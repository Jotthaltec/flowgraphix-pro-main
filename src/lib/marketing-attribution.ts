/**
 * Leitura da origem de marketing de um pedido (store.order_attributions).
 * A atribuição só existe depois do pagamento; antes disso não há o que mostrar.
 */

export type OrderAttributionRow = {
  channel: string;
  utm_source: string | null;
  utm_campaign: string | null;
  status: string;
  is_primary: boolean;
  source: string;
};

export const CHANNEL_LABELS: Record<string, string> = {
  paid_social: "Anúncio (redes)",
  organic_social: "Redes sociais",
  paid_search: "Anúncio (busca)",
  organic_search: "Busca orgânica",
  email: "E-mail",
  referral: "Indicação de site",
  other: "Outra origem",
  direct: "Direto / não rastreado",
};

export type OrderOrigin = {
  label: string;
  detail: string | null;
  reversed: boolean;
  manual: boolean;
};

/** Origem principal do pedido, ou null quando ainda não há atribuição (pedido não pago). */
export function summarizeOrderOrigin(
  rows: OrderAttributionRow[] | null | undefined,
): OrderOrigin | null {
  const primary = rows?.find((row) => row.is_primary);
  if (!primary) return null;
  const detail = primary.utm_campaign ?? primary.utm_source ?? null;
  return {
    label: CHANNEL_LABELS[primary.channel] ?? "Outra origem",
    detail: primary.channel === "direct" ? null : detail,
    reversed: primary.status === "reversed",
    manual: primary.source === "manual",
  };
}
