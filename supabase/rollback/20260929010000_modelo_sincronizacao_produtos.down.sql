-- Reversão de 20260929010000_modelo_sincronizacao_produtos.sql.
-- Rode manualmente, numa transação, só se a migração precisar ser desfeita:
--   psql "$SUPABASE_DB_URL" -1 -v ON_ERROR_STOP=1 -f <este arquivo>
-- e depois: delete from supabase_migrations.schema_migrations where version = '20260929010000';
--
-- Perde: source_updated_at, content_hash e last_sync_error (informação derivada,
-- recriada na próxima publicação). Status novos são rebaixados para os antigos.

drop trigger if exists tr_products_guard_ownership on store.products;
drop function if exists store.guard_product_ownership();
drop trigger if exists products_set_updated_at on public.products;

alter table store.products drop constraint if exists products_sync_ownership_check;
alter table store.products drop constraint if exists products_sync_archived_check;
alter table store.products drop constraint if exists products_sync_status_check;

update store.products set sync_status = 'removed' where sync_status = 'archived';
update store.products set sync_status = 'attention' where sync_status in ('pending', 'syncing', 'stale');

alter table store.products add constraint products_sync_status_check
  check (sync_status = any (array['native', 'synced', 'attention', 'error', 'removed']));

create index if not exists products_crm_id_idx on store.products (crm_id) where crm_id is not null;

alter table store.products
  drop column if exists source_updated_at,
  drop column if exists content_hash,
  drop column if exists last_sync_error;

create or replace function store.remove_product_internal(p_product_id uuid, p_origin text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product store.products%rowtype;
  v_action text;
begin
  select * into v_product from store.products where id = p_product_id for update;
  if v_product.id is null then
    return 'not_found';
  end if;

  if exists (select 1 from store.order_items where product_id = p_product_id)
     or exists (select 1 from store.quote_items where product_id = p_product_id) then
    update store.products
      set active = false, archived_at = coalesce(archived_at, pg_catalog.now()), sync_status = 'removed'
      where id = p_product_id;
    v_action := 'archive';
  else
    delete from store.products where id = p_product_id;
    v_action := 'delete';
  end if;

  insert into store.sync_log(entidade, direcao, origem_id, destino_id, acao, sucesso, payload)
  values (
    'produtos', p_origin, v_product.crm_id, p_product_id, v_action, true,
    pg_catalog.jsonb_build_object('name', v_product.name, 'sku', v_product.sku, 'by', auth.uid())
  );
  return v_action;
end;
$$;

revoke all on function store.remove_product_internal(uuid, text) from public, anon, authenticated;
