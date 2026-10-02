/**
 * Regra de preço na atualização pelo fornecedor (decisão de 02/10/2026).
 *
 * Função pura (sem DB/rede), testável.
 *
 * O "De/Por" da página da FuturaIM NÃO é usado como sinal: é preço âncora
 * fixo na maioria dos produtos (39 de 40 conferidos em 02/10/2026) e só
 * aparece para a tiragem selecionada. O sinal é o próprio custo:
 *
 * - Custo CAIU em relação ao último custo normal registrado: promoção. O "de"
 *   na loja é o nosso preço normal e o "por" aplica o mesmo % de queda do
 *   custo, preservando a margem percentual.
 * - Custo voltou ao normal (ou acima): fim da promoção, vale de novo o preço
 *   normal, que nunca foi alterado.
 * - Custo SUBIU: o preço de venda não muda; só o custo é atualizado e a margem
 *   cai (alerta se ficar baixa).
 * - Promoção com mais de PROMO_MAX_DAYS dias: alerta para decidir se vira o
 *   preço normal.
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
  /** Custo normal do fornecedor (antes da queda), só enquanto há promoção. */
  listPrice: number | null;
  /** Início da promoção (ISO), mantido enquanto ela durar. */
  promoSince: string | null;
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
  external_id?: string;
  collected_at?: string;
}

export interface PricingAlert {
  quantity: number;
  kind: "margem_baixa" | "prejuizo" | "promocao_longa";
  marginPercent: number;
  /** Dias de promoção, em "promocao_longa". */
  days?: number;
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
/** Promoção mais longa que isto gera alerta para virar preço normal. */
export const PROMO_MAX_DAYS = 30;
/** Diferença de custo abaixo disto é arredondamento, não mudança. */
const EPS = 0.005;

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
  now: Date = new Date(),
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

    const prev = prevByQty.get(quantity);
    const prevCost = num(prev?.price);
    // Custo normal de referência: o de antes da promoção, se havia uma; senão o último custo.
    const prevNormal = num(prev?.listPrice) ?? prevCost;
    const inPromo = prevNormal != null && cost < prevNormal - EPS;
    const normalCost = inPromo ? (prevNormal as number) : cost;

    // Preço de venda normal: o que já estava, ou (faixa nova) margem sobre o custo.
    const prevSell = num(prev?.sellPrice);
    const sellPrice = prevSell && prevSell > 0 ? prevSell : round2(normalCost * factor);

    let promoSellPrice: number | null = null;
    let promoDiscountPercent: number | null = null;
    let promoSince: string | null = null;
    if (inPromo) {
      const candidate = round2(sellPrice * (cost / normalCost));
      if (candidate > 0 && candidate < sellPrice) {
        promoSellPrice = candidate;
        promoDiscountPercent = Math.round((1 - cost / normalCost) * 100);
        promoSince = (prev?.promoSince as string | null | undefined) ?? now.toISOString();
      }
    }

    const hadPromo = num(prev?.promoSellPrice) != null;
    if (promoSellPrice != null && !hadPromo) result.promoStarted.push(quantity);
    if (promoSellPrice == null && hadPromo) result.promoEnded.push(quantity);
    if (prev && prevCost != null && Math.abs(prevCost - cost) > EPS)
      result.costChanged.push(quantity);

    const effectiveSell = promoSellPrice ?? sellPrice;
    const margin = ((effectiveSell - cost) / effectiveSell) * 100;
    if (margin < 0) {
      result.alerts.push({ quantity, kind: "prejuizo", marginPercent: round2(margin) });
    } else if (margin < MIN_MARGIN_PERCENT) {
      result.alerts.push({ quantity, kind: "margem_baixa", marginPercent: round2(margin) });
    }
    if (promoSince) {
      const days = Math.floor((now.getTime() - new Date(promoSince).getTime()) / 86_400_000);
      if (days >= PROMO_MAX_DAYS) {
        result.alerts.push({
          quantity,
          kind: "promocao_longa",
          marginPercent: round2(margin),
          days,
        });
      }
    }

    result.table.push({
      quantity,
      price: cost,
      unitPrice: num(t.unit_price) ?? round4(cost / quantity),
      sellPrice,
      unitSellPrice: round4(sellPrice / quantity),
      listPrice: promoSellPrice != null ? normalCost : null,
      promoSince,
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
