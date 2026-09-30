-- Reversão de 20260929050000: a view volta à definição de 20260929040000
-- (sem o filtro de equipe; reabre a leitura para qualquer autenticado).
--   psql "$SUPABASE_DB_URL" -1 -v ON_ERROR_STOP=1 -f <este arquivo>
--   delete from supabase_migrations.schema_migrations where version = '20260929050000';

create or replace view store.crm_product_sync_health
with (security_invoker = true)
as
select
  p.id, p.crm_id, p.name, p.slug, p.active, p.auto_sync, p.archived_at,
  p.sync_status as stored_status,
  st.status as sync_status,
  st.divergence, st.site_changed, st.crm_changed, st.orphan,
  p.synced_at, p.sync_version, p.source_updated_at,
  c.updated_at as crm_updated_at,
  p.updated_at as site_updated_at,
  p.content_hash, st.site_hash, p.last_sync_error,
  q.status as queue_status, q.events as queue_events, q.attempts as queue_attempts,
  q.next_attempt_at as queue_next_attempt_at, q.last_error as queue_last_error,
  p.unpublished_at, p.withdrawn_reason, p.withdrawn_by
from store.products p
left join public.products c on c.id = p.crm_id
cross join lateral store.product_sync_state(p.id) st
left join lateral (
  select * from store.product_sync_queue q
  where q.crm_product_id = p.crm_id and q.status in ('pending', 'processing', 'error')
  order by q.created_at desc limit 1
) q on true
where p.sync_origin = 'crm';

revoke all on store.crm_product_sync_health from anon;
grant select on store.crm_product_sync_health to authenticated, service_role;
