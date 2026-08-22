-- =============================================================================
-- AUTOMAÇÕES DO CICLO DO PEDIDO
--
-- O schema `store` tem 63 tabelas e, até aqui, três gatilhos de negócio — os
-- três de sincronização com o CRM. Tudo o mais que as telas prometem é escrita
-- manual do app, quando o app lembra:
--
--   * order_status_history só é gravada em updateOrderStatusAction e
--     cancelOrderAction. O nascimento do pedido não deixa rastro, e qualquer
--     mudança feita por outro caminho (link público, correção no banco,
--     importação) some da linha do tempo.
--   * customers.total_orders / total_spent nunca saem de zero. A tela de
--     clientes, o ranking e a curva ABC mostram zero para todo mundo.
--   * notifications tem três pontos de escrita no app inteiro. O sino do painel
--     fica vazio e o cliente liga para saber do pedido.
--   * art_approvals muda de status sem mexer em order_items.art_status nem em
--     orders.status. Os três registros discordam entre si — é o erro que manda
--     chapa com arte reprovada para a impressora.
--   * finance_entries não é alimentada por pagamento nenhum. O caixa do dia não
--     bate com as vendas do dia.
--
-- Esta migração move essas cinco regras para o banco. O critério é o mesmo em
-- todas: a regra vale independentemente de quem escreveu — app, painel do CRM,
-- correção manual ou importação futura.
--
-- ANTI-ECO: `update_customer_totals` escreve em store.customers, que dispara
-- tr_sync_customer_to_client. A volta não acontece porque nenhuma coluna de
-- total participa da sincronização, e 20260801000005 trocou o guard de
-- profundidade por "só propaga se um campo relevante mudou de verdade". Todo
-- update aqui repete esse critério com `is distinct from` — sem ele, as
-- gravações redundantes voltariam a bater na ponte do CRM sem necessidade.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Rótulo de status em português
--
-- Espelha ORDER_STATUS_META de src/lib/domain.ts. A duplicação é consciente: a
-- notificação é gerada no banco e precisa do texto ali; deixá-la com o código
-- cru ('aprovado_producao') entregaria jargão ao cliente.
-- -----------------------------------------------------------------------------

create or replace function store.rotulo_status_pedido(p_status text)
returns text
language sql
immutable
as $$
  select case p_status
    when 'pedido_recebido'      then 'Pedido recebido'
    when 'aguardando_pagamento' then 'Aguardando pagamento'
    when 'pagamento_analise'    then 'Pagamento em análise'
    when 'pago'                 then 'Pagamento confirmado'
    when 'aguardando_arquivos'  then 'Aguardando seus arquivos'
    when 'arte_analise'         then 'Arte em análise'
    when 'arte_criacao'         then 'Arte em criação'
    when 'aguardando_aprovacao' then 'Aguardando sua aprovação'
    when 'alteracao_solicitada' then 'Alteração solicitada'
    when 'aprovado_producao'    then 'Aprovado para produção'
    when 'em_producao'          then 'Em produção'
    when 'acabamento'           then 'Em acabamento'
    when 'controle_qualidade'   then 'Em controle de qualidade'
    when 'embalagem'            then 'Em embalagem'
    when 'pronto_retirada'      then 'Pronto para retirada'
    when 'enviado'              then 'Enviado'
    when 'entregue'             then 'Entregue'
    when 'concluido'            then 'Concluído'
    when 'cancelado'            then 'Cancelado'
    else p_status
  end;
$$;

-- -----------------------------------------------------------------------------
-- 1. Histórico de status
--
-- `changed_by` prefere auth.uid(): é quem de fato clicou. O created_by do
-- pedido é o fallback para escrita por service_role (importação, rotina), onde
-- não há sessão.
-- -----------------------------------------------------------------------------

create or replace function store.log_order_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into store.order_status_history (order_id, from_status, to_status, note, changed_by)
    values (new.id, null, new.status, 'Pedido criado.', coalesce(auth.uid(), new.created_by));

  elsif new.status is distinct from old.status then
    insert into store.order_status_history (order_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, coalesce(auth.uid(), new.created_by));
  end if;

  return new;
end;
$$;

drop trigger if exists tr_log_order_status on store.orders;
create trigger tr_log_order_status
  after insert or update of status on store.orders
  for each row execute function store.log_order_status();

-- -----------------------------------------------------------------------------
-- 2. Totais do cliente
--
-- Recalcula do zero em vez de somar incrementalmente. Somar é mais barato e
-- erra: cancelamento, exclusão e correção de valor deixariam o acumulado
-- mentindo para sempre, sem nenhum jeito de perceber. Aqui, qualquer evento
-- devolve o número certo.
--
-- Pedido cancelado não conta — nem no volume, nem no valor.
-- -----------------------------------------------------------------------------

create or replace function store.update_customer_totals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer uuid := coalesce(new.customer_id, old.customer_id);
begin
  if v_customer is null then
    return coalesce(new, old);
  end if;

  update store.customers c
     set total_orders  = t.qtd,
         total_spent   = t.valor,
         last_order_at = t.ultimo
    from (
      select count(*)                     as qtd,
             coalesce(sum(o.total), 0)    as valor,
             max(o.created_at)            as ultimo
        from store.orders o
       where o.customer_id = v_customer
         and o.status <> 'cancelado'
    ) t
   where c.id = v_customer
     and (c.total_orders   is distinct from t.qtd
       or c.total_spent    is distinct from t.valor
       or c.last_order_at  is distinct from t.ultimo);

  return coalesce(new, old);
end;
$$;

