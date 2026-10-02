-- Cliente novo do Flow chega na loja (migração 20261002040000). Transação desfeita no fim.
begin;
\o /dev/null

do $$
declare
  v_company uuid := public.crm_default_company();
  v_outra uuid;
  v_id uuid;
  v_id2 uuid;
  r record;
  n integer;
begin
  if v_company is null then
    insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000d1', 'qa.cli.dono@homolog.local');
    insert into public.companies (name, owner_id, store_access)
    values ('QA loja', '00000000-0000-4000-8000-0000000000d1', true);
    v_company := public.crm_default_company();
  end if;

  insert into public.clients (company_id, name, email, whatsapp, client_type)
  values (v_company, 'QA Cliente Flow', 'qa.cliente.flow@homolog.local', '11999990000', 'pessoa_juridica')
  returning id into v_id;

  select * into r from store.customers where id = v_id;
  assert r.id is not null, 'cliente do Flow existe na loja';
  assert r.sync_origin = 'crm' and r.customer_type = 'pj' and r.phone = '11999990000',
    'campos copiados com origem crm';

  select count(*) into n from public.clients where id = v_id;
  assert n = 1, 'sem duplicata no Flow';

  -- Edição continua propagando pelo gatilho existente.
  update public.clients set name = 'QA Cliente Flow 2' where id = v_id;
  select name into r from store.customers where id = v_id;
  assert r.name = 'QA Cliente Flow 2', 'edição chega na loja';

  -- Empresa sem vínculo com a loja não é copiada.
  insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000d2', 'qa.cli.outra@homolog.local')
  on conflict do nothing;
  insert into public.companies (name, owner_id, store_access)
  values ('QA outra', '00000000-0000-4000-8000-0000000000d2', false) returning id into v_outra;
  insert into public.clients (company_id, name) values (v_outra, 'QA de outra empresa') returning id into v_id2;
  select count(*) into n from store.customers where id = v_id2;
  assert n = 0, 'cliente de outra empresa fica fora da loja';

  raise notice 'cliente do Flow na loja: ok';
end $$;

\o
rollback;
