-- Pagamento marcado no Financeiro do Flow vale na loja (migração 20261002020000).
-- Transação desfeita no fim.
begin;
\o /dev/null

create function pg_temp.act_as(p_user uuid) returns void language sql as $f$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true),
         set_config('request.jwt.claim.sub', p_user::text, true);
$f$;

do $$
declare
  v_staff constant uuid := '00000000-0000-4000-8000-0000000000c1';
  v_cliente constant uuid := '00000000-0000-4000-8000-0000000000c2';
  v_order uuid;
  v_st text;
  v_pay text;
  v_crm_pay text;
  n integer;
begin
  if public.crm_default_company() is null then
    insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000c3', 'qa.fin.dono@homolog.local');
    insert into public.companies (name, owner_id, store_access)
    values ('QA loja', '00000000-0000-4000-8000-0000000000c3', true);
  end if;
  insert into auth.users (id, email) values
    (v_staff, 'qa.fin.staff@homolog.local'), (v_cliente, 'qa.fin.cliente@homolog.local')
  on conflict do nothing;
  insert into store.profiles (id, role, full_name, email, active) values
    (v_staff, 'financeiro', 'QA financeiro', 'qa.fin.staff@homolog.local', true),
    (v_cliente, 'cliente', 'QA cliente', 'qa.fin.cliente@homolog.local', true)
  on conflict (id) do update set role = excluded.role, active = true;

  insert into store.orders (profile_id, status, payment_status, payment_method, subtotal, total, shipping_cost)
  values (v_cliente, 'aguardando_pagamento', 'pendente', 'pix', 100, 100, 0)
  returning id into v_order;
  insert into store.payments (order_id, method, status, amount) values (v_order, 'pix', 'pendente', 100);

  -- 1. Cliente não pode.
  perform pg_temp.act_as(v_cliente);
  begin
    perform store.crm_set_order_payment(v_order, 'pago');
    assert false, 'cliente não pode marcar pagamento';
  exception when insufficient_privilege then null;
  end;

  -- 2. Equipe marca como pago: loja, pagamento, financeiro e espelho do Flow.
  perform pg_temp.act_as(v_staff);
  perform store.crm_set_order_payment(v_order, 'pago');
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);

  select status, payment_status into v_st, v_pay from store.orders where id = v_order;
  assert v_pay = 'pago' and v_st = 'pago', 'pedido na loja fica pago, veio ' || v_st || '/' || v_pay;
  select count(*) into n from store.payments where order_id = v_order and status = 'pago' and paid_at is not null;
  assert n = 1, 'pagamento pendente vira pago';
  select count(*) into n from store.finance_entries where order_id = v_order and type = 'receber' and status = 'pago';
  assert n = 1, 'lançamento a receber pago criado pelo gatilho da loja';
  select payment_status into v_crm_pay from public.orders where id = v_order;
  assert v_crm_pay is null or v_crm_pay = 'pago', 'espelho do Flow acompanha (quando o pedido tem cliente)';

  -- 3. Status inválido é recusado.
  perform pg_temp.act_as(v_staff);
  begin
    perform store.crm_set_order_payment(v_order, 'qualquer');
    assert false, 'status inválido recusado';
  exception when invalid_parameter_value then null;
  end;

  raise notice 'financeiro do Flow grava na loja: ok';
end $$;

\o
rollback;