drop trigger if exists tr_update_customer_totals on store.orders;
create trigger tr_update_customer_totals
  after insert or delete or update of total, status, customer_id on store.orders
  for each row execute function store.update_customer_totals();

-- -----------------------------------------------------------------------------
-- 3. Notificação de pedido
--
-- Só para pedido com conta (profile_id). Venda de balcão de cliente sem acesso
-- não tem para quem notificar — e inserir notificação órfã só sujaria a tabela.
--
-- Nem todo status merece aviso: os intermediários de arte e acabamento mudam
-- várias vezes por dia e transformariam o sino em ruído. A lista abaixo é a dos
-- momentos em que o cliente precisa agir ou quer saber.
-- -----------------------------------------------------------------------------

create or replace function store.notify_order_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evento text;
  v_status text;
begin
  if new.profile_id is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_status := new.status;
  elsif new.status is distinct from old.status then
    v_status := new.status;
  else
    return new;
  end if;

  if v_status not in (
    'pedido_recebido', 'aguardando_pagamento', 'pago', 'aguardando_arquivos', 'aguardando_aprovacao',
    'alteracao_solicitada', 'aprovado_producao', 'pronto_retirada', 'enviado',
    'entregue', 'concluido', 'cancelado'
  ) then
    return new;
  end if;

  v_evento := 'pedido_' || v_status;

  insert into store.notifications (profile_id, event, title, body, link)
  values (
    new.profile_id,
    v_evento,
    'Pedido ' || new.number || ': ' || store.rotulo_status_pedido(v_status),
    case v_status
      when 'aguardando_arquivos'  then 'Envie os arquivos de arte para começarmos a produção.'
      when 'aguardando_aprovacao' then 'Sua arte está pronta para aprovação.'
      when 'pronto_retirada'      then 'Seu pedido está pronto para retirada na loja.'
      else null
    end,
    '/painel/pedidos/' || new.id
  );

  return new;
end;
$$;

drop trigger if exists tr_notify_order_event on store.orders;
create trigger tr_notify_order_event
  after insert or update of status on store.orders
  for each row execute function store.notify_order_event();

-- -----------------------------------------------------------------------------
-- 4. Decisão de arte propaga
--
-- A aprovação vive em três lugares — art_approvals (a decisão), order_items
-- (o item) e orders (o pedido) — e só o app mantinha os três de acordo, num
-- único caminho de código. Qualquer outra origem deixava o trio inconsistente.
--
-- Liberar produção exige que NENHUM item esteja pendente: um pedido com cinco
-- itens e uma arte aprovada não pode ir para a impressora.
-- -----------------------------------------------------------------------------

create or replace function store.apply_art_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pendentes integer;
begin
  -- Decisão sem item aponta para o pedido inteiro (é como o link público age).
  if new.order_item_id is not null then
    update store.order_items
       set art_status = new.status
     where id = new.order_item_id
       and art_status is distinct from new.status;
  else
    update store.order_items
       set art_status = new.status
     where order_id = new.order_id
       and art_status is distinct from new.status;
  end if;

  if new.status in ('reprovada', 'alteracao_solicitada') then
    update store.orders
       set status = 'alteracao_solicitada'
     where id = new.order_id
       and status not in ('cancelado', 'concluido', 'entregue')
       and status is distinct from 'alteracao_solicitada';

    return new;
  end if;

  select count(*)
    into v_pendentes
    from store.order_items
   where order_id = new.order_id
     and art_status <> 'aprovada';

  if v_pendentes = 0 then
    update store.orders
       set status = 'aprovado_producao'
     where id = new.order_id
       and status not in ('cancelado', 'concluido', 'entregue')
       and status is distinct from 'aprovado_producao';
  end if;

  return new;
end;
$$;

drop trigger if exists tr_apply_art_decision on store.art_approvals;
create trigger tr_apply_art_decision
  after insert on store.art_approvals
  for each row execute function store.apply_art_decision();

-- -----------------------------------------------------------------------------
-- 5. Pagamento vira receita
--
-- O `not exists` é o que impede duplicata: confirmar pagamento duas vezes, ou
-- estornar e reconfirmar, não pode lançar a mesma venda duas vezes no caixa.
-- -----------------------------------------------------------------------------

create or replace function store.post_finance_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.payment_status is not distinct from old.payment_status then
    return new;
  end if;

  if new.payment_status <> 'pago' then
    return new;
  end if;

  insert into store.finance_entries (
    type, description, category, amount, due_date, paid_at,
    status, order_id, customer_id, payment_method
  ) values (
    'receber',
    'Pedido ' || new.number,
    'vendas',
    new.total,
    current_date,
    now(),
    'pago',
    new.id,
    new.customer_id,
    new.payment_method
  )
  on conflict (order_id) where order_id is not null and type = 'receber'
  do update set
    description = excluded.description,
    amount = excluded.amount,
    due_date = excluded.due_date,
    paid_at = excluded.paid_at,
    status = excluded.status,
    customer_id = excluded.customer_id,
    payment_method = excluded.payment_method;

  return new;
end;
$$;

drop trigger if exists tr_post_finance_entry on store.orders;
create trigger tr_post_finance_entry
  after insert or update of payment_status on store.orders
  for each row execute function store.post_finance_entry();

create unique index if not exists finance_entries_one_receivable_per_order_idx
  on store.finance_entries(order_id)
  where order_id is not null and type = 'receber';

revoke all on function store.log_order_status() from public, anon, authenticated;
revoke all on function store.update_customer_totals() from public, anon, authenticated;
revoke all on function store.notify_order_event() from public, anon, authenticated;
revoke all on function store.apply_art_decision() from public, anon, authenticated;
revoke all on function store.post_finance_entry() from public, anon, authenticated;
