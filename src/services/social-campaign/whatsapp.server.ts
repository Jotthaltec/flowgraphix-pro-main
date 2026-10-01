const GRAPH_VERSION = "v23.0";
interface WhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
  recipient: string;
  fetchImpl?: typeof fetch;
}

async function uploadMedia(config: WhatsAppConfig, bytes: Buffer, filename: string) {
  const body = new FormData();
  body.set("messaging_product", "whatsapp");
  body.set("type", "image/png");
  body.set("file", new Blob([new Uint8Array(bytes)], { type: "image/png" }), filename);
  const response = await (config.fetchImpl ?? fetch)(
    `https://graph.facebook.com/${GRAPH_VERSION}/${config.phoneNumberId}/media`,
    { method: "POST", headers: { authorization: `Bearer ${config.accessToken}` }, body },
  );
  if (!response.ok) throw new Error(`WhatsApp recusou a arte (HTTP ${response.status}).`);
  const result = (await response.json()) as { id?: string };
  if (!result.id) throw new Error("WhatsApp não devolveu o id da mídia.");
  return result.id;
}
async function sendImage(config: WhatsAppConfig, mediaId: string, caption: string) {
  const response = await (config.fetchImpl ?? fetch)(
    `https://graph.facebook.com/${GRAPH_VERSION}/${config.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: config.recipient,
        type: "image",
        image: { id: mediaId, caption },
      }),
    },
  );
  if (!response.ok) throw new Error(`WhatsApp recusou a mensagem (HTTP ${response.status}).`);
}

export async function sendCampaignForApproval(input: {
  productName: string;
  feed: Buffer;
  story: Buffer;
  caption: string;
}) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const recipient = process.env.SOCIAL_APPROVAL_WHATSAPP_TO;
  if (!accessToken || !phoneNumberId || !recipient)
    return { sent: false as const, reason: "whatsapp_not_configured" as const };
  const config = { accessToken, phoneNumberId, recipient };
  const [feedId, storyId] = await Promise.all([
    uploadMedia(config, input.feed, "feed.png"),
    uploadMedia(config, input.story, "story.png"),
  ]);
  await sendImage(
    config,
    feedId,
    `FEED — ${input.productName}\n\n${input.caption}\n\nResponda APROVADO ou escreva os ajustes.`,
  );
  await sendImage(config, storyId, `STORY — ${input.productName}`);
  return { sent: true as const };
}
