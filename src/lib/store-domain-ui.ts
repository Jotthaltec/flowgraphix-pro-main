import {
  ORDER_STATUSES,
  ORDER_STATUS_META,
  PAYMENT_STATUS_META,
  QUOTE_STATUS_META,
  type OrderStatus,
  type QuoteStatus,
  type PaymentStatus,
  type Tone,
} from "@/lib/store-domain";

/** Cor do site (Tone) → variante do StatusBadge do CRM. */
export type BadgeVariant =
  "default" | "success" | "warning" | "destructive" | "info" | "accent" | "muted";

export const TONE_VARIANT: Record<Tone, BadgeVariant> = {
  neutral: "muted",
  info: "info",
  warning: "warning",
  success: "success",
  danger: "destructive",
  brand: "accent",
};

export const toneVariant = (tone: Tone | undefined): BadgeVariant =>
  tone ? TONE_VARIANT[tone] : "default";

/**
 * Grupos de filtro da lista de pedidos — os mesmos de
 * Nexus-Printi/src/app/admin/pedidos/page.tsx.
 */
export const ORDER_FILTERS: { value: string; label: string; statuses?: readonly string[] }[] = [
  { value: "", label: "Todos" },
  {
    value: "abertos",
    label: "Em andamento",
    statuses: ORDER_STATUSES.filter((s) => !["concluido", "cancelado", "entregue"].includes(s)),
  },
  {
    value: "pagamento",
    label: "Aguardando pagamento",
    statuses: ["aguardando_pagamento", "pagamento_analise"],
  },
  {
    value: "arte",
    label: "Arte",
    statuses: [
      "aguardando_arquivos",
      "arte_analise",
      "arte_criacao",
      "aguardando_aprovacao",
      "alteracao_solicitada",
    ],
  },
  {
    value: "producao",
    label: "Produção",
    statuses: ["aprovado_producao", "em_producao", "acabamento", "controle_qualidade", "embalagem"],
  },
  { value: "entrega", label: "Entrega", statuses: ["pronto_retirada", "enviado"] },
  { value: "atrasados", label: "Atrasados" },
  { value: "concluidos", label: "Concluídos", statuses: ["entregue", "concluido"] },
  { value: "cancelados", label: "Cancelados", statuses: ["cancelado"] },
];

export function orderStatusMeta(status: string) {
  return (
    ORDER_STATUS_META[status as OrderStatus] ?? {
      label: status,
      tone: "neutral" as Tone,
      group: "",
    }
  );
}

export function paymentStatusMeta(status: string) {
  return PAYMENT_STATUS_META[status as PaymentStatus] ?? { label: status, tone: "neutral" as Tone };
}

/** Filtros da lista de orçamentos — os mesmos de Nexus-Printi/src/app/admin/orcamentos/page.tsx. */
export const QUOTE_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "rascunho", label: "Rascunhos" },
  { value: "enviado", label: "Enviados" },
  { value: "em_negociacao", label: "Em negociação" },
  { value: "aprovado", label: "Aprovados" },
  { value: "convertido", label: "Convertidos" },
  { value: "recusado", label: "Recusados" },
];

export function quoteStatusMeta(status: string) {
  return QUOTE_STATUS_META[status as QuoteStatus] ?? { label: status, tone: "neutral" as Tone };
}

/**
 * Colunas do quadro de pedidos (Produção → Visão de Pedidos): os grupos de
 * ORDER_STATUS_META do site. Soltar um pedido na coluna leva à situação de
 * entrada dela; a situação exata se ajusta abrindo o pedido.
 */
export const ORDER_BOARD_COLUMNS: {
  id: string;
  title: string;
  statuses: readonly string[];
  enter: OrderStatus;
}[] = [
  {
    id: "pagamento",
    title: "Pagamento",
    statuses: ["pedido_recebido", "aguardando_pagamento", "pagamento_analise", "pago"],
    enter: "aguardando_pagamento",
  },
  {
    id: "arte",
    title: "Arte",
    statuses: [
      "aguardando_arquivos",
      "arte_analise",
      "arte_criacao",
      "aguardando_aprovacao",
      "alteracao_solicitada",
    ],
    enter: "aguardando_arquivos",
  },
  {
    id: "producao",
    title: "Produção",
    statuses: ["aprovado_producao", "em_producao", "acabamento", "controle_qualidade", "embalagem"],
    enter: "aprovado_producao",
  },
  {
    id: "entrega",
    title: "Entrega",
    statuses: ["pronto_retirada", "enviado"],
    enter: "pronto_retirada",
  },
  { id: "concluidos", title: "Concluídos", statuses: ["entregue", "concluido"], enter: "entregue" },
];
