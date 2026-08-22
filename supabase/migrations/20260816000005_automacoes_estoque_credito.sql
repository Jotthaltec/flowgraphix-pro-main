-- =============================================================================
-- AUTOMAÇÕES DE ESTOQUE, CRÉDITO, CUPOM E PRODUÇÃO
--
-- Quatro saldos que o sistema exibe e nunca calcula:
--
--   * stock_movements.balance_after fica nulo e stock_items.quantity/avg_cost
--     não se movem. O estoque na tela nunca é o estoque real, e o custo médio
--     nunca é recalculado — então o custo de produção sai errado por baixo.
--   * credits.balance_after fica no default 0 e profiles.credit_balance nunca é
--     atualizado. Hoje isso mata o recurso (o cliente nunca vê o crédito que
--     ganhou). O lado perigoso aparece no dia em que alguém escrever o saldo à
--     mão: o checkout LÊ profiles.credit_balance para autorizar pagamento em
--     credito_interno e NADA debita depois — o mesmo saldo paga quantas vezes
--     quiserem. É a única falha desta migração que tem cara de prejuízo direto.
--   * coupons.used_count só é incrementado pelo app, e só quando há service
--     role. Cupom com limite de uso não respeita o limite.
--   * production_stage_history existe e fica vazia. Sem tempo por estágio não
--     há como achar gargalo nem calcular hora-máquina.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Saldo de estoque
--
-- O sinal de cada tipo de movimento fica AQUI, e não em quem chama, porque o
-- mesmo movimento é lançado pelo painel, pela produção e (em breve) pela
-- importação. Regra espalhada é regra que diverge.
--
-- `inventario` é o caso que foge do padrão: a quantidade informada é o saldo
-- contado na prateleira, não a variação. O delta é a diferença.
--
-- O `for update` serializa duas baixas simultâneas do mesmo insumo. Sem ele,
-- duas produções concorrentes leem o mesmo saldo e a segunda sobrescreve a
-- primeira — o clássico lost update, que em estoque some com material.
-- -----------------------------------------------------------------------------

create or replace function store.set_stock_balance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_saldo numeric;
  v_delta numeric;
begin
  select quantity
    into v_saldo
    from store.stock_items
   where id = new.stock_item_id
     for update;

  if v_saldo is null then
    raise exception 'Item de estoque % não existe', new.stock_item_id;
  end if;

  v_delta := case new.type
    when 'entrada'           then  new.quantity
    when 'saida'             then -new.quantity
    when 'consumo_producao'  then -new.quantity
    when 'ajuste'            then  new.quantity          -- assinado pelo operador
    when 'inventario'        then  new.quantity - v_saldo -- informa o saldo contado
    else 0
  end;

  new.balance_after := v_saldo + v_delta;

  if new.balance_after < 0 then
    raise exception
      'Estoque insuficiente: disponível %, movimento de % (%).',
      v_saldo, new.quantity, new.type;
  end if;

  return new;
end;
$$;

drop trigger if exists tr_set_stock_balance on store.stock_movements;
create trigger tr_set_stock_balance
  before insert on store.stock_movements
  for each row execute function store.set_stock_balance();

-- Custo médio ponderado só se move na entrada com custo informado: saída não
-- altera o custo do que restou, e entrada sem nota não tem como ponderar.
-- Dentro do UPDATE, s.quantity ainda é o saldo anterior — é o que faz a média
-- ponderada fechar.
create or replace function store.apply_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update store.stock_items s
     set quantity = new.balance_after,
         avg_cost = case
           when new.type = 'entrada'
            and new.unit_cost is not null
            and (greatest(s.quantity, 0) + new.quantity) > 0
           then round(
                  ((greatest(s.quantity, 0) * s.avg_cost) + (new.quantity * new.unit_cost))
                  / (greatest(s.quantity, 0) + new.quantity)
                , 4)
           else s.avg_cost
         end
   where s.id = new.stock_item_id;

  return new;
end;
$$;

drop trigger if exists tr_apply_stock_movement on store.stock_movements;
create trigger tr_apply_stock_movement
  after insert on store.stock_movements
  for each row execute function store.apply_stock_movement();

