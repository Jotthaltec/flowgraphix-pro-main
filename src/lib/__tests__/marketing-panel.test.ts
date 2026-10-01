import { describe, expect, it } from "vitest";
import {
  periodRange,
  rate,
  revenueRoas,
  saoPauloDate,
  signalHealth,
  type SignalStatus,
} from "@/lib/marketing-panel";

describe("período em São Paulo", () => {
  it("23h30 em SP ainda é o mesmo dia, mesmo já sendo o dia seguinte em UTC", () => {
    expect(saoPauloDate(new Date("2026-10-02T02:30:00Z"))).toBe("2026-10-01");
  });
  it("intervalos inclusivos terminando hoje", () => {
    const now = new Date("2026-10-01T15:00:00Z");
    expect(periodRange("hoje", now)).toEqual({ from: "2026-10-01", to: "2026-10-01" });
    expect(periodRange("7d", now)).toEqual({ from: "2026-09-25", to: "2026-10-01" });
    expect(periodRange("30d", now).from).toBe("2026-09-02");
  });
});

describe("métricas", () => {
  it("taxa sem base é null, não zero", () => {
    expect(rate(0, 0)).toBeNull();
    expect(rate(1, 4)).toBe(0.25);
  });
  it("ROAS só com investimento importado", () => {
    expect(revenueRoas(100, null, "Conta Meta ainda não importada.")).toEqual({
      value: null,
      reason: "Conta Meta ainda não importada.",
    });
    expect(revenueRoas(100, 0, null).value).toBeNull();
    expect(revenueRoas(150, 60, null)).toEqual({ value: 2.5, reason: null });
  });
});

const base: SignalStatus = {
  settings: {
    enabled: true,
    mode: "test",
    pixel_id: "123456789012345",
    test_event_code: "TEST1",
    graph_api_version: "v25.0",
    version: 1,
    updated_at: "2026-10-01T10:00:00Z",
  },
  token_configured: true,
  dispatch_configured: true,
  cron_active: true,
  queue: {},
  oldest_pending_at: null,
  last_sent_at: null,
  last_failure: null,
};

describe("signalHealth", () => {
  it("desligado quando não há configuração ou enabled=false", () => {
    expect(signalHealth({ ...base, settings: null }).state).toBe("desligado");
    expect(signalHealth({ ...base, settings: { ...base.settings!, enabled: false } }).state).toBe(
      "desligado",
    );
  });
  it("incompleto aponta o que falta", () => {
    const h = signalHealth({ ...base, token_configured: false });
    expect(h.state).toBe("incompleto");
    expect(h.checks.find((c) => !c.ok)?.label).toBe("Token da Conversions API no Vault");
  });
  it("modo teste sem código conta como incompleto", () => {
    expect(
      signalHealth({ ...base, settings: { ...base.settings!, test_event_code: null } }).state,
    ).toBe("incompleto");
  });
  it("teste e real", () => {
    expect(signalHealth(base).state).toBe("teste");
    expect(signalHealth({ ...base, settings: { ...base.settings!, mode: "live" } }).state).toBe(
      "real",
    );
  });
  it("fila parada há mais de 30 min com tudo configurado é sinalizada", () => {
    const now = new Date("2026-10-01T12:00:00Z");
    expect(signalHealth({ ...base, oldest_pending_at: "2026-10-01T11:00:00Z" }, now).stalled).toBe(
      true,
    );
    expect(signalHealth({ ...base, oldest_pending_at: "2026-10-01T11:50:00Z" }, now).stalled).toBe(
      false,
    );
    expect(
      signalHealth(
        { ...base, token_configured: false, oldest_pending_at: "2026-10-01T11:00:00Z" },
        now,
      ).stalled,
    ).toBe(false);
  });
});
