/**
 * Modo "Atualizar preços do fornecedor" (seção 27).
 *
 * 1. Carrega produtos importados (origin=supplier_import com source_url).
 * 2. Reabre o link original (server-side, anti-SSRF) e coleta o custo atual.
 * 3. Compara as tabelas de preço (faixas alteradas/novas/removidas/indisponível).
 * 4. Aplica SOMENTE o custo do fornecedor — nunca o preço de venda da gráfica.
 * 5. Registra histórico.
 *
 * Mantém separados: custo do fornecedor (atualizado aqui) x preço de venda /
 * margem (preservados). Para faixas existentes, o preço de venda é mantido como
 * estava; para faixas novas, calcula-se uma sugestão a partir da margem do
 * produto (que o usuário pode revisar depois).
 */

import { supabase } from "@/integrations/supabase/client";
import { analyzeSupplierLink } from "@/integrations/supabase/importer-actions";
import {
  comparePriceTiers,
  type PriceComparison,
  type CurrentTier,
} from "@/services/priceComparison";
import { persistStructured } from "@/lib/importer-structured-persistence";
import type { ImportedProduct } from "@/types/importedProduct";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  buildPriceTable,
  mergeDeadline,
  type PriceTableResult,
  type StoredPriceTier,
} from "@/services/supplierPricing";

const db = supabase;

export interface ImportedProductRow {
  id: string;
  name: string;
  source_url: string | null;
  supplier_sku: string | null;
  cost_price: number | null;
  sale_price: number | null;
  margin_percent: number | null;
  quantity_price_table: StoredTier[] | null;
  production_deadline: string | null;
}

/** Linha da tabela de tiragens gravada em products.quantity_price_table. */
export type StoredTier = Partial<StoredPriceTier>;

export interface PriceCheckResult {
  product: ImportedProductRow;
  fresh?: ImportedProduct;
  comparison?: PriceComparison;
  error?: string;
}

/** Carrega os produtos importados elegíveis para atualização de preço. */
export async function loadImportedProducts(companyId: string): Promise<ImportedProductRow[]> {
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, name, source_url, supplier_sku, cost_price, sale_price, margin_percent, quantity_price_table, production_deadline",
    )
    .eq("company_id", companyId)
    .eq("origin", "supplier_import")
    .not("source_url", "is", null)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => ({
    ...row,
    quantity_price_table: Array.isArray(row.quantity_price_table)
      ? (row.quantity_price_table as StoredTier[])
      : null,
  }));
}

function currentTiers(row: ImportedProductRow): CurrentTier[] {
  return (row.quantity_price_table || [])
    .map((t) => ({ quantity: Number(t.quantity), cost: Number(t.price) }))
    .filter((t: CurrentTier) => t.quantity > 0);
}

/** Reabre o link original e compara os preços, sem gravar nada. */
export async function checkProductPrice(row: ImportedProductRow): Promise<PriceCheckResult> {
  if (!row.source_url) return { product: row, error: "Produto sem link de origem." };
  const res = await analyzeSupplierLink({ data: { url: row.source_url } });
  if (!res.success) return { product: row, error: res.error };

  const fresh = res.product;
  const fresh_tiers = (fresh.variants[0]?.price_tiers || []).map((t) => ({
    quantity: t.quantity,
    total_price: t.total_price,
  }));
  const comparison = comparePriceTiers(currentTiers(row), fresh_tiers, fresh.unavailable === true);
  return { product: row, fresh, comparison };
}

/**
 * Aplica a coleta do fornecedor ao produto (regra em services/supplierPricing):
 * - mudança normal: atualiza o custo e PRESERVA o preço de venda;
 * - promoção do fornecedor ("de/por"): grava o nosso "por" com o mesmo % de
 *   desconto; quando a promoção acaba, o "por" sai e vale o preço normal;
 * - prazo: mantém os "nossos dias" de produção somados ao do fornecedor.
 * A gravação em products dispara a republicação na loja (fila de sincronização).
 */
export async function applyCostUpdate(
  result: PriceCheckResult,
  companyId: string,
  client: SupabaseClient<Database> = db,
): Promise<PriceTableResult | undefined> {
  const { product: row, fresh } = result;
  if (!fresh) return;

  const margin = Number(row.margin_percent) || 50;
  const freshTiers = fresh.variants[0]?.price_tiers || [];
  const pricing = buildPriceTable(row.quantity_price_table, freshTiers, margin);
  const newTable = pricing.table;

  const newBaseCost = freshTiers[0]?.total_price ?? row.cost_price ?? 0;

  const { error } = await client
    .from("products")
    .update({
      // Custo e promoção — o preço de venda normal é preservado. — preço de venda/margem preservados.
      cost_price: newBaseCost,
      base_cost: newBaseCost,
      quantity_price_table: newTable as unknown as Json,
      quantity_prices: newTable as unknown as Json,
      production_deadline:
        mergeDeadline(
          row.production_deadline,
          fresh.production_time?.original_production_time,
          fresh.production_time?.production_days,
          fresh.production_time?.freight_not_included,
        ) ?? undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);
  if (error) throw error;

  // Re-sincroniza o grafo estruturado com os novos custos (best-effort).
  await persistStructured(row.id, fresh, companyId, client);

  // Histórico (best-effort).
  client
    .from("supplier_imports")
    .insert({
      company_id: companyId,
      source_url: row.source_url ?? fresh.source_url,
      supplier_domain: fresh.supplier_domain,
      extraction_status: "price_updated",
      product_name: row.name,
      supplier_sku: row.supplier_sku ?? fresh.external_id ?? null,
      current_price: newBaseCost,
    })
    .then(undefined, () => {});

  return pricing;
}
