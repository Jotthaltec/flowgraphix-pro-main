import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { capiConfigSchema } from "@/services/meta/conversions";
import { checkMetaConnection } from "@/services/meta/verify";

/**
 * "Verificar conexão com a Meta" do painel. Exige a sessão do usuário
 * (Authorization: Bearer <access token do Supabase>) e a permissão de
 * marketing, conferida pelo próprio banco. O token da Meta só é usado aqui,
 * servidor → Meta; a resposta traz apenas o diagnóstico.
 */
const json = (body: unknown, status = 200) => Response.json(body, { status });

export const Route = createFileRoute("/api/marketing/verify-meta")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!userToken || !url || !key) {
          return json({ error: { code: "unauthorized", message: "Sessão ausente." } }, 401);
        }
        const asUser = createClient(url, key, {
          global: { headers: { Authorization: `Bearer ${userToken}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        // marketing_signal_status recusa (42501) quem não pode ver o módulo.
        const { error: permError } = await asUser.schema("store").rpc("marketing_signal_status");
        if (permError) {
          return json(
            { error: { code: "forbidden", message: "Sem permissão para Anúncios e Crescimento." } },
            403,
          );
        }

        const { data: rawConfig, error } = await supabaseAdmin
          .schema("store")
          .rpc("meta_capi_config");
        if (error)
          return json({ error: { code: "config", message: "Configuração indisponível." } }, 503);
        const config = capiConfigSchema.safeParse(rawConfig);
        if (!config.success || !config.data.pixel_id || !config.data.access_token) {
          return json({
            data: {
              pixel: {
                ok: false,
                name: null,
                business: null,
                message: "Informe o Pixel e salve antes de verificar.",
              },
              token: {
                ok: Boolean(config.success && config.data.access_token),
                type: null,
                expiresAt: null,
                daysLeft: null,
                message:
                  config.success && config.data.access_token
                    ? "Token presente no Vault."
                    : "Token ausente no Vault.",
              },
            },
          });
        }
        const result = await checkMetaConnection({
          pixelId: config.data.pixel_id,
          accessToken: config.data.access_token,
          graphApiVersion: config.data.graph_api_version,
        });
        return json({ data: result });
      },
    },
  },
});
