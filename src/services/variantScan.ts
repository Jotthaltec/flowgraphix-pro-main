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

/**
 * URLs de variantes a visitar a partir de um produto: as opções de eixo que
 * têm URL com id externo diferente do id atual (combinações ainda não vistas).
 */
export function collectVariantUrls(product: ImportedProduct): string[] {
  const urls = new Set<string>();
  for (const axis of product.variant_axes) {
    for (const opt of axis.options) {
      if (!opt.url) continue;
      const id = externalIdFromUrl(opt.url);
      if (id && id !== product.external_id) urls.add(opt.url);
    }
  }
  return [...urls];
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

  return {
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
}
