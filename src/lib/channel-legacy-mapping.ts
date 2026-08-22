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

export function mapSalesChannelToCredentialRow(row: any) {
  const config = (row?.config && typeof row.config === "object" && !Array.isArray(row.config)) ? row.config : {};

  return {
    id: row?.id ?? "",
    company_id: row?.company_id ?? "",
    platform: row?.provider ?? row?.platform ?? "mercado_livre",
    credential_key: String(config?.api_key ?? config?.client_id ?? config?.key ?? ""),
    credential_secret: String(config?.secret ?? config?.client_secret ?? config?.token ?? ""),
    extra_config: Object.fromEntries(
      Object.entries(config ?? {}).filter(([key]) => !["api_key", "client_id", "key", "secret", "client_secret", "token"].includes(key))
    ),
    status: normalizeStatus(row?.status, "disconnected"),
    last_verified_at: row?.last_sync_at ?? null,
    error_message: row?.error_message ?? null,
  };
}

export function mapChannelListingToDraft(row: any) {
  const channel = row?.sales_channels ?? row?.channel ?? {};
  const product = row?.products ?? row?.product ?? {};

  return {
    id: row?.id ?? "",
    company_id: row?.company_id ?? "",
    product_id: row?.product_id ?? null,
    marketplace: channel?.provider ?? row?.provider ?? "mercado_livre",
    title: row?.title ?? "",
    description: row?.description ?? "",
    price: Number(row?.price ?? 0),
    category: row?.category_externa ?? row?.category ?? "",
    keywords: Array.isArray(row?.keywords) ? row?.keywords : [],
    status: normalizeStatus(row?.status, "draft"),
    external_id: row?.external_id ?? null,
    error_message: row?.last_error ?? null,
    created_at: row?.created_at ?? null,
    updated_at: row?.updated_at ?? null,
    products: product,
  };
}
