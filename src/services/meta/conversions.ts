import { z } from "zod";

/**
 * Cliente da Conversions API (Meta). Sem estado e com `fetch` injetável:
 * a rota /api/marketing/conversions decide o que enviar; aqui só se monta a
 * requisição, se trata a resposta da Meta como dado não confiável e se
 * devolve um resultado sanitizado (sem token, sem payload).
 */

export const capiConfigSchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(["test", "live"]),
  pixel_id: z
    .string()
    .regex(/^\d{5,20}$/)
    .nullable(),
  test_event_code: z.string().nullable(),
  graph_api_version: z.string().regex(/^v\d{2}\.0$/),
  access_token: z.string().nullable(),
});
export type CapiConfig = z.infer<typeof capiConfigSchema>;

export type ReadyCapiConfig = {
  mode: "test" | "live";
  pixelId: string;
  testEventCode: string | null;
  graphApiVersion: string;
  accessToken: string;
};

/** Configuração utilizável ou o motivo de não enviar. Modo teste exige código de teste. */
export function readyConfig(
  raw: unknown,
): { ok: true; config: ReadyCapiConfig } | { ok: false; reason: string } {
  const parsed = capiConfigSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: "config_invalida" };
  const c = parsed.data;
  if (!c.enabled || !c.pixel_id || !c.access_token || c.access_token.length < 20) {
    return { ok: false, reason: "desligado" };
  }
  if (c.mode === "test" && !c.test_event_code) return { ok: false, reason: "teste_sem_codigo" };
  return {
    ok: true,
    config: {
      mode: c.mode,
      pixelId: c.pixel_id,
      testEventCode: c.mode === "test" ? c.test_event_code : null,
      graphApiVersion: c.graph_api_version,
      accessToken: c.access_token,
    },
  };
}

const sha256Hex = z.string().regex(/^[0-9a-f]{64}$/);

/** Formato que o banco grava em store.conversion_events.payload. */
export const serverEventSchema = z.object({
  event_name: z.enum(["Purchase", "Lead"]),
  event_id: z.string().regex(/^(purchase|lead):[0-9a-f-]{36}$/),
  event_time: z.number().int().positive(),
  action_source: z.literal("website"),
  event_source_url: z.url({ protocol: /^https$/ }),
  user_data: z.object({
    em: z.array(sha256Hex).optional(),
    ph: z.array(sha256Hex).optional(),
    external_id: z.array(sha256Hex).optional(),
    fbc: z.string().max(500).optional(),
    fbp: z.string().max(500).optional(),
    // Obrigatório para eventos web na Conversions API.
    client_user_agent: z.string().min(1).max(400),
  }),
  custom_data: z.looseObject({
    currency: z.literal("BRL"),
    value: z.number().nonnegative().optional(),
  }),
});
export type ServerEvent = z.infer<typeof serverEventSchema>;

export function buildEventRequest(config: ReadyCapiConfig, event: ServerEvent) {
  return {
    url: `https://graph.facebook.com/${config.graphApiVersion}/${config.pixelId}/events`,
    // Token no corpo, não na URL: URLs acabam em logs de proxy.
    body: {
      data: [event],
      access_token: config.accessToken,
      ...(config.testEventCode ? { test_event_code: config.testEventCode } : {}),
    },
  };
}

const successSchema = z.object({
  events_received: z.number().int().nonnegative(),
  fbtrace_id: z.string().optional(),
});
const errorSchema = z.object({
  error: z.object({
    message: z.string().optional(),
    type: z.string().optional(),
    code: z.union([z.number(), z.string()]).optional(),
    error_subcode: z.union([z.number(), z.string()]).optional(),
    fbtrace_id: z.string().optional(),
  }),
});

export type SendOutcome = {
  /** 0 = sem resposta (timeout/rede). O banco decide repetir ou encerrar. */
  httpStatus: number;
  errorCode: string | null;
  errorMessage: string | null;
  fbtraceId: string | null;
  eventsReceived: number | null;
};

/** Remove qualquer coisa parecida com token antes de gravar ou logar. */
export function sanitizeMessage(message: string | undefined | null): string | null {
  if (!message) return null;
  return message
    .replace(/access_token=[^&\s]+/gi, "access_token=[removido]")
    .replace(/\bEA[A-Za-z0-9]{20,}\b/g, "[token removido]")
    .slice(0, 300);
}

export function classifyResponse(httpStatus: number, body: unknown): SendOutcome {
  if (httpStatus >= 200 && httpStatus < 300) {
    const ok = successSchema.safeParse(body);
    if (ok.success && ok.data.events_received >= 1) {
      return {
        httpStatus,
        errorCode: null,
        errorMessage: null,
        fbtraceId: ok.data.fbtrace_id ?? null,
        eventsReceived: ok.data.events_received,
      };
    }
    // 2xx sem confirmação de recebimento não é sucesso; não repetir às cegas.
    return {
      httpStatus: 422,
      errorCode: "resposta_inesperada",
      errorMessage: "A Meta respondeu 2xx sem confirmar o evento.",
      fbtraceId: null,
      eventsReceived: ok.success ? ok.data.events_received : null,
    };
  }
  const err = errorSchema.safeParse(body);
  const code = err.success
    ? [err.data.error.code, err.data.error.error_subcode].filter((v) => v !== undefined).join(".")
    : "";
  return {
    httpStatus,
    errorCode: code || `http_${httpStatus}`,
    errorMessage: sanitizeMessage(err.success ? err.data.error.message : null),
    fbtraceId: err.success ? (err.data.error.fbtrace_id ?? null) : null,
    eventsReceived: null,
  };
}

export async function sendServerEvent(
  config: ReadyCapiConfig,
  event: ServerEvent,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 10_000,
): Promise<SendOutcome> {
  const request = buildEventRequest(config, event);
  let response: Response;
  try {
    response = await fetchImpl(request.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request.body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const timeout =
      error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return {
      httpStatus: 0,
      errorCode: timeout ? "timeout" : "rede",
      errorMessage: null,
      fbtraceId: null,
      eventsReceived: null,
    };
  }
  const body: unknown = await response.json().catch(() => null);
  return classifyResponse(response.status, body);
}
