-- Modelo de sincronização de produtos CRM -> loja (fase 2 da integração).
--
-- Dono de cada produto da loja, explícito e verificado pelo banco:
--   * sync_origin = 'site': produto nativo da Nexus. Status sempre 'native',
--     sem crm_id. O CRM enxerga, mas nunca sobrescreve.
--   * sync_origin = 'crm': o Flow é a fonte de verdade. Tem crm_id único e um
--     dos status de sincronização abaixo.
--
-- Status de produto do CRM:
--   pending    aprovado para publicar, ainda não publicado
--   syncing    publicação em andamento
--   synced     conteúdo da loja = conteúdo publicado do Flow (hash igual)
--   stale      o Flow mudou depois da última publicação
--   attention  publicado com avisos, ou alterado direto na loja
--   error      a última tentativa de publicação falhou
--   archived   fora de venda, preservado para histórico
-- 'removed' (usado só por remove_product_internal) vira 'archived'.
--
-- Idempotente: pode rodar de novo sem efeito.

-- 1. Campos de rastreio ---------------------------------------------------------

alter table store.products
  add column if not exists source_updated_at timestamptz,
  add column if not exists content_hash text,
  add column if not exists last_sync_error text;

comment on column store.products.sync_origin is
  'Dono do produto: site (nativo da Nexus) ou crm (Flow é a fonte de verdade).';
comment on column store.products.sync_status is
  'native | pending | syncing | synced | stale | attention | error | archived. Ver migração 20260929010000.';
comment on column store.products.sync_version is
  'Quantas publicações do Flow já foram aplicadas a este produto.';
comment on column store.products.synced_at is
  'Fim da última publicação bem-sucedida vinda do Flow.';
comment on column store.products.source_updated_at is
  'public.products.updated_at do Flow no momento da última publicação.';
comment on column store.products.content_hash is
  'Assinatura dos campos publicados na última publicação; base da detecção de divergência.';
comment on column store.products.last_sync_error is
  'Mensagem da última publicação que falhou; limpa na próxima que der certo.';

-- 2. Status ---------------------------------------------------------------------

alter table store.products drop constraint if exists products_sync_status_check;
alter table store.products drop constraint if exists products_sync_ownership_check;
alter table store.products drop constraint if exists products_sync_archived_check;

-- Nativos arquivados pelo admin da loja voltam a ser 'native' (o arquivamento
-- fica em archived_at); os do CRM passam a 'archived'.
update store.products set sync_status = 'native'
  where sync_status = 'removed' and sync_origin = 'site';
update store.products set sync_status = 'archived', archived_at = coalesce(archived_at, pg_catalog.now())
  where sync_status = 'removed' and sync_origin = 'crm';

alter table store.products add constraint products_sync_status_check check (
  sync_status = any (array['native', 'pending', 'syncing', 'synced', 'stale', 'attention', 'error', 'archived'])
);

alter table store.products add constraint products_sync_ownership_check check (
  (sync_origin = 'site' and sync_status = 'native' and crm_id is null)
  or (sync_origin = 'crm' and sync_status <> 'native' and crm_id is not null)
);

alter table store.products add constraint products_sync_archived_check check (
  sync_status <> 'archived' or archived_at is not null
);

-- crm_id já tem índice único (products_crm_id_key); este era redundante.
drop index if exists store.products_crm_id_idx;

-- 3. O dono não muda -------------------------------------------------------------
-- Um nativo nunca vira produto do CRM (e vice-versa), e o vínculo com o Flow não
-- é trocado: é o que impede uma publicação de sobrescrever um produto da loja.

create or replace function store.guard_product_ownership()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.sync_origin is distinct from old.sync_origin then
    raise exception 'A origem do produto não pode mudar (% -> %).', old.sync_origin, new.sync_origin
      using errcode = '42501';
  end if;
  if old.crm_id is not null and new.crm_id is distinct from old.crm_id then
    raise exception 'O vínculo do produto com o Flow não pode mudar.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function store.guard_product_ownership() from public, anon, authenticated;

drop trigger if exists tr_products_guard_ownership on store.products;
create trigger tr_products_guard_ownership
  before update of sync_origin, crm_id on store.products
  for each row execute function store.guard_product_ownership();

-- 4. Data de alteração confiável no Flow ------------------------------------------
-- Até aqui public.products.updated_at dependia de cada tela lembrar de gravá-lo.

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.update_updated_at_column();

-- 5. Arquivamento grava o status novo --------------------------------------------

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
