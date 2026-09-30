-- Produção unificada (migração 20260930030000). Transação desfeita no fim.
begin;
\o /dev/null

create function pg_temp.act_as(p_user uuid) returns void language sql as $f$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true),
         set_config('request.jwt.claim.sub', p_user::text, true);
$f$;

-- Pedido pago com N itens, aprovado para produção: nasce uma OP por item.
create function pg_temp.pedido(p_itens int, p_entrega text default 'retirada') returns uuid language plpgsql as $f$
declare v_id uuid;
begin
  insert into store.orders (status, payment_status, payment_method, shipping_method, subtotal, total)
  values ('pago', 'pago', 'pix', p_entrega, 10 * p_itens, 10 * p_itens) returning id into v_id;
  for i in 1..p_itens loop
    insert into store.order_items (order_id, product_name, quantity, unit_price, total_price)
    values (v_id, 'QA item ' || i, 10, 1, 10);
  end loop;
  update store.orders set status = 'aprovado_producao' where id = v_id;
  return v_id;
end $f$;

create function pg_temp.situacao(p_order uuid) returns text language sql as $f$
  select status from store.orders where id = p_order;
$f$;

do $$
declare
  v_admin uuid;
  v_p uuid;
  v_ops uuid[];
begin
  select id into v_admin from store.profiles where role = 'admin' and active limit 1;
  perform pg_temp.act_as(v_admin);

  -- 1. A OP sai da fila: pedido vai para em produção, com o motivo no histórico.
  v_p := pg_temp.pedido(1);
  assert (select count(*) from store.production_orders where order_id = v_p) = 1, '1: OP criada';
  update store.production_orders set stage = 'impressao' where order_id = v_p;
  assert pg_temp.situacao(v_p) = 'em_producao', format('1: %s', pg_temp.situacao(v_p));
  assert (select note from store.order_status_history where order_id = v_p and to_status = 'em_producao') like 'Produção: %',
    '1: histórico diz que veio da produção';

  -- 2. Finalizada (retirada): pronto para retirada.
  update store.production_orders set stage = 'finalizado' where order_id = v_p;
  assert pg_temp.situacao(v_p) = 'pronto_retirada', format('2: %s', pg_temp.situacao(v_p));

  -- 3. Nunca para trás.
  update store.production_orders set stage = 'impressao' where order_id = v_p;
  assert pg_temp.situacao(v_p) = 'pronto_retirada', '3: não regride';

  -- 4. Várias OPs: só avança quando todas avançam.
  v_p := pg_temp.pedido(2);
  select array_agg(id order by created_at, id) into v_ops from store.production_orders where order_id = v_p;
  update store.production_orders set stage = 'finalizado' where id = v_ops[1];
  assert pg_temp.situacao(v_p) = 'em_producao', format('4: uma finalizada, outra na fila: %s', pg_temp.situacao(v_p));
  update store.production_orders set stage = 'embalagem' where id = v_ops[2];
  assert pg_temp.situacao(v_p) = 'embalagem', format('4: %s', pg_temp.situacao(v_p));
  update store.production_orders set stage = 'finalizado' where id = v_ops[2];
  assert pg_temp.situacao(v_p) = 'pronto_retirada', format('4: todas finalizadas: %s', pg_temp.situacao(v_p));

  -- 5. Com envio, todas finalizadas = embalagem (o envio é registrado no pedido).
  v_p := pg_temp.pedido(1, 'sedex');
  update store.production_orders set stage = 'finalizado' where order_id = v_p;
  assert pg_temp.situacao(v_p) = 'embalagem', format('5: %s', pg_temp.situacao(v_p));

  -- 6. Pedido entregue direto finaliza as OPs abertas.
  v_p := pg_temp.pedido(2);
  update store.orders set status = 'entregue' where id = v_p;
  assert (select bool_and(stage = 'finalizado' and finished_at is not null) from store.production_orders where order_id = v_p),
    '6: OPs finalizadas';
  assert pg_temp.situacao(v_p) = 'entregue', '6: continua entregue (sem laço)';

  -- 7. Pedido cancelado não é movido pela produção.
  v_p := pg_temp.pedido(1);
  perform store.cancel_order(v_p, 'QA');
  update store.production_orders set stage = 'finalizado' where order_id = v_p;
  assert pg_temp.situacao(v_p) = 'cancelado', '7: cancelado fica cancelado';

  -- 8. Kanban do CRM move o pedido real, e o espelho acompanha.
  v_p := pg_temp.pedido(1);
  insert into public.orders (id, company_id, client_id, order_number, product_desc, total_value, deadline, payment_status, production_status)
  select o.id, public.crm_default_company(), (select id from public.clients limit 1), o.number, 'QA', o.total, current_date + 7, 'pago', 'arte_aprovada'
  from store.orders o where o.id = v_p
  on conflict (id) do nothing;
  assert store.crm_move_order(v_p, 'em_producao') ->> 'status' = 'em_producao', '8: move';
  assert pg_temp.situacao(v_p) = 'em_producao', '8: pedido real';
  assert (select note from store.order_status_history where order_id = v_p and to_status = 'em_producao') = 'Movido no kanban do CRM.',
    '8: histórico';
  assert store.crm_move_order(v_p, 'pronto') ->> 'status' = 'pronto_retirada', '8: pronto';
  assert (select bool_and(stage = 'finalizado') from store.production_orders where order_id = v_p), '8: OPs finalizadas';

  -- 9. Coluna que não faz sentido para pedido da loja é recusada.
  begin
    perform store.crm_move_order(v_p, 'pedido_criado');
    raise exception 'FALHOU: 9: voltou para novo pedido';
  exception when invalid_parameter_value then null;
  end;

  -- 10. Pedido antigo, só do CRM: move o espelho.
  insert into public.orders (company_id, client_id, order_number, product_desc, total_value, deadline, payment_status, production_status)
  values (public.crm_default_company(), (select id from public.clients limit 1), 'QA-LEGADO-1', 'QA', 10, current_date + 7, 'pago', 'pedido_criado')
  returning id into v_p;
  assert store.crm_move_order(v_p, 'em_producao') ->> 'store' = 'false', '10: legado';
  assert (select production_status from public.orders where id = v_p) = 'em_producao', '10: espelho movido';

  -- 11. Sem permissão: usuário qualquer não move.
  perform pg_temp.act_as(gen_random_uuid());
  begin
    perform store.crm_move_order(v_p, 'entregue');
    raise exception 'FALHOU: 11: moveu sem permissão';
  exception when insufficient_privilege then null;
  end;
end $$;

rollback;
