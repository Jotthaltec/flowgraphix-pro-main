-- Painel de saúde da integração: só para a equipe da loja (fase 7).
--
-- store.crm_product_sync_health herdava a leitura pública de store.products:
-- qualquer usuário autenticado (inclusive cliente da loja, que usa o mesmo
-- Supabase) lia pela API o último erro de publicação, o motivo de retirada e
-- o estado da fila dos produtos ativos. A view passa a devolver linhas só para
-- a equipe (store.is_staff()). O status em public.site_products continua
-- público: é só o rótulo, sem erro nem motivo.
--
-- Mesma definição de 20260929040000, com o filtro no final.

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
where p.sync_origin = 'crm'
  and store.is_staff();

revoke all on store.crm_product_sync_health from anon;
grant select on store.crm_product_sync_health to authenticated, service_role;
