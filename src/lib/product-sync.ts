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
