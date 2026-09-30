-- Produção unificada: o quadro da loja (store.production_orders) é o oficial.
--
-- Decisão de 30/09/2026. As OPs dos pedidos nascem na loja (aprovado para
-- produção), reservam e baixam material conforme a etapa. Até aqui:
--   * o kanban "Visão de Pedidos" do CRM gravava só no espelho public.orders:
--     arrastar um pedido não mudava o pedido real, e o cliente não via;
--   * a etapa da OP e a situação do pedido andavam separadas (pedido "pronto"
--     com OP ainda na fila, material reservado sem baixa).
--
-- Agora:
--   1. store.crm_move_order: o kanban do CRM move o pedido real (histórico,
--      notificação, criação de OP, espelho e painel do cliente acompanham).
--      Pedido antigo que só existe no CRM continua sendo movido no espelho.
--   2. A OP conduz o pedido, sempre para frente: saiu da fila -> em produção;
--      todas em acabamento/controle/embalagem -> idem; todas finalizadas ->
--      pronto para retirada (ou embalagem, quando há envio).
--   3. Pedido dado como pronto/enviado/entregue/concluído finaliza as OPs
--      abertas (e com isso baixa o material reservado).
-- Cada lado só reage a mudanças feitas diretamente nele (pg_trigger_depth),
-- então um não realimenta o outro.

-- 1. Ordem das situações do pedido ---------------------------------------------

create or replace function store.order_status_rank(p_status text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.array_position(array[
    'pedido_recebido', 'aguardando_pagamento', 'pagamento_analise', 'pago', 'aguardando_arquivos',
    'arte_analise', 'arte_criacao', 'aguardando_aprovacao', 'alteracao_solicitada', 'aprovado_producao',
    'em_producao', 'acabamento', 'controle_qualidade', 'embalagem', 'pronto_retirada', 'enviado',
    'entregue', 'concluido'
  ], p_status);
$$;

-- 2. A OP conduz o pedido ----------------------------------------------------------

create or replace function store.sync_order_from_production()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order store.orders%rowtype;
  v_stages text[];
  v_target text;
begin
  -- Finalização feita pelo próprio pedido (gatilho abaixo): não volta a ele.
  if pg_catalog.pg_trigger_depth() > 1 or new.order_id is null then
    return new;
  end if;

  select * into v_order from store.orders where id = new.order_id for update;
  if v_order.id is null or v_order.status in ('cancelado', 'enviado', 'entregue', 'concluido') then
    return new;
  end if;

  select pg_catalog.array_agg(stage) into v_stages from store.production_orders where order_id = new.order_id;

  v_target := case
    when v_stages <@ array['finalizado'] then
      case when coalesce(v_order.shipping_method, 'retirada') in ('retirada', 'digital')
        then 'pronto_retirada' else 'embalagem' end
    when v_stages <@ array['embalagem', 'finalizado'] then 'embalagem'
    when v_stages <@ array['controle_qualidade', 'embalagem', 'finalizado'] then 'controle_qualidade'
    when v_stages <@ array['acabamento', 'montagem', 'controle_qualidade', 'embalagem', 'finalizado'] then 'acabamento'
    when exists (select 1 from pg_catalog.unnest(v_stages) s where s <> 'fila_entrada') then 'em_producao'
  end;

  if v_target is not null
     and store.order_status_rank(v_target) > coalesce(store.order_status_rank(v_order.status), 0) then
    perform pg_catalog.set_config('app.status_note', 'Produção: ' || new.number || ' em ' || new.stage || '.', true);
    update store.orders set status = v_target where id = v_order.id;
    perform pg_catalog.set_config('app.status_note', '', true);
  end if;
  return new;
end;
$$;

revoke all on function store.sync_order_from_production() from public, anon, authenticated;

drop trigger if exists tr_sync_order_from_production on store.production_orders;
create trigger tr_sync_order_from_production
  after update of stage on store.production_orders
  for each row when (new.stage is distinct from old.stage)
  execute function store.sync_order_from_production();

-- 3. Pedido concluído finaliza as OPs ------------------------------------------------

create or replace function store.finish_production_on_order_done()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Só mudança feita diretamente no pedido (não a que veio de uma OP).
  if pg_catalog.pg_trigger_depth() = 1
     and new.status in ('pronto_retirada', 'enviado', 'entregue', 'concluido')
     and new.status is distinct from old.status then
    update store.production_orders
      set stage = 'finalizado', finished_at = coalesce(finished_at, pg_catalog.now())
    where order_id = new.id and stage <> 'finalizado';
  end if;
  return new;
end;
$$;

revoke all on function store.finish_production_on_order_done() from public, anon, authenticated;

drop trigger if exists tr_finish_production_on_order_done on store.orders;
create trigger tr_finish_production_on_order_done
  after update of status on store.orders
  for each row execute function store.finish_production_on_order_done();

-- 4. Kanban do CRM move o pedido real ---------------------------------------------

create or replace function store.crm_move_order(p_order_id uuid, p_column text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mirror public.orders%rowtype;
  v_order store.orders%rowtype;
  v_target text;
begin
  select * into v_mirror from public.orders where id = p_order_id;
  if v_mirror.id is null then
    raise exception 'Pedido não encontrado.' using errcode = 'P0002';
  end if;
  if not (store.is_staff() or private.is_company_member(v_mirror.company_id)) then
    raise exception 'Sem permissão para mover este pedido.' using errcode = '42501';
  end if;

  select * into v_order from store.orders where id = p_order_id for update;

  -- Pedido antigo, só do CRM: o espelho é o próprio registro.
  if v_order.id is null then
    update public.orders set production_status = p_column where id = p_order_id;
    return pg_catalog.jsonb_build_object('ok', true, 'store', false, 'production_status', p_column);
  end if;

  if v_order.status = 'cancelado' then
    raise exception 'Pedido cancelado não volta para a produção.' using errcode = '22023';
  end if;

  v_target := case p_column
    when 'arte_pendente' then 'aguardando_arquivos'
    when 'arte_em_criacao' then 'arte_criacao'
    when 'arte_aprovada' then 'aprovado_producao'
    when 'em_producao' then 'em_producao'
    when 'em_acabamento' then 'acabamento'
    when 'pronto' then
      case when coalesce(v_order.shipping_method, 'retirada') in ('retirada', 'digital') then 'pronto_retirada' end
    when 'entregue' then 'entregue'
  end;

  if v_target is null then
    raise exception '%', case
      when p_column = 'pronto' then 'Pedido com entrega: registre o envio (com rastreio) no pedido, não no kanban.'
      when p_column = 'pedido_criado' then 'Um pedido da loja não volta para "Novo pedido".'
      else 'Coluna desconhecida: ' || p_column
    end using errcode = '22023';
  end if;

  if v_target is distinct from v_order.status then
    perform pg_catalog.set_config('app.status_note', 'Movido no kanban do CRM.', true);
    update store.orders set status = v_target where id = v_order.id;
    perform pg_catalog.set_config('app.status_note', '', true);
  end if;

  return pg_catalog.jsonb_build_object(
    'ok', true, 'store', true, 'status', v_target,
    'production_status', (select production_status from public.orders where id = p_order_id)
  );
end;
$$;

comment on function store.crm_move_order(uuid, text) is
  'Kanban "Visão de Pedidos" do CRM: move o pedido real da loja (ou o espelho, em pedido só do CRM).';

revoke all on function store.crm_move_order(uuid, text) from public, anon;
grant execute on function store.crm_move_order(uuid, text) to authenticated;
