/**
 * Parser específico da FuturaIM (https://www.futuraim.com.br).
 *
 * É **server-safe**: usa apenas string/regex, sem DOMParser/window, para poder
 * rodar dentro de uma server function (TanStack Start) e em testes Node.
 *
 * Estratégia de extração (seção 5 da spec), na ordem de confiança:
 *  1. JSON-LD (application/ld+json) do produto e dos serviços
 *  2. Estado embutido (GTM dataLayer view_item)
 *  3. Tabela de preços por tiragem (cada tiragem é um SKU real)
 *  4. Eixos de variação (select[data-type], grupos grupo-sku, links de Material)
 *  5. Breadcrumb (schema.org BreadcrumbList no HTML)
 *  6. Meta Open Graph (fallback)
 *
 * Nada é fabricado: campos sem dado real ficam vazios e geram `warnings`.
 */

import type {
  ImportedExtra,
  ImportedImage,
  ImportedPriceTier,
  ImportedProduct,
  ImportedVariant,
  ImportedVariantAxis,
  ImportPageType,
} from "@/types/importedProduct";
import { classifyProduct } from "@/services/productClassifier";
import {
  cleanText,
  discountPercent,
  normalizeKey,
  parseColorCode,
  parseDimensions,
  parseMaterial,
  parsePriceBR,
  parseProductionTime,
  parseQuantity,
  slugify,
} from "@/services/productNormalizer";

export const FUTURAIM_SUPPLIER = "FuturaIM";
export const FUTURAIM_DOMAINS = ["futuraim.com.br", "www.futuraim.com.br"];

// ---------------------------------------------------------------------------
// Helpers de baixo nível
// ---------------------------------------------------------------------------

function decodeEntities(s: string): string {
  if (!s) return "";
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ");
}

function stripTags(s: string): string {
  return cleanText(decodeEntities((s || "").replace(/<[^>]+>/g, " ")));
}

/** Extrai todos os blocos JSON-LD (lida com atributos sem aspas do HTML minificado). */
export function extractJsonLd(html: string): any[] {
  const out: any[] = [];
  const re = /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1].trim());
      if (Array.isArray(parsed)) out.push(...parsed);
      else out.push(parsed);
    } catch {
      /* bloco malformado é ignorado */
    }
  }
  return out;
}

function ldType(obj: any): string[] {
  const t = obj?.["@type"];
  if (!t) return [];
  return Array.isArray(t) ? t.map(String) : [String(t)];
}

