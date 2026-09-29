import { describe, expect, it } from "vitest";
import {
  SYNC_STATUS_DISPLAY,
  describeSyncHealth,
  syncStatusDisplay,
  type ProductSyncHealth,
} from "@/lib/product-sync";

describe("syncStatusDisplay", () => {
  it("cobre os oito status do modelo", () => {
    expect(Object.keys(SYNC_STATUS_DISPLAY).sort()).toEqual([
      "archived",
      "attention",
      "error",
      "native",
      "pending",
      "stale",
      "synced",
      "syncing",
    ]);
  });

  it("só 'synced' aparece como sucesso", () => {
    const green = Object.entries(SYNC_STATUS_DISPLAY).filter(([, d]) => d.variant === "success");
    expect(green.map(([s]) => s)).toEqual(["synced"]);
  });

  it("desatualizado e erro nunca parecem sincronizados", () => {
    expect(syncStatusDisplay("stale").variant).toBe("warning");
    expect(syncStatusDisplay("error").variant).toBe("destructive");
  });

  it("status inesperado é sinalizado, não escondido", () => {
    expect(syncStatusDisplay("removed")).toEqual({
      label: "Status desconhecido",
      variant: "destructive",
    });
    expect(syncStatusDisplay(undefined).variant).toBe("destructive");
  });
});

describe("describeSyncHealth", () => {
  const base: ProductSyncHealth = {
    crm_id: "crm-1",
    divergence: null,
    synced_at: "2026-09-29T02:30:00Z",
    crm_updated_at: "2026-09-29T02:29:00Z",
    site_updated_at: "2026-09-29T02:30:00Z",
    last_sync_error: null,
    queue_status: null,
    queue_attempts: null,
    queue_next_attempt_at: null,
    queue_last_error: null,
  };
  const fmt = (iso: string) => iso.slice(11, 16);

  it("em dia: nenhum aviso, só as datas dos dois lados", () => {
    expect(describeSyncHealth(base, fmt)).toEqual({
      summary: [],
      dates: ["Publicado: 02:30", "Flow alterado: 02:29", "Loja alterada: 02:30"],
    });
  });

  it("diz qual lado mudou", () => {
    expect(describeSyncHealth({ ...base, divergence: "site" }, fmt).summary).toEqual([
      "Loja editada diretamente depois da publicação",
    ]);
    expect(describeSyncHealth({ ...base, divergence: "ambos" }, fmt).summary[0]).toMatch(
      /Flow e editado na loja/,
    );
  });

  it("mostra a fila e a próxima tentativa", () => {
    const h = {
      ...base,
      divergence: "flow" as const,
      queue_status: "pending" as const,
      queue_attempts: 2,
      queue_next_attempt_at: "2026-09-29T03:10:00Z",
      queue_last_error: "Defina a categoria",
    };
    expect(describeSyncHealth(h, fmt).summary).toEqual([
      "Alterado no Flow depois da publicação",
      "Republicação agendada às 03:10 (tentativa 3)",
      "Último erro: Defina a categoria",
    ]);
  });

  it("fila que desistiu aparece como tal, com o erro da publicação", () => {
    const h = {
      ...base,
      queue_status: "error" as const,
      queue_attempts: 5,
      last_sync_error: "Preço inválido",
    };
    expect(describeSyncHealth(h, fmt).summary).toEqual([
      "Fila desistiu após 5 tentativa(s)",
      "Último erro: Preço inválido",
    ]);
  });

  it("nunca publicado não inventa data", () => {
    expect(describeSyncHealth({ ...base, synced_at: null }, fmt).dates[0]).toBe("Nunca publicado");
  });
});
