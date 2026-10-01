import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { generateCampaignCopy, type ProductFacts } from "./openai.server";
import { renderCampaign } from "./render.server";
import { sendCampaignForApproval } from "./whatsapp.server";

export const socialWebhookSchema = z.object({ product_id: z.string().uuid() }).strict();

const productSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  short_description: z.string().nullable(),
  description: z.string().nullable(),
  benefits: z.array(z.string()),
  materials: z.array(z.string()),
  applications: z.array(z.string()),
  base_price: z.coerce.number().nonnegative(),
  sale_price: z.coerce.number().nonnegative().nullable(),
  price_unit: z.string(),
  min_quantity: z.number().int().positive(),
  production_days: z.number().int().nonnegative(),
  on_sale: z.boolean(),
  active: z.boolean(),
  archived_at: z.string().nullable(),
  unpublished_at: z.string().nullable(),
  sync_status: z.string(),
  created_at: z.string(),
});

const imageSchema = z.object({
  url: z.string().url(),
  kind: z.string(),
  position: z.number().int(),
});
type StoreClient = ReturnType<typeof supabaseAdmin.schema>;
function store(): StoreClient {
  return supabaseAdmin.schema("store");
}

async function setCampaign(productId: string, values: Record<string, unknown>) {
  // A tabela nasce na mesma entrega; os tipos gerados serão atualizados após a migration remota.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (store() as any)
    .from("social_product_campaigns")
    .update(values)
    .eq("product_id", productId);
  if (error) throw new Error(`Falha ao atualizar campanha: ${error.message}`);
}

async function claim(productId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertError } = await (store() as any)
    .from("social_product_campaigns")
    .insert({ product_id: productId, status: "processing" });
  if (!insertError) return true;
  if (insertError.code !== "23505")
    throw new Error(`Falha ao registrar campanha: ${insertError.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (store() as any)
    .from("social_product_campaigns")
    .update({ status: "processing", last_error: null, updated_at: new Date().toISOString() })
    .eq("product_id", productId)
    .in("status", ["waiting_data", "retryable_error"])
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`Falha ao reservar campanha: ${error.message}`);
  return Boolean(data);
}

async function downloadProductImage(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok)
    throw new Error(`A foto cadastrada não pôde ser baixada (HTTP ${response.status}).`);
  const mime = (response.headers.get("content-type") || "").split(";")[0];
  if (!mime.startsWith("image/")) throw new Error("A URL cadastrada não retornou uma imagem.");
  const length = Number(response.headers.get("content-length") || 0);
  if (length > 12_000_000) throw new Error("A foto cadastrada ultrapassa 12 MB.");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 12_000_000) throw new Error("A foto cadastrada ultrapassa 12 MB.");
  return { bytes, mime };
}

async function uploadAssets(productId: string, feed: Buffer, story: Buffer) {
  const base = `${productId}/${Date.now()}`;
  const [feedResult, storyResult] = await Promise.all([
    supabaseAdmin.storage
      .from("social-campaigns")
      .upload(`${base}/feed.png`, feed, { contentType: "image/png", upsert: false }),
    supabaseAdmin.storage
      .from("social-campaigns")
      .upload(`${base}/story.png`, story, { contentType: "image/png", upsert: false }),
  ]);
  if (feedResult.error || storyResult.error)
    throw new Error(
      `Falha ao guardar as artes: ${feedResult.error?.message || storyResult.error?.message}`,
    );
  return { feedPath: feedResult.data.path, storyPath: storyResult.data.path };
}

export async function processNewProductCampaign(productId: string) {
  if (!(await claim(productId))) return { status: "duplicate" as const };
  try {
    const [{ data: rawProduct, error: productError }, { data: rawImages, error: imageError }] =
      await Promise.all([
        store()
          .from("products")
          .select(
            "id,name,slug,short_description,description,benefits,materials,applications,base_price,sale_price,price_unit,min_quantity,production_days,on_sale,active,archived_at,unpublished_at,sync_status,created_at",
          )
          .eq("id", productId)
          .maybeSingle(),
        store()
          .from("product_images")
          .select("url,kind,position")
          .eq("product_id", productId)
          .order("position", { ascending: true }),
      ]);
    if (productError) throw new Error(`Falha ao ler produto: ${productError.message}`);
    if (imageError) throw new Error(`Falha ao ler imagens: ${imageError.message}`);
    if (!rawProduct) {
      await setCampaign(productId, { status: "ignored", last_error: "Produto não encontrado." });
      return { status: "ignored" as const };
    }
    const product = productSchema.parse(rawProduct);
    if (
      !product.active ||
      product.archived_at ||
      product.unpublished_at ||
      !["native", "synced"].includes(product.sync_status)
    ) {
      await setCampaign(productId, {
        status: "ignored",
        last_error: "Produto ainda não está ativo e publicado.",
      });
      return { status: "ignored" as const };
    }
    const images = z.array(imageSchema).parse(rawImages ?? []);
    const selected = images.find((x) => x.kind === "foto") ?? images[0];
    if (!selected) {
      await setCampaign(productId, {
        status: "waiting_data",
        last_error: "O produto ainda não possui foto cadastrada.",
      });
      return { status: "waiting_data" as const };
    }
    const facts: ProductFacts = {
      name: product.name,
      shortDescription: product.short_description,
      description: product.description,
      benefits: product.benefits,
      materials: product.materials,
      applications: product.applications,
      price:
        product.on_sale && product.sale_price !== null ? product.sale_price : product.base_price,
      priceUnit: product.price_unit,
      minQuantity: product.min_quantity,
      productionDays: product.production_days,
      onSale: product.on_sale,
    };
    if (facts.price <= 0) {
      await setCampaign(productId, {
        status: "waiting_data",
        last_error: "O produto ainda não possui preço comercial válido.",
      });
      return { status: "waiting_data" as const };
    }
    const [{ bytes, mime }, copy] = await Promise.all([
      downloadProductImage(selected.url),
      generateCampaignCopy(facts),
    ]);
    const arts = await renderCampaign({
      copy,
      product: facts,
      productImage: bytes,
      productImageMime: mime,
    });
    const paths = await uploadAssets(productId, arts.feed, arts.story);
    const caption = `${copy.caption}\n\n${copy.hashtags.join(" ")}`;
    const delivery = await sendCampaignForApproval({
      productName: product.name,
      feed: arts.feed,
      story: arts.story,
      caption,
    });
    await setCampaign(productId, {
      status: delivery.sent ? "approval_sent" : "ready",
      product_snapshot: product,
      copy,
      caption,
      feed_path: paths.feedPath,
      story_path: paths.storyPath,
      notification_status: delivery.sent ? "sent" : delivery.reason,
      notified_at: delivery.sent ? new Date().toISOString() : null,
      completed_at: new Date().toISOString(),
    });
    return { status: delivery.sent ? ("approval_sent" as const) : ("ready" as const) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida";
    await setCampaign(productId, {
      status: "retryable_error",
      last_error: message.slice(0, 1000),
    }).catch(() => undefined);
    throw error;
  }
}
