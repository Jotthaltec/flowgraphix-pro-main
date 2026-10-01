export const SUPPORTED_CHANNEL_PROVIDERS = ["mercado_livre", "shopee"] as const;

export type SupportedChannelProvider = (typeof SUPPORTED_CHANNEL_PROVIDERS)[number];

function normalizeStatus(rawStatus?: string | null, fallback = "pending") {
  if (!rawStatus) return fallback;
  const status = String(rawStatus).toLowerCase();
  if (status === "conectado") return "connected";
  if (status === "desconectado") return "disconnected";
  if (status === "expirado") return "expired";
  if (status === "erro") return "error";
  if (status === "ativo") return "published";
  if (status === "rascunho") return "draft";
  if (status === "publicando") return "publishing";
  return status;
}

/** Linha vinda do banco lida de forma tolerante (formatos antigos e novos). */
type LooseRow = Record<string, unknown>;

const asRecord = (value: unknown): LooseRow =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as LooseRow) : {};
const text = (value: unknown, fallback = ""): string => (value == null ? fallback : String(value));
const textOrNull = (value: unknown): string | null => (value == null ? null : String(value));

export function mapSalesChannelToCredentialRow(row: unknown) {
  const r = asRecord(row);
  const config = asRecord(r.config);

  return {
    id: text(r.id),
    company_id: text(r.company_id),
    platform: text(r.provider ?? r.platform, "mercado_livre"),
    credential_key: text(config.api_key ?? config.client_id ?? config.key),
    credential_secret: text(config.secret ?? config.client_secret ?? config.token),
    extra_config: Object.fromEntries(
      Object.entries(config)
        .filter(
          ([key]) =>
            !["api_key", "client_id", "key", "secret", "client_secret", "token"].includes(key),
        )
        .map(([key, value]) => [key, text(value)]),
    ),
    status: normalizeStatus(textOrNull(r.status), "disconnected"),
    last_verified_at: textOrNull(r.last_sync_at),
    error_message: textOrNull(r.error_message),
  };
}

export function mapChannelListingToDraft(row: unknown) {
  const r = asRecord(row);
  const channel = asRecord(r.sales_channels ?? r.channel);
  const product = asRecord(r.products ?? r.product);

  return {
    id: text(r.id),
    company_id: text(r.company_id),
    product_id: textOrNull(r.product_id),
    marketplace: text(channel.provider ?? r.provider, "mercado_livre"),
    title: text(r.title),
    description: text(r.description),
    price: Number(r.price ?? 0),
    category: text(r.category_externa ?? r.category),
    keywords: Array.isArray(r.keywords) ? r.keywords.map((k) => String(k)) : [],
    status: normalizeStatus(textOrNull(r.status), "draft"),
    external_id: textOrNull(r.external_id),
    error_message: textOrNull(r.last_error),
    created_at: textOrNull(r.created_at),
    updated_at: textOrNull(r.updated_at),
    products: {
      name: textOrNull(product.name),
      main_image_url: textOrNull(product.main_image_url),
    },
  };
}
