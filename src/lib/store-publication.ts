/**
 * Publicação de um produto do Flow na loja Nexus.
 *
 * `store.publish_crm_product` é a única entrada (ver a migração
 * 20260929020000_publicacao_canonica.sql). Ela não lança erro quando a
 * publicação falha por regra de negócio: devolve `ok: false`, porque o
 * registro da falha em `store.sync_log` precisa sobreviver. Por isso quem
 * chama nunca pode tratar "sem erro do Supabase" como sucesso.
 */
import type { ProductSyncStatus } from "@/lib/product-sync";

export type PublishCounts = {
  images: number;
  option_groups: number;
  options: number;
  variants: number;
  tiers: number;
  source_variants?: number;
  merged_variants?: number;
  unmatched_variants?: number;
};

export type PublishSuccess = {
  ok: true;
  action: "insert" | "update" | "noop";
  product_id: string;
  /** Slug do produto na loja, para montar o link público. */
  slug: string;
  sync_status: ProductSyncStatus;
  sync_version: number;
  content_hash: string;
  counts: PublishCounts;
  warnings: string[];
};

export type PublishFailure = {
  ok: false;
  action: "error";
  product_id: string | null;
  sync_status: ProductSyncStatus | null;
  error: string;
  code: string;
  content_hash: string | null;
  warnings: string[];
};

export type PublishResult = PublishSuccess | PublishFailure;

export class PublishError extends Error {
  constructor(
    message: string,
    readonly result: PublishFailure | null,
  ) {
    super(message);
    this.name = "PublishError";
  }
}

/** Valida o formato devolvido pelo banco. Resposta inesperada é erro, nunca sucesso. */
export function parsePublishResult(data: unknown): PublishResult {
  if (!data || typeof data !== "object" || !("ok" in data)) {
    throw new PublishError("A loja devolveu uma resposta inesperada à publicação.", null);
  }
  const result = data as PublishResult;
  if (result.ok === true) {
    if (!result.product_id || !result.counts) {
      throw new PublishError("A loja confirmou a publicação sem identificar o produto.", null);
    }
    return { ...result, warnings: result.warnings ?? [] };
  }
  return { ...result, warnings: result.warnings ?? [] };
}

type RpcClient = {
  schema: (schema: string) => {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  };
};

/**
 * Publica e só retorna depois da confirmação do banco. Lança `PublishError`
 * tanto para erro de chamada quanto para publicação recusada (`ok: false`).
 */
export async function publishCrmProduct(
  client: RpcClient,
  crmProductId: string,
): Promise<PublishSuccess> {
  const { data, error } = await client
    .schema("store")
    .rpc("publish_crm_product", { p_crm_product_id: crmProductId });
  if (error) throw new PublishError(error.message, null);
  const result = parsePublishResult(data);
  if (!result.ok) throw new PublishError(result.error, result);
  return result;
}

export function describePublishSuccess(result: PublishSuccess): {
  level: "success" | "warning";
  title: string;
  description: string;
} {
  const c = result.counts;
  const title =
    result.action === "insert"
      ? "Produto publicado na loja Nexus."
      : result.action === "update"
        ? "Produto atualizado na loja Nexus."
        : "A loja já estava igual ao Flow; nada foi alterado.";
  const linked = c.source_variants
    ? ` Combinações do Flow: ${c.source_variants} → ${c.variants} na loja` +
      (c.merged_variants ? ` (${c.merged_variants} SKU(s) de tiragem unidos)` : "") +
      (c.unmatched_variants ? `, ${c.unmatched_variants} sem correspondência` : "") +
      "."
    : "";
  const summary =
    `${c.images} mídia(s), ${c.option_groups} grupo(s), ${c.options} opção(ões), ` +
    `${c.variants} variante(s) e ${c.tiers} tiragem(ns).${linked}`;
  const description = [summary, ...result.warnings].join(" ");
  return { level: result.warnings.length ? "warning" : "success", title, description };
}

/** Endereço público do produto na loja (rota `app/(loja)/produtos/[slug]` do site). */
export function storeProductUrl(lojaUrl: string, slug: string): string {
  return `${lojaUrl.replace(/\/+$/, "")}/produtos/${encodeURIComponent(slug)}`;
}

/**
 * Retirar um produto do Flow da loja (migração 20260929040000). Nunca apaga:
 * - `unpublish` tira da vitrine; volta com "Publicar na loja".
 * - `archive` deixa fora de venda com o histórico; só uma nova publicação o traz de volta.
 * O motivo é obrigatório e fica no produto e em `store.sync_log`.
 */
export type WithdrawMode = "unpublish" | "archive";

export type WithdrawResult = {
  ok: true;
  action: WithdrawMode;
  product_id: string;
  sync_status: ProductSyncStatus;
  cancelled_queue_items: number;
};

export const WITHDRAW_LABEL: Record<WithdrawMode, { action: string; done: string }> = {
  unpublish: { action: "Despublicar da loja", done: "Produto despublicado: saiu da vitrine." },
  archive: {
    action: "Arquivar na loja",
    done: "Produto arquivado: fora de venda, histórico preservado.",
  },
};

export async function withdrawCrmProduct(
  client: RpcClient,
  crmProductId: string,
  mode: WithdrawMode,
  reason: string,
): Promise<WithdrawResult> {
  const trimmed = reason.trim();
  if (!trimmed) throw new Error("Informe o motivo.");
  const { data, error } = await client
    .schema("store")
    .rpc(mode === "archive" ? "archive_crm_product" : "unpublish_crm_product", {
      p_crm_product_id: crmProductId,
      p_reason: trimmed,
    });
  if (error) throw new Error(error.message);
  const result = data as Partial<WithdrawResult> | null;
  if (!result || result.ok !== true || result.action !== mode || !result.product_id) {
    throw new Error("A loja devolveu uma resposta inesperada.");
  }
  return result as WithdrawResult;
}
