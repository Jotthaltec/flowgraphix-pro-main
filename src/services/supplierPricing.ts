/**
 * Regra de preço na atualização pelo fornecedor (decisão de 02/10/2026).
 *
 * Função pura (sem DB/rede), testável.
 *
 * - Mudança normal do fornecedor (sem "de/por"): o PREÇO DE VENDA da gráfica
 *   não muda. Só o custo é atualizado; a margem real é que varia.
 * - Promoção do fornecedor (preço "de" maior que o atual): vira promoção na
 *   loja. O "de" é o nosso preço normal e o "por" aplica o MESMO percentual de
 *   desconto do fornecedor, preservando a margem percentual.
 * - Fim da promoção: o "por" some e vale de novo o preço normal, que nunca foi
 *   alterado. Nada a desfazer.
 */

/** Linha de products.quantity_prices / quantity_price_table. */
export interface StoredPriceTier {
  quantity: number;
  /** Custo atual do fornecedor (promocional, se houver promoção). */
  price: number;
  unitPrice: number;
  /** Nosso preço de venda normal (total da tiragem). */
  sellPrice: number;
  unitSellPrice: number;
  /** Preço normal ("de") do fornecedor, só enquanto ele está em promoção. */
  listPrice: number | null;
  /** Nosso preço promocional (total da tiragem), só enquanto há promoção. */
  promoSellPrice: number | null;
  promoUnitSellPrice: number | null;
  promoDiscountPercent: number | null;
  external_id: string | null;
  collected_at?: string;
}

/** Faixa recém-coletada do fornecedor (subconjunto de ImportedPriceTier). */
export interface FreshSupplierTier {
  quantity: number;
  total_price: number;
  unit_price: number;
  old_price?: number;
  external_id?: string;
  collected_at?: string;
}

export interface PricingAlert {
  quantity: number;
  kind: "margem_baixa" | "prejuizo";
  marginPercent: number;
}

export interface PriceTableResult {
  table: StoredPriceTier[];
  promoStarted: number[];
  promoEnded: number[];
  costChanged: number[];
  alerts: PricingAlert[];
}

/** Margem abaixo disto gera alerta (o preço não é alterado sozinho). */
export const MIN_MARGIN_PERCENT = 15;

const round2 = (n: number) => Math.round(n * 100) / 100;
const round4 = (n: number) => Math.round(n * 10000) / 10000;

function num(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : (value as number);
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

export function buildPriceTable(
  previous: Array<Partial<StoredPriceTier>> | null | undefined,
  fresh: FreshSupplierTier[],
  marginPercent: number,
): PriceTableResult {
  const factor = 1 + Math.max(0, marginPercent) / 100;
  const prevByQty = new Map<number, Partial<StoredPriceTier>>();
  for (const t of previous ?? []) {
    const q = num(t?.quantity);
    if (q && q > 0) prevByQty.set(q, t);
  }

  const result: PriceTableResult = {
    table: [],
    promoStarted: [],
    promoEnded: [],
    costChanged: [],
    alerts: [],
  };

  for (const t of fresh) {
    const quantity = num(t.quantity);
    const cost = num(t.total_price);
    if (!quantity || quantity <= 0 || cost == null || cost <= 0) continue;

    const old = num(t.old_price);
    const inPromo = old != null && old > cost;
    const normalCost = inPromo ? old : cost;
    const prev = prevByQty.get(quantity);

    // Preço de venda normal: o que já estava, ou (faixa nova) margem sobre o
    // custo NORMAL — uma promoção nunca rebaixa o preço de referência.
    const prevSell = num(prev?.sellPrice);
    const sellPrice = prevSell && prevSell > 0 ? prevSell : round2(normalCost * factor);

    let promoSellPrice: number | null = null;
    let promoDiscountPercent: number | null = null;
    if (inPromo) {
      const candidate = round2(sellPrice * (cost / normalCost));
      if (candidate > 0 && candidate < sellPrice) {
        promoSellPrice = candidate;
        promoDiscountPercent = Math.round((1 - cost / normalCost) * 100);
      }
    }

    const hadPromo = num(prev?.promoSellPrice) != null;
    if (promoSellPrice != null && !hadPromo) result.promoStarted.push(quantity);
    if (promoSellPrice == null && hadPromo) result.promoEnded.push(quantity);
    const prevCost = num(prev?.price);
    if (prev && prevCost != null && prevCost !== cost) result.costChanged.push(quantity);

    const effectiveSell = promoSellPrice ?? sellPrice;
    const margin = ((effectiveSell - cost) / effectiveSell) * 100;
    if (margin < 0) {
      result.alerts.push({ quantity, kind: "prejuizo", marginPercent: round2(margin) });
    } else if (margin < MIN_MARGIN_PERCENT) {
      result.alerts.push({ quantity, kind: "margem_baixa", marginPercent: round2(margin) });
    }

    result.table.push({
      quantity,
      price: cost,
      unitPrice: num(t.unit_price) ?? round4(cost / quantity),
      sellPrice,
      unitSellPrice: round4(sellPrice / quantity),
      listPrice: inPromo ? normalCost : null,
      promoSellPrice,
      promoUnitSellPrice: promoSellPrice != null ? round4(promoSellPrice / quantity) : null,
      promoDiscountPercent,
      external_id: t.external_id ?? (prev?.external_id as string | null | undefined) ?? null,
      collected_at: t.collected_at,
    });
  }

  for (const [quantity, prev] of prevByQty) {
    if (num(prev.promoSellPrice) != null && !result.table.some((t) => t.quantity === quantity)) {
      result.promoEnded.push(quantity);
    }
  }

  result.table.sort((a, b) => a.quantity - b.quantity);
  return result;
}

/**
 * Prazo após atualização do fornecedor, preservando os "nossos Z dias" que o
 * importador gravou em products.production_deadline. Sem produção interna
 * registrada, devolve o texto do fornecedor como antes.
 */
export function mergeDeadline(
  current: string | null | undefined,
  supplierText: string | null | undefined,
  supplierDays: number | null | undefined,
  freightNotIncluded?: boolean,
): string | null {
  const ours = Number((current ?? "").match(/nossos\s+(\d+)/i)?.[1] ?? 0);
  const days = supplierDays ?? Number((supplierText ?? "").match(/\d+/)?.[0] ?? NaN);
  if (!ours || !Number.isFinite(days)) return supplierText ?? current ?? null;
  const freight = freightNotIncluded ?? /\+\s*frete/i.test(current ?? "");
  return `Total: ${days + ours} dias (fornecedor ${days} + nossos ${ours})${freight ? " + frete" : ""}`;
}
