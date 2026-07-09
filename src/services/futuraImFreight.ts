/**
 * Frete real da FuturaIM (seção 11).
 *
 * Endpoint descoberto no bundle `produto-geral.min.js` (função `calcularFrete`):
 *
 *   POST /produtos/frete-sku/?cep=<cep>&produtoId=<id>&quantidade=<qtd>
 *
 * Requisitos verificados contra o site real:
 *  - cookie `.AspNetCore.Antiforgery.*` obtido no GET da página do produto;
 *  - token antiforgery no header `RequestVerificationToken` (ou no campo
 *    `__RequestVerificationToken`). Sem ele o servidor responde 302 → /Error/400.
 *
 * A resposta é um FRAGMENTO HTML, uma linha por transportadora:
 *
 *   <div class="row mb-1">
 *     <div class="col-5">JAD - Delivery</div>
 *     <div class="col-4">2  dias úteis</div>
 *     <div class="col-3">Grátis</div>      <- ou "R$ 12,34"
 *   </div>
 *
 * Este módulo contém apenas funções PURAS (sem rede) — a requisição vive na
 * server function, para não expor cookies nem burlar a allowlist anti-SSRF.
 */

import { parsePriceBR } from "@/services/productNormalizer";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

/** Uma opção de frete cotada pelo fornecedor. */
export interface FreightOption {
  /** Transportadora / método (ex.: "JAD - Delivery"). */
  carrier: string;
  /** Prazo em dias úteis (null quando o fornecedor não informa). */
  days: number | null;
  /** Valor em BRL. 0 quando grátis. */
  cost: number;
  /** true quando o fornecedor indica "Grátis". */
  free: boolean;
}

// ---------------------------------------------------------------------------
// Helpers de texto
// ---------------------------------------------------------------------------

function decodeEntities(s: string): string {
  return (s || "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripTags(s: string): string {
  return decodeEntities((s || "").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Token antiforgery
// ---------------------------------------------------------------------------

/**
 * Extrai o `__RequestVerificationToken` do HTML da página do produto.
 * O HTML da FuturaIM é minificado: o atributo `value` costuma vir SEM aspas.
 */
export function extractAntiForgeryToken(html: string): string | null {
  const m =
    html.match(/__RequestVerificationToken[^>]*?value=["']([^"']+)["']/i) ||
    html.match(/__RequestVerificationToken[^>]*?value=([^\s">]+)/i);
  return m ? m[1] : null;
}

/** Monta o caminho do endpoint de frete (sem host). */
export function buildFreightPath(cep: string, produtoId: string, quantidade: number): string {
  const cleanCep = (cep || "").replace(/\D/g, "");
  const qty = Number.isFinite(quantidade) && quantidade > 0 ? Math.trunc(quantidade) : 1;
  return `/produtos/frete-sku/?cep=${cleanCep}&produtoId=${encodeURIComponent(produtoId)}&quantidade=${qty}`;
}

/** Valida um CEP brasileiro (8 dígitos após limpeza). */
export function isValidCep(cep: string): boolean {
  return /^\d{8}$/.test((cep || "").replace(/\D/g, ""));
}

// ---------------------------------------------------------------------------
// Parser do fragmento de frete
// ---------------------------------------------------------------------------

/**
 * Converte o fragmento HTML devolvido pelo endpoint em opções de frete.
 *
 * Nunca inventa valor: uma linha sem transportadora legível é ignorada, e uma
 * linha sem preço nem "Grátis" também — o chamador trata a lista vazia como
 * "frete não cotado".
 */
export function parseFuturaImFreight(html: string): FreightOption[] {
  const options: FreightOption[] = [];
  if (!html) return options;

  // Cada opção é uma <div class="row ...">; quebramos por "row" e lemos as colunas.
  const rows = html.split(/<div\s+class=["'][^"']*\brow\b/i).slice(1);

  for (const row of rows) {
    const cols = [...row.matchAll(/<div\s+class=["'][^"']*\bcol-\d+\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi)].map(
      (m) => stripTags(m[1]),
    );
    if (cols.length < 3) continue;

    const [carrier, daysText, priceText] = cols;
    if (!carrier) continue;

    // Prazo: "2 dias úteis" → 2
    const dm = daysText.match(/(\d+)\s*dias?/i);
    const days = dm ? parseInt(dm[1], 10) : null;

    // Valor: "Grátis" → 0 | "R$ 12,34" → 12.34
    const free = /gr[áa]tis|gratuito/i.test(priceText);
    let cost = 0;
    if (!free) {
      const pm = priceText.match(/R\$\s*([\d.,]+)/i);
      if (!pm) continue; // sem preço nem "Grátis" → linha não é uma cotação
      cost = parsePriceBR(pm[1]);
    }

    options.push({ carrier, days, cost, free });
  }

  return options;
}
