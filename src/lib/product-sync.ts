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
