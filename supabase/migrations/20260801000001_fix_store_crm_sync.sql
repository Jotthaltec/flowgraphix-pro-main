-- =============================================================================
-- CORREÇÃO DA SINCRONIZAÇÃO store <-> public
--
-- Os triggers criados em 20260801000000_unify_store_schema.sql não conseguem
-- executar. Quatro defeitos, todos corrigidos aqui:
--
--   1. RECURSÃO INFINITA
--      store.customers -> public.clients -> store.customers -> ...
--      Os dois triggers são AFTER UPDATE e disparam mesmo quando nada muda, então
--      qualquer edição de cliente estourava "stack depth limit exceeded".
--      Correção: `pg_trigger_depth()` corta a volta.
--
--   2. COLUNAS INEXISTENTES
--      Escreviam `public.orders.financial_status` (o certo é `payment_status`) e
--      `public.clients.status` (não existe). Ambos abortavam a transação.
--
--   3. NOT NULL NÃO PREENCHIDOS
--      `clients.company_id`, `orders.company_id`, `orders.deadline` e
--      `orders.product_desc` são obrigatórios e não eram informados.
--
--   4. VOCABULÁRIOS NÃO TRADUZIDOS
--      A loja usa 'pf'/'pj' e 'pendente|processando|pago|…'; o CRM usa
--      'pessoa_fisica'/'pessoa_juridica' e 'nao_pago|entrada_paga|pago|atrasado'.
--      Copiar cru gravava valores que as telas do CRM não sabem exibir.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Empresa de destino no CRM
-- -----------------------------------------------------------------------------

/*
 * `company_id` é obrigatório em clients e orders. Enquanto houver uma única
 * gráfica, resolver pela primeira empresa é suficiente e evita configuração.
 * Num cenário multi-empresa, troque por um mapeamento explícito.
 */
create or replace function public.crm_default_company()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.companies order by created_at limit 1;
$$;

-- -----------------------------------------------------------------------------
-- Tradutores de vocabulário
-- -----------------------------------------------------------------------------

create or replace function public.map_customer_type(p_type text)
returns text
language sql
immutable
as $$
  select case p_type when 'pj' then 'pessoa_juridica' else 'pessoa_fisica' end;
$$;

create or replace function public.map_client_type_back(p_type text)
returns text
language sql
immutable
as $$
  select case p_type when 'pessoa_juridica' then 'pj' else 'pf' end;
$$;

/*
 * O CRM só modela o que a gráfica recebeu: recusa, estorno e cancelamento
 * voltam todos para 'nao_pago'. O detalhe fica na loja.
 */
create or replace function public.map_payment_status(p_status text)
returns text
language sql
immutable
as $$
  select case p_status
    when 'pago' then 'pago'
    when 'processando' then 'entrada_paga'
    else 'nao_pago'
  end;
$$;

/*
 * Os 19 status da loja colapsam nos 9 do chão de fábrica do CRM.
 */
create or replace function public.map_production_status(p_status text)
returns text
language sql
immutable
as $$
  select case p_status
    when 'aguardando_arquivos'    then 'arte_pendente'
    when 'arte_analise'           then 'arte_pendente'
    when 'arte_criacao'           then 'arte_em_criacao'
    when 'aguardando_aprovacao'   then 'arte_em_criacao'
    when 'alteracao_solicitada'   then 'arte_em_criacao'
    when 'aprovado_producao'      then 'arte_aprovada'
    when 'em_producao'            then 'em_producao'
    when 'acabamento'             then 'em_acabamento'
    when 'controle_qualidade'     then 'em_acabamento'
    when 'embalagem'              then 'em_acabamento'
    when 'pronto_retirada'        then 'pronto'
    when 'enviado'                then 'pronto'
    when 'entregue'               then 'entregue'
    when 'concluido'              then 'entregue'
    when 'cancelado'              then 'cancelado'
    else 'pedido_criado'
  end;
$$;

-- -----------------------------------------------------------------------------
-- store.customers -> public.clients
-- -----------------------------------------------------------------------------

create or replace function store.sync_customer_to_client()
returns trigger
language plpgsql
security definer
set search_path = public, store
as $$
begin
  -- Corta a recursão: se já estamos dentro de outro trigger, a origem é a volta
  -- do CRM e não há o que propagar.
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  insert into public.clients (
    id, company_id, name, company_name, document, email, whatsapp, client_type, notes
  )
  values (
    new.id,
    public.crm_default_company(),
    new.name,
    new.company_name,
    new.document,
    new.email,
    new.phone,
    public.map_customer_type(new.customer_type),
    new.notes
  )
  on conflict (id) do update set
    name         = excluded.name,
    company_name = excluded.company_name,
    document     = excluded.document,
    email        = excluded.email,
    whatsapp     = excluded.whatsapp,
    client_type  = excluded.client_type,
    notes        = excluded.notes;

  return new;
