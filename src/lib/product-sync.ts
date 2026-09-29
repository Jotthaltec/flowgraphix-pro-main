/**
 * Estado de sincronização de um produto da loja com o Flow.
 * Nativos da loja são sempre "native"; os demais valem só para sync_origin = "crm".
 * Ver supabase/migrations/20260929010000_modelo_sincronizacao_produtos.sql.
 */
export type ProductSyncStatus =
  | "native"
  | "pending"
  | "syncing"
  | "synced"
  | "stale"
  | "attention"
  | "error"
  | "archived";

type BadgeVariant = "success" | "warning" | "destructive" | "info" | "muted";

/**
 * Como mostrar cada status. O status vem de public.site_products, que desde a
 * migração 20260929030000 é calculado dos dados reais (hash da loja, edições no
 * Flow, fila), e não do valor gravado na última publicação.
 */
export const SYNC_STATUS_DISPLAY: Record<
  ProductSyncStatus,
  { label: string; variant: BadgeVariant }
> = {
  native: { label: "Produto da loja", variant: "muted" },
  pending: { label: "Aguardando publicação", variant: "info" },
  syncing: { label: "Publicando", variant: "info" },
  synced: { label: "Loja sincronizada", variant: "success" },
  stale: { label: "Flow alterado: republicar", variant: "warning" },
  attention: { label: "Loja com atenção", variant: "warning" },
  error: { label: "Falha na publicação", variant: "destructive" },
  archived: { label: "Arquivado", variant: "muted" },
};

export function syncStatusDisplay(status: string | null | undefined) {
  return (
    SYNC_STATUS_DISPLAY[status as ProductSyncStatus] ?? {
      label: "Status desconhecido",
      variant: "destructive" as const,
    }
  );
}

/** Linha de store.crm_product_sync_health (migração 20260929030000). */
export type ProductSyncHealth = {
  crm_id: string | null;
  divergence: "flow" | "site" | "ambos" | "orfao" | "sem_assinatura" | null;
  synced_at: string | null;
  crm_updated_at: string | null;
  site_updated_at: string | null;
  last_sync_error: string | null;
  queue_status: "pending" | "processing" | "error" | null;
  queue_attempts: number | null;
  queue_next_attempt_at: string | null;
  queue_last_error: string | null;
};

export const DIVERGENCE_LABEL: Record<NonNullable<ProductSyncHealth["divergence"]>, string> = {
  flow: "Alterado no Flow depois da publicação",
  site: "Loja editada diretamente depois da publicação",
  ambos: "Alterado no Flow e editado na loja",
  orfao: "O produto do Flow não existe mais",
  sem_assinatura: "Publicado antes da assinatura de conteúdo: republique para conferir",
};

const dateTime = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(iso),
  );

/**
 * Explica o status: o que divergiu, o que a fila está fazendo e o último erro.
 * `summary` cabe na lista; `dates` mostra quando cada lado mudou.
 */
export function describeSyncHealth(h: ProductSyncHealth, fmt: (iso: string) => string = dateTime) {
  const summary: string[] = [];
  if (h.divergence) summary.push(DIVERGENCE_LABEL[h.divergence] ?? `Divergência: ${h.divergence}`);

  if (h.queue_status === "pending") {
    const when = h.queue_next_attempt_at ? ` às ${fmt(h.queue_next_attempt_at)}` : "";
    const retry = h.queue_attempts ? ` (tentativa ${h.queue_attempts + 1})` : "";
    summary.push(`Republicação agendada${when}${retry}`);
  } else if (h.queue_status === "processing") {
    summary.push("Republicando agora");
  } else if (h.queue_status === "error") {
    summary.push(`Fila desistiu após ${h.queue_attempts ?? 0} tentativa(s)`);
  }

  const error = h.queue_last_error ?? h.last_sync_error;
  if (error) summary.push(`Último erro: ${error}`);

  const dates = [
    h.synced_at ? `Publicado: ${fmt(h.synced_at)}` : "Nunca publicado",
    h.crm_updated_at ? `Flow alterado: ${fmt(h.crm_updated_at)}` : null,
    h.site_updated_at ? `Loja alterada: ${fmt(h.site_updated_at)}` : null,
  ].filter((d): d is string => d !== null);

  return { summary, dates };
}
