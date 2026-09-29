-- Reversão de 20260929040000_despublicacao_arquivamento.sql.
--
--   psql "$SUPABASE_DB_URL" -1 -v ON_ERROR_STOP=1 -f <este arquivo>
--   psql "$SUPABASE_DB_URL" -1 -v ON_ERROR_STOP=1 -f supabase/migrations/20260929020000_publicacao_canonica.sql
--   psql "$SUPABASE_DB_URL" -1 -v ON_ERROR_STOP=1 -f supabase/migrations/20260929030000_fila_sincronizacao_produtos.sql
--   delete from supabase_migrations.schema_migrations where version = '20260929040000';
--
-- As duas migrações reaplicadas são idempotentes e devolvem as versões
-- anteriores de publish_crm_product_internal, enqueue_product_sync,
-- process_product_sync_queue, product_sync_state e crm_product_sync_health.
--
-- Volta a valer: excluir no Flow apaga o produto da loja quando não há pedido
-- ou orçamento. Produtos despublicados continuam inativos (status 'pending')
-- até a próxima publicação. O check de sync_log mantém 'unpublish' para não
-- invalidar o histórico já gravado.

drop view if exists store.crm_product_sync_health;

drop trigger if exists tr_crm_product_delete_guard on public.products;
drop trigger if exists tr_products_guard_crm_delete on store.products;
drop trigger if exists tr_products_guard_withdrawn on store.products;
drop function if exists store.guard_crm_product_delete();
drop function if exists store.guard_store_crm_product_delete();
drop function if exists store.guard_withdrawn_crm_product();

drop function if exists store.unpublish_crm_product(uuid, text);
drop function if exists store.archive_crm_product(uuid, text);
drop function if exists store.withdraw_crm_product(uuid, text, text);

-- Versão de 20260929010000.
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
      set active = false,
          archived_at = coalesce(archived_at, pg_catalog.now()),
          sync_status = case when sync_origin = 'crm' then 'archived' else 'native' end
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

drop function if exists store.withdraw_crm_product_internal(uuid, text, text, text);
drop function if exists store.product_commercial_refs(uuid);

-- Versão de 20260928150000.
create or replace function store.crm_product_deleted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store_id uuid;
begin
  for v_store_id in select id from store.products where crm_id = old.id
  loop
    perform store.remove_product_internal(v_store_id, 'crm_para_site');
  end loop;
  return old;
end;
$$;

revoke all on function store.crm_product_deleted() from public, anon, authenticated;

drop trigger if exists tr_crm_product_deleted on public.products;
create trigger tr_crm_product_deleted
  after delete on public.products
  for each row execute function store.crm_product_deleted();

create or replace function store.crm_republish_unarchives()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.archived_at is not null and new.sync_origin = 'crm'
     and new.synced_at is distinct from old.synced_at then
    new.archived_at := null;
  end if;
  return new;
end;
$$;

revoke all on function store.crm_republish_unarchives() from public, anon, authenticated;

alter table store.products
  drop column if exists unpublished_at,
  drop column if exists withdrawn_reason,
  drop column if exists withdrawn_by;
