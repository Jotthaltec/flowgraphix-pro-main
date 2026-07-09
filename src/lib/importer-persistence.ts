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

/**
 * Normaliza uma URL para comparação de identidade do produto.
 * Remove protocolo, "www.", barra final e parâmetros de rastreamento (utm_*, fbclid, …),
 * MAS preserva os demais query params — muitos fornecedores (ex.: FuturaIM ?id=4627)
 * usam o query string como identidade do produto.
 */
export function normalizeUrlForMatch(raw?: string | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    const TRACKING = /^(utm_|fbclid|gclid|gclsrc|mc_|_hs|ref|source)$/i;
    const params = [...u.searchParams.entries()]
      .filter(([k]) => !TRACKING.test(k))
      .sort(([a], [b]) => a.localeCompare(b));
    const host = u.host.replace(/^www\./i, "").toLowerCase();
    const path = u.pathname.replace(/\/+$/, "").toLowerCase();
    const query = params.map(([k, v]) => `${k}=${v}`).join("&");
    return `${host}${path}${query ? `?${query}` : ""}`;
  } catch {
    return raw.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "").toLowerCase();
  }
}

/** Normaliza um nome para comparação (minúsculo, sem acentos, espaços colapsados). */
function normalizeName(name?: string | null): string {
  return (name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export interface ExistingProductMatch {
  id: string;
  name: string | null;
  matched_by: "source_url" | "supplier_sku" | "name_supplier";
}

/**
 * Localiza um produto já existente na base (mesma empresa), reconhecendo-o por:
 *   1. source_url normalizada (barra final / www / http-https / tracking não importam);
 *   2. supplier_sku (external_id) em produtos de fornecedor;
 *   3. fallback: mesmo nome + mesmo fornecedor (evita duplicar quando o link mudou).
 * Retorna o produto correspondente ou null.
 */
export async function findExistingProduct(
  product: ImportedProduct,
  companyId: string,
): Promise<ExistingProductMatch | null> {
  // 1. Por source_url normalizada
  const targetUrl = normalizeUrlForMatch(product.source_url);
  if (targetUrl) {
    const { data: candidates } = await supabase
      .from("products")
      .select("id, name, source_url")
      .eq("company_id", companyId)
      .not("source_url", "is", null);
    const hit = (candidates || []).find(
      (c: any) => normalizeUrlForMatch(c.source_url) === targetUrl,
    );
    if (hit?.id) return { id: hit.id, name: hit.name ?? null, matched_by: "source_url" };
  }

  // 2. Por supplier_sku (external_id)
  if (product.external_id) {
    const { data } = await supabase
      .from("products")
      .select("id, name")
      .eq("company_id", companyId)
      .eq("supplier_sku", product.external_id)
      .eq("origin", "supplier_import")
      .maybeSingle();
    if (data?.id) return { id: data.id, name: data.name ?? null, matched_by: "supplier_sku" };
  }

  // 3. Fallback: mesmo nome + mesmo fornecedor (link pode ter mudado)
  const targetName = normalizeName(product.original_name);
  if (targetName && product.supplier) {
    const { data: byName } = await supabase
      .from("products")
      .select("id, name, supplier_name")
      .eq("company_id", companyId)
      .eq("origin", "supplier_import")
      .ilike("supplier_name", product.supplier);
    const hit = (byName || []).find((c: any) => normalizeName(c.name) === targetName);
    if (hit?.id) return { id: hit.id, name: hit.name ?? null, matched_by: "name_supplier" };
  }

  return null;
}

/** Compat: retorna apenas o id do produto existente (ou null). */
async function findExisting(product: ImportedProduct, companyId: string): Promise<string | null> {
  const match = await findExistingProduct(product, companyId);
  return match?.id ?? null;
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
