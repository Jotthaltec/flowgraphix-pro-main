/**
 * Normalizador de dados de produtos gráficos.
 *
 * Funções puras (sem DOM, sem rede) usadas pelo parser e pelos testes.
 * Regras seguem as seções 11–19 da especificação. O texto original NUNCA é
 * descartado: toda função preserva o valor de origem.
 */

import type {
  ImportedColorSpec,
  ImportedDimensions,
  ImportedMaterial,
  ImportedProductionTime,
} from "@/types/importedProduct";

// ---------------------------------------------------------------------------
// Texto / chaves
// ---------------------------------------------------------------------------

/** Remove acentos. */
export function deburr(str: string): string {
  // Remove marcas diacríticas combinantes (U+0300–U+036F) após decompor em NFD.
  return str.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Normaliza um nome/chave para snake_case ascii (ex.: "Couché Brilho 300g" -> "couche_brilho_300g"). */
export function normalizeKey(str: string): string {
  return deburr(str || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Gera slug a partir de um texto. */
export function slugify(str: string): string {
  return deburr(str || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Limpa espaços/quebras redundantes. */
export function cleanText(str: string): string {
  return (str || "").replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Preço (seção 11)
// ---------------------------------------------------------------------------

/**
 * Converte preços em texto para número. Suporta:
 *  - BR: "R$ 1.301,99" -> 1301.99 ; "97,99" -> 97.99
 *  - Internacional: "110.99" -> 110.99 ; "1,299.99" -> 1299.99
 */
export function parsePriceBR(input: string | number | null | undefined): number {
  if (input == null) return 0;
  if (typeof input === "number") return Number.isFinite(input) ? input : 0;

  let s = String(input).replace(/R\$/gi, "").replace(/\s/g, "");
  if (!s) return 0;

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    // O último separador é o decimal.
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      // BR: ponto = milhar, vírgula = decimal
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // Internacional: vírgula = milhar
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    // Só vírgula -> decimal BR
    s = s.replace(",", ".");
  }
  // Só ponto, ou sem separadores -> já é parseável

  const val = parseFloat(s);
  return Number.isFinite(val) ? val : 0;
}

/** Calcula percentual de desconto entre preço antigo e atual. */
export function discountPercent(oldPrice: number, current: number): number {
  if (!oldPrice || oldPrice <= 0 || current >= oldPrice) return 0;
  return Math.round(((oldPrice - current) / oldPrice) * 100);
}

// ---------------------------------------------------------------------------
// Formato / medidas (seção 12)
// ---------------------------------------------------------------------------

const SIZE_LABELS = new Set(["p", "m", "g", "gg", "gg1", "gg2", "xg", "xgg", "pp", "xs", "s", "l", "xl", "xxl"]);

function toMm(value: number, unit: string): number {
  switch (unit) {
    case "mm":
      return value;
    case "cm":
      return value * 10;
    case "m":
      return value * 1000;
    default:
      return value;
  }
}

/**
 * Normaliza um formato textual para milímetros quando possível.
 * Não transforma tamanhos de vestuário (P/M/G) em dimensões gráficas.
 */
export function parseDimensions(input: string): ImportedDimensions {
  const original = cleanText(input);
  const lower = deburr(original).toLowerCase();

  // Tamanho de vestuário (P, M, G, GG...) — não vira dimensão.
  if (SIZE_LABELS.has(lower.replace(/\s/g, ""))) {
    return { original, unit: "size_label", is_special: true };
  }

  // Capacidade em ml/l
  const ml = lower.match(/([\d.,]+)\s*(ml|l|litros?)/);
  if (ml && !lower.match(/\d\s*x\s*\d/)) {
    return { original, unit: "ml", is_special: true, note: "capacidade" };
  }

  // Personalizado
  if (/personalizad|sob\s*medida|tamanho\s*livre|custom/.test(lower)) {
    return { original, unit: "custom", is_special: true };
  }

  // WxHxD com unidade opcional (mm/cm/m). Aceita vírgula decimal: 21x29,7cm
  const m = lower.match(
    /([\d]+(?:[.,]\d+)?)\s*x\s*([\d]+(?:[.,]\d+)?)(?:\s*x\s*([\d]+(?:[.,]\d+)?))?\s*(mm|cm|m)?/,
  );
  if (m) {
    const unit = (m[4] as string) || "mm";
    const w = parseFloat(m[1].replace(",", "."));
    const h = parseFloat(m[2].replace(",", "."));
    const d = m[3] ? parseFloat(m[3].replace(",", ".")) : undefined;
    return {
      original,
      width: w,
      height: h,
      depth: d,
      unit,
      width_mm: Math.round(toMm(w, unit)),
      height_mm: Math.round(toMm(h, unit)),
      depth_mm: d != null ? Math.round(toMm(d, unit)) : undefined,
    };
  }

  return { original };
}

// ---------------------------------------------------------------------------
// Cor de impressão (seção 13)
// ---------------------------------------------------------------------------

/** Interpreta códigos como 1x0, 4x4, 5x0 (5 = colorido + branco). Nada é deduzido sem o código. */
export function parseColorCode(input: string): ImportedColorSpec {
  const original = cleanText(input);
  const m = original.match(/(\d)\s*[x×]\s*(\d)/);
  if (!m) {
    return { original_color_code: original };
  }
  const front = parseInt(m[1], 10);
  const back = parseInt(m[2], 10);
  const hasWhite = front === 5 || back === 5;

  const parts: string[] = [];
  if (front === 0) parts.push("sem impressão na frente");
  else if (front === 1) parts.push("1 cor na frente");
  else if (front === 4) parts.push("colorido na frente");
  else if (front === 5) parts.push("colorido com branco na frente");
  else parts.push(`${front} cores na frente`);

  if (back === 0) parts.push("sem impressão no verso");
  else if (back === 1) parts.push("1 cor no verso");
  else if (back === 4) parts.push("colorido no verso");
  else if (back === 5) parts.push("colorido com branco no verso");
  else parts.push(`${back} cores no verso`);

  return {
    original_color_code: original.match(/\d\s*[x×]\s*\d/)?.[0] || original,
    front_colors: front,
    back_colors: back,
    front_printed: front > 0,
    back_printed: back > 0,
    has_white_ink: hasWhite,
    description: parts.join(", "),
  };
}

// ---------------------------------------------------------------------------
// Material e gramatura (seção 14)
// ---------------------------------------------------------------------------

const MATERIAL_FAMILIES = [
  "couché",
  "couche",
  "offset",
  "supremo",
  "triplex",
  "duplex",
  "kraft",
  "polionda",
  "adesivo",
  "vinil",
  "lona",
  "papel",
  "cartão",
  "cartao",
  "sulfite",
  "reciclato",
  "tecido",
  "ps",
  "pvc",
  "acrílico",
  "acrilico",
];

const SURFACES = ["brilho", "fosco", "fosca", "matte", "acetinado"];

/** Separa família de material, superfície, gramatura, espessura e cor. Preserva o original. */
export function parseMaterial(input: string): ImportedMaterial {
  const original_material = cleanText(input);
  const lower = deburr(original_material).toLowerCase();
  const result: ImportedMaterial = { original_material };

  const family = MATERIAL_FAMILIES.find((f) => lower.includes(deburr(f)));
  if (family) {
    // capitaliza primeira letra do termo original encontrado
    result.material_family = family.charAt(0).toUpperCase() + family.slice(1);
  }

  const surface = SURFACES.find((s) => lower.includes(s));
  if (surface) result.surface = surface.charAt(0).toUpperCase() + surface.slice(1);

  const gram = lower.match(/(\d{2,4})\s*g(?:\/?m2|sm)?\b/);
  if (gram) result.grammage_gsm = parseInt(gram[1], 10);

  const thick = lower.match(/(\d+(?:[.,]\d+)?)\s*mm\b/);
  if (thick) result.thickness_mm = parseFloat(thick[1].replace(",", "."));

  const color = lower.match(/\b(branca|branco|preta|preto|transparente|cristal)\b/);
  if (color) result.color = color[1];

  const comp = lower.match(/\b(poli[eé]ster|algod[aã]o|pet|pp|pvc)\b/);
  if (comp) result.composition = comp[1];

  return result;
}

// ---------------------------------------------------------------------------
// Prazo de produção (seção 19)
// ---------------------------------------------------------------------------

/** Decompõe "2 dias úteis + frete" em campos estruturados, mantendo o texto original. */
export function parseProductionTime(input: string): ImportedProductionTime {
  const original_production_time = cleanText(input);
  const lower = deburr(original_production_time).toLowerCase();
  const result: ImportedProductionTime = { original_production_time };

  const days = lower.match(/(\d+)\s*dias?\b/);
  if (days) result.production_days = parseInt(days[1], 10);

  if (/uteis|util/.test(lower)) result.production_day_type = "business_days";
  else if (/corridos?/.test(lower)) result.production_day_type = "calendar_days";

  if (/\+\s*frete|mais\s*frete|frete\b/.test(lower)) result.freight_not_included = true;

  return result;
}

// ---------------------------------------------------------------------------
// Quantidades / unidades
// ---------------------------------------------------------------------------

/** Lê quantidades como "5.000 unidades", "1000 un", "100" -> número. */
export function parseQuantity(input: string): number {
  const s = deburr(String(input)).toLowerCase().replace(/\s/g, "");
  const m = s.match(/([\d.]+)/);
  if (!m) return 0;
  const n = parseInt(m[1].replace(/\./g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}
