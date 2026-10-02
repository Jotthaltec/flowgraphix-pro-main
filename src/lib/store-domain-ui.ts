import {
  ORDER_STATUSES,
  ORDER_STATUS_META,
  PAYMENT_STATUS_META,
  type OrderStatus,
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