/** Lê o objeto do dataLayer `view_item` (estado embutido do GTM). */
export function extractDataLayerItem(html: string): any | null {
  const m = html.match(/dataLayer\.push\((\{[^]*?"event"\s*:\s*"view_item"[^]*?\})\);/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

/** Extrai o id externo da URL (?id=NNN). */
export function externalIdFromUrl(url: string): string | undefined {
  const m = url.match(/[?&]id=(\d+)/);
  return m ? m[1] : undefined;
}

// ---------------------------------------------------------------------------
// Breadcrumb
// ---------------------------------------------------------------------------

function extractBreadcrumb(html: string): string[] {
  const block = html.match(/<ol[^>]*class=["']?breadcrumb[^>]*>([\s\S]*?)<\/ol>/i);
  if (!block) return [];
  const names = [...block[1].matchAll(/itemprop=["']?name["']?>\s*([^<]+?)\s*<\/span>/gi)].map((m) =>
    stripTags(m[1]),
  );
  // Remove "Início"/"Home"
  return names.filter((n) => n && !/^in[ií]cio$|^home$/i.test(n));
}

// ---------------------------------------------------------------------------
// Preços por tiragem (seção 11)
// ---------------------------------------------------------------------------

export function extractPriceTiers(html: string, collectedAt: string, currentId?: string): ImportedPriceTier[] {
  const tiers: ImportedPriceTier[] = [];
  const seen = new Set<number>();

  // As linhas de tiragem têm o radio name=qtd-sku. Quebramos por <tr.
  const rows = html.split(/<tr\b/i).slice(1);
  for (const raw of rows) {
    const chunk = raw.slice(0, raw.search(/<\/tr>|<tr\b/i) >= 0 ? raw.length : raw.length);
    if (!/qtd-sku/i.test(chunk)) continue;

    // Quantidade: do texto "N unidades" ou do id do radio.
    let qty = 0;
    const qm = chunk.match(/name=["']?qtd-sku["']?[^>]*>\s*([\d.\s]+?)\s*unidad/i);
    if (qm) qty = parseQuantity(qm[1]);
    if (!qty) {
      const idm = chunk.match(/input\s+id=["']?(\d+)["']?[^>]*qtd-sku|qtd-sku[^>]*id=["']?(\d+)/i);
      if (idm) qty = parseInt(idm[1] || idm[2], 10);
    }
    if (!qty || seen.has(qty)) continue;

    // Preço unitário (R$ x,xx/un) e preço total (último R$ que não é /un).
    const unitM = chunk.match(/R\$\s*([\d.,]+)\s*\/\s*un/i);
    const unit_price = unitM ? parsePriceBR(unitM[1]) : 0;
    const withoutUnit = chunk.replace(/R\$\s*[\d.,]+\s*\/\s*un/gi, " ");
    const totals = [...withoutUnit.matchAll(/R\$\s*([\d.,]+)/gi)].map((m) => parsePriceBR(m[1]));
    const total_price = totals.length ? totals[totals.length - 1] : 0;
    if (!total_price) continue;

    // id externo do SKU desta tiragem (onclick trocarProduto('slug',ID)).
    const idM = chunk.match(/trocarProduto\([^,]+,\s*(\d+)\s*\)/i);

    seen.add(qty);
    tiers.push({
      quantity: qty,
      unit: "unidade",
      total_price,
      unit_price: unit_price || parseFloat((total_price / qty).toFixed(4)),
      currency: "BRL",
      available: true,
      external_id: idM ? idM[1] : undefined,
      collected_at: collectedAt,
    });
  }

  tiers.sort((a, b) => a.quantity - b.quantity);
  return tiers;
}

// ---------------------------------------------------------------------------
// Eixos de variação (seção 8/9) — somente opções com id real
// ---------------------------------------------------------------------------

export function extractVariantAxes(html: string): ImportedVariantAxis[] {
  const axes = new Map<string, ImportedVariantAxis>();

  function ensure(name: string): ImportedVariantAxis {
    const key = normalizeKey(name);
    if (!axes.has(key)) {
      axes.set(key, { name, normalized_name: key, options: [] });
    }
    return axes.get(key)!;
  }
  function addOption(axisName: string, value: string, url?: string, selected?: boolean) {
    const v = stripTags(value);
    if (!v) return;
    const axis = ensure(axisName);
    const external_id = url ? externalIdFromUrl(url) : undefined;
    if (axis.options.some((o) => o.normalized_value === normalizeKey(v))) return;
    axis.options.push({ value: v, normalized_value: normalizeKey(v), external_id, url, selected });
  }

  // 1) <select data-type=Formato ...><option value="/produto/...id=N"> Label
  const selRe = /<select[^>]*data-type=["']?([^"'\s>]+)["']?[^>]*>([\s\S]*?)<\/select>/gi;
  let sm: RegExpExecArray | null;
  while ((sm = selRe.exec(html))) {
    const axisName = stripTags(sm[1]);
    const optRe = /<option[^>]*value=["']([^"']*id=\d+[^"']*)["'][^>]*>\s*([^<]+?)\s*(?=<|$)/gi;
    let om: RegExpExecArray | null;
    while ((om = optRe.exec(sm[2]))) {
      addOption(axisName, om[2], om[1]);
    }
  }

  // 2) Links/botões com title="Ver produto (no|na|com|em) <Eixo> <Valor>" + id.
  //    Ex.: "Ver produto no Material Couché Fosco 300g"
  //         "Ver produto com Cor 4x0 - Colorido Frente"
  const titleRe =
    /title=["']Ver produto (?:no|na|com|em)\s+([A-Za-zÀ-ú]+)\s+([^"']+)["'][^>]*(?:href|onclick)=["']?[^"']*?(\/produto\/[^"'?]*\?id=\d+|[^"']*id=\d+)/gi;
  let tm: RegExpExecArray | null;
  while ((tm = titleRe.exec(html))) {
    const axisName = stripTags(tm[1]);
    const value = stripTags(tm[2]);
    const url = tm[3];
    addOption(axisName, value, url);
  }

  return [...axes.values()].filter((a) => a.options.length > 0);
}

// ---------------------------------------------------------------------------
// Imagens (seção 17) — usamos as imagens limpas do JSON-LD do produto
// ---------------------------------------------------------------------------

function buildImages(productLd: any, ogImage?: string): ImportedImage[] {
  const urls: string[] = [];
  if (productLd?.image) {
    const imgs = Array.isArray(productLd.image) ? productLd.image : [productLd.image];
    for (const i of imgs) {
      const u = typeof i === "string" ? i : i?.url;
      if (u) urls.push(u);
    }
  }
  if (ogImage && !urls.includes(ogImage)) urls.push(ogImage);

  const seen = new Set<string>();
  const images: ImportedImage[] = [];
  urls.forEach((u, idx) => {
    if (seen.has(u)) return;
    seen.add(u);
    images.push({ url: u, order: idx, is_main: idx === 0 });
  });
  return images;
}

// ---------------------------------------------------------------------------
// Extras / serviços adicionais (seção 20) — vêm de JSON-LD @type Service
// ---------------------------------------------------------------------------

function buildExtras(ld: any[]): ImportedExtra[] {
  const extras: ImportedExtra[] = [];
  for (const obj of ld) {
    if (!ldType(obj).includes("Service")) continue;
    const name = stripTags(obj.name || obj.serviceType || "");
    if (!name) continue;
    const offer = Array.isArray(obj.offers) ? obj.offers[0] : obj.offers;
    extras.push({
      name,
      normalized_name: normalizeKey(name),
      price: parsePriceBR(offer?.price),
      currency: offer?.priceCurrency || "BRL",
      url: offer?.url,
    });
  }
  return extras;
}

// ---------------------------------------------------------------------------
// Parser principal
// ---------------------------------------------------------------------------

export function parseFuturaImProduct(html: string, sourceUrl: string): ImportedProduct {
  const collectedAt = new Date().toISOString();
  const warnings: string[] = [];
  const errors: string[] = [];

  const ld = extractJsonLd(html);
  const productLd = ld.find((o) => ldType(o).includes("Product"));
  const dataLayer = extractDataLayerItem(html);
  const dlItem = dataLayer?.ecommerce?.items?.[0] || dataLayer?.items?.[0] || null;

  if (!productLd && !dlItem) {
    errors.push("Página sem JSON-LD de Produto nem dataLayer — pode exigir navegador (JavaScript).");
  }

  // Identificação
  const breadcrumb = extractBreadcrumb(html);
  const ogTitle = html.match(/property=["']?og:title["']?\s+content=["']([^"']+)["']/i)?.[1];
  const ogImage = html.match(/property=["']?og:image["']?\s+content=["']([^"']+)["']/i)?.[1];

  const original_name = decodeEntities(
    productLd?.name || dataLayer?.ecommerce?.items?.[0]?.item_category || ogTitle || "",
  );
  if (!original_name) warnings.push("Nome do produto não encontrado.");

  // base_product (família): 2º item do breadcrumb costuma ser a família real.
  const base_product = breadcrumb.length >= 1 ? breadcrumb[breadcrumb.length === 1 ? 0 : 0] : undefined;

  const external_id = externalIdFromUrl(sourceUrl) || (productLd?.sku != null ? String(productLd.sku) : undefined);

  // Descrição (seção 18) — não misturamos avaliações/relacionados.
  const description = productLd?.description ? stripTags(productLd.description) : undefined;
  const metaDesc = html.match(/name=["']?description["']?\s+content=["']([^"']+)["']/i)?.[1];
  const short_description = metaDesc ? decodeEntities(metaDesc) : undefined;

  // Preço / disponibilidade
  const offer = Array.isArray(productLd?.offers) ? productLd.offers[0] : productLd?.offers;
  const currentPrice = parsePriceBR(offer?.price ?? dlItem?.price);
  const availability: string = offer?.availability || "";
  const unavailable = /OutOfStock|SoldOut|Discontinued/i.test(availability);
  const available = !unavailable;
  if (unavailable) warnings.push("Produto sinalizado como indisponível pelo fornecedor.");

  // Avaliações (apenas agregados — sem copiar textos/dados pessoais)
  let rating_average: number | undefined;
  let rating_count: number | undefined;
  if (Array.isArray(productLd?.review) && productLd.review.length) {
    const ratings = productLd.review
      .map((r: any) => Number(r?.reviewRating?.ratingValue))
      .filter((n: number) => Number.isFinite(n));
    if (ratings.length) {
      rating_count = ratings.length;
      rating_average = parseFloat((ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length).toFixed(2));
    }
  }

  // Tiragens
  const price_tiers = extractPriceTiers(html, collectedAt, external_id);
  // Garante a tiragem atualmente selecionada (do dataLayer) se a tabela não a trouxe.
  if (currentPrice > 0) {
    const dlQty = dlItem?.item_name ? parseQuantity(dlItem.item_name) : 0;
    if (dlQty && !price_tiers.some((t) => t.quantity === dlQty)) {
      price_tiers.push({
        quantity: dlQty,
        unit: "unidade",
        total_price: currentPrice,
        unit_price: parseFloat((currentPrice / dlQty).toFixed(4)),
        currency: "BRL",
        available,
        external_id,
        collected_at: collectedAt,
      });
      price_tiers.sort((a, b) => a.quantity - b.quantity);
    }
  }
  if (!price_tiers.length) warnings.push("Nenhuma faixa de preço por quantidade foi encontrada.");

  // Eixos de variação
  const variant_axes = extractVariantAxes(html);
  const multiOption = variant_axes.some((a) => a.options.length > 1);
  const variant_scan_status = multiOption ? "pending" : "selected_only";

  // Atributos / especificações da variante atualmente selecionada.
  // Derivamos do item_name do dataLayer (descritor completo) quando disponível.
  // Ex.: "1000 Cartão de Visita - 88x48mm em Couché Fosco 300g - 4x4 - Laminação Fosca e Verniz Localizado - Refile"
  const descriptor: string = dlItem?.item_name || "";
  const specsRaw: Record<string, string> = {};
  const findAxisValue = (axis: string): string | undefined => {
    const a = variant_axes.find((x) => x.normalized_name === normalizeKey(axis));
    if (!a) return undefined;
    return a.options.find((o) => o.selected)?.value;
  };

  // Material / formato / cor / acabamento — preferimos o eixo, com fallback no descritor.
  const formatStr =
    findAxisValue("Formato") || descriptor.match(/(\d+(?:[.,]\d+)?\s*x\s*\d+(?:[.,]\d+)?\s*(?:mm|cm|m)?)/i)?.[1] || "";
  const materialStr =
    findAxisValue("Material") || descriptor.match(/em\s+([^-]+?)(?:\s*-\s*\d|\s*$)/i)?.[1]?.trim() || "";
  const colorStr = findAxisValue("Cor") || descriptor.match(/(\d\s*x\s*\d)/)?.[1] || "";

  if (formatStr) specsRaw["Formato"] = formatStr;
  if (materialStr) specsRaw["Material"] = materialStr;
  if (colorStr) specsRaw["Cor"] = colorStr;

  const dimensions = formatStr ? parseDimensions(formatStr) : undefined;
  const material = materialStr ? parseMaterial(materialStr) : undefined;
  const color = colorStr ? parseColorCode(colorStr) : undefined;

  // Especificações como atributos (nunca num campo único — seção 7).
  const specifications = Object.entries(specsRaw).map(([k, v]) => ({
    name: k,
    normalized_name: normalizeKey(k),
    value: v,
    normalized_value: normalizeKey(v),
  }));

  // Prazo de produção (seção 19) — frequentemente renderizado via JS na FuturaIM.
  let production_time;
  const deadlineM =
    html.match(/(\d+\s*dias?\s*[úu]teis(?:\s*\+\s*frete)?)/i) ||
    html.match(/prazo[^<]{0,40}?(\d+\s*dias?[^<]{0,12})/i);
  if (deadlineM) {
    production_time = parseProductionTime(deadlineM[1]);
  } else {
    warnings.push("Prazo de produção não está no HTML estático (provável renderização via JavaScript).");
  }

  // Imagens / extras
  const images = buildImages(productLd, ogImage);
  if (!images.length) warnings.push("Nenhuma imagem de produto encontrada.");
  const extras = buildExtras(ld);

  // Variante concreta (a selecionada). Criada apenas porque há id externo real.
  const variants: ImportedVariant[] = [];
  if (external_id || price_tiers.length) {
    const attrEntries = specifications.map((s) => [s.name, s.value] as const);
    variants.push({
      external_id,
      sku: external_id,
      title: descriptor || original_name,
      url: sourceUrl,
      canonical_url: offer?.url,
      attributes: specifications,
      material,
      dimensions,
      color,
      production_days: production_time?.production_days,
      available,
      price_tiers,
      raw_attributes: Object.fromEntries(attrEntries),
    });
  }
  if (variant_scan_status === "pending") {
    warnings.push(
      "Existem opções de variação não varridas (material/formato/cor/acabamento). Importada apenas a variante selecionada.",
    );
  }

  // Classificação
  const classification = classifyProduct({
    name: original_name,
    breadcrumb,
    specifications: specifications.map((s) => s.value),
    material: material?.original_material,
    description,
  });

  const page_type: ImportPageType = /\/produto\//i.test(sourceUrl) ? "product" : "unknown";

  // old price / desconto se houver preço "de"
  if (price_tiers.length) {
    const oldM = html.match(/de\s*R\$\s*([\d.,]+)\s*por/i);
    if (oldM) {
      const old = parsePriceBR(oldM[1]);
      const t = price_tiers[0];
      if (old > t.total_price) {
        t.old_price = old;
        t.discount_percent = discountPercent(old, t.total_price);
      }
    }
  }

  return {
    page_type,
    source_url: sourceUrl,
    canonical_url: offer?.url,
    external_id,
    supplier: FUTURAIM_SUPPLIER,
    supplier_domain: "futuraim.com.br",
    brand: productLd?.brand?.name || dlItem?.item_brand || FUTURAIM_SUPPLIER,
    original_name,
    normalized_name: cleanText(original_name),
    slug: slugify(original_name),
    breadcrumb,
    base_product,
    short_description,
    description,
    specifications,
    available,
    unavailable,
    is_on_sale: price_tiers.some((t) => t.discount_percent && t.discount_percent > 0),
    production_time,
    rating_average,
    rating_count,
    classification,
    variant_axes,
    variants,
    variant_scan_status,
    images,
    templates: [],
    extras,
    collected_at: collectedAt,
    warnings,
    errors,
  };
}
