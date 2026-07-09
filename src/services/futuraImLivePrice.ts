/**
 * LIVE_RESOLVER — preço ao vivo da FuturaIM para produtos de TAMANHO PERSONALIZADO (§8).
 *
 * Endpoint descoberto no bundle `produto-geral.min.js` (função `calcularPreco`):
 *
 *   POST /produto/<slug>?id=<ProdutoId>
 *   body: o #formProduto serializado (ProdutoId, Quantidade, Largura, Altura, ...)
 *   headers: X-Requested-With: XMLHttpRequest + RequestVerificationToken
 *   cookies: .AspNetCore.Antiforgery.* (obtidos no GET da página)
 *
 * A resposta é o fragmento `#produtoGeral`. O preço fica no rodapé:
 *
 *   <div class="descricao-produto"><span>1 Adesivo cm² em Vinil …</span> (71910)</div>
 *   <span class="footer-preco-label">Total</span>
 *   <span class="txt-valor"> R$ 260,00 </span>
 *   <div class="justify-end">até 3x de R$ 86,67 sem juros</div>   <- NÃO é o total
 *
 * POR QUE LIVE_RESOLVER E NÃO FÓRMULA (medido contra o site real, id 71910):
 *   10x10    → R$   0,00   (abaixo do mínimo)
 *   50x50    → R$ 123,99   ┐
 *   200x200  → R$ 123,99   ├ constante = PREÇO MÍNIMO (não é área × preço/m²)
 *   500x500  → R$ 123,99   ┘
 *   1000x1000→ R$   0,00   (fora do limite de largura)
 *   500x500 q=4 → R$ 260,00 (quantidade NÃO é linear)
 *
 * Total 0,00 significa "dimensão fora dos limites / sem preço" — NUNCA um produto
 * grátis. Nesses casos `has_price=false` e o orçamento exibe "Preço não confirmado".
 *
 * Somente funções PURAS aqui (sem rede) — a requisição vive na server function.
 */

import { parsePriceBR } from "@/services/productNormalizer";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface LivePriceResult {
  /** Preço TOTAL oficial devolvido pelo fornecedor. 0 quando não há preço. */
  total_price: number;
  /** ProdutoId externo confirmado pelo fornecedor no rodapé. */
  external_product_id: string | null;
  /** Descritor completo da combinação (ex.: "1 Adesivo cm² em Vinil …"). */
  descriptor: string | null;
  /**
   * false quando o fornecedor devolve 0,00 — dimensão fora dos limites ou sem
   * preço. Nunca tratar como "grátis".
   */
  has_price: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function decodeEntities(s: string): string {
  return (s || "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&");
}

function cleanText(s: string): string {
  return decodeEntities(s).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Detecção de tamanho personalizado
// ---------------------------------------------------------------------------

/**
 * A página oferece medida manual (largura × altura)?
 * O marcador é o elemento `id=FlagDimensaoManual`, lido por `validarDimensaoManual()`
 * no bundle do fornecedor. Ele não tem `name` — serve só como sinalizador.
 */
export function supportsCustomSize(html: string): boolean {
  return /id=["']?FlagDimensaoManual["']?/i.test(html || "");
}

/**
 * Lê os campos do `#formProduto` (inputs hidden) para repostar o formulário
 * completo, como o site faz. O HTML da FuturaIM é minificado: os atributos
 * podem vir sem aspas.
 */
export function extractProductFormFields(html: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const inputs = (html || "").match(/<input\b[^>]*>/gi) || [];
  for (const tag of inputs) {
    const name = tag.match(/\bname=["']?([A-Za-z_][A-Za-z0-9_]*)["']?/i)?.[1];
    if (!name) continue;
    const value = tag.match(/\bvalue=["']([^"']*)["']/i)?.[1] ?? tag.match(/\bvalue=([^\s">]+)/i)?.[1] ?? "";
    // O primeiro valor vence: o form do produto vem antes dos formulários do rodapé.
    if (!(name in fields)) fields[name] = decodeEntities(value);
  }
  return fields;
}

// ---------------------------------------------------------------------------
// Parser do fragmento
// ---------------------------------------------------------------------------

/**
 * Extrai o preço TOTAL oficial do fragmento devolvido por `calcularPreco`.
 *
 * Cuidado: o rodapé também traz "até 3x de R$ 86,67 sem juros" — nunca confundir
 * o parcelamento com o total. Ancoramos no rótulo "Total" + `<span class="txt-valor">`.
 *
 * Retorna null quando o rodapé de preço não existe (fragmento inesperado) — o
 * chamador trata como "não foi possível consultar", jamais como preço zero.
 */
export function parseLivePriceFragment(html: string): LivePriceResult | null {
  if (!html) return null;

  // Rótulo "Total" seguido do valor em .txt-valor (ignora quebras de linha).
  const totalMatch = html.match(
    /footer-preco-label["'][^>]*>\s*Total\s*<\/span>\s*<span[^>]*txt-valor[^>]*>\s*R\$\s*([\d.,]+)/i,
  );
  if (!totalMatch) return null;

  const total_price = parsePriceBR(totalMatch[1]);

  // Descritor + ProdutoId confirmado: <span>TEXTO</span> (71910)
  let descriptor: string | null = null;
  let external_product_id: string | null = null;
  const descBlock = html.match(/descricao-produto["'][^>]*>([\s\S]{0,600}?)<\/div>/i);
  if (descBlock) {
    const inner = descBlock[1];
    const spanText = inner.match(/<span[^>]*>([\s\S]*?)<\/span>/i)?.[1];
    if (spanText) descriptor = cleanText(spanText) || null;
    external_product_id = inner.match(/\((\d+)\)/)?.[1] ?? null;
  }

  return {
    total_price,
    external_product_id,
    descriptor,
    // 0,00 = fora dos limites / sem preço. Nunca "grátis".
    has_price: total_price > 0,
  };
}
