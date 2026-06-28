/**
 * Persistência do importador dedicado: grava o produto estruturado na tabela
 * `products` aplicando deduplicação (seção 26). NUNCA salva sem ser chamado
 * explicitamente após a aprovação do usuário (a tela só chama isto no clique
 * de "Salvar selecionados").
 */

import { supabase } from "@/integrations/supabase/client";
import type { ImportedProduct } from "@/types/importedProduct";
import { buildProductRow, type BuildProductRowOptions } from "@/services/productImporterService";

export interface PersistOptions extends Omit<BuildProductRowOptions, "companyId"> {
  companyId: string;
  /** Se false e o produto já existir, não sobrescreve (apenas reporta). */
  updateExisting?: boolean;
}

export interface PersistResult {
  productId: string | null;
  action: "created" | "updated" | "skipped";
  message?: string;
}

/** Localiza um produto existente por (source_url) ou (supplier_sku) dentro da empresa. */
async function findExisting(product: ImportedProduct, companyId: string): Promise<string | null> {
  if (product.source_url) {
    const { data } = await supabase
      .from("products")
      .select("id")
      .eq("company_id", companyId)
      .eq("source_url", product.source_url)
      .maybeSingle();
    if (data?.id) return data.id;
  }
  if (product.external_id) {
    const { data } = await supabase
      .from("products")
      .select("id")
      .eq("company_id", companyId)
      .eq("supplier_sku", product.external_id)
      .eq("origin", "supplier_import")
      .maybeSingle();
    if (data?.id) return data.id;
  }
  return null;
}

export async function persistImportedProduct(
  product: ImportedProduct,
  opts: PersistOptions,
): Promise<PersistResult> {
  const row = buildProductRow(product, opts);
  const existingId = await findExisting(product, opts.companyId);

  if (existingId && !opts.updateExisting) {
    return { productId: existingId, action: "skipped", message: "Produto já existe (atualização desativada)." };
  }

  if (existingId) {
    const { error } = await supabase
      .from("products")
      // colunas novas (subcategory/review_required/...) ainda não refletidas em types.ts
      .update({ ...row, updated_at: new Date().toISOString() } as any)
      .eq("id", existingId);
    if (error) throw error;
    return { productId: existingId, action: "updated" };
  }

  const { data, error } = await supabase
    .from("products")
    .insert({ ...row, created_at: new Date().toISOString() } as any)
    .select("id")
    .single();
  if (error) throw error;
  return { productId: data.id, action: "created" };
}
