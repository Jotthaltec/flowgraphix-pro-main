-- Exclusao de produto coerente entre Flow (CRM) e loja.
--
-- Antes: excluir o produto no Flow nao tinha efeito na loja (nenhum gatilho
-- em public.products), e o admin da loja so conseguia "arquivar". Produtos
-- apagados no CRM continuavam a venda no site.
--
-- Regra unica (store.remove_product_internal), usada pelos dois lados:
--   * sem pedido/orcamento que o referencie -> exclusao definitiva (imagens,
--     opcoes, variantes e tiragens saem em cascata);
--   * com historico -> arquivado e desativado (sai do site; relatorios que
--     juntam por product_id continuam funcionando). Itens de pedido guardam
--     nome/sku/opcoes, entao nada do historico se perde em nenhum caso.

-- Estados/acoes novos: produto removido da loja e origem "site" (admin da loja).
alter table store.products drop constraint products_sync_status_check;
alter table store.products add constraint products_sync_status_check
  check (sync_status = any (array['native', 'synced', 'attention', 'error', 'removed']));
alter table store.sync_log drop constraint sync_log_acao_check;
alter table store.sync_log add constraint sync_log_acao_check
  check (acao = any (array['insert', 'update', 'skip', 'erro', 'delete', 'archive']));
alter table store.sync_log drop constraint sync_log_direcao_check;
alter table store.sync_log add constraint sync_log_direcao_check
  check (direcao = any (array['crm_para_site', 'site_para_crm', 'site']));

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

-- Chamada pelo admin da loja.
create or replace function store.admin_remove_product(p_product_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not store.is_admin() then
    raise exception 'Sem permissao para excluir produtos.' using errcode = '42501';
  end if;
  return store.remove_product_internal(p_product_id, 'site');
end;
$$;

revoke all on function store.admin_remove_product(uuid) from public, anon;
grant execute on function store.admin_remove_product(uuid) to authenticated;

-- Excluir no Flow remove da loja.
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

-- Publicar de novo pelo Flow traz o produto de volta: publish_crm_product
-- sempre renova synced_at e nao mexe em archived_at. Arquivar pelo admin da
-- loja nao toca synced_at, entao nao dispara esta regra.
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

drop trigger if exists tr_crm_republish_unarchives on store.products;
create trigger tr_crm_republish_unarchives
  before update on store.products
  for each row execute function store.crm_republish_unarchives();

-- Produtos da loja cujo produto de origem ja foi excluido no Flow.
select store.remove_product_internal(s.id, 'crm_para_site')
from store.products s
where s.crm_id is not null
  and not exists (select 1 from public.products p where p.id = s.crm_id);
