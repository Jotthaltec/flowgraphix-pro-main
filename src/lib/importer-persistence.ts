/**
 * Persistência do importador dedicado: grava o produto estruturado na tabela
 * `products` aplicando deduplicação (seção 26). NUNCA salva sem ser chamado
 * explicitamente após a aprovação do usuário (a tela só chama isto no clique
 * de "Salvar selecionados").
 */

import { supabase } from "@/integrations/supabase/client";
import type { ImportedProduct } from "@/types/importedProduct";
import { buildProductRow, type BuildProductRowOptions } from "@/services/productImporterService";
import { persistStructured } from "@/lib/importer-structured-persistence";
import { copyImagesToStorage } from "@/lib/importer-image-storage";
import { resolveSupplierByUrl } from "@/lib/supplier-link";

export interface PersistOptions extends Omit<BuildProductRowOptions, "companyId"> {
  companyId: string;
  /** Se false e o produto já existir, não sobrescreve (apenas reporta). */
  updateExisting?: boolean;
  /** Grava também o grafo estruturado (variants/tiers/attributes/...). Padrão: true. */
  writeStructured?: boolean;
  /** Copia as imagens para o Supabase Storage (seção 17). Padrão: false (mantém URL externa). */
  copyImages?: boolean;
}

export interface PersistResult {
  productId: string | null;
  action: "created" | "updated" | "skipped";
  message?: string;
  structuredWarnings?: string[];
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
  // Fase 3 — vínculo produto↔fornecedor: se o chamador não informou um
  // supplierId explícito, encontra/cria o fornecedor pelo domínio do link de
  // origem. Garante que todo produto importado fique ligado a um `suppliers`
  // real (base da compra assistida). Best-effort: nunca derruba a importação.
  let effectiveOpts = opts;
  if (!opts.supplierId) {
    try {
      const resolved = await resolveSupplierByUrl(opts.companyId, product.source_url, product.supplier);
      if (resolved) {
        effectiveOpts = {
          ...opts,
          supplierId: resolved.id,
          supplierName: opts.supplierName ?? resolved.name,
        };
      }
    } catch {
      // segue sem o vínculo; o produto ainda é salvo com supplier_name textual.
    }
  }

  const row = buildProductRow(product, effectiveOpts);
  const existingId = await findExisting(product, opts.companyId);

  if (existingId && !opts.updateExisting) {
    return { productId: existingId, action: "skipped", message: "Produto já existe (atualização desativada)." };
  }

  let productId: string;
  let action: "created" | "updated";

  if (existingId) {
    const { error } = await supabase
      .from("products")
      // colunas novas (subcategory/review_required/...) ainda não refletidas em types.ts
      .update({ ...row, updated_at: new Date().toISOString() } as any)
      .eq("id", existingId);
    if (error) throw error;
    productId = existingId;
    action = "updated";
  } else {
    const { data, error } = await supabase
      .from("products")
      .insert({ ...row, created_at: new Date().toISOString() } as any)
      .select("id")
      .single();
    if (error) throw error;
    productId = data.id;
    action = "created";
  }

  const structuredWarnings: string[] = [];

  // Copia imagens para o Storage (opcional) ANTES do grafo estruturado, para
  // que as URLs gravadas já sejam as do Storage.
  if (opts.copyImages && product.images.length) {
    try {
      const res = await copyImagesToStorage(product.images, productId, opts.companyId);
      product.images = res.images;
      structuredWarnings.push(...res.warnings);
      const main = res.images.find((i) => i.is_main)?.url ?? res.images[0]?.url ?? null;
      await supabase
        .from("products")
        .update({ image_url: main, main_image_url: main, gallery_images: res.images.map((i) => i.url) } as any)
        .eq("id", productId);
    } catch (e: any) {
      structuredWarnings.push(`cópia de imagens: ${e?.message || e}`);
    }
  }

  // Grava o grafo estruturado (best-effort — não derruba o salvamento principal).
  if (opts.writeStructured !== false) {
    const structured = await persistStructured(productId, product, opts.companyId);
    structuredWarnings.push(...structured.warnings);
  }

  return { productId, action, structuredWarnings: structuredWarnings.length ? structuredWarnings : undefined };
}
