/**
 * Varredura completa de variantes (seção 10).
 *
 * Cada opção de eixo da FuturaIM aponta para um `?id=` REAL (uma combinação que
 * de fato existe). Seguindo esses ids em largura (BFS), coletamos apenas
 * combinações reais — nunca um produto cartesiano. Aqui ficam as funções PURAS
 * (sem rede): descobrir os ids a visitar e consolidar os produtos coletados.
 */

import type {
  ImportedProduct,
  ImportedVariant,
  ImportedVariantAxis,
} from "@/types/importedProduct";
import { externalIdFromUrl } from "@/services/futuraImParser";
import {
  normalizeKey,
  parseColorCode,
  parseDimensions,
  parseMaterial,
} from "@/services/productNormalizer";
import { attributeSignature, resolveVariantAttributes } from "@/services/variantAttributes";

/** Reescreve a URL de origem apontando para outro `?id=` (mesmo slug). */
function urlWithExternalId(sourceUrl: string, id: string): string | null {
  try {
    const u = new URL(sourceUrl, "https://www.futuraim.com.br");
    u.searchParams.set("id", id);
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Torna absoluta uma URL de opção.
 *
 * O configurador da FuturaIM traz caminhos RELATIVOS nas opções
 * (`<option value="/produto/slug?id=123">`). Sem resolver contra a origem, o
 * validador anti-SSRF rejeita a URL e a varredura descarta silenciosamente
 * todos os eixos (material/formato) — coletando só a combinação inicial.
 */
function absolutize(url: string, sourceUrl: string): string | null {
  try {
    const base = new URL(sourceUrl, "https://www.futuraim.com.br");
    return new URL(url, base).toString();
  } catch {
    return null;
  }
}

/**
 * URLs das OPÇÕES DE EIXO (material/formato/impressão) — cada uma tem seu `?id=`.
 *
 * São as que abrem novas combinações; têm prioridade absoluta na varredura.
 * O configurador entrega caminhos relativos: absolutizamos, senão o validador
 * anti-SSRF as rejeita e a varredura ignora todos os eixos.
 */
export function collectAxisUrls(product: ImportedProduct): string[] {
  const urls = new Set<string>();
  for (const axis of product.variant_axes) {
    for (const opt of axis.options) {
      if (!opt.url) continue;
      const id = externalIdFromUrl(opt.url);
      if (!id || id === product.external_id) continue;
      const absolute = absolutize(opt.url, product.source_url);
      if (absolute) urls.add(absolute);
    }
  }
  return [...urls];
}

/**
 * URLs das TIRAGENS que ainda NÃO têm preço.
 *
 * A tabela de tiragens quase sempre já traz o preço de cada quantidade no HTML.
 * Quando traz, visitar o `?id=` da tiragem é redundante — e caríssimo: um produto
 * com 19 quantidades × 32 combinações geraria ~600 páginas, estourando o limite
 * da varredura e impedindo a cobertura dos eixos.
 *
 * Só seguimos a tiragem quando o preço não veio (tabela renderizada por JS): aí
 * a página daquele `?id=` é a única fonte do valor real (via dataLayer).
 */
export function collectUnpricedTierUrls(product: ImportedProduct): string[] {
  const urls = new Set<string>();
  for (const variant of product.variants) {
    for (const tier of variant.price_tiers) {
      if (tier.total_price > 0) continue; // preço já conhecido — não precisa visitar
      const id = tier.external_id;
      if (!id || id === product.external_id) continue;
      const url = urlWithExternalId(product.source_url, id);
      if (url) urls.add(url);
    }
  }
  return [...urls];
}

/**
 * Todas as URLs a visitar: eixos primeiro (abrem combinações), depois as
 * tiragens sem preço. Só ids diferentes do atual — nunca um produto cartesiano.
 */
export function collectVariantUrls(product: ImportedProduct): string[] {
  return [...new Set([...collectAxisUrls(product), ...collectUnpricedTierUrls(product)])];
}

/**
 * Anexa a cada OPÇÃO de eixo o preço real da sua combinação (`?id=`), lido das
 * variantes já coletadas na varredura. Cada opção aponta para um id específico;
 * a variante com esse `external_id` traz a tabela de tiragens daquela escolha.
 * Usamos a MENOR tiragem como referência (custo unitário/total de entrada).
 *
 * Sem varredura (nenhuma variante extra) as opções ficam sem preço e a UI herda
 * o custo-base — nada é fabricado.
 */
export function attachVariantPrices(
  product: ImportedProduct,
  aliases: Map<string, string> = new Map(),
): ImportedProduct {
  const byExtId = new Map<
    string,
    {
      unit_price: number;
      total_price: number;
      quantity: number;
      tiers: Array<{ quantity: number; unit_price: number; total_price: number }>;
    }
  >();
  for (const v of product.variants) {
    if (!v.external_id) continue;
    const sorted = [...v.price_tiers].sort((a, b) => a.quantity - b.quantity);
    const tier = sorted[0]; // menor tiragem = referência de custo de entrada
    if (!tier || !tier.total_price) continue;
    byExtId.set(v.external_id, {
      unit_price: tier.unit_price || parseFloat((tier.total_price / tier.quantity).toFixed(4)),
      total_price: tier.total_price,
      quantity: tier.quantity,
      // Tabela COMPLETA da combinação — o orçamento espelha o preço por qtd real.
      tiers: sorted.map((t) => ({
        quantity: t.quantity,
        unit_price: t.unit_price || parseFloat((t.total_price / t.quantity).toFixed(4)),
        total_price: t.total_price,
      })),
    });
  }
  if (!byExtId.size) return product;

  const variant_axes = product.variant_axes.map((axis) => ({
    ...axis,
    options: axis.options.map((o) => {
      const id = o.external_id ? (aliases.get(o.external_id) ?? o.external_id) : undefined;
      const p = id ? byExtId.get(id) : undefined;
      return p
        ? {
            ...o,
            unit_price: p.unit_price,
            total_price: p.total_price,
            ref_quantity: p.quantity,
            tiers: p.tiers,
          }
        : o;
    }),
  }));
  return { ...product, variant_axes };
}

/** Reaplica atributos resolvidos nos campos estruturados da variante. */
function withAttributes(
  variant: ImportedVariant,
  attributes: Record<string, string>,
): ImportedVariant {
  const get = (name: string) =>
    Object.entries(attributes).find(([k]) => normalizeKey(k) === normalizeKey(name))?.[1];
  const formato = get("Formato");
  const material = get("Material");
  const cor = get("Cor");
  const enobrecimento = get("Enobrecimento");
  const acabamento = get("Acabamento");
  return {
    ...variant,
    raw_attributes: attributes,
    attributes: Object.entries(attributes).map(([name, value]) => ({
      name,
      normalized_name: normalizeKey(name),
      value,
      normalized_value: normalizeKey(value),
    })),
    dimensions: formato ? parseDimensions(formato) : variant.dimensions,
    material: material ? parseMaterial(material) : variant.material,
    color: cor ? parseColorCode(cor) : variant.color,
    enoblement: enobrecimento ? [enobrecimento] : variant.enoblement,
    finishing: acabamento ? [acabamento] : variant.finishing,
  };
}

/**
 * Normaliza as variantes coletadas contra o vocabulário UNIDO dos eixos e funde
 * as que representam a mesma combinação.
 *
 * - Cada página só mostra as opções alcançáveis a partir dela; por isso a
 *   resolução é refeita aqui, com as opções de TODAS as páginas.
 * - A FuturaIM expõe SKUs de tiragem (ex.: 104756 = 50 un. do mesmo cartão que
 *   4571) com o mesmo descritor: viram UMA combinação com as tiragens unidas.
 * - Mesma combinação com preços diferentes na mesma quantidade é sinalizada —
 *   indica um eixo que a página não expõe — em vez de descartada em silêncio.
 */
export function normalizeScannedVariants(
  variants: ImportedVariant[],
  axes: ImportedVariantAxis[],
  preferredId?: string,
): { variants: ImportedVariant[]; warnings: string[]; aliases: Map<string, string> } {
  const warnings: string[] = [];
  const aliases = new Map<string, string>();
  if (!axes.length) return { variants, warnings, aliases };

  const validValue = (key: string, value: string) => {
    const axis = axes.find((a) => a.normalized_name === normalizeKey(key));
    return axis?.options.find(
      (o) => (o.normalized_value || normalizeKey(o.value)) === normalizeKey(value),
    )?.value;
  };
  const combinationIds = new Set(
    axes.flatMap((a) => a.options.map((o) => o.external_id).filter((id): id is string => !!id)),
  );

  const groups = new Map<string, ImportedVariant[]>();
  for (const variant of variants) {
    const resolved = resolveVariantAttributes(variant.title || "", axes, { useSelected: false });
    const attributes: Record<string, string> = {};
    // Valores de página só sobrevivem se forem opções reais de algum eixo.
    for (const [k, v] of Object.entries(variant.raw_attributes || {})) {
      const canonical = validValue(k, v);
      if (canonical) attributes[k] = canonical;
    }
    Object.assign(attributes, resolved.attributes);
    const missing = resolved.unresolved.filter((name) => !attributes[name]);
    if (missing.length) {
      warnings.push(
        `Combinação ${variant.external_id || variant.title}: eixo(s) não identificado(s): ${missing.join(", ")}.`,
      );
    }
    const normalized = withAttributes(variant, attributes);
    const signature =
      attributeSignature(attributes) || `id:${variant.external_id || variant.title}`;
    groups.set(signature, [...(groups.get(signature) ?? []), normalized]);
  }

  const merged: ImportedVariant[] = [];
  for (const group of groups.values()) {
    // Mantém o id de entrada (é o supplier_sku do produto no CRM); senão, a
    // combinação que os eixos apontam. Os demais ids viram apelidos dela.
    const primary =
      group.find((v) => preferredId && v.external_id === preferredId) ??
      group.find((v) => v.external_id && combinationIds.has(v.external_id)) ??
      group[0];
    for (const other of group) {
      if (other !== primary && other.external_id && primary.external_id) {
        aliases.set(other.external_id, primary.external_id);
      }
    }
    const tiers = new Map(primary.price_tiers.map((t) => [t.quantity, t]));
    for (const other of group) {
      if (other === primary) continue;
      for (const tier of other.price_tiers) {
        const current = tiers.get(tier.quantity);
        if (!current) tiers.set(tier.quantity, tier);
        else if (Math.abs(current.total_price - tier.total_price) > 0.01) {
          warnings.push(
            `Combinações ${primary.external_id} e ${other.external_id} têm os mesmos atributos mas preços diferentes em ${tier.quantity} un. — algum eixo não foi exposto pela página.`,
          );
        }
      }
    }
    merged.push({
      ...primary,
      price_tiers: [...tiers.values()].sort((a, b) => a.quantity - b.quantity),
    });
  }
  return { variants: merged, warnings, aliases };
}

/**
 * Consolida vários produtos (um por id de combinação) em UM produto-base com
 * todas as variantes reais coletadas e os eixos unidos. Deduplica variantes por
 * id externo/SKU/título.
 */
export function consolidateVariants(products: ImportedProduct[]): ImportedProduct {
  const base = products[0];
  const rawVariants: ImportedProduct["variants"] = [];
  const seen = new Set<string>();
  const axesMap = new Map<string, ImportedVariantAxis>();

  for (const p of products) {
    for (const v of p.variants) {
      const key = v.external_id || v.sku || v.title;
      if (key && !seen.has(key)) {
        seen.add(key);
        rawVariants.push(v);
      }
    }
    for (const axis of p.variant_axes) {
      const k = axis.normalized_name;
      if (!axesMap.has(k)) {
        axesMap.set(k, { ...axis, options: [...axis.options] });
      } else {
        const existing = axesMap.get(k)!;
        for (const o of axis.options) {
          if (!existing.options.some((eo) => eo.normalized_value === o.normalized_value))
            existing.options.push(o);
        }
      }
    }
  }

  const variant_axes = [...axesMap.values()];
  const {
    variants,
    warnings: mergeWarnings,
    aliases,
  } = normalizeScannedVariants(rawVariants, variant_axes, base.external_id);

  const consolidated: ImportedProduct = {
    ...base,
    variants,
    variant_axes,
    variant_scan_status: "complete",
    warnings: Array.from(
      new Set([
        ...base.warnings.filter(
          (w) => !/opções de varia[cç][aã]o não varridas|Eixo\(s\) sem valor identificado/i.test(w),
        ),
        ...mergeWarnings,
        `Varredura completa: ${variants.length} combinação(ões) real(is) coletada(s).`,
      ]),
    ),
  };
  // Anexa o preço real de cada combinação às opções dos eixos.
  return attachVariantPrices(consolidated, aliases);
}
