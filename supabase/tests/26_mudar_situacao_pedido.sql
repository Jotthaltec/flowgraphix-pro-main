-- Mudar a situação com observação (migração 20261003010000). Transação desfeita no fim.
begin;
\o /dev/null

create function pg_temp.act_as(p_user uuid) returns void language sql as $f$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true),
         set_config('request.jwt.claim.sub', p_user::text, true);
$f$;

do $$
declare
  v_staff constant uuid := '00000000-0000-4000-8000-0000000000f1';
  v_cliente constant uuid := '00000000-0000-4000-8000-0000000000f2';
  v_order uuid;
  r record;
begin
  insert into auth.users (id, email) values
    (v_staff, 'qa.sit.staff@homolog.local'), (v_cliente, 'qa.sit.cliente@homolog.local')
  on conflict do nothing;
  insert into store.profiles (id, role, full_name, email, active) values
    (v_staff, 'admin', 'QA admin', 'qa.sit.staff@homolog.local', true),
    (v_cliente, 'cliente', 'QA cliente', 'qa.sit.cliente@homolog.local', true)
  on conflict (id) do update set role = excluded.role, active = true;

  insert into store.orders (profile_id, status, payment_status, payment_method, subtotal, total, shipping_cost)
  values (v_cliente, 'pago', 'pago', 'pix', 100, 100, 0)
  returning id into v_order;

  perform pg_temp.act_as(v_cliente);
  begin
    perform store.update_order_status(v_order, 'em_producao', null);
    assert false, 'cliente não muda a situação';
  exception when insufficient_privilege then null;
  end;

  perform pg_temp.act_as(v_staff);
  perform store.update_order_status(v_order, 'aguardando_arquivos', 'Cliente vai mandar a arte amanhã');
  -- Criação e mudança caem na mesma transação (mesmo created_at): busca pela situação.
  select * into r from store.order_status_history
  where order_id = v_order and to_status = 'aguardando_arquivos';
  assert r.to_status = 'aguardando_arquivos' and r.note = 'Cliente vai mandar a arte amanhã',
    'histórico com a observação, veio ' || coalesce(r.note, 'nulo');

  begin
    perform store.update_order_status(v_order, 'cancelado', 'x');
    assert false, 'cancelar exige o fluxo de cancelamento';
  exception when invalid_parameter_value then null;
  end;

  raise notice 'mudar situação do pedido: ok';
end $$;

\o
rollback;
