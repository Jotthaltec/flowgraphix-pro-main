/**
 * OPs dos pedidos da loja (store.production_orders) — o quadro oficial de
 * produção desde a migração 20260930030000. Mover uma OP de etapa conduz a
 * situação do pedido (sempre para frente) no banco; aqui só há rótulos e a
 * equivalência com as faixas do painel do CRM.
 */

export const STORE_STAGES = [
  "fila_entrada",
  "conferencia",
  "pre_impressao",
  "impressao",
  "recorte",
  "acabamento",
  "montagem",
  "controle_qualidade",
  "embalagem",
  "finalizado",
] as const;

export type StoreStage = (typeof STORE_STAGES)[number];

export const STORE_STAGE_LABEL: Record<StoreStage, string> = {
  fila_entrada: "Fila de entrada",
  conferencia: "Conferência",
  pre_impressao: "Pré-impressão",
  impressao: "Impressão",
  recorte: "Recorte",
  acabamento: "Acabamento",
  montagem: "Montagem",
  controle_qualidade: "Controle de qualidade",
  embalagem: "Embalagem",
  finalizado: "Finalizado",
};

/** Faixas do painel do CRM (as mesmas do PCP interno). */
export type DashboardBucket =
  | "aguardando"
  | "pre_impressao"
  | "impressao"
  | "acabamento"
  | "finalizado";

export function stageBucket(stage: string): DashboardBucket {
  switch (stage) {
    case "pre_impressao":
      return "pre_impressao";
    case "impressao":
    case "recorte":
      return "impressao";
    case "acabamento":
    case "montagem":
    case "controle_qualidade":
    case "embalagem":
      return "acabamento";
    case "finalizado":
      return "finalizado";
    default:
      return "aguardando";
  }
}

export type StoreProductionOrder = {
  id: string;
  number: string;
  stage: string;
  priority: string | null;
  due_date: string | null;
};

/** Contagens das OPs da loja para somar às do PCP interno. */
export function storeProductionMetrics(ops: StoreProductionOrder[], today = new Date()) {
  const day = new Date(today);
  day.setHours(0, 0, 0, 0);
  const late = ops.filter((o) => {
    if (!o.due_date || o.stage === "finalizado") return false;
    const due = new Date(`${o.due_date.slice(0, 10)}T00:00:00`);
    return due < day;
  }).length;
  const buckets: Record<DashboardBucket, number> = {
    aguardando: 0,
    pre_impressao: 0,
    impressao: 0,
    acabamento: 0,
    finalizado: 0,
  };
  for (const o of ops) buckets[stageBucket(o.stage)]++;
  return {
    total: ops.length,
    inProgress: ops.filter((o) => o.stage !== "fila_entrada" && o.stage !== "finalizado").length,
    done: buckets.finalizado,
    urgent: ops.filter((o) => o.priority === "urgente" || o.priority === "alta").length,
    late,
    buckets,
  };
}
