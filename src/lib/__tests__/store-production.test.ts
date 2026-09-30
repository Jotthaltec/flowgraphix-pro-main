import { describe, expect, it } from "vitest";
import {
  STORE_STAGES,
  STORE_STAGE_LABEL,
  stageBucket,
  storeProductionMetrics,
} from "@/lib/store-production";

describe("stageBucket", () => {
  it("toda etapa da loja cai numa faixa do painel", () => {
    expect(STORE_STAGES.map(stageBucket)).toEqual([
      "aguardando",
      "aguardando",
      "pre_impressao",
      "impressao",
      "impressao",
      "acabamento",
      "acabamento",
      "acabamento",
      "acabamento",
      "finalizado",
    ]);
  });

  it("todas as etapas têm rótulo", () => {
    expect(STORE_STAGES.every((s) => STORE_STAGE_LABEL[s].length > 0)).toBe(true);
  });
});

describe("storeProductionMetrics", () => {
  const hoje = new Date("2026-09-30T12:00:00");
  const ops = [
    { id: "1", number: "OP-1", stage: "fila_entrada", priority: "normal", due_date: "2026-10-05" },
    { id: "2", number: "OP-2", stage: "impressao", priority: "alta", due_date: "2026-09-28" },
    { id: "3", number: "OP-3", stage: "embalagem", priority: "urgente", due_date: null },
    { id: "4", number: "OP-4", stage: "finalizado", priority: "normal", due_date: "2026-09-01" },
  ];

  it("conta andamento, concluídas, urgentes e atrasadas", () => {
    expect(storeProductionMetrics(ops, hoje)).toMatchObject({
      total: 4,
      inProgress: 2,
      done: 1,
      urgent: 2,
      late: 1, // a finalizada vencida não conta como atraso
      buckets: { aguardando: 1, pre_impressao: 0, impressao: 1, acabamento: 1, finalizado: 1 },
    });
  });

  it("sem OPs, tudo zero", () => {
    expect(storeProductionMetrics([], hoje).total).toBe(0);
  });
});