-- -----------------------------------------------------------------------------
-- 2. Saldo de crédito
--
-- A exceção em saldo negativo é o ponto principal desta seção. Sem ela, o
-- débito grava um balance_after negativo e o checkout continua autorizando —
-- que é exatamente o buraco descrito no cabeçalho. Falhar alto aqui é melhor
-- do que deixar passar: o pedido é recusado com mensagem clara em vez de a
-- gráfica descobrir o rombo no fechamento do mês.
--
-- Estorno e cashback somam; crédito soma; débito subtrai.
-- -----------------------------------------------------------------------------

create or replace function store.set_credit_balance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_saldo numeric;
begin
  select coalesce(credit_balance, 0)
    into v_saldo
    from store.profiles
   where id = new.profile_id
     for update;

  if v_saldo is null then
    raise exception 'Perfil % não existe — crédito não pode ser lançado', new.profile_id;
  end if;

  new.balance_after := v_saldo + case
    when new.type in ('credito', 'cashback', 'estorno') then  new.amount
    else                                                     -new.amount
  end;

  if new.balance_after < 0 then
    raise exception
      'Saldo de crédito insuficiente: disponível %, lançamento de % (%).',
      v_saldo, new.amount, new.type;
  end if;

  return new;
end;
$$;

drop trigger if exists tr_set_credit_balance on store.credits;
create trigger tr_set_credit_balance
  before insert on store.credits
  for each row execute function store.set_credit_balance();

create or replace function store.apply_credit_balance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update store.profiles
     set credit_balance = new.balance_after
   where id = new.profile_id
     and credit_balance is distinct from new.balance_after;

  return new;
end;
$$;

drop trigger if exists tr_apply_credit_balance on store.credits;
create trigger tr_apply_credit_balance
  after insert on store.credits
  for each row execute function store.apply_credit_balance();

-- -----------------------------------------------------------------------------
-- 3. Contador de uso do cupom
--
-- O DELETE devolve o uso porque cancelar um pedido apaga o coupon_uses em
-- cascata: sem a devolução, uma promoção morreria por cancelamentos.
-- -----------------------------------------------------------------------------

create or replace function store.count_coupon_use()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update store.coupons
       set used_count = used_count + 1
     where id = new.coupon_id;
    return new;
  end if;

  update store.coupons
     set used_count = greatest(used_count - 1, 0)
   where id = old.coupon_id;

  return old;
end;
$$;

drop trigger if exists tr_count_coupon_use on store.coupon_uses;
create trigger tr_count_coupon_use
  after insert or delete on store.coupon_uses
  for each row execute function store.count_coupon_use();

-- -----------------------------------------------------------------------------
-- 4. Histórico de estágio da produção
-- -----------------------------------------------------------------------------

create or replace function store.log_production_stage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into store.production_stage_history (production_order_id, from_stage, to_stage, changed_by)
    values (new.id, null, new.stage, coalesce(auth.uid(), new.assigned_to));

  elsif new.stage is distinct from old.stage then
    insert into store.production_stage_history (production_order_id, from_stage, to_stage, changed_by)
    values (new.id, old.stage, new.stage, coalesce(auth.uid(), new.assigned_to));
  end if;

  return new;
end;
$$;

drop trigger if exists tr_log_production_stage on store.production_orders;
create trigger tr_log_production_stage
  after insert or update of stage on store.production_orders
  for each row execute function store.log_production_stage();

-- Integridade e idempotência: valores não positivos não representam movimento,
-- e o mesmo pedido não pode consumir o mesmo saldo duas vezes por reenvio.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'store.credits'::regclass
      and conname = 'credits_amount_positive'
  ) then
    alter table store.credits
      add constraint credits_amount_positive check (amount > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'store.stock_movements'::regclass
      and conname = 'stock_movements_quantity_positive'
  ) then
    alter table store.stock_movements
      add constraint stock_movements_quantity_positive check (quantity > 0);
  end if;
end $$;

create unique index if not exists credits_one_debit_per_order_idx
  on store.credits(order_id, profile_id)
  where order_id is not null and type = 'debito';

revoke all on function store.set_stock_balance() from public, anon, authenticated;
revoke all on function store.apply_stock_movement() from public, anon, authenticated;
revoke all on function store.set_credit_balance() from public, anon, authenticated;
revoke all on function store.apply_credit_balance() from public, anon, authenticated;
revoke all on function store.count_coupon_use() from public, anon, authenticated;
revoke all on function store.log_production_stage() from public, anon, authenticated;
