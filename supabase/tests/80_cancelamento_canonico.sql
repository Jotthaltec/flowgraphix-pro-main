-- Cancelamento canônico (migração 20260930020000). Transação desfeita no fim.
begin;
\o /dev/null

create function pg_temp.act_as(p_user uuid) returns void language sql as $f$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true),
         set_config('request.jwt.claim.sub', p_user::text, true);
$f$;

-- Pedido de teste com cobrança Pix pendente, conta a receber aberta e crédito usado.
create function pg_temp.pedido(p_cliente uuid, p_status text, p_pago boolean) returns uuid language plpgsql as $f$
declare v_id uuid;
begin
  insert into store.orders (profile_id, status, payment_status, payment_method, subtotal, total, credit_used)
  values (p_cliente, p_status, case when p_pago then 'pago' else 'pendente' end, 'pix', 50, 50, 5)
  returning id into v_id;
  insert into store.payments (order_id, method, amount, status)
  values (v_id, 'pix', 45, case when p_pago then 'pago' else 'pendente' end);
  insert into store.finance_entries (type, description, amount, due_date, status, order_id)
  values ('receber', 'QA', 45, current_date, case when p_pago then 'pago' else 'aberto' end, v_id)
  on conflict do nothing;
  return v_id;
end $f$;

do $$
declare
  v_admin uuid;
  v_cliente constant uuid := '00000000-0000-4000-8000-0000000000c7';
  v_outro constant uuid := '00000000-0000-4000-8000-0000000000c8';
  v_pedido uuid;
  r jsonb;
  v_saldo numeric;
begin
  select id into v_admin from store.profiles where role = 'admin' and active limit 1;
  insert into auth.users (id, email, raw_user_meta_data) values
    (v_cliente, 'qa.cancel@homolog.local', '{"full_name": "QA cancelamento"}'),
    (v_outro, 'qa.outro@homolog.local', '{"full_name": "QA outro"}')
  on conflict do nothing;
  insert into store.profiles (id, role, full_name, email, active) values
    (v_cliente, 'cliente', 'QA cancelamento', 'qa.cancel@homolog.local', true),
    (v_outro, 'cliente', 'QA outro', 'qa.outro@homolog.local', true)
  on conflict (id) do update set role = 'cliente', active = true;
  select credit_balance into v_saldo from store.profiles where id = v_cliente;

  -- 1. Equipe cancela pedido não pago: tudo cancelado, histórico único com motivo.
  v_pedido := pg_temp.pedido(v_cliente, 'aguardando_pagamento', false);
  perform pg_temp.act_as(v_admin);
  r := store.cancel_order(v_pedido, 'Cliente desistiu');
  assert r ->> 'ok' = 'true' and r ->> 'already' = 'false', format('1: %s', r);
  assert (select status = 'cancelado' and payment_status = 'cancelado' from store.orders where id = v_pedido), '1: pedido';
  assert (select status from store.payments where order_id = v_pedido) = 'cancelado', '1: cobrança';
  assert (select status from store.finance_entries where order_id = v_pedido) = 'cancelado', '1: financeiro';
  assert (select count(*) from store.order_status_history where order_id = v_pedido and to_status = 'cancelado') = 1,
    '1: uma linha de histórico';
  assert (select note from store.order_status_history where order_id = v_pedido and to_status = 'cancelado') = 'Cliente desistiu',
    '1: motivo na linha do histórico';
  assert (select count(*) from store.credits where order_id = v_pedido and type = 'estorno') = 1, '1: crédito devolvido';

  -- 2. Cancelar de novo não devolve o crédito outra vez.
  r := store.cancel_order(v_pedido, 'De novo');
  assert r ->> 'already' = 'true', format('2: %s', r);
  assert (select count(*) from store.credits where order_id = v_pedido and type = 'estorno') = 1, '2: sem estorno duplicado';
  assert (select count(*) from store.order_status_history where order_id = v_pedido and to_status = 'cancelado') = 1, '2: sem histórico novo';

  -- 3. Pedido pago cancelado: o que foi recebido continua recebido e a devolução fica sinalizada.
  v_pedido := pg_temp.pedido(v_cliente, 'em_producao', true);
  r := store.cancel_order(v_pedido, 'Erro de arte');
  assert (r ->> 'refund_pending')::boolean, format('3: devolução sinalizada: %s', r);
  assert (select payment_status from store.orders where id = v_pedido) = 'pago', '3: continua pago';
  assert (select status from store.finance_entries where order_id = v_pedido) = 'pago', '3: recebido não some do financeiro';

  -- 4. Cliente cancela o próprio pedido antes da produção.
  v_pedido := pg_temp.pedido(v_cliente, 'aguardando_pagamento', false);
  perform pg_temp.act_as(v_cliente);
  assert store.cancel_order(v_pedido, 'Mudei de ideia') ->> 'ok' = 'true', '4: cliente cancela';

  -- 5. Cliente não cancela pedido em produção, nem pedido de outra pessoa.
  perform pg_temp.act_as(v_admin);
  v_pedido := pg_temp.pedido(v_cliente, 'em_producao', true);
  perform pg_temp.act_as(v_cliente);
  begin
    perform store.cancel_order(v_pedido, 'Quero cancelar');
    raise exception 'FALHOU: 5: cliente cancelou pedido em produção';
  exception when invalid_parameter_value then null;
  end;
  perform pg_temp.act_as(v_outro);
  begin
    perform store.cancel_order(v_pedido, 'Não é meu');
    raise exception 'FALHOU: 5: cancelou pedido de outra pessoa';
  exception when insufficient_privilege then null;
  end;

  -- 6. Motivo é obrigatório.
  perform pg_temp.act_as(v_admin);
  begin
    perform store.cancel_order(v_pedido, '   ');
    raise exception 'FALHOU: 6: cancelou sem motivo';
  exception when invalid_parameter_value then null;
  end;

  -- 7. Mudanças comuns de situação continuam gravando uma linha, sem motivo herdado.
  v_pedido := pg_temp.pedido(v_cliente, 'pago', true);
  update store.orders set status = 'aprovado_producao' where id = v_pedido;
  assert (select count(*) = 1 and bool_and(note is null) from store.order_status_history
          where order_id = v_pedido and to_status = 'aprovado_producao'), '7: histórico normal';
end $$;

-- 8. Anônimo não cancela.
do $$ begin
  assert not has_function_privilege('anon', 'store.cancel_order(uuid, text)', 'execute'), '8: anon';
end $$;

rollback;