end;
$$;

drop trigger if exists tr_sync_customer_to_client on store.customers;
create trigger tr_sync_customer_to_client
  after insert or update on store.customers
  for each row execute function store.sync_customer_to_client();

-- -----------------------------------------------------------------------------
-- public.clients -> store.customers
-- -----------------------------------------------------------------------------

create or replace function public.sync_client_to_store_customer()
returns trigger
language plpgsql
security definer
set search_path = public, store
as $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  -- Só atualiza: um cliente que nasce no CRM não vira conta na loja
  -- automaticamente, porque não tem login nem aceite de termos.
  update store.customers set
    name          = new.name,
    company_name  = new.company_name,
    document      = new.document,
    email         = new.email,
    phone         = new.whatsapp,
    customer_type = public.map_client_type_back(new.client_type),
    notes         = new.notes
  where id = new.id;

  return new;
end;
$$;

drop trigger if exists tr_sync_client_to_store_customer on public.clients;
create trigger tr_sync_client_to_store_customer
  after update on public.clients
  for each row execute function public.sync_client_to_store_customer();

-- -----------------------------------------------------------------------------
-- store.orders -> public.orders
-- -----------------------------------------------------------------------------

create or replace function store.sync_order_to_crm()
returns trigger
language plpgsql
security definer
set search_path = public, store
as $$
declare
  v_client_id uuid;
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  -- `orders.client_id` é NOT NULL no CRM. O cliente chega lá pelo trigger de
  -- store.customers; se ainda não chegou, garante agora em vez de abortar.
  select id into v_client_id from public.clients where id = new.customer_id;

  if v_client_id is null then
    if new.customer_id is null then
      return new;
    end if;

    insert into public.clients (id, company_id, name, client_type)
    select c.id, public.crm_default_company(), c.name, public.map_customer_type(c.customer_type)
    from store.customers c
    where c.id = new.customer_id
    on conflict (id) do nothing;

    select id into v_client_id from public.clients where id = new.customer_id;
    if v_client_id is null then
      return new;
    end if;
  end if;

  insert into public.orders (
    id, company_id, client_id, order_number, product_desc,
    total_value, deadline, payment_status, production_status, notes
  )
  values (
    new.id,
    public.crm_default_company(),
    v_client_id,
    new.number,
    -- `product_desc` é NOT NULL e os itens ainda não existem no INSERT do
    -- pedido; o resumo real entra pelo trigger de store.order_items.
    'Pedido ' || new.number,
    new.total,
    coalesce(new.estimated_delivery::date, current_date + 7),
    public.map_payment_status(new.payment_status),
    public.map_production_status(new.status),
    new.notes
  )
  on conflict (id) do update set
    client_id         = excluded.client_id,
    order_number      = excluded.order_number,
    total_value       = excluded.total_value,
    deadline          = excluded.deadline,
    payment_status    = excluded.payment_status,
    production_status = excluded.production_status,
    notes             = excluded.notes;

  return new;
end;
$$;

drop trigger if exists tr_sync_order_to_crm on store.orders;
create trigger tr_sync_order_to_crm
  after insert or update on store.orders
  for each row execute function store.sync_order_to_crm();

-- -----------------------------------------------------------------------------
-- store.order_items -> public.orders.product_desc
-- -----------------------------------------------------------------------------

/*
 * O CRM descreve o pedido num campo de texto; a loja tem lista de itens. Este
 * trigger recompõe o resumo sempre que a lista muda, para o chão de fábrica ver
 * o que precisa produzir em vez do placeholder "Pedido NNN".
 */
create or replace function store.sync_order_items_to_crm()
returns trigger
language plpgsql
security definer
set search_path = public, store
as $$
declare
  v_order_id uuid := coalesce(new.order_id, old.order_id);
  v_desc text;
begin
  select string_agg(i.quantity || 'x ' || i.product_name, ' | ' order by i.id)
  into v_desc
  from store.order_items i
  where i.order_id = v_order_id;

  if v_desc is not null then
    update public.orders set product_desc = left(v_desc, 500) where id = v_order_id;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists tr_sync_order_items_to_crm on store.order_items;
create trigger tr_sync_order_items_to_crm
  after insert or update or delete on store.order_items
  for each row execute function store.sync_order_items_to_crm();
