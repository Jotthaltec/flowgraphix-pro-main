import { describe, expect, it, vi } from "vitest";
import {
  checkMetaConnection,
  daysUntil,
  interpretPixel,
  interpretToken,
} from "@/services/meta/verify";

const now = new Date("2026-10-02T00:00:00Z");
const inDays = (d: number) => Math.floor(now.getTime() / 1000) + d * 86_400;

describe("interpretToken", () => {
  it("token pessoal válido avisa e mostra a validade", () => {
    const t = interpretToken(
      { data: { type: "USER", is_valid: true, expires_at: inDays(59), app_id: "55" } },
      now,
    );
    expect(t).toMatchObject({ ok: true, type: "USER", daysLeft: 59, appId: "55" });
    expect(t.message).toContain("pessoal");
  });
  it("usuário do sistema sem validade é ok", () => {
    const t = interpretToken({ data: { type: "SYSTEM_USER", is_valid: true } }, now);
    expect(t).toMatchObject({ ok: true, daysLeft: null, expiresAt: null });
  });
  it("vence em até 15 dias ou já venceu = alerta", () => {
    expect(
      interpretToken({ data: { type: "USER", is_valid: true, expires_at: inDays(10) } }, now).ok,
    ).toBe(false);
    expect(
      interpretToken({ data: { type: "USER", is_valid: true, expires_at: inDays(-1) } }, now)
        .message,
    ).toContain("vencido");
  });
  it("inválido, revogado ou resposta estranha", () => {
    expect(interpretToken({ data: { is_valid: false } }, now).ok).toBe(false);
    expect(interpretToken("<html>", now).ok).toBe(false);
  });
  it("daysUntil", () => {
    expect(daysUntil(undefined, now)).toBeNull();
    expect(daysUntil(inDays(3), now)).toBe(3);
  });
});

describe("interpretPixel", () => {
  it("pixel acessível", () => {
    expect(
      interpretPixel(
        "123",
        { id: "123", name: "Nexus Printi", owner_business: { id: "9", name: "Nexus Printi" } },
        "55",
      ),
    ).toMatchObject({ ok: true, name: "Nexus Printi", business: "Nexus Printi" });
  });
  it("ID do app no lugar do Pixel é apontado explicitamente", () => {
    const r = interpretPixel("55", { id: "55", name: "app" }, "55");
    expect(r.ok).toBe(false);
    expect(r.message).toContain("ID do app");
  });
  it("erros documentados viram mensagens acionáveis", () => {
    expect(interpretPixel("1", { error: { code: 100, message: "x" } }, null).message).toContain(
      "não é de um Pixel",
    );
    expect(interpretPixel("1", { error: { code: 200 } }, null).message).toContain("não tem acesso");
    expect(interpretPixel("1", null, null).ok).toBe(false);
  });
});

describe("checkMetaConnection", () => {
  it("consulta token e pixel e nunca devolve o token", async () => {
    const fetchMock = vi.fn(async (url: URL | string) => {
      const u = String(url);
      return Response.json(
        u.includes("debug_token")
          ? { data: { type: "USER", is_valid: true, expires_at: inDays(40), app_id: "55" } }
          : { id: "123", name: "Nexus Printi" },
      );
    });
    const r = await checkMetaConnection(
      { pixelId: "123", accessToken: "EAAB" + "x".repeat(40), graphApiVersion: "v25.0" },
      fetchMock as unknown as typeof fetch,
      now,
    );
    expect(r.pixel.ok).toBe(true);
    expect(r.token.daysLeft).toBe(40);
    expect(JSON.stringify(r)).not.toContain("EAAB");
    expect(r).not.toHaveProperty("token.appId");
  });
  it("falha de rede não quebra", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const r = await checkMetaConnection(
      { pixelId: "123", accessToken: "t", graphApiVersion: "v25.0" },
      fetchMock as unknown as typeof fetch,
      now,
    );
    expect(r.pixel.ok).toBe(false);
    expect(r.token.ok).toBe(false);
  });
});
