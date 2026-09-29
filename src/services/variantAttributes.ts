/**
 * Resolução dos atributos de uma variante contra o VOCABULÁRIO dos eixos.
 *
 * Cada combinação da FuturaIM tem um descritor completo, por exemplo:
 *   "500 Cartão de Visita - 88x48mm em Couché 300g - 4x0 - Sem Enobrecimento - Refile"
 * e a página expõe os eixos com as opções reais ("4x0 - Colorido Frente",
 * "Couché 300g", "88x48mm", ...). Em vez de adivinhar com regex soltas (que
 * liam o "8x4" de 8[8x4]8mm como cor), cada trecho do descritor é casado com
 * as opções conhecidas do eixo. O valor gravado é SEMPRE o rótulo exato da
 * opção — o mesmo texto que vira opção no site —, então variante e opção falam
 * a mesma língua do importador até a loja.
 *
 * Funções puras: sem DOM, sem rede.
 */

import type { ImportedVariantAxis } from "@/types/importedProduct";
import { COLOR_CODE_RE, normalizeKey, parseDimensions } from "@/services/productNormalizer";

export type AttributeSource = "selected" | "exact" | "code" | "contains";

export interface ResolvedAttributes {
  /** { "Cor": "4x0 - Colorido Frente", "Formato": "88x48mm", ... } — rótulos exatos das opções. */
  attributes: Record<string, string>;
  /** Como cada eixo foi resolvido (auditoria / testes). */
  sources: Record<string, AttributeSource>;
  /** Eixos com mais de uma opção que não puderam ser resolvidos. */
  unresolved: string[];
}

/** Quebra o descritor em trechos: " - " separa blocos e " em " separa formato de material. */
export function descriptorSegments(descriptor: string): string[] {
  const out: string[] = [];
  for (const block of (descriptor || "").split(/\s+[-–—]\s+/)) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    out.push(trimmed);
    const parts = trimmed.split(/\s+em\s+/i).map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1) out.push(...parts);
  }
  return out;
}

function colorCode(text: string): string | undefined {
  const m = (text || "").match(COLOR_CODE_RE);
  return m ? `${m[1]}x${m[2]}` : undefined;
}

function dimensionCode(text: string): string | undefined {
  if (!/\d\s*x\s*\d/i.test(text || "")) return undefined;
  const d = parseDimensions(text);
  if (d.width_mm == null || d.height_mm == null) return undefined;
  return `${d.width_mm}x${d.height_mm}${d.depth_mm != null ? `x${d.depth_mm}` : ""}`;
}

/** Contido com borda de token: "couche_300g" está em "88x48mm_em_couche_300g", mas não em "couche_brilho_300g". */
function containsToken(haystack: string, needle: string): boolean {
  if (!needle) return false;
  return (`_${haystack}_`).includes(`_${needle}_`);
}

/** Escolhe a única opção candidata; ambiguidade = sem resposta (nunca chuta). */
function unique<T>(items: T[]): T | undefined {
  return items.length === 1 ? items[0] : undefined;
}

/**
 * Casa um texto livre com uma opção do eixo. Ordem de confiança:
 *  1. igualdade normalizada;
 *  2. mesmo código (cor "4x0" ↔ "4x0 - Colorido Frente"; medida "88x48mm" ↔ "88 x 48 mm");
 *  3. a opção aparece inteira dentro do texto (a mais longa vence).
 */
export function matchAxisOption(
  axis: Pick<ImportedVariantAxis, "normalized_name" | "options">,
  text: string,
): { value: string; source: Exclude<AttributeSource, "selected"> } | undefined {
  const norm = normalizeKey(text);
  if (!norm) return undefined;
  const options = axis.options;

  const exact = options.find((o) => (o.normalized_value || normalizeKey(o.value)) === norm);
  if (exact) return { value: exact.value, source: "exact" };

  const color = colorCode(text);
  if (color) {
    const byColor = unique(options.filter((o) => colorCode(o.value) === color));
    if (byColor) return { value: byColor.value, source: "code" };
  }
  const dim = dimensionCode(text);
  if (dim) {
    const byDim = unique(options.filter((o) => dimensionCode(o.value) === dim));
    if (byDim) return { value: byDim.value, source: "code" };
  }

  const contained = options
    .map((o) => ({ o, n: o.normalized_value || normalizeKey(o.value) }))
    .filter(({ n }) => containsToken(norm, n))
    .sort((a, b) => b.n.length - a.n.length);
  if (contained.length && (contained.length === 1 || contained[0].n.length > contained[1].n.length)) {
    return { value: contained[0].o.value, source: "contains" };
  }
  return undefined;
}

/**
 * Resolve TODOS os eixos de uma variante.
 *
 * - Cada trecho do descritor (o item_name do próprio SKU) é casado com as opções
 *   do eixo; o trecho que resolve um eixo não é reutilizado por outro.
 * - Sem trecho correspondente, vale a opção marcada na página.
 * - Eixo com uma única opção assume essa opção (não há escolha).
 * - Nada é chutado: eixo ambíguo fica em `unresolved`.
 */
export function resolveVariantAttributes(
  descriptor: string,
  axes: ImportedVariantAxis[],
  opts: { useSelected?: boolean } = {},
): ResolvedAttributes {
  const attributes: Record<string, string> = {};
  const sources: Record<string, AttributeSource> = {};
  const unresolved: string[] = [];
  const segments = descriptorSegments(descriptor);
  const used = new Set<number>();

  // Passo 1: o descritor (item_name do SKU) é a fonte mais confiável. Casamos
  // do mais forte para o mais fraco, para que um trecho exato ("Verniz Total
  // Brilho Frente e Verso") não seja roubado por um casamento "contido".
  const pending = axes.filter((axis) => axis.options.length > 0);
  const rank = { exact: 0, code: 1, contains: 2 } as const;
  const candidates: Array<{ axis: ImportedVariantAxis; seg: number; value: string; source: keyof typeof rank }> = [];
  for (const axis of pending) {
    segments.forEach((segment, seg) => {
      const m = matchAxisOption(axis, segment);
      if (m) candidates.push({ axis, seg, value: m.value, source: m.source });
    });
  }
  candidates.sort((a, b) => rank[a.source] - rank[b.source] || b.value.length - a.value.length);
  for (const c of candidates) {
    if (attributes[c.axis.name] !== undefined || used.has(c.seg)) continue;
    attributes[c.axis.name] = c.value;
    sources[c.axis.name] = c.source;
    used.add(c.seg);
  }

  // Passo 2: sem trecho no descritor, vale a opção marcada na página; eixo de
  // opção única assume essa opção (não há escolha).
  for (const axis of pending) {
    if (attributes[axis.name] !== undefined) continue;
    const selected = opts.useSelected !== false ? axis.options.find((o) => o.selected) : undefined;
    if (selected) {
      attributes[axis.name] = selected.value;
      sources[axis.name] = "selected";
    } else if (axis.options.length === 1) {
      attributes[axis.name] = axis.options[0].value;
      sources[axis.name] = "exact";
    } else {
      unresolved.push(axis.name);
    }
  }
  return { attributes, sources, unresolved };
}

/** Assinatura estável de uma combinação (para deduplicar variantes). */
export function attributeSignature(attributes: Record<string, string>): string {
  return Object.entries(attributes)
    .map(([k, v]) => `${normalizeKey(k)}=${normalizeKey(v)}`)
    .sort()
    .join("|");
}
