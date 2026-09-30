/**
 * Adaptador GENÉRICO baseado em JSON-LD schema.org/Product (§6, prioridade 5).
 *
 * Funciona em QUALQUER site que publique dados estruturados de produto — a base
 * mais comum de e-commerce (Google exige para rich results). Não é mock: lê o
 * bloco `<script type="application/ld+json">`, encontra o nó `Product`, e
 * preenche o modelo canônico com o que realmente existe. Campo sem evidência
 * fica vazio e gera warning; nada é fabricado.
 *
 * Reaproveita utilitários já testados (extractJsonLd, parsePriceBR, classifier).
 */

import type {
  ImportedImage,
  ImportedPriceTier,
  ImportedProduct,
  ImportedVariant,
} from "@/types/importedProduct";
import { extractJsonLd, externalIdFromUrl } from "@/services/futuraImParser";
import { cleanText, parsePriceBR, slugify } from "@/services/productNormalizer";
import { classifyProduct } from "@/services/productClassifier";
import type { AdapterMatchContext, SupplierAdapter } from "./types";

// --- helpers de leitura tolerante do JSON-LD ------------------------------

/** Nó JSON-LD: objeto arbitrário vindo da página, lido campo a campo. */
type LdNode = { [key: string]: unknown };

function isNode(v: unknown): v is LdNode {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/** Texto de um campo escalar (string ou número); qualquer outra coisa vira "". */
function text(v: unknown): string {
  return typeof v === "string" || typeof v === "number" ? String(v) : "";
}

/** Valor numérico ou textual aceito por parsePriceBR; o resto é ausência. */
function priceLike(v: unknown): string | number | null {
  return typeof v === "string" || typeof v === "number" ? v : null;
}

function typesOf(node: unknown): string[] {
  const t = isNode(node) ? node["@type"] : undefined;
  if (!t) return [];
  return (Array.isArray(t) ? t : [t]).map((x) => String(x).toLowerCase());
}

/** Achata `@graph` e arrays aninhados num único vetor de nós. */
function flattenNodes(blocks: unknown[]): LdNode[] {
  const out: LdNode[] = [];
  const visit = (n: unknown) => {
    if (Array.isArray(n)) return n.forEach(visit);
    if (!isNode(n)) return;
    out.push(n);
    if (Array.isArray(n["@graph"])) n["@graph"].forEach(visit);
  };
  blocks.forEach(visit);
  return out;
}

function findProductNode(nodes: LdNode[]): LdNode | null {
  return nodes.find((n) => typesOf(n).includes("product")) ?? null;
}

function findBreadcrumb(nodes: LdNode[]): string[] {
  const bc = nodes.find((n) => typesOf(n).includes("breadcrumblist"));
  const items = bc?.itemListElement;
  if (!Array.isArray(items)) return [];
  return items
    .map((el) =>
      isNode(el) ? cleanText(text(el.name) || (isNode(el.item) ? text(el.item.name) : "")) : "",
    )
    .filter(Boolean);
}

/** Normaliza `image` (string | array | {url}) numa lista de URLs. */
function readImages(image: unknown): ImportedImage[] {
  const urls: string[] = [];
  const push = (v: unknown) => {
    if (!v) return;
    if (typeof v === "string") urls.push(v);
    else if (isNode(v) && typeof v.url === "string") urls.push(v.url);
  };
  if (Array.isArray(image)) image.forEach(push);
  else push(image);
  return urls
    .filter((u) => /^https?:\/\//i.test(u))
    .map((url, i) => ({ url, order: i, is_main: i === 0 }));
}

/** Extrai a primeira oferta útil de `offers` (Offer | AggregateOffer | array). */
function readOffer(offers: unknown): { price?: number; currency?: string; availability?: string } {
  if (!offers) return {};
  const first = Array.isArray(offers) ? offers[0] : offers;
  if (!isNode(first)) return {};
  // AggregateOffer usa lowPrice; Offer usa price.
  const rawPrice = priceLike(first.price ?? first.lowPrice ?? first.highPrice);
  const price = rawPrice != null ? parsePriceBR(rawPrice) : undefined;
  const currency = typeof first.priceCurrency === "string" ? first.priceCurrency : undefined;
  const availability = typeof first.availability === "string" ? first.availability : undefined;
  return { price: price && price > 0 ? price : undefined, currency, availability };
}

function readBrand(brand: unknown): string | undefined {
  if (!brand) return undefined;
  if (typeof brand === "string") return cleanText(brand);
  if (isNode(brand) && typeof brand.name === "string") return cleanText(brand.name);
  return undefined;
}

// --- adaptador --------------------------------------------------------------

export const GenericJsonLdAdapter: SupplierAdapter = {
  key: "generic_jsonld",
  label: "Genérico (JSON-LD schema.org)",
  domains: [], // genérico — fallback para qualquer domínio

  matchScore(ctx: AdapterMatchContext) {
    const html = ctx.html || "";
    if (!/application\/ld\+json/i.test(html)) {
      return { score: 0, reason: "sem JSON-LD na página" };
    }
    const nodes = flattenNodes(extractJsonLd(html));
    const product = findProductNode(nodes);
    if (!product) return { score: 0.05, reason: "JSON-LD presente, mas sem @type Product" };
    const hasName = !!product.name;
    const hasOffer = !!product.offers;
    // Confiança moderada: bom sinal, mas não é adaptador dedicado.
    const score = 0.5 + (hasName ? 0.1 : 0) + (hasOffer ? 0.1 : 0);
    return { score, reason: `JSON-LD Product encontrado${hasOffer ? " com oferta" : ""}` };
  },

  parseProduct(html: string, url: string): ImportedProduct {
    const warnings: string[] = [];
    const errors: string[] = [];
    const collected_at = new Date().toISOString();
    const domain = safeDomain(url);

    const nodes = flattenNodes(extractJsonLd(html));
    const product = findProductNode(nodes);

    if (!product) {
      errors.push("Nenhum produto JSON-LD (schema.org/Product) encontrado na página.");
      return emptyProduct(url, domain, collected_at, warnings, errors);
    }

    const original_name = cleanText(text(product.name));
    if (!original_name) warnings.push("Produto sem nome no JSON-LD.");

    const breadcrumb = findBreadcrumb(nodes);
    const images = readImages(product.image);
    if (!images.length) warnings.push("Produto sem imagens no JSON-LD.");

    const { price, currency, availability } = readOffer(product.offers);
    if (price == null) warnings.push("Produto sem preço no JSON-LD.");

    const sku = text(product.sku) || undefined;
    const external_id = sku || externalIdFromUrl(url);
    const brand = readBrand(product.brand);
    const description = cleanText(text(product.description)) || undefined;

    const currencyCode = currency || "BRL";
    const inStock = availability
      ? /InStock|LimitedAvailability|PreOrder|BackOrder/i.test(availability)
      : price != null;

    const price_tiers: ImportedPriceTier[] =
      price != null
        ? [
            {
              quantity: 1,
              unit: "unidade",
              total_price: price,
              unit_price: price,
              currency: currencyCode,
              available: inStock,
              external_id,
              collected_at,
            },
          ]
        : [];

    const classification = classifyProduct({
      name: original_name,
      breadcrumb,
      description,
    });

    const variant: ImportedVariant = {
      external_id,
      sku,
      title: original_name || "Produto",
      url,
      canonical_url: url,
      attributes: [],
      available: inStock,
      price_tiers,
      raw_attributes: {},
    };

    const ratingNode = isNode(product.aggregateRating) ? product.aggregateRating : null;
    const ratingValue = priceLike(ratingNode?.ratingValue);
    const reviewCount = priceLike(ratingNode?.reviewCount) ?? priceLike(ratingNode?.ratingCount);
    const rating_average = ratingValue != null ? parsePriceBR(ratingValue) : undefined;
    const rating_count = reviewCount != null ? Math.round(parsePriceBR(reviewCount)) : undefined;

    return {
      page_type: "product",
      source_url: url,
      canonical_url: url,
      external_id,
      supplier: domain,
      supplier_domain: domain,
      brand,
      original_name,
      normalized_name: original_name,
      slug: slugify(original_name),
      breadcrumb,
      base_product: original_name || undefined,
      description,
      specifications: [],
      available: inStock,
      is_on_sale: false,
      unavailable: !inStock,
      rating_average,
      rating_count,
      classification,
      variant_axes: [],
      variants: [variant],
      variant_scan_status: "selected_only",
      images,
      templates: [],
      extras: [],
      collected_at,
      warnings,
      errors,
    };
  },
};

function safeDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function emptyProduct(
  url: string,
  domain: string,
  collected_at: string,
  warnings: string[],
  errors: string[],
): ImportedProduct {
  return {
    page_type: "unknown",
    source_url: url,
    supplier: domain,
    supplier_domain: domain,
    original_name: "",
    normalized_name: "",
    breadcrumb: [],
    specifications: [],
    available: false,
    unavailable: true,
    classification: {
      category: "Não classificado",
      subcategory: "",
      confidence: 0,
      reason: "Sem dados estruturados.",
      tags: [],
      segments: [],
      production_sector: "",
      review_required: true,
    },
    variant_axes: [],
    variants: [],
    variant_scan_status: "pending",
    images: [],
    templates: [],
    extras: [],
    collected_at,
    warnings,
    errors,
  };
}
