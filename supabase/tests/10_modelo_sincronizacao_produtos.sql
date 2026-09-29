-- Modelo de sincronização de produtos (migração 20260929010000).
-- Roda numa transação desfeita no fim: nada do que cria aqui persiste.
-- Uso: bash scripts/db-rehearsal.sh test supabase/tests/10_modelo_sincronizacao_produtos.sql
begin;
\o /dev/null

create function pg_temp.expect_error(p_sql text, p_errcode text, p_label text)
returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'FALHOU: % (esperava erro %, nada aconteceu)', p_label, p_errcode;
exception when others then
  if sqlstate = p_errcode then return; end if;
  if sqlerrm like 'FALHOU:%' then raise; end if;
  raise exception 'FALHOU: % (esperava erro %, veio % %)', p_label, p_errcode, sqlstate, sqlerrm;
end $$;

-- Fixtures: um nativo e um produto do CRM, sem depender dos dados da cópia.
insert into store.products (id, sku, name, slug, price_unit, base_price)
values ('00000000-0000-4000-8000-000000000001', 'QA-NATIVO', 'QA nativo', 'qa-nativo', 'unidade', 10);

insert into public.products (id, company_id, name)
select '00000000-0000-4000-8000-0000000000c1', id, 'QA produto CRM' from public.companies limit 1;

insert into store.products (id, sku, name, slug, price_unit, base_price, sync_origin, crm_id, sync_status)
values ('00000000-0000-4000-8000-000000000002', 'QA-CRM', 'QA CRM', 'qa-crm', 'unidade', 10,
        'crm', '00000000-0000-4000-8000-0000000000c1', 'synced');

do $$ begin
  -- Padrões continuam valendo para produto criado pelo admin da loja.
  assert (select sync_origin = 'site' and sync_status = 'native' from store.products
          where id = '00000000-0000-4000-8000-000000000001'), 'nativo nasce site/native';

  -- Todos os status novos são aceitos para produto do CRM.
  update store.products set sync_status = 'pending'  where id = '00000000-0000-4000-8000-000000000002';
  update store.products set sync_status = 'syncing'  where id = '00000000-0000-4000-8000-000000000002';
  update store.products set sync_status = 'stale'    where id = '00000000-0000-4000-8000-000000000002';
  update store.products set sync_status = 'error'    where id = '00000000-0000-4000-8000-000000000002';
  update store.products set sync_status = 'archived', archived_at = now()
    where id = '00000000-0000-4000-8000-000000000002';
  update store.products set sync_status = 'synced', archived_at = null
    where id = '00000000-0000-4000-8000-000000000002';
end $$;

select pg_temp.expect_error(
  $q$update store.products set sync_status = 'removed' where id = '00000000-0000-4000-8000-000000000002'$q$,
  '23514', 'status legado removed é recusado');
select pg_temp.expect_error(
  $q$update store.products set sync_status = 'archived', archived_at = null where id = '00000000-0000-4000-8000-000000000002'$q$,
  '23514', 'archived exige archived_at');
select pg_temp.expect_error(
  $q$update store.products set sync_status = 'synced' where id = '00000000-0000-4000-8000-000000000001'$q$,
  '23514', 'nativo não pode ter status de sincronização');
select pg_temp.expect_error(
  $q$update store.products set sync_status = 'native' where id = '00000000-0000-4000-8000-000000000002'$q$,
  '23514', 'produto do CRM não pode ser native');
select pg_temp.expect_error(
  $q$insert into store.products (sku, name, slug, price_unit, base_price, sync_origin, sync_status)
     values ('QA-X', 'x', 'qa-x', 'unidade', 1, 'crm', 'synced')$q$,
  '23514', 'produto do CRM exige crm_id');
select pg_temp.expect_error(
  $q$insert into store.products (sku, name, slug, price_unit, base_price, crm_id)
     values ('QA-Y', 'y', 'qa-y', 'unidade', 1, '00000000-0000-4000-8000-0000000000c9')$q$,
  '23514', 'nativo não pode ter crm_id');
select pg_temp.expect_error(
  $q$insert into store.products (sku, name, slug, price_unit, base_price, sync_origin, crm_id, sync_status)
     values ('QA-Z', 'z', 'qa-z', 'unidade', 1, 'crm', '00000000-0000-4000-8000-0000000000c1', 'synced')$q$,
  '23505', 'crm_id é único');
select pg_temp.expect_error(
  $q$update store.products set sync_origin = 'crm', crm_id = '00000000-0000-4000-8000-0000000000c9', sync_status = 'synced'
     where id = '00000000-0000-4000-8000-000000000001'$q$,
  '42501', 'nativo nunca vira produto do CRM');
select pg_temp.expect_error(
  $q$update store.products set crm_id = '00000000-0000-4000-8000-0000000000c9'
     where id = '00000000-0000-4000-8000-000000000002'$q$,
  '42501', 'vínculo com o Flow não muda');

-- updated_at do Flow passa a ser mantido pelo banco.
update public.products set updated_at = '2000-01-01' where id = '00000000-0000-4000-8000-0000000000c1';
do $$ begin
  assert (select updated_at > now() - interval '1 minute' from public.products
          where id = '00000000-0000-4000-8000-0000000000c1'), 'updated_at do Flow é renovado no update';
end $$;

-- Arquivamento com histórico: CRM vira archived, nativo continua native.
insert into store.quotes (id, number) values ('00000000-0000-4000-8000-0000000000a1', 'QA-ORC-1');
insert into store.quote_items (quote_id, description, product_id) values
  ('00000000-0000-4000-8000-0000000000a1', 'QA', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-0000000000a1', 'QA', '00000000-0000-4000-8000-000000000002');
do $$ begin
  assert store.remove_product_internal('00000000-0000-4000-8000-000000000002', 'crm_para_site') = 'archive';
  assert store.remove_product_internal('00000000-0000-4000-8000-000000000001', 'site') = 'archive';
  assert (select sync_status = 'archived' and archived_at is not null and not active from store.products
          where id = '00000000-0000-4000-8000-000000000002'), 'CRM arquivado fica archived';
  assert (select sync_status = 'native' and archived_at is not null and not active from store.products
          where id = '00000000-0000-4000-8000-000000000001'), 'nativo arquivado continua native';
end $$;

rollback;
