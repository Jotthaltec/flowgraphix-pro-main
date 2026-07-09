/**
 * Varredura completa de variantes (seção 10).
 *
 * Cada opção de eixo da FuturaIM aponta para um `?id=` REAL (uma combinação que
 * de fato existe). Seguindo esses ids em largura (BFS), coletamos apenas
 * combinações reais — nunca um produto cartesiano. Aqui ficam as funções PURAS
 * (sem rede): descobrir os ids a visitar e consolidar os produtos coletados.
 */

import type { ImportedProduct, ImportedVariantAxis } from "@/types/importedProduct";
import { externalIdFromUrl } from "@/services/futuraImParser";

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
export function attachVariantPrices(product: ImportedProduct): ImportedProduct {
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
      const p = o.external_id ? byExtId.get(o.external_id) : undefined;
      return p
        ? { ...o, unit_price: p.unit_price, total_price: p.total_price, ref_quantity: p.quantity, tiers: p.tiers }
        : o;
    }),
  }));
  return { ...product, variant_axes };
}

/**
 * Consolida vários produtos (um por id de combinação) em UM produto-base com
 * todas as variantes reais coletadas e os eixos unidos. Deduplica variantes por
 * id externo/SKU/título.
 */
export function consolidateVariants(products: ImportedProduct[]): ImportedProduct {
  const base = products[0];
  const variants: ImportedProduct["variants"] = [];
  const seen = new Set<string>();
  const axesMap = new Map<string, ImportedVariantAxis>();

  for (const p of products) {
    for (const v of p.variants) {
      const key = v.external_id || v.sku || v.title;
      if (key && !seen.has(key)) {
        seen.add(key);
        variants.push(v);
      }
    }
    for (const axis of p.variant_axes) {
      const k = axis.normalized_name;
      if (!axesMap.has(k)) {
        axesMap.set(k, { ...axis, options: [...axis.options] });
      } else {
        const existing = axesMap.get(k)!;
        for (const o of axis.options) {
          if (!existing.options.some((eo) => eo.normalized_value === o.normalized_value)) existing.options.push(o);
        }
      }
    }
  }

  const consolidated: ImportedProduct = {
    ...base,
    variants,
    variant_axes: [...axesMap.values()],
    variant_scan_status: "complete",
    warnings: Array.from(
      new Set([
        ...base.warnings.filter((w) => !/opções de varia[cç][aã]o não varridas/i.test(w)),
        `Varredura completa: ${variants.length} variante(s) real(is) coletada(s).`,
      ]),
    ),
  };
  // Anexa o preço real de cada combinação às opções dos eixos.
  return attachVariantPrices(consolidated);
}
