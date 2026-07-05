/**
 * Orquestração do IMPORTADOR DE PRODUTOS POR LINK.
 *
 * Funções puras e helpers de alto nível: validação/classificação de URL,
 * detecção do tipo de página, chaves de deduplicação (seção 26) e construção
 * do registro a ser persistido. A raspagem em si é feita pelas server functions
 * em `@/integrations/supabase/importer-actions` (server-side, anti-SSRF).
 */

import type { ImportPageType, ImportedProduct, UrlValidationResult } from "@/types/importedProduct";
import type { ExtractedProductData } from "@/lib/supplier-extractor";
import { validateSupplierUrl } from "@/services/urlValidator";
import { externalIdFromUrl } from "@/services/futuraImParser";
import { normalizeKey } from "@/services/productNormalizer";

/** Detecta o tipo de página a partir da URL (e, opcionalmente, do HTML). */
export function detectPageType(url: string, html?: string): ImportPageType {
  const u = url.toLowerCase();
  if (/\/produto\//.test(u) || /[?&]id=\d+/.test(u)) return "product";
  if (/todos-?(os-)?produtos/.test(u)) return "catalog";
  // Validação por conteúdo (não depender só do caminho — seção 2).
  if (html) {
    const productLinks = (html.match(/\/produto\/[^"'\s]*\?id=\d+/g) || []).length;
    if (productLinks > 5) return "catalog";
    if (/application\/ld\+json[^>]*>[^<]*"@type"\s*:\s*"Product"/i.test(html)) return "product";
  }
  return "unknown";
}

/** Valida e classifica uma URL de importação (allowlist + tipo + id externo). */
export function validateImportUrl(url: string): UrlValidationResult {
  const base = validateSupplierUrl(url);
  if (!base.ok) {
    return { ok: false, reason: base.reason };
  }
  return {
    ok: true,
    url: base.url,
    domain: base.domain,
    page_type: detectPageType(base.url!),
    external_id: externalIdFromUrl(base.url!),
  };
}

/** Quebra um texto em várias linhas/URLs (modo lote — seção 2). */
export function parseBatchUrls(text: string): string[] {
  return Array.from(
    new Set(
      (text || "")
        .split(/[\r\n]+/)
        .map((l) => l.trim())
        .filter(Boolean),
    ),
  );
}

// ---------------------------------------------------------------------------
// Deduplicação (seção 26)
// ---------------------------------------------------------------------------

export interface DedupKeys {
  externalKey?: string; // supplier + external_id
  urlKey?: string; // supplier + url canônica
  skuKey?: string; // supplier + sku
  hashKey: string; // hash dos atributos principais
}

function canonicalizeUrl(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    const id = u.searchParams.get("id");
    // canônica = caminho + id (ignora demais query params/fragment)
    return `${u.hostname.replace(/^www\./, "")}${u.pathname}${id ? `?id=${id}` : ""}`;
  } catch {
    return url;
  }
}

/** Hash estável e simples (FNV-1a) — suficiente para chave de deduplicação. */
export function stableHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

/** Computa as chaves de deduplicação de um produto importado. */
export function computeDedupKeys(product: ImportedProduct): DedupKeys {
  const supplier = normalizeKey(product.supplier);
  const canonical = canonicalizeUrl(product.canonical_url || product.source_url);

  const mainAttrs = [
    product.normalized_name,
    product.specifications.find((s) => s.normalized_name === "material")?.normalized_value || "",
    product.specifications.find((s) => s.normalized_name === "formato")?.normalized_value || "",
    product.specifications.find((s) => s.normalized_name === "cor")?.normalized_value || "",
  ].join("|");

  return {
    externalKey: product.external_id ? `${supplier}:id:${product.external_id}` : undefined,
    urlKey: canonical ? `${supplier}:url:${canonical}` : undefined,
    skuKey: product.variants[0]?.sku ? `${supplier}:sku:${product.variants[0].sku}` : undefined,
    hashKey: `${supplier}:hash:${stableHash(mainAttrs)}`,
  };
}

// ---------------------------------------------------------------------------
// Mapeamento para a tabela `products` existente (persistência da fundação)
// ---------------------------------------------------------------------------

export interface BuildProductRowOptions {
  companyId: string;
  marginPercent: number;
  supplierId?: string | null;
  supplierName?: string | null;
  /** "Usar descrição somente como referência interna" (seção 18). */
  descriptionInternalOnly?: boolean;
}

/**
 * Constrói o registro para a tabela `products` a partir do produto importado.
 * Mantém custo do fornecedor e preço de venda SEPARADOS (seção 27): o custo é
 * o preço do fornecedor; o preço de venda aplica a margem informada.
 *
 * Importante: nenhuma faixa de preço é fabricada — usamos apenas as tiragens
 * realmente coletadas.
 */
/**
 * Calcula o prazo total: dias do FORNECEDOR (coletado) + NOSSOS dias (editável).
 * Retorna { supplierDays, ourDays, totalDays }.
 */
export function computeDeadlineDays(product: ImportedProduct): {
  supplierDays: number;
  ourDays: number;
  totalDays: number;
} {
  const pt = product.production_time;
  const supplierDays = pt?.production_days ?? 0;
  const ourDays = pt?.our_production_days ?? 0;
  return { supplierDays, ourDays, totalDays: supplierDays + ourDays };
}

/** Texto do prazo para gravar em `products.production_deadline`. */
export function buildDeadlineText(product: ImportedProduct): string | null {
  const pt = product.production_time;
  if (!pt) return null;
  const { supplierDays, ourDays, totalDays } = computeDeadlineDays(product);
  const supplierLabel = pt.original_production_time || (supplierDays ? `${supplierDays} dias` : "—");
  if (!ourDays) return supplierLabel;
  return `Total: ${totalDays} dias (fornecedor ${supplierDays} + nossos ${ourDays})${pt.freight_not_included ? " + frete" : ""}`;
}

export function buildProductRow(product: ImportedProduct, opts: BuildProductRowOptions) {
  const margin = opts.marginPercent ?? 50;
  const factor = 1 + margin / 100;
  const tiers = product.variants[0]?.price_tiers || [];
  const baseCost = tiers.length ? tiers[0].total_price : 0;
  const salePrice = parseFloat((baseCost * factor).toFixed(2));

  const quantityPriceTable = tiers.map((t) => ({
    quantity: t.quantity,
    price: t.total_price,
    unitPrice: t.unit_price,
    sellPrice: parseFloat((t.total_price * factor).toFixed(2)),
    unitSellPrice: parseFloat(((t.total_price * factor) / t.quantity).toFixed(4)),
    external_id: t.external_id ?? null,
    collected_at: t.collected_at,
  }));

  const specifications = Object.fromEntries(product.specifications.map((s) => [s.name, s.value]));

  // Variações do fornecedor (Material/Formato/Cor/Enobrecimento/Acabamento...).
  // Cada eixo já traz TODAS as opções reais numa única página (com id externo),
  // então a lista completa é gravada mesmo sem a varredura multi-página. É o
  // campo lido pelo botão "Importar do fornecedor" do editor de produto.
  // `cost` por opção = custo real da combinação (só após varredura completa);
  // `sell` aplica a margem. Sem varredura, ficam null e o editor herda o
  // custo/preço-base do produto.
  const variations = product.variant_axes.map((a) => ({
    name: a.name,
    normalized_name: a.normalized_name,
    values: a.options.map((o) => {
      const cost = o.unit_price ?? null;
      return {
        value: o.value,
        external_id: o.external_id ?? null,
        url: o.url ?? null,
        selected: o.selected ?? false,
        cost,
        sell: cost != null ? parseFloat((cost * factor).toFixed(2)) : null,
        ref_quantity: o.ref_quantity ?? null,
      };
    }),
  }));

  // Serviços/acabamentos extras (ex.: "Kit Canetas Marcador + R$ 29,99").
  const extraServices = product.extras.map((e) => ({
    name: e.name,
    price: e.price,
    currency: e.currency || "BRL",
    extra_days: e.extra_days ?? null,
    url: e.url ?? null,
  }));

  // Gabaritos / templates de arte quando o fornecedor disponibiliza.
  const templateLinks = product.templates.map((t) => ({
    name: t.name ?? null,
    url: t.url,
    type: t.type ?? null,
    format: t.format ?? null,
  }));

  const smallestQty = tiers.length ? Math.min(...tiers.map((t) => t.quantity)) : null;

  return {
    company_id: opts.companyId,
    name: product.normalized_name,
    commercial_name: product.original_name,
    type: "product" as const,
    origin: "supplier_import" as const,
    supplier_id: opts.supplierId ?? null,
    supplier_name: opts.supplierName ?? product.supplier,
    supplier_sku: product.external_id ?? null,
    source_url: product.source_url,
    category: product.classification.category,
    subcategory: product.classification.subcategory,
    description: opts.descriptionInternalOnly ? null : product.description ?? null,
    technical_description: opts.descriptionInternalOnly ? product.description ?? null : null,
    main_image_url: product.images.find((i) => i.is_main)?.url ?? null,
    image_url: product.images.find((i) => i.is_main)?.url ?? null,
    gallery_images: product.images.map((i) => i.url),
    cost_price: baseCost,
    base_cost: baseCost,
    margin_percent: margin,
    target_margin: margin,
    sale_price: salePrice,
    suggested_price: salePrice,
    min_price: parseFloat((salePrice * 0.9).toFixed(2)),
    unit_measure: product.variants[0]?.price_tiers[0]?.unit || "Unidade",
    minimum_quantity: smallestQty,
    quantity_price_table: quantityPriceTable,
    quantity_prices: quantityPriceTable,
    specifications,
    variations,
    extra_services: extraServices,
    template_links: templateLinks,
    avg_production_time: product.production_time?.original_production_time ?? null,
    production_deadline: buildDeadlineText(product),
    // review_required/classification_confidence vivem no grafo estruturado
    // (product_category_mappings) — não gravamos em `products` para não exigir
    // colunas que podem não existir no banco antes da migration.
    status: "Ativo",
    imported_from_supplier: true,
  };
}

/**
 * Converte o produto estruturado (FuturaIM) para o formato `ExtractedProductData`
 * usado pela tela de revisão existente. Assim o importador dedicado entrega
 * dados REAIS (sem fabricação) ao mesmo fluxo de prévia/aprovação.
 */
export function importedToExtracted(product: ImportedProduct): ExtractedProductData {
  const tiers = product.variants[0]?.price_tiers || [];
  const firstTier = tiers[0];

  const specifications: Record<string, string> = Object.fromEntries(
    product.specifications.map((s) => [s.name, s.value]),
  );
  if (product.description) specifications["Descrição"] = product.description;
  if (product.production_time?.original_production_time)
    specifications["Prazo"] = product.production_time.original_production_time;
  if (product.classification.production_sector !== "Não identificado")
    specifications["Técnica"] = product.classification.production_sector;
  if (product.classification.segments.length)
    specifications["Segmento"] = product.classification.segments.join(", ");

  return {
    product_name: product.original_name,
    supplier_sku: product.external_id || "",
    category: product.classification.category,
    subcategory: product.classification.subcategory,
    main_image_url: product.images.find((i) => i.is_main)?.url || "",
    gallery_images: product.images.map((i) => i.url),
    original_price: firstTier?.old_price || firstTier?.total_price || 0,
    current_price: firstTier?.total_price || 0,
    discount_percent: firstTier?.discount_percent || 0,
    production_deadline: product.production_time?.original_production_time || "",
    specifications,
    variations: product.variant_axes.map((a) => ({
      name: a.name,
      values: a.options.map((o) => o.value),
    })),
    quantity_prices: tiers.map((t) => ({
      quantity: t.quantity,
      price: t.total_price,
      unitPrice: t.unit_price,
    })),
    extra_services: product.extras.map((e) => ({ name: e.name, price: e.price })),
    template_links: product.templates.map((t) => ({ name: t.name, url: t.url })),
    raw_text_sample: "",
  };
}
