-- Painel de saúde (migração 20260929050000): só a equipe da loja lê
-- store.crm_product_sync_health. Transação desfeita no fim.
begin;
\o /dev/null

create function pg_temp.as_user(p_user uuid) returns void language sql as $f$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true),
         set_config('request.jwt.claim.sub', p_user::text, true);
$f$;

-- Garante um produto do Flow ativo e com erro gravado, para haver o que vazar.
do $$
declare v_company uuid;
begin
  select id into v_company from public.companies where store_access limit 1;
  insert into public.products (id, company_id, name, category, sale_price, status)
  values ('00000000-0000-4000-8000-0000000000e1', v_company, 'QA acesso', 'QA', 10, 'Ativo');
  insert into store.products (sku, name, slug, price_unit, base_price, sync_origin, crm_id, sync_status,
                              active, last_sync_error)
  values ('QA-ACESSO', 'QA acesso', 'qa-acesso', 'unidade', 10, 'crm',
          '00000000-0000-4000-8000-0000000000e1', 'error', true, 'segredo interno');
  -- Um cliente da loja: perfil sem papel de equipe.
  insert into auth.users (id) values ('00000000-0000-4000-8000-0000000000e2');
  insert into store.profiles (id, role, active)
  values ('00000000-0000-4000-8000-0000000000e2', 'cliente', true)
  on conflict (id) do update set role = 'cliente', active = true;
end $$;

-- Equipe (dono da empresa, admin da loja) vê.
select pg_temp.as_user((select m.user_id from public.company_members m
                        join store.profiles p on p.id = m.user_id
                        where p.role = 'admin' and p.active limit 1));
set local role authenticated;
do $$ begin
  assert store.is_staff(), 'pré-condição: usuário da equipe';
  assert (select count(*) from store.crm_product_sync_health where name = 'QA acesso') = 1, 'equipe vê';
end $$;
reset role;

-- Cliente autenticado não vê nada, nem o produto ativo.
select pg_temp.as_user('00000000-0000-4000-8000-0000000000e2');
set local role authenticated;
do $$ begin
  assert not store.is_staff(), 'pré-condição: cliente não é equipe';
  assert (select count(*) from store.crm_product_sync_health) = 0, 'cliente não lê o painel';
  assert (select count(*) from store.products where name = 'QA acesso') = 1,
    'o produto continua visível na vitrine para o cliente';
end $$;
reset role;

-- Anônimo nem tem permissão.
set local role anon;
do $$ begin
  begin
    perform 1 from store.crm_product_sync_health;
    raise exception 'FALHOU: anon leu o painel';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

rollback;
