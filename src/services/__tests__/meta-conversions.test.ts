import { describe, expect, it, vi } from "vitest";
import {
  buildEventRequest,
  classifyResponse,
  readyConfig,
  sanitizeMessage,
  sendServerEvent,
  serverEventSchema,
  type ReadyCapiConfig,
  type ServerEvent,
} from "@/services/meta/conversions";

const TOKEN = "EAAB" + "x".repeat(40);
const config: ReadyCapiConfig = {
  mode: "test",
  pixelId: "123456789012345",
  testEventCode: "TEST123",
  graphApiVersion: "v25.0",
  accessToken: TOKEN,
};
const hash = "a".repeat(64);
const event: ServerEvent = {
  event_name: "Purchase",
  event_id: "purchase:3f2b8c4e-1d2a-4b3c-8d4e-5f6a7b8c9d0e",
  event_time: 1_790_000_000,
  action_source: "website",
  event_source_url: "https://nexusprinti.com.br/produtos/cartao",
  user_data: { em: [hash], ph: [hash], client_user_agent: "Mozilla/5.0" },
  custom_data: { currency: "BRL", value: 100, order_id: "NP-26-01005", contents: [] },
};

describe("readyConfig", () => {
  const base = {
    enabled: true,
    mode: "test",
    pixel_id: "123456789012345",
    test_event_code: "TEST123",
    graph_api_version: "v25.0",
    access_token: TOKEN,
  };
  it("aceita configuração completa", () => {
    expect(readyConfig(base)).toMatchObject({ ok: true, config: { testEventCode: "TEST123" } });
  });
  it("desligado, sem token ou sem pixel não envia", () => {
    expect(readyConfig({ ...base, enabled: false })).toEqual({ ok: false, reason: "desligado" });
    expect(readyConfig({ ...base, access_token: null })).toEqual({
      ok: false,
      reason: "desligado",
    });
    expect(readyConfig({ ...base, pixel_id: null })).toEqual({ ok: false, reason: "desligado" });
  });
  it("modo teste sem código de teste nunca envia (sairia como evento real)", () => {
    expect(readyConfig({ ...base, test_event_code: null })).toEqual({
      ok: false,
      reason: "teste_sem_codigo",
    });
  });
  it("modo real não manda código de teste", () => {
    const r = readyConfig({ ...base, mode: "live" });
    expect(r.ok && r.config.testEventCode).toBeNull();
  });
  it("configuração malformada é rejeitada", () => {
    expect(readyConfig({ ...base, graph_api_version: "latest" })).toEqual({
      ok: false,
      reason: "config_invalida",
    });
    expect(readyConfig(null)).toEqual({ ok: false, reason: "config_invalida" });
  });
});

describe("serverEventSchema", () => {
  it("aceita o evento gravado pelo banco, inclusive campos extras em custom_data", () => {
    expect(serverEventSchema.safeParse(event).success).toBe(true);
  });
  it("recusa e-mail em texto puro, URL http e evento sem user agent", () => {
    expect(
      serverEventSchema.safeParse({ ...event, user_data: { ...event.user_data, em: ["a@b.com"] } })
        .success,
    ).toBe(false);
    expect(
      serverEventSchema.safeParse({ ...event, event_source_url: "http://nexusprinti.com.br" })
        .success,
    ).toBe(false);
    expect(serverEventSchema.safeParse({ ...event, user_data: { em: [hash] } }).success).toBe(
      false,
    );
  });
  it("recusa event_id fora do padrão compartilhado com o Pixel", () => {
    expect(serverEventSchema.safeParse({ ...event, event_id: "random-123" }).success).toBe(false);
  });
});

describe("buildEventRequest", () => {
  it("token vai no corpo, não na URL; código de teste só em modo teste", () => {
    const req = buildEventRequest(config, event);
    expect(req.url).toBe("https://graph.facebook.com/v25.0/123456789012345/events");
    expect(req.url).not.toContain(TOKEN);
    expect(req.body).toMatchObject({ access_token: TOKEN, test_event_code: "TEST123" });
    expect(
      buildEventRequest({ ...config, mode: "live", testEventCode: null }, event).body,
    ).not.toHaveProperty("test_event_code");
  });
});

describe("classifyResponse (contrato da Meta)", () => {
  it("sucesso documentado", () => {
    expect(classifyResponse(200, { events_received: 1, messages: [], fbtrace_id: "Ab1" })).toEqual({
      httpStatus: 200,
      errorCode: null,
      errorMessage: null,
      fbtraceId: "Ab1",
      eventsReceived: 1,
    });
  });
  it("2xx sem confirmação ou com corpo inesperado não conta como enviado", () => {
    expect(classifyResponse(200, { events_received: 0 }).httpStatus).toBe(422);
    expect(classifyResponse(200, "<html>").httpStatus).toBe(422);
  });
  it("token expirado (190) e parâmetro inválido (100) são finais e sanitizados", () => {
    const expired = classifyResponse(401, {
      error: {
        message: `Error validating access token: access_token=${TOKEN} expired`,
        type: "OAuthException",
        code: 190,
        error_subcode: 463,
        fbtrace_id: "X",
      },
    });
    expect(expired).toMatchObject({ httpStatus: 401, errorCode: "190.463", fbtraceId: "X" });
    expect(expired.errorMessage).not.toContain(TOKEN);
    expect(
      classifyResponse(400, { error: { code: 100, message: "Invalid parameter" } }).errorCode,
    ).toBe("100");
  });
  it("429 e 5xx sem corpo reconhecível guardam só o status", () => {
    expect(classifyResponse(429, null)).toMatchObject({ httpStatus: 429, errorCode: "http_429" });
    expect(classifyResponse(503, { unexpected: true })).toMatchObject({
      httpStatus: 503,
      errorCode: "http_503",
      errorMessage: null,
    });
  });
});

describe("sendServerEvent", () => {
  it("envia uma vez e devolve o resultado", async () => {
    const fetchMock = vi.fn(async () => Response.json({ events_received: 1, fbtrace_id: "T" }));
    const out = await sendServerEvent(config, event, fetchMock as unknown as typeof fetch);
    expect(out.httpStatus).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(JSON.parse(String(init.body)).data[0].event_id).toBe(event.event_id);
  });
  it("timeout vira status 0 (o banco decide repetir; a Meta deduplica pelo event_id)", async () => {
    const fetchMock = vi.fn(async () => {
      throw new DOMException("timeout", "TimeoutError");
    });
    expect(
      await sendServerEvent(config, event, fetchMock as unknown as typeof fetch),
    ).toMatchObject({
      httpStatus: 0,
      errorCode: "timeout",
    });
  });
  it("falha de rede vira status 0 com código próprio", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    expect(
      (await sendServerEvent(config, event, fetchMock as unknown as typeof fetch)).errorCode,
    ).toBe("rede");
  });
  it("resposta que não é JSON não quebra", async () => {
    const fetchMock = vi.fn(async () => new Response("bad gateway", { status: 502 }));
    expect(
      await sendServerEvent(config, event, fetchMock as unknown as typeof fetch),
    ).toMatchObject({
      httpStatus: 502,
      errorCode: "http_502",
    });
  });
});

describe("sanitizeMessage", () => {
  it("remove token e limita tamanho", () => {
    expect(sanitizeMessage(`x ${TOKEN} y`)).toBe("x [token removido] y");
    expect(sanitizeMessage("a".repeat(500))?.length).toBe(300);
    expect(sanitizeMessage(undefined)).toBeNull();
  });
});
