import { createFileRoute } from "@tanstack/react-router";
import { hasBearerSecret } from "@/lib/bearer-auth.server";
import {
  processNewProductCampaign,
  socialWebhookSchema,
} from "@/services/social-campaign/campaign.server";

function authorized(request: Request) {
  return hasBearerSecret(request, process.env.SOCIAL_WEBHOOK_SECRET);
}

export const Route = createFileRoute("/api/social/new-product")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorized(request))
          return Response.json(
            { error: { code: "unauthorized", message: "Credencial inválida." } },
            { status: 401 },
          );
        const length = Number(request.headers.get("content-length") || 0);
        if (length > 16_384)
          return Response.json(
            { error: { code: "payload_too_large", message: "Corpo excede o limite." } },
            { status: 413 },
          );
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json(
            { error: { code: "invalid_json", message: "JSON inválido." } },
            { status: 400 },
          );
        }
        const parsed = socialWebhookSchema.safeParse(body);
        if (!parsed.success)
          return Response.json(
            { error: { code: "invalid_payload", message: "Evento inválido." } },
            { status: 422 },
          );
        try {
          const result = await processNewProductCampaign(parsed.data.product_id);
          return Response.json(
            { data: result },
            { status: result.status === "duplicate" ? 200 : 202 },
          );
        } catch (error) {
          console.error("[social-campaign] falha ao processar produto", {
            productId: parsed.data.product_id,
            error: error instanceof Error ? error.message : "unknown",
          });
          return Response.json(
            {
              error: {
                code: "processing_failed",
                message: "A campanha não pôde ser processada agora.",
              },
            },
            { status: 503 },
          );
        }
      },
    },
  },
});
