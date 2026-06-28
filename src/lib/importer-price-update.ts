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
import { comparePriceTiers, type PriceComparison, type CurrentTier } from "@/services/priceComparison";
import { persistStructured } from "@/lib/importer-structured-persistence";
import type { ImportedProduct } from "@/types/importedProduct";

const db = supabase as any;

export interface ImportedProductRow {
  id: string;
  name: string;
  source_url: string | null;
  supplier_sku: string | null;
  cost_price: number | null;
  sale_price: number | null;
  margin_percent: number | null;
  quantity_price_table: any[] | null;
}

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
    .select("id, name, source_url, supplier_sku, cost_price, sale_price, margin_percent, quantity_price_table")
    .eq("company_id", companyId)
    .eq("origin", "supplier_import")
    .not("source_url", "is", null)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data || []) as ImportedProductRow[];
}

function currentTiers(row: ImportedProductRow): CurrentTier[] {
  return (row.quantity_price_table || [])
    .map((t: any) => ({ quantity: Number(t.quantity), cost: Number(t.price) }))
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
 * Aplica o novo CUSTO do fornecedor ao produto. Não altera sale_price/margem.
 * - Faixas existentes: mantêm o preço de venda atual; atualizam custo.
 * - Faixas novas: preço de venda sugerido = custo * (1 + margem/100).
 * - Faixas removidas pelo fornecedor: saem da tabela de custo.
 */
export async function applyCostUpdate(result: PriceCheckResult, companyId: string): Promise<void> {
  const { product: row, fresh } = result;
  if (!fresh) return;

  const margin = Number(row.margin_percent) || 50;
  const factor = 1 + margin / 100;
  const freshTiers = fresh.variants[0]?.price_tiers || [];

  // Mapa do preço de venda atual por quantidade (para preservar).
  const oldSellByQty = new Map<number, number>();
  for (const t of row.quantity_price_table || []) {
    if (t?.quantity != null && t?.sellPrice != null) oldSellByQty.set(Number(t.quantity), Number(t.sellPrice));
  }

  const newTable = freshTiers.map((t) => {
    const existingSell = oldSellByQty.get(t.quantity);
    const sellPrice = existingSell ?? parseFloat((t.total_price * factor).toFixed(2));
    return {
      quantity: t.quantity,
      price: t.total_price, // custo do fornecedor
      unitPrice: t.unit_price,
      sellPrice, // preço de venda preservado (ou sugerido para faixas novas)
      unitSellPrice: parseFloat((sellPrice / t.quantity).toFixed(4)),
      external_id: t.external_id ?? null,
      collected_at: t.collected_at,
    };
  });

  const newBaseCost = freshTiers[0]?.total_price ?? row.cost_price ?? 0;

  const { error } = await db
    .from("products")
    .update({
      // SOMENTE custo — preço de venda/margem preservados.
      cost_price: newBaseCost,
      base_cost: newBaseCost,
      quantity_price_table: newTable,
      quantity_prices: newTable,
      production_deadline: fresh.production_time?.original_production_time ?? undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);
  if (error) throw error;

  // Re-sincroniza o grafo estruturado com os novos custos (best-effort).
  await persistStructured(row.id, fresh, companyId);

  // Histórico (best-effort).
  db.from("supplier_imports")
    .insert({
      company_id: companyId,
      source_url: row.source_url,
      supplier_domain: fresh.supplier_domain,
      extraction_status: "price_updated",
      product_name: row.name,
      supplier_sku: row.supplier_sku ?? fresh.external_id ?? null,
      current_price: newBaseCost,
    })
    .then(undefined, () => {});
}
