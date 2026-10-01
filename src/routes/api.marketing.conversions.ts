import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { hasBearerSecret } from "@/lib/bearer-auth.server";
import { readyConfig, sendServerEvent, serverEventSchema } from "@/services/meta/conversions";

/**
 * Worker da Conversions API. Chamado pelo pg_cron (store.dispatch_conversion_events)
 * ou manualmente com o mesmo segredo. Reserva eventos vencidos, envia um a um
 * e devolve o resultado ao banco, que aplica a política de repetição.
 * Responde só com contagens: nada de token, payload ou dado de cliente.
 */
const BATCH = 25;

async function dispatch() {
  const store = supabaseAdmin.schema("store");
  const { data: rawConfig, error: configError } = await store.rpc("meta_capi_config");
  if (configError) throw new Error(`config: ${configError.code}`);
  const ready = readyConfig(rawConfig);
  if (!ready.ok) return { status: "skipped" as const, reason: ready.reason };

  const { data: events, error: claimError } = await store.rpc("claim_conversion_events", {
    p_limit: BATCH,
  });
  if (claimError) throw new Error(`claim: ${claimError.code}`);

  const counts: Record<string, number> = {};
  for (const event of events ?? []) {
    const parsed = serverEventSchema.safeParse(event.payload);
    const outcome = parsed.success
      ? await sendServerEvent(ready.config, parsed.data)
      : {
          httpStatus: 422,
          errorCode: "payload_invalido",
          errorMessage: parsed.error.issues
            .map((i) => i.path.join("."))
            .join(", ")
            .slice(0, 300),
          fbtraceId: null,
          eventsReceived: null,
        };
    const { data: status, error } = await store.rpc("complete_conversion_event", {
      p_id: event.id,
      p_http_status: outcome.httpStatus,
      p_mode: ready.config.mode,
      p_error_code: outcome.errorCode ?? undefined,
      p_error_message: outcome.errorMessage ?? undefined,
      p_fbtrace_id: outcome.fbtraceId ?? undefined,
      p_events_received: outcome.eventsReceived ?? undefined,
    });
    // Sem gravar o resultado o evento volta à fila quando o lock vencer;
    // reenviar é seguro porque a Meta deduplica pelo event_id.
    const key = error ? "nao_registrado" : String(status);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return {
    status: "done" as const,
    mode: ready.config.mode,
    processed: events?.length ?? 0,
    counts,
  };
}

export const Route = createFileRoute("/api/marketing/conversions")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!hasBearerSecret(request, process.env.MARKETING_DISPATCH_SECRET)) {
          return Response.json(
            { error: { code: "unauthorized", message: "Credencial inválida." } },
            { status: 401 },
          );
        }
        try {
          const result = await dispatch();
          console.info("[marketing.capi] despacho", result);
          return Response.json({ data: result });
        } catch (error) {
          console.error("[marketing.capi] falha no despacho", {
            reason: error instanceof Error ? error.message : "unknown",
          });
          return Response.json(
            { error: { code: "dispatch_failed", message: "Despacho indisponível agora." } },
            { status: 503 },
          );
        }
      },
    },
  },
});
