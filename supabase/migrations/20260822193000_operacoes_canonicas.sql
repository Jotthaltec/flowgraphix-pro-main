-- =============================================================================
-- OPERAÇÕES CANÔNICAS — pedido transacional e proposta pública segura
-- =============================================================================

create extension if not exists unaccent with schema extensions;

-- Papéis operacionais do CRM também existem no domínio da loja. A autorização
-- continua sendo feita por policy/função; ampliar o enum não amplia acesso só.
alter table public.companies add column if not exists store_access boolean not null default false;
update public.companies c
   set store_access = true
 where exists (
   select 1 from store.profiles p
   where p.id = c.owner_id and p.role = 'admin' and p.active
 );

-- A loja pode ser instalada antes do primeiro tenant do CRM. Nesse estado,
-- sincronizar é um no-op seguro: cadastro e pedido continuam funcionando e a
-- ponte passa a usar, de forma determinística, o primeiro tenant habilitado.
create or replace function public.crm_default_company()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id
    from public.companies c
   order by c.store_access desc, c.created_at, c.id
   limit 1;
$$;

revoke all on function public.crm_default_company() from public, anon, authenticated;

create or replace function store.sync_customer_to_client()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid := public.crm_default_company();
begin
  if v_company_id is null then
    return new;
  end if;

  insert into public.clients (
    id, company_id, name, company_name, document, email, whatsapp, client_type, notes
  ) values (
    new.id, v_company_id, new.name, new.company_name, new.document, new.email,
    new.phone, public.map_customer_type(new.customer_type), new.notes
  )
  on conflict (id) do update set
    company_id  = excluded.company_id,
    name         = excluded.name,
    company_name = excluded.company_name,
    document     = excluded.document,
    email        = excluded.email,
    whatsapp     = excluded.whatsapp,
    client_type  = excluded.client_type,
    notes        = excluded.notes
  where public.clients.company_id   is distinct from excluded.company_id
     or public.clients.name         is distinct from excluded.name
     or public.clients.company_name is distinct from excluded.company_name
     or public.clients.document     is distinct from excluded.document
     or public.clients.email        is distinct from excluded.email
     or public.clients.whatsapp     is distinct from excluded.whatsapp
     or public.clients.client_type  is distinct from excluded.client_type
     or public.clients.notes        is distinct from excluded.notes;

  return new;
end;
$$;

create or replace function store.sync_order_to_crm()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid := public.crm_default_company();
  v_client_id uuid;
begin
  if v_company_id is null or new.customer_id is null then
    return new;
  end if;

  select c.id into v_client_id
    from public.clients c
   where c.id = new.customer_id;

  if v_client_id is null then
    insert into public.clients (id, company_id, name, client_type)
    select c.id, v_company_id, c.name, public.map_customer_type(c.customer_type)
      from store.customers c
     where c.id = new.customer_id
    on conflict (id) do nothing;

    select c.id into v_client_id
      from public.clients c
     where c.id = new.customer_id;
    if v_client_id is null then
      return new;
    end if;
  end if;

  insert into public.orders (
    id, company_id, client_id, order_number, product_desc,
    total_value, deadline, payment_status, production_status, notes
  ) values (
    new.id, v_company_id, v_client_id, new.number, 'Pedido ' || new.number,
    new.total, coalesce(new.estimated_delivery::date, current_date + 7),
    public.map_payment_status(new.payment_status),
    public.map_production_status(new.status), new.notes
  )
  on conflict (id) do update set
    company_id        = excluded.company_id,
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

revoke all on function store.sync_customer_to_client() from public, anon, authenticated;
revoke all on function store.sync_order_to_crm() from public, anon, authenticated;

alter table store.profiles drop constraint if exists profiles_role_check;
alter table store.profiles add constraint profiles_role_check check (role in (
  'cliente','revendedor','vendedor','atendente','producao','financeiro','admin'
));

create or replace function store.auth_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.role from store.profiles p where p.id = (select auth.uid())), 'anon');
$$;

create or replace function store.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from store.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin' and p.active
  );
$$;

create or replace function store.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from store.profiles p
    where p.id = (select auth.uid())
      and p.role in ('admin','vendedor','atendente','producao','financeiro')
      and p.active
  );
$$;

revoke all on function store.auth_role() from public;
revoke all on function store.is_admin() from public;
revoke all on function store.is_staff() from public;
grant execute on function store.auth_role(), store.is_admin(), store.is_staff()
  to anon, authenticated, service_role;

-- Um cadastro originado no Flow é o dono operacional inicial. Convites futuros
-- são sincronizados por company_members sem transformar clientes em equipe.
create or replace function store.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_name text;
  v_document text;
  v_customer_type text;
  v_store_access boolean := false;
begin
  if coalesce(new.raw_user_meta_data->>'app_origin', '') in ('flow','crm') then
    select c.store_access into v_store_access
      from public.profiles p
      join public.companies c on c.id = p.company_id
      where p.user_id = new.id;
    if not coalesce(v_store_access, false) then
      return new;
    end if;
    v_role := 'admin';
  else
    v_role := coalesce(new.raw_user_meta_data->>'role', 'cliente');
    if v_role not in ('cliente', 'revendedor') then
      v_role := 'cliente';
    end if;
  end if;

  v_name := coalesce(
    nullif(pg_catalog.btrim(new.raw_user_meta_data->>'full_name'), ''),
    pg_catalog.split_part(new.email, '@', 1)
  );
  v_document := nullif(
    pg_catalog.regexp_replace(coalesce(new.raw_user_meta_data->>'document', ''), '\D', '', 'g'),
    ''
  );
  v_customer_type := coalesce(nullif(new.raw_user_meta_data->>'customer_type', ''), 'pf');

  insert into store.profiles (
    id, role, full_name, email, phone, document, customer_type, company_name
  ) values (
    new.id, v_role, v_name, new.email,
    nullif(new.raw_user_meta_data->>'phone', ''), v_document, v_customer_type,
    nullif(new.raw_user_meta_data->>'company_name', '')
  )
  on conflict (id) do nothing;

  -- Só contas da loja são clientes comerciais. Usuário interno do Flow não
  -- polui CRM, relatórios de cliente ou métricas de compra.
  if coalesce(new.raw_user_meta_data->>'app_origin', '') not in ('flow','crm') then
    insert into store.customers (
      profile_id, name, company_name, customer_type, document, email, phone, created_by
    ) values (
      new.id, v_name, nullif(new.raw_user_meta_data->>'company_name', ''),
      v_customer_type, v_document, new.email,
      nullif(new.raw_user_meta_data->>'phone', ''), new.id
    )
    on conflict do nothing;
  end if;

  return new;
end;
$$;

revoke all on function store.handle_new_user() from public, anon, authenticated;

create or replace function store.sync_company_member_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_name text;
  v_role text;
  v_store_access boolean;
begin
  if tg_op = 'DELETE' then
    update store.profiles set active = false where id = old.user_id;
    return old;
  end if;

  select u.email, coalesce(nullif(u.raw_user_meta_data->>'full_name',''), u.email)
    into v_email, v_name
    from auth.users u where u.id = new.user_id;

  select c.store_access into v_store_access
    from public.companies c where c.id = new.company_id;
  if not coalesce(v_store_access, false) then
    update store.profiles set active = false where id = new.user_id;
    return new;
  end if;

  v_role := case new.role
    when 'owner' then 'admin'
    when 'admin' then 'admin'
    when 'atendente' then 'atendente'
    when 'vendedor' then 'vendedor'
    when 'producao' then 'producao'
    when 'financeiro' then 'financeiro'
    else 'atendente'
  end;

  insert into store.profiles (id, role, full_name, email, active)
  values (new.user_id, v_role, coalesce(v_name,''), v_email, new.active)
  on conflict (id) do update
    set role = excluded.role, active = excluded.active, updated_at = now();
  return new;
end;
$$;

drop trigger if exists tr_sync_company_member_role on public.company_members;
create trigger tr_sync_company_member_role
  after insert or update of role, active or delete on public.company_members
  for each row execute function store.sync_company_member_role();

revoke all on function store.sync_company_member_role() from public, anon, authenticated;

-- Limite operacional real de quantidade e chave de idempotência por origem.
alter table store.products add column if not exists max_quantity integer;
alter table store.products drop constraint if exists products_max_quantity_check;
alter table store.products add constraint products_max_quantity_check
  check (max_quantity is null or max_quantity >= min_quantity);

alter table store.orders add column if not exists idempotency_key text;
create unique index if not exists orders_idempotency_key_idx
  on store.orders(idempotency_key) where idempotency_key is not null;

alter table store.quotes add column if not exists idempotency_key text;
create unique index if not exists quotes_idempotency_key_idx
  on store.quotes(idempotency_key) where idempotency_key is not null;
alter table store.quote_items add column if not exists internal_cost numeric(12,4);
alter table store.quote_items add column if not exists source_origin text;

alter table store.customers add column if not exists system_key text;
create unique index if not exists customers_system_key_idx
  on store.customers(system_key) where system_key is not null;

alter table store.orders drop constraint if exists orders_payment_method_check;
alter table store.orders add constraint orders_payment_method_check check (payment_method in (
  'pix','cartao_credito','boleto','link_pagamento','credito_interno',
  'combinado','aprovado_manual','dinheiro','faturado'
));

alter table store.payments add column if not exists idempotency_key text;
create unique index if not exists payments_idempotency_key_idx
  on store.payments(idempotency_key) where idempotency_key is not null;

create table if not exists store.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references store.profiles(id) on delete restrict,
  status text not null default 'aberto' check (status in ('aberto','fechado')),
  opening_amount numeric(12,2) not null default 0 check (opening_amount >= 0),
  expected_amount numeric(12,2),
  closing_amount numeric(12,2),
  difference_amount numeric(12,2),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  notes text
);
create unique index if not exists cash_sessions_one_open_per_operator_idx
  on store.cash_sessions(operator_id) where status = 'aberto';

create table if not exists store.cash_movements (
  id uuid primary key default gen_random_uuid(),
  cash_session_id uuid not null references store.cash_sessions(id) on delete restrict,
  order_id uuid references store.orders(id) on delete restrict,
  type text not null check (type in ('venda','suprimento','sangria','estorno')),
  payment_method text,
  amount numeric(12,2) not null check (amount > 0),
  reference text,
  created_by uuid not null references store.profiles(id) on delete restrict,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists cash_movements_session_idx on store.cash_movements(cash_session_id, created_at);
alter table store.cash_sessions enable row level security;
alter table store.cash_movements enable row level security;
drop policy if exists cash_sessions_staff_read on store.cash_sessions;
create policy cash_sessions_staff_read on store.cash_sessions for select to authenticated
  using (operator_id = (select auth.uid()) or store.is_admin());
drop policy if exists cash_movements_staff_read on store.cash_movements;
create policy cash_movements_staff_read on store.cash_movements for select to authenticated
  using (created_by = (select auth.uid()) or store.is_admin());
revoke all on store.cash_sessions, store.cash_movements from anon, authenticated;
grant select on store.cash_sessions, store.cash_movements to authenticated;
grant all on store.cash_sessions, store.cash_movements to service_role;

create table if not exists store.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null unique references store.notifications(id) on delete cascade,
  profile_id uuid not null references store.profiles(id) on delete cascade,
  channel text not null default 'email' check (channel = 'email'),
  recipient text not null,
  subject text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pendente' check (status in ('pendente','enviando','enviado','falhou')),
  attempts integer not null default 0,
  last_error text,
  next_attempt_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notification_outbox_pending_idx
  on store.notification_outbox(next_attempt_at, created_at) where status in ('pendente','falhou');
alter table store.notification_outbox enable row level security;
drop policy if exists notification_outbox_admin_read on store.notification_outbox;
create policy notification_outbox_admin_read on store.notification_outbox
  for select to authenticated using (store.is_admin());
revoke all on store.notification_outbox from anon, authenticated;
grant select on store.notification_outbox to authenticated;
grant all on store.notification_outbox to service_role;

create or replace function store.enqueue_notification_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  select email into v_email from store.profiles where id = new.profile_id and active;
  if nullif(pg_catalog.btrim(v_email), '') is null then
    return new;
  end if;
  insert into store.notification_outbox (
    notification_id, profile_id, recipient, subject, payload
  ) values (
    new.id, new.profile_id, v_email, new.title,
    jsonb_build_object('body', new.body, 'link', new.link, 'event', new.event)
  ) on conflict (notification_id) do nothing;
  return new;
end;
$$;
drop trigger if exists tr_enqueue_notification_email on store.notifications;
create trigger tr_enqueue_notification_email
  after insert on store.notifications
  for each row execute function store.enqueue_notification_email();
revoke all on function store.enqueue_notification_email() from public, anon, authenticated;

-- Uma solicitacao em analise por revendedor. Pedidos antigos repetidos ficam
-- encerrados como substituidos, preservando todo o historico.
with ranked_requests as (
  select id, row_number() over (partition by profile_id order by created_at desc, id desc) as position
  from store.credit_requests
  where status = 'pendente'
)
update store.credit_requests r
   set status = 'recusado',
       reviewed_at = coalesce(r.reviewed_at, now()),
       review_note = coalesce(r.review_note, 'Substituida por uma solicitacao mais recente.')
  from ranked_requests ranked
 where r.id = ranked.id and ranked.position > 1;
create unique index if not exists credit_requests_one_pending_per_profile_idx
  on store.credit_requests(profile_id) where status = 'pendente';

create table if not exists store.reseller_limit_movements (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references store.profiles(id) on delete restrict,
  order_id uuid not null references store.orders(id) on delete restrict,
  type text not null check (type in ('reserva','liquidacao','liberacao')),
  amount numeric(12,2) not null check (amount > 0),
  used_after numeric(12,2) not null check (used_after >= 0),
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists reseller_limit_movements_profile_idx
  on store.reseller_limit_movements(profile_id, created_at desc);
alter table store.reseller_limit_movements enable row level security;
drop policy if exists reseller_limit_movements_read on store.reseller_limit_movements;
create policy reseller_limit_movements_read on store.reseller_limit_movements
  for select to authenticated
  using (profile_id = (select auth.uid()) or store.is_admin());
revoke all on store.reseller_limit_movements from anon;
grant select on store.reseller_limit_movements to authenticated;
grant all on store.reseller_limit_movements to service_role;

alter table store.production_orders add column if not exists assigned_section text;

create table if not exists store.stock_reservations (
  id uuid primary key default gen_random_uuid(),
  production_order_id uuid not null references store.production_orders(id) on delete restrict,
  order_id uuid not null references store.orders(id) on delete restrict,
  stock_item_id uuid not null references store.stock_items(id) on delete restrict,
  quantity numeric(12,3) not null check (quantity > 0),
  status text not null default 'reservado' check (status in ('reservado','consumido','liberado')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (production_order_id, stock_item_id)
);
create index if not exists stock_reservations_item_status_idx
  on store.stock_reservations(stock_item_id, status);
alter table store.stock_reservations enable row level security;
drop policy if exists stock_reservations_staff_read on store.stock_reservations;
create policy stock_reservations_staff_read on store.stock_reservations
  for select to authenticated using (store.is_staff());
revoke all on store.stock_reservations from anon, authenticated;
grant select on store.stock_reservations to authenticated;
grant all on store.stock_reservations to service_role;

create unique index if not exists commissions_order_profile_role_idx
  on store.commissions(order_id, profile_id, role) where order_id is not null;

create or replace function store.open_cash_session(p_opening_amount numeric default 0)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_session store.cash_sessions%rowtype;
begin
  if v_actor is null or not store.is_staff() then
    raise exception 'Perfil sem permissao para operar o caixa.' using errcode = '42501';
  end if;
  if p_opening_amount < 0 then
    raise exception 'Saldo inicial invalido.' using errcode = '22023';
  end if;
  select * into v_session from store.cash_sessions
   where operator_id = v_actor and status = 'aberto' for update;
  if v_session.id is not null then
    return jsonb_build_object('id', v_session.id, 'reused', true, 'opening_amount', v_session.opening_amount);
  end if;
  insert into store.cash_sessions(operator_id, opening_amount)
  values (v_actor, round(p_opening_amount, 2)) returning * into v_session;
  return jsonb_build_object('id', v_session.id, 'reused', false, 'opening_amount', v_session.opening_amount);
end;
$$;

create or replace function store.close_cash_session(p_closing_amount numeric, p_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_session store.cash_sessions%rowtype;
  v_expected numeric(12,2);
begin
  if v_actor is null or not store.is_staff() then
    raise exception 'Perfil sem permissao para operar o caixa.' using errcode = '42501';
  end if;
  if p_closing_amount < 0 then
    raise exception 'Saldo contado invalido.' using errcode = '22023';
  end if;
  select * into v_session from store.cash_sessions
   where operator_id = v_actor and status = 'aberto' for update;
  if v_session.id is null then
    raise exception 'Nao existe caixa aberto para este operador.' using errcode = 'P0002';
  end if;
  select v_session.opening_amount + coalesce(sum(case
    when type in ('venda','suprimento') then amount else -amount end), 0)
    into v_expected from store.cash_movements where cash_session_id = v_session.id;
  update store.cash_sessions
     set status='fechado', expected_amount=v_expected, closing_amount=round(p_closing_amount,2),
         difference_amount=round(p_closing_amount-v_expected,2), closed_at=now(),
         notes=nullif(pg_catalog.btrim(p_notes),'')
   where id=v_session.id;
  return jsonb_build_object('id', v_session.id, 'expected_amount', v_expected,
    'closing_amount', round(p_closing_amount,2), 'difference_amount', round(p_closing_amount-v_expected,2));
end;
$$;

revoke all on function store.open_cash_session(numeric) from public, anon;
revoke all on function store.close_cash_session(numeric,text) from public, anon;
grant execute on function store.open_cash_session(numeric), store.close_cash_session(numeric,text)
  to authenticated, service_role;

-- Cabeçalho, itens, pagamento, crédito, cupom, financeiro, comissão e OP são
-- uma única transação. SECURITY DEFINER é seguro aqui porque identidade,
-- propriedade e todos os valores são revalidados antes do primeiro INSERT.
create or replace function store.create_order(
  p_order jsonb,
  p_items jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_role text;
  v_order_id uuid;
  v_number text;
  v_item jsonb;
  v_item_id uuid;
  v_profile_id uuid;
  v_customer_id uuid;
  v_reseller_id uuid;
  v_seller_id uuid;
  v_quote_id uuid;
  v_subtotal numeric(12,2);
  v_discount numeric(12,2);
  v_shipping numeric(12,2);
  v_total numeric(12,2);
  v_credit numeric(12,2);
  v_items_total numeric(12,2) := 0;
  v_quantity integer;
  v_unit numeric(12,4);
  v_line numeric(12,2);
  v_product_id uuid;
  v_coupon_id uuid;
  v_coupon store.coupons%rowtype;
  v_pct numeric(5,2);
  v_create_production boolean;
  v_payment_status text;
  v_payment_method text;
  v_limit numeric(12,2);
  v_limit_used numeric(12,2);
  v_cash_session_id uuid;
begin
  if v_actor is null then
    raise exception 'Sessão expirada.' using errcode = '42501';
  end if;
  if p_idempotency_key is null or length(p_idempotency_key) not between 12 and 200 then
    raise exception 'Chave de idempotência inválida.' using errcode = '22023';
  end if;

  select o.id, o.number into v_order_id, v_number
    from store.orders o where o.idempotency_key = p_idempotency_key;
  if v_order_id is not null then
    return jsonb_build_object('id', v_order_id, 'number', v_number, 'reused', true);
  end if;

  select p.role into v_actor_role
    from store.profiles p where p.id = v_actor and p.active for update;
  if v_actor_role is null then
    raise exception 'Perfil operacional ausente ou inativo.' using errcode = '42501';
  end if;
  if v_actor_role not in ('admin','vendedor','atendente')
     and coalesce(current_setting('app.trusted_order', true), '') <> 'true' then
    raise exception 'Pedidos de cliente e revendedor devem passar pelo checkout validado do servidor.' using errcode = '42501';
  end if;

  v_profile_id := coalesce(nullif(p_order->>'profile_id','')::uuid, v_actor);
  v_customer_id := nullif(p_order->>'customer_id','')::uuid;
  v_reseller_id := nullif(p_order->>'reseller_id','')::uuid;
  v_seller_id := nullif(p_order->>'seller_id','')::uuid;
  v_quote_id := nullif(p_order->>'quote_id','')::uuid;

  if coalesce(p_order->>'source','') = 'balcao' and v_customer_id is null then
    if v_actor_role not in ('admin','vendedor','atendente') then
      raise exception 'Somente a equipe pode registrar venda de balcão.' using errcode = '42501';
    end if;
    insert into store.customers (
      name, customer_type, tags, created_by, system_key
    ) values (
      'Consumidor balcão', 'pf', array['sistema','balcao'], v_actor, 'walk_in_customer'
    ) on conflict (system_key) where system_key is not null do update
      set active = true
    returning id into v_customer_id;
  end if;

  if v_actor_role not in ('admin','vendedor','atendente') and v_profile_id <> v_actor then
    raise exception 'Não é permitido criar pedido para outro perfil.' using errcode = '42501';
  end if;
  if v_reseller_id is not null and v_reseller_id <> v_actor and v_actor_role not in ('admin','vendedor','atendente') then
    raise exception 'Revendedor inválido para esta sessão.' using errcode = '42501';
  end if;
  if v_customer_id is not null
     and v_actor_role not in ('admin','vendedor','atendente')
     and not store.can_access_customer(v_customer_id) then
    raise exception 'Cliente não pertence a esta sessão.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'O pedido precisa ter ao menos um item.' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_quantity := (v_item->>'quantity')::integer;
    v_unit := (v_item->>'unit_price')::numeric;
    v_product_id := nullif(v_item->>'product_id','')::uuid;
    if v_quantity <= 0 or v_unit < 0 then
      raise exception 'Quantidade ou preço inválido.' using errcode = '22023';
    end if;
    if v_product_id is not null and not exists (
      select 1 from store.products p
      where p.id = v_product_id and p.active
        and v_quantity >= p.min_quantity
        and (p.max_quantity is null or v_quantity <= p.max_quantity)
    ) then
      raise exception 'Produto indisponível ou quantidade fora do limite operacional.' using errcode = '22023';
    end if;
    v_line := round(v_unit * v_quantity, 2);
    v_items_total := v_items_total + v_line;
  end loop;

  v_subtotal := round(coalesce((p_order->>'subtotal')::numeric, 0), 2);
  v_discount := round(coalesce((p_order->>'discount_total')::numeric, 0), 2);
  v_shipping := round(coalesce((p_order->>'shipping_cost')::numeric, 0), 2);
  v_total := round(coalesce((p_order->>'total')::numeric, 0), 2);
  v_credit := round(coalesce((p_order->>'credit_used')::numeric, 0), 2);
  if v_items_total <> v_subtotal or v_discount < 0 or v_shipping < 0 or v_credit < 0
     or v_total <> round(greatest(0, v_subtotal - v_discount + v_shipping - v_credit), 2) then
    raise exception 'Totais do pedido são inconsistentes.' using errcode = '22023';
  end if;

  v_payment_status := coalesce(nullif(p_order->>'payment_status',''), 'pendente');
  v_payment_method := nullif(p_order->>'payment_method','');
  v_create_production := coalesce((p_order->>'create_production')::boolean, false);

  if v_payment_method = 'faturado' then
    if v_actor_role <> 'revendedor' or v_reseller_id <> v_actor or v_payment_status <> 'pendente' then
      raise exception 'Compra faturada disponivel apenas para o revendedor titular e com pagamento pendente.' using errcode = '42501';
    end if;
    select credit_limit, credit_used into v_limit, v_limit_used
      from store.reseller_profiles
     where profile_id = v_actor and approved
     for update;
    if v_limit is null or v_total <= 0 or v_limit - v_limit_used < v_total then
      raise exception 'Limite faturado insuficiente para este pedido.' using errcode = '22023';
    end if;
  end if;

  if nullif(p_order->>'coupon_code','') is not null then
    select * into v_coupon from store.coupons c
      where upper(c.code) = upper(p_order->>'coupon_code') for update;
    if v_coupon.id is null or not v_coupon.active
       or (v_coupon.valid_from is not null and v_coupon.valid_from > now())
       or (v_coupon.valid_to is not null and v_coupon.valid_to < now())
       or (v_coupon.usage_limit is not null and v_coupon.used_count >= v_coupon.usage_limit)
       or v_subtotal < v_coupon.min_order then
      raise exception 'Cupom indisponível.' using errcode = '22023';
    end if;
    if (select count(*) from store.coupon_uses cu
        where cu.coupon_id = v_coupon.id and cu.profile_id = v_profile_id) >= v_coupon.per_customer_limit then
      raise exception 'Limite de uso deste cupom atingido.' using errcode = '22023';
    end if;
    v_coupon_id := v_coupon.id;
  end if;

  insert into store.orders (
    customer_id, profile_id, reseller_id, seller_id, created_by,
    status, payment_status, payment_method, installments,
    subtotal, discount_total, coupon_code, coupon_discount, shipping_cost, total, credit_used,
    shipping_method, shipping_address, billing, estimated_delivery, art_flow,
    priority, notes, source, quote_id, idempotency_key
  ) values (
    v_customer_id, v_profile_id, v_reseller_id, v_seller_id, v_actor,
    coalesce(nullif(p_order->>'status',''), 'pedido_recebido'), v_payment_status,
    v_payment_method, coalesce((p_order->>'installments')::integer, 1),
    v_subtotal, v_discount, nullif(p_order->>'coupon_code',''),
    coalesce((p_order->>'coupon_discount')::numeric, 0), v_shipping, v_total, v_credit,
    nullif(p_order->>'shipping_method',''), p_order->'shipping_address', p_order->'billing',
    nullif(p_order->>'estimated_delivery','')::date, nullif(p_order->>'art_flow',''),
    coalesce(nullif(p_order->>'priority',''), 'normal'), nullif(p_order->>'notes',''),
    coalesce(nullif(p_order->>'source',''), 'loja'), v_quote_id, p_idempotency_key
  ) returning id, number into v_order_id, v_number;

  if v_payment_method = 'faturado' then
    update store.reseller_profiles
       set credit_used = credit_used + v_total
     where profile_id = v_actor
     returning credit_used into v_limit_used;
    insert into store.reseller_limit_movements (
      profile_id, order_id, type, amount, used_after, idempotency_key
    ) values (
      v_actor, v_order_id, 'reserva', v_total, v_limit_used, p_idempotency_key || ':limite:reserva'
    );
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_quantity := (v_item->>'quantity')::integer;
    v_unit := (v_item->>'unit_price')::numeric;
    v_product_id := nullif(v_item->>'product_id','')::uuid;
    insert into store.order_items (
      order_id, product_id, product_name, product_slug, sku, quantity,
      unit_price, total_price, base_price, options, price_breakdown,
      production_days, art_flow, notes
    ) values (
      v_order_id, v_product_id, v_item->>'product_name', nullif(v_item->>'product_slug',''),
      nullif(v_item->>'sku',''), v_quantity, v_unit, round(v_unit * v_quantity, 2),
      coalesce((v_item->>'base_price')::numeric, v_unit), coalesce(v_item->'options','{}'::jsonb),
      coalesce(v_item->'price_breakdown','[]'::jsonb),
      coalesce((v_item->>'production_days')::integer, 3), nullif(v_item->>'art_flow',''),
      nullif(v_item->>'notes','')
    ) returning id into v_item_id;

    if v_create_production then
      insert into store.production_orders (
        order_id, order_item_id, product_name, quantity, priority, assigned_section
      ) values (
        v_order_id, v_item_id, v_item->>'product_name', v_quantity,
        coalesce(nullif(p_order->>'priority',''), 'normal'), nullif(p_order->>'assigned_section','')
      );
    end if;
  end loop;

  if v_credit > 0 then
    insert into store.credits (profile_id, type, amount, reason, order_id, created_by)
    values (v_profile_id, 'debito', v_credit, 'Crédito aplicado no pedido ' || v_number, v_order_id, v_actor);
    insert into store.payments (order_id, method, status, amount, paid_at, created_by, idempotency_key)
    values (v_order_id, 'credito_interno', 'pago', v_credit, now(), v_actor, p_idempotency_key || ':credito');
  end if;

  if v_total > 0 then
    insert into store.payments (
      order_id, method, status, amount, installments, gateway_payment_id,
      paid_at, created_by, idempotency_key
    ) values (
      v_order_id, coalesce(v_payment_method,'combinado'), v_payment_status, v_total,
      coalesce((p_order->>'installments')::integer, 1), nullif(p_order->>'payment_reference',''),
      case when v_payment_status = 'pago' then now() else null end,
      v_actor, p_idempotency_key || ':principal'
    );
  end if;

  if coalesce(p_order->>'source','') = 'balcao' and v_payment_status = 'pago' then
    select id into v_cash_session_id from store.cash_sessions
     where operator_id = v_actor and status = 'aberto' for update;
    if v_cash_session_id is null then
      raise exception 'Abra o caixa antes de registrar uma venda de balcao recebida.' using errcode = 'P0001';
    end if;
    if v_total > 0 then
      insert into store.cash_movements (
        cash_session_id, order_id, type, payment_method, amount, reference, created_by, idempotency_key
      ) values (
        v_cash_session_id, v_order_id, 'venda', v_payment_method, v_total,
        nullif(p_order->>'payment_reference',''), v_actor, p_idempotency_key || ':caixa'
      );
    end if;
  end if;

  if v_coupon_id is not null then
    insert into store.coupon_uses (coupon_id, order_id, profile_id, discount_amount)
    values (v_coupon_id, v_order_id, v_profile_id,
            coalesce((p_order->>'coupon_discount')::numeric, 0));
  end if;

  insert into store.finance_entries (
    type, description, category, amount, due_date, paid_at, status,
    order_id, customer_id, payment_method, created_by
  ) values (
    'receber', 'Pedido ' || v_number, 'vendas', v_total + v_credit, current_date,
    case when v_payment_status = 'pago' then now() else null end,
    case when v_payment_status = 'pago' then 'pago' else 'aberto' end,
    v_order_id, v_customer_id, v_payment_method, v_actor
  ) on conflict (order_id) where order_id is not null and type = 'receber' do update
    set amount = excluded.amount, payment_method = excluded.payment_method,
        status = excluded.status, paid_at = excluded.paid_at;

  if v_reseller_id is not null then
    select rp.commission_pct into v_pct from store.reseller_profiles rp
      where rp.profile_id = v_reseller_id and rp.approved for update;
    if coalesce(v_pct, 0) <= 0 then
      raise exception 'Comissão do revendedor não está configurada.' using errcode = '22023';
    end if;
    insert into store.commissions (order_id, profile_id, role, base_amount, percentage, amount, status)
    values (v_order_id, v_reseller_id, 'revendedor', v_subtotal, v_pct,
            round(v_subtotal * v_pct / 100, 2),
            case when v_payment_status = 'pago' then 'aprovado' else 'previsto' end);
  end if;

  if v_seller_id is not null then
    select sp.commission_pct into v_pct from store.seller_profiles sp where sp.profile_id = v_seller_id;
    if coalesce(v_pct, 0) > 0 then
      insert into store.commissions (order_id, profile_id, role, base_amount, percentage, amount, status)
      values (v_order_id, v_seller_id, 'vendedor', v_subtotal, v_pct,
              round(v_subtotal * v_pct / 100, 2),
              case when v_payment_status = 'pago' then 'aprovado' else 'previsto' end)
      on conflict (order_id, profile_id, role) where order_id is not null do nothing;
    end if;
  end if;

  return jsonb_build_object('id', v_order_id, 'number', v_number, 'reused', false);
exception
  when unique_violation then
    select o.id, o.number into v_order_id, v_number
      from store.orders o where o.idempotency_key = p_idempotency_key;
    if v_order_id is not null then
      return jsonb_build_object('id', v_order_id, 'number', v_number, 'reused', true);
    end if;
    raise;
end;
$$;

-- Liquida/libera o limite faturado e sincroniza o estado das comissoes quando
-- o pagamento do pedido muda. A chave por pedido/tipo impede dupla baixa.
create or replace function store.reconcile_order_settlement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_used numeric(12,2);
  v_movement_type text;
begin
  if tg_op <> 'UPDATE' or new.payment_status is not distinct from old.payment_status then
    return new;
  end if;

  if new.payment_status = 'pago' then
    update store.commissions set status = 'aprovado'
     where order_id = new.id and status = 'previsto';
  elsif new.payment_status in ('cancelado','estornado','recusado') then
    update store.commissions set status = 'cancelado'
     where order_id = new.id and status in ('previsto','aprovado');
  end if;

  if new.payment_method = 'faturado'
     and old.payment_status not in ('pago','cancelado','estornado','recusado')
     and new.payment_status in ('pago','cancelado','estornado','recusado') then
    v_movement_type := case when new.payment_status = 'pago' then 'liquidacao' else 'liberacao' end;
    update store.reseller_profiles
       set credit_used = greatest(0, credit_used - new.total)
     where profile_id = new.reseller_id
     returning credit_used into v_used;
    insert into store.reseller_limit_movements (
      profile_id, order_id, type, amount, used_after, idempotency_key
    ) values (
      new.reseller_id, new.id, v_movement_type, new.total, coalesce(v_used, 0),
      'pedido:' || new.id || ':limite:' || v_movement_type
    ) on conflict (idempotency_key) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists tr_reconcile_order_settlement on store.orders;
create trigger tr_reconcile_order_settlement
  after update of payment_status on store.orders
  for each row execute function store.reconcile_order_settlement();
revoke all on function store.reconcile_order_settlement() from public, anon, authenticated;

create or replace function store.ensure_order_production()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'aprovado_producao'
     and (tg_op = 'INSERT' or new.status is distinct from old.status) then
    insert into store.production_orders (
      order_id, order_item_id, product_name, quantity, priority, due_date
    )
    select new.id, i.id, i.product_name, i.quantity, new.priority, new.estimated_delivery
      from store.order_items i
     where i.order_id = new.id
       and not exists (
         select 1 from store.production_orders po where po.order_item_id = i.id
       );
  end if;
  return new;
end;
$$;

drop trigger if exists tr_ensure_order_production on store.orders;
create trigger tr_ensure_order_production
  after insert or update of status on store.orders
  for each row execute function store.ensure_order_production();

create or replace function store.reserve_production_materials()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_material record;
  v_available numeric(12,3);
  v_required numeric(12,3);
begin
  if new.order_item_id is null then
    return new;
  end if;
  for v_material in
    select pm.stock_item_id, pm.quantity_per_unit, oi.quantity
      from store.order_items oi
      join store.product_materials pm on pm.product_id = oi.product_id
     where oi.id = new.order_item_id and pm.quantity_per_unit > 0
  loop
    v_required := round(v_material.quantity_per_unit * v_material.quantity, 3);
    perform 1 from store.stock_items where id = v_material.stock_item_id for update;
    select si.quantity - coalesce(sum(r.quantity) filter (where r.status = 'reservado'), 0)
      into v_available
      from store.stock_items si
      left join store.stock_reservations r on r.stock_item_id = si.id
     where si.id = v_material.stock_item_id
     group by si.quantity;
    if coalesce(v_available, 0) < v_required then
      raise exception 'Estoque insuficiente para reservar a ordem de producao %.', new.number using errcode = '23514';
    end if;
    insert into store.stock_reservations (
      production_order_id, order_id, stock_item_id, quantity
    ) values (new.id, new.order_id, v_material.stock_item_id, v_required)
    on conflict (production_order_id, stock_item_id) do nothing;
  end loop;
  return new;
end;
$$;

drop trigger if exists tr_reserve_production_materials on store.production_orders;
create trigger tr_reserve_production_materials
  after insert on store.production_orders
  for each row execute function store.reserve_production_materials();

create or replace function store.resolve_production_materials()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reservation record;
begin
  if new.stage = 'finalizado' and new.stage is distinct from old.stage then
    for v_reservation in
      select * from store.stock_reservations
       where production_order_id = new.id and status = 'reservado'
       for update
    loop
      insert into store.stock_movements (
        stock_item_id, type, quantity, reference, order_id, production_order_id, note, created_by
      ) values (
        v_reservation.stock_item_id, 'consumo_producao', v_reservation.quantity,
        new.number, new.order_id, new.id, 'Consumo confirmado na finalizacao da OP.', auth.uid()
      );
      update store.stock_reservations
         set status = 'consumido', resolved_at = now()
       where id = v_reservation.id;
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists tr_resolve_production_materials on store.production_orders;
create trigger tr_resolve_production_materials
  after update of stage on store.production_orders
  for each row execute function store.resolve_production_materials();

create or replace function store.release_cancelled_order_materials()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'cancelado' and new.status is distinct from old.status then
    update store.stock_reservations
       set status = 'liberado', resolved_at = now()
     where order_id = new.id and status = 'reservado';
  end if;
  return new;
end;
$$;

drop trigger if exists tr_release_cancelled_order_materials on store.orders;
create trigger tr_release_cancelled_order_materials
  after update of status on store.orders
  for each row execute function store.release_cancelled_order_materials();

revoke all on function store.ensure_order_production() from public, anon, authenticated;
revoke all on function store.reserve_production_materials() from public, anon, authenticated;
revoke all on function store.resolve_production_materials() from public, anon, authenticated;
revoke all on function store.release_cancelled_order_materials() from public, anon, authenticated;

revoke all on function store.create_order(jsonb, jsonb, text) from public, anon;
grant execute on function store.create_order(jsonb, jsonb, text) to authenticated, service_role;

create or replace function store.create_order_as(
  p_actor uuid,
  p_order jsonb,
  p_items jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_actor is null or not exists (select 1 from store.profiles where id=p_actor and active) then
    raise exception 'Perfil do checkout invalido.' using errcode = '42501';
  end if;
  perform set_config('request.jwt.claim.sub', p_actor::text, true);
  perform set_config('app.trusted_order', 'true', true);
  return store.create_order(p_order, p_items, p_idempotency_key);
end;
$$;
revoke all on function store.create_order_as(uuid,jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function store.create_order_as(uuid,jsonb,jsonb,text) to service_role;

-- Publicacao explicita do catalogo comercial do Flow para o catalogo canonico
-- da loja. O vinculo crm_id torna atualizacoes idempotentes e o sync_log deixa
-- visivel se o produto foi inserido ou atualizado.
create or replace function store.publish_crm_product(p_crm_product_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.products%rowtype;
  v_store_id uuid;
  v_action text;
  v_image text;
  v_days integer;
begin
  select * into v_source from public.products where id = p_crm_product_id;
  if v_source.id is null then
    raise exception 'Produto do Flow nao encontrado.' using errcode = 'P0002';
  end if;
  if not private.is_company_member(v_source.company_id, array['owner','admin']) then
    raise exception 'Sem permissao para publicar este produto.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.companies where id = v_source.company_id and store_access) then
    raise exception 'Esta empresa nao esta vinculada a loja Nexus.' using errcode = '42501';
  end if;
  if coalesce(v_source.sale_price, v_source.suggested_price, v_source.min_price, 0) <= 0 then
    raise exception 'Defina um preco de venda valido antes de publicar.' using errcode = '22023';
  end if;

  v_days := case
    when coalesce(v_source.production_deadline, v_source.avg_production_time, '') ~ '[0-9]+'
      then greatest(1, (pg_catalog.regexp_match(coalesce(v_source.production_deadline, v_source.avg_production_time), '[0-9]+'))[1]::integer)
    else 3
  end;
  v_image := coalesce(nullif(v_source.main_image_url, ''), nullif(v_source.image_url, ''));
  select id into v_store_id from store.products where crm_id = v_source.id for update;
  v_action := case when v_store_id is null then 'insert' else 'update' end;

  insert into store.products (
    sku, name, slug, short_description, description, price_unit, base_price,
    min_quantity, production_days, active, sync_origin, crm_id
  ) values (
    'CRM-' || pg_catalog.upper(pg_catalog.substr(pg_catalog.replace(v_source.id::text, '-', ''), 1, 12)),
    coalesce(nullif(v_source.commercial_name, ''), v_source.name),
    pg_catalog.btrim(pg_catalog.regexp_replace(
      pg_catalog.lower(pg_catalog.translate(
        coalesce(nullif(v_source.commercial_name, ''), v_source.name),
        'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ',
        'aaaaaaeeeeiiiiooooouuuucnyy'
      )),
      '[^a-z0-9]+', '-', 'g'
    ), '-') || '-' || pg_catalog.substr(v_source.id::text, 1, 8),
    nullif(v_source.description, ''),
    coalesce(nullif(v_source.technical_description, ''), nullif(v_source.description, '')),
    case when v_source.unit_measure in ('m2','milheiro','pacote','metro_linear')
      then v_source.unit_measure else 'unidade' end,
    coalesce(v_source.sale_price, v_source.suggested_price, v_source.min_price),
    greatest(1, coalesce(v_source.minimum_quantity, 1)),
    v_days,
    coalesce(v_source.status, 'Ativo') = 'Ativo',
    'crm', v_source.id
  ) on conflict (crm_id) do update set
    name = excluded.name,
    slug = excluded.slug,
    short_description = excluded.short_description,
    description = excluded.description,
    price_unit = excluded.price_unit,
    base_price = excluded.base_price,
    min_quantity = excluded.min_quantity,
    production_days = excluded.production_days,
    active = excluded.active,
    sync_origin = 'crm'
  returning id into v_store_id;

  if v_image is not null then
    update store.product_images
       set url = v_image, alt = coalesce(nullif(v_source.commercial_name, ''), v_source.name)
     where id = (
       select id from store.product_images where product_id = v_store_id order by position, created_at limit 1
     );
    if not found then
      insert into store.product_images (product_id, url, alt, position)
      values (v_store_id, v_image, coalesce(nullif(v_source.commercial_name, ''), v_source.name), 0);
    end if;
  end if;

  insert into store.sync_log (
    entidade, direcao, origem_id, destino_id, acao, sucesso, payload
  ) values (
    'produtos', 'crm_para_site', v_source.id, v_store_id, v_action, true,
    jsonb_build_object('name', v_source.name, 'published_by', auth.uid())
  );

  return jsonb_build_object('ok', true, 'id', v_store_id, 'action', v_action);
end;
$$;

revoke all on function store.publish_crm_product(uuid) from public, anon;
grant execute on function store.publish_crm_product(uuid) to authenticated, service_role;

create or replace function store.create_quote(
  p_quote jsonb,
  p_items jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_quote_id uuid;
  v_number text;
  v_customer_id uuid := nullif(p_quote->>'customer_id', '')::uuid;
  v_item jsonb;
  v_quantity integer;
  v_unit numeric(12,4);
  v_subtotal numeric(12,2) := 0;
  v_discount numeric(12,2) := round(coalesce((p_quote->>'discount_total')::numeric, 0), 2);
  v_shipping numeric(12,2) := round(coalesce((p_quote->>'shipping_cost')::numeric, 0), 2);
  v_total numeric(12,2);
begin
  if v_actor is null then
    raise exception 'Sessao expirada.' using errcode = '42501';
  end if;
  if p_idempotency_key is null or length(p_idempotency_key) not between 12 and 200 then
    raise exception 'Chave de idempotencia invalida.' using errcode = '22023';
  end if;
  select id, number into v_quote_id, v_number
    from store.quotes where idempotency_key = p_idempotency_key;
  if v_quote_id is not null then
    return jsonb_build_object('id', v_quote_id, 'number', v_number, 'reused', true);
  end if;

  select role into v_actor_role from store.profiles where id = v_actor and active;
  if v_actor_role not in ('admin','vendedor','atendente','revendedor') then
    raise exception 'Perfil sem permissao para criar orcamentos.' using errcode = '42501';
  end if;
  if v_customer_id is null or not store.can_access_customer(v_customer_id) then
    raise exception 'Cliente nao pertence a esta sessao.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Inclua ao menos um item no orcamento.' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_quantity := (v_item->>'quantity')::integer;
    v_unit := (v_item->>'unit_price')::numeric;
    if v_quantity <= 0 or v_unit < 0 or length(pg_catalog.btrim(coalesce(v_item->>'description',''))) < 2 then
      raise exception 'Item de orcamento invalido.' using errcode = '22023';
    end if;
    v_subtotal := v_subtotal + round(v_unit * v_quantity, 2);
  end loop;
  v_subtotal := round(v_subtotal, 2);
  if v_discount < 0 or v_discount > v_subtotal or v_shipping < 0 then
    raise exception 'Desconto ou frete invalido.' using errcode = '22023';
  end if;
  v_total := round(v_subtotal - v_discount + v_shipping, 2);

  insert into store.quotes (
    customer_id, profile_id, reseller_id, seller_id, created_by, status, title,
    subtotal, discount_type, discount_value, discount_total, shipping_cost, total,
    payment_terms, shipping_method, delivery_days, notes, internal_notes,
    valid_until, contact_name, contact_email, contact_phone, source, idempotency_key
  )
  select
    v_customer_id, c.profile_id,
    case when v_actor_role = 'revendedor' then v_actor else null end,
    case when v_actor_role = 'vendedor' then v_actor else c.seller_id end,
    v_actor, 'rascunho', nullif(p_quote->>'title',''),
    v_subtotal, 'valor_fixo', v_discount, v_discount, v_shipping, v_total,
    nullif(p_quote->>'payment_terms',''), nullif(p_quote->>'shipping_method',''),
    greatest(1, coalesce((p_quote->>'delivery_days')::integer, 7)),
    nullif(p_quote->>'notes',''), nullif(p_quote->>'internal_notes',''),
    coalesce(nullif(p_quote->>'valid_until','')::date, current_date + 15),
    c.name, c.email, c.phone, coalesce(nullif(p_quote->>'source',''), 'flow'), p_idempotency_key
  from store.customers c where c.id = v_customer_id
  returning id, number into v_quote_id, v_number;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_quantity := (v_item->>'quantity')::integer;
    v_unit := (v_item->>'unit_price')::numeric;
    insert into store.quote_items (
      quote_id, product_id, description, detail, quantity, unit_price, total_price,
      base_price, options, production_days, position, internal_cost, source_origin
    ) values (
      v_quote_id, (
        select p.id from store.products p
         where p.active and nullif(v_item->>'product_id','') is not null
           and (p.id = (v_item->>'product_id')::uuid or p.crm_id = (v_item->>'product_id')::uuid)
         limit 1
      ), v_item->>'description',
      nullif(v_item->>'detail',''), v_quantity, v_unit, round(v_unit * v_quantity, 2),
      coalesce((v_item->>'base_price')::numeric, v_unit), coalesce(v_item->'options','{}'::jsonb),
      coalesce((v_item->>'production_days')::integer, 3),
      coalesce((v_item->>'position')::integer, 0),
      nullif(v_item->>'internal_cost','')::numeric, nullif(v_item->>'source_origin','')
    );
  end loop;

  insert into store.quote_history (quote_id, action, note, actor_id)
  values (v_quote_id, 'criado', 'Orcamento criado no Flow Printi.', v_actor);
  return jsonb_build_object('id', v_quote_id, 'number', v_number, 'total', v_total, 'reused', false);
exception
  when unique_violation then
    select id, number into v_quote_id, v_number
      from store.quotes where idempotency_key = p_idempotency_key;
    if v_quote_id is not null then
      return jsonb_build_object('id', v_quote_id, 'number', v_number, 'reused', true);
    end if;
    raise;
end;
$$;

revoke all on function store.create_quote(jsonb,jsonb,text) from public, anon;
grant execute on function store.create_quote(jsonb,jsonb,text) to authenticated, service_role;

create or replace function store.convert_quote_to_order(p_quote_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_quote store.quotes%rowtype;
  v_items jsonb;
  v_order jsonb;
begin
  if v_actor is null then
    raise exception 'Sessão expirada.' using errcode = '42501';
  end if;
  select * into v_quote from store.quotes q where q.id = p_quote_id for update;
  if v_quote.id is null then
    raise exception 'Orçamento não encontrado.' using errcode = 'P0002';
  end if;
  if v_quote.converted_order_id is not null then
    select jsonb_build_object('id', o.id, 'number', o.number, 'reused', true)
      into v_order from store.orders o where o.id = v_quote.converted_order_id;
    return v_order;
  end if;
  if v_quote.status <> 'aprovado'
     or (v_quote.valid_until is not null and v_quote.valid_until < current_date) then
    raise exception 'Somente orçamento aprovado e válido pode virar pedido.' using errcode = '22023';
  end if;
  if not (
    store.is_staff()
    or v_quote.created_by = v_actor
    or v_quote.reseller_id = v_actor
    or v_quote.seller_id = v_actor
  ) then
    raise exception 'Sem permissão para converter este orçamento.' using errcode = '42501';
  end if;

  select jsonb_agg(jsonb_build_object(
    'product_id', i.product_id,
    'product_name', i.description,
    'quantity', i.quantity,
    'unit_price', i.unit_price,
    'base_price', i.base_price,
    'options', i.options,
    'production_days', coalesce(i.production_days, 3),
    'notes', i.detail
  ) order by i.position) into v_items
  from store.quote_items i where i.quote_id = v_quote.id;
  if v_items is null then
    raise exception 'Orçamento sem itens.' using errcode = '22023';
  end if;

  perform set_config('app.trusted_order', 'true', true);

  v_order := store.create_order(
    jsonb_build_object(
      'customer_id', v_quote.customer_id,
      'profile_id', coalesce(v_quote.profile_id, v_actor),
      'reseller_id', v_quote.reseller_id,
      'seller_id', v_quote.seller_id,
      'quote_id', v_quote.id,
      'status', 'aguardando_pagamento',
      'payment_status', 'pendente',
      'payment_method', 'combinado',
      'subtotal', v_quote.subtotal,
      'discount_total', v_quote.discount_total,
      'coupon_discount', 0,
      'shipping_cost', v_quote.shipping_cost,
      'total', v_quote.total,
      'credit_used', 0,
      'shipping_method', coalesce(v_quote.shipping_method, 'frete_combinado'),
      'estimated_delivery', current_date + coalesce(v_quote.delivery_days, 5),
      'notes', v_quote.notes,
      'source', 'orcamento',
      'create_production', false
    ),
    v_items,
    'quote:' || v_quote.id::text
  );

  update store.quotes
     set status = 'convertido', converted_order_id = (v_order->>'id')::uuid
   where id = v_quote.id;
  insert into store.quote_history (quote_id, action, note, actor_id, actor_label)
  values (
    v_quote.id, 'convertido', 'Pedido ' || (v_order->>'number') || ' gerado.',
    v_actor, (select p.full_name from store.profiles p where p.id = v_actor)
  );
  return v_order;
end;
$$;

revoke all on function store.convert_quote_to_order(uuid) from public, anon;
grant execute on function store.convert_quote_to_order(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Proposta pública
-- -----------------------------------------------------------------------------

create or replace function store.set_quote_public_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.public_token is null then
    new.public_token := encode(extensions.gen_random_bytes(24), 'hex');
  end if;
  if new.valid_until is null then
    new.valid_until := current_date + 15;
  end if;
  return new;
end;
$$;

drop trigger if exists tr_quote_public_defaults on store.quotes;
create trigger tr_quote_public_defaults
  before insert on store.quotes
  for each row execute function store.set_quote_public_defaults();

revoke all on function store.set_quote_public_defaults() from public, anon, authenticated;

create or replace function store.request_public_quote(
  name text,
  email text,
  phone text,
  company text,
  product text,
  quantity text,
  deadline text,
  message text,
  website text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote_id uuid;
  v_number text;
  v_profile_id uuid := (select auth.uid());
  v_customer_id uuid;
begin
  if nullif(pg_catalog.btrim(website), '') is not null then
    raise exception 'Solicitação inválida.' using errcode = '22023';
  end if;
  name := pg_catalog.btrim(name);
  email := lower(pg_catalog.btrim(email));
  phone := pg_catalog.regexp_replace(coalesce(phone,''), '\D', '', 'g');
  if length(name) not between 3 and 120
     or email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
     or length(phone) not between 10 and 13
     or length(pg_catalog.btrim(product)) not between 2 and 200
     or length(pg_catalog.btrim(message)) not between 10 and 4000 then
    raise exception 'Dados da solicitação são inválidos.' using errcode = '22023';
  end if;
  if (select count(*) from store.quotes q
      where q.source = 'site' and lower(q.contact_email) = email
        and q.created_at >= now() - interval '1 hour') >= 3 then
    raise exception 'Limite de solicitações atingido. Aguarde uma hora.' using errcode = 'P0001';
  end if;

  if v_profile_id is not null then
    select c.id into v_customer_id from store.customers c where c.profile_id = v_profile_id;
  end if;

  insert into store.quotes (
    customer_id, profile_id, created_by,
    status, title, contact_name, contact_email, contact_phone, notes, source
  ) values (
    v_customer_id, v_profile_id, v_profile_id,
    'rascunho', 'Solicitação pelo site — ' || pg_catalog.btrim(product),
    name, email, phone,
    concat_ws(E'\n',
      'Produto de interesse: ' || pg_catalog.btrim(product),
      case when nullif(pg_catalog.btrim(quantity),'') is not null then 'Quantidade estimada: ' || pg_catalog.btrim(quantity) end,
      case when nullif(pg_catalog.btrim(deadline),'') is not null then 'Prazo desejado: ' || pg_catalog.btrim(deadline) end,
      case when nullif(pg_catalog.btrim(company),'') is not null then 'Empresa: ' || pg_catalog.btrim(company) end,
      '', pg_catalog.btrim(message)
    ), 'site'
  ) returning id, number into v_quote_id, v_number;

  insert into store.quote_history (quote_id, action, note, actor_label)
  values (v_quote_id, 'criado', 'Solicitação recebida pelo formulário público.', name);
  return jsonb_build_object('id', v_quote_id, 'number', v_number);
end;
$$;

revoke all on function store.request_public_quote(text,text,text,text,text,text,text,text,text) from public;
grant execute on function store.request_public_quote(text,text,text,text,text,text,text,text,text)
  to anon, authenticated, service_role;

create or replace function store.get_public_quote(token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_quote_id uuid;
begin
  select q.id into v_quote_id
    from store.quotes q
    where q.public_token = $1
      and q.status in ('enviado','visualizado','em_negociacao')
      and (q.valid_until is null or q.valid_until >= current_date)
    for update;
  if v_quote_id is null then return null; end if;

  update store.quotes q
     set status = case when q.status = 'enviado' then 'visualizado' else q.status end,
         viewed_at = coalesce(q.viewed_at, now())
   where q.id = v_quote_id;

  insert into store.quote_history (quote_id, action, note, actor_label)
  select v_quote_id, 'visualizado', 'Proposta aberta pelo link público.', 'Cliente'
  where not exists (
    select 1 from store.quote_history h where h.quote_id = v_quote_id and h.action = 'visualizado'
  );

  select jsonb_build_object(
    'id', q.id, 'number', q.number, 'status', q.status, 'title', q.title,
    'subtotal', q.subtotal, 'discount_total', q.discount_total,
    'shipping_cost', q.shipping_cost, 'total', q.total,
    'payment_terms', q.payment_terms, 'shipping_method', q.shipping_method,
    'delivery_days', q.delivery_days, 'notes', q.notes,
    'valid_until', q.valid_until, 'created_at', q.created_at,
    'contact_name', q.contact_name,
    'issuer', jsonb_build_object(
      'name', coalesce(r.company_name, c.name, 'Nexus Printi'),
      'logo_url', coalesce(r.logo_url, c.logo_url),
      'email', c.email, 'phone', coalesce(c.whatsapp, c.phone)
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'description', i.description, 'detail', i.detail, 'quantity', i.quantity,
        'unit_price', i.unit_price, 'total_price', i.total_price
      ) order by i.position)
      from store.quote_items i where i.quote_id = q.id
    ), '[]'::jsonb)
  ) into v_result
  from store.quotes q
  left join store.reseller_profiles r on r.profile_id = q.reseller_id
  left join public.profiles p on p.user_id = coalesce(q.created_by, q.seller_id)
  left join public.companies c on c.id = p.company_id
  where q.id = v_quote_id;
  return v_result;
end;
$$;

create or replace function store.respond_public_quote(
  token text,
  decision text,
  message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote store.quotes%rowtype;
begin
  if decision not in ('aprovado','recusado','em_negociacao') then
    return jsonb_build_object('ok', false, 'error', 'Resposta inválida.');
  end if;
  if length(coalesce(message,'')) > 2000 then
    return jsonb_build_object('ok', false, 'error', 'Mensagem muito longa.');
  end if;

  select * into v_quote from store.quotes q
    where q.public_token = $1 for update;
  if v_quote.id is null
     or v_quote.status not in ('enviado','visualizado','em_negociacao')
     or (v_quote.valid_until is not null and v_quote.valid_until < current_date) then
    return jsonb_build_object('ok', false, 'error', 'Proposta inválida, expirada ou já respondida.');
  end if;

  update store.quotes q
     set status = decision, responded_at = now()
   where q.id = v_quote.id;
  insert into store.quote_history (quote_id, action, note, actor_label)
  values (v_quote.id, decision, nullif(pg_catalog.btrim(message),''), coalesce(v_quote.contact_name,'Cliente'));

  if v_quote.created_by is not null then
    insert into store.notifications (profile_id, event, title, body, link)
    values (
      v_quote.created_by,
      case when decision = 'aprovado' then 'orcamento_aprovado' else 'orcamento_enviado' end,
      'Orçamento ' || v_quote.number || ': ' || decision,
      coalesce(nullif(pg_catalog.btrim(message),''), 'O cliente respondeu à proposta.'),
      '/admin/orcamentos/' || v_quote.id
    );
  end if;
  return jsonb_build_object('ok', true, 'status', decision);
end;
$$;

-- A decisao de limite precisa ser atomica: encerra a solicitacao, atualiza o
-- cadastro financeiro do revendedor e registra a devolutiva no mesmo commit.
create or replace function store.review_credit_request(
  p_request_id uuid,
  p_decision text,
  p_approved_limit numeric default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_request store.credit_requests%rowtype;
  v_status text;
  v_profile_role text;
begin
  if v_actor is null or not store.is_admin() then
    raise exception 'Apenas administradores podem revisar solicitacoes de limite.' using errcode = '42501';
  end if;

  v_status := case p_decision
    when 'aprovar' then 'aprovado'
    when 'aprovado' then 'aprovado'
    when 'recusar' then 'recusado'
    when 'recusado' then 'recusado'
    else null
  end;
  if v_status is null then
    raise exception 'Decisao invalida.' using errcode = '22023';
  end if;
  if length(coalesce(p_note, '')) > 2000 then
    raise exception 'Observacao muito longa.' using errcode = '22023';
  end if;

  select * into v_request
    from store.credit_requests
   where id = p_request_id
   for update;
  if v_request.id is null then
    raise exception 'Solicitacao nao encontrada.' using errcode = 'P0002';
  end if;
  if v_request.status <> 'pendente' then
    raise exception 'Esta solicitacao ja foi revisada.' using errcode = 'P0001';
  end if;
  select role into v_profile_role from store.profiles where id = v_request.profile_id;
  if v_profile_role <> 'revendedor' then
    raise exception 'A solicitacao nao pertence a um revendedor.' using errcode = '22023';
  end if;

  if v_status = 'aprovado' then
    if p_approved_limit is null or p_approved_limit < 0 then
      raise exception 'Informe um limite aprovado valido.' using errcode = '22023';
    end if;
    insert into store.reseller_profiles (profile_id, credit_limit)
    values (v_request.profile_id, p_approved_limit)
    on conflict (profile_id) do update
      set credit_limit = excluded.credit_limit,
          updated_at = now();
  end if;

  update store.credit_requests
     set status = v_status,
         reviewed_by = v_actor,
         reviewed_at = now(),
         review_note = nullif(pg_catalog.btrim(p_note), '')
   where id = v_request.id;

  insert into store.notifications (profile_id, event, title, body, link)
  values (
    v_request.profile_id,
    'limite_credito_' || v_status,
    case when v_status = 'aprovado'
      then 'Limite de compra aprovado'
      else 'Solicitacao de limite revisada'
    end,
    case when v_status = 'aprovado'
      then 'Seu limite de compra foi definido em R$ ' || pg_catalog.to_char(p_approved_limit, 'FM999G999G990D00') || '.'
      else coalesce(nullif(pg_catalog.btrim(p_note), ''), 'A solicitacao nao foi aprovada neste momento.')
    end,
    '/revenda/creditos'
  );

  return jsonb_build_object(
    'ok', true,
    'status', v_status,
    'approved_limit', case when v_status = 'aprovado' then p_approved_limit else null end
  );
end;
$$;

revoke all on function store.get_public_quote(text) from public;
revoke all on function store.respond_public_quote(text,text,text) from public;
grant execute on function store.get_public_quote(text), store.respond_public_quote(text,text,text)
  to anon, authenticated, service_role;
revoke all on function store.review_credit_request(uuid,text,numeric,text) from public, anon;
grant execute on function store.review_credit_request(uuid,text,numeric,text)
  to authenticated, service_role;

create or replace function store.increment_marketing_download(p_asset_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_count integer;
begin
  if v_actor is null or not exists (
    select 1
      from store.marketing_assets a
      left join store.reseller_profiles r on r.profile_id = v_actor
     where a.id = p_asset_id and a.active
       and (store.is_staff() or (r.approved and (not a.whitelabel or r.allow_whitelabel)))
  ) then
    raise exception 'Material indisponivel para este perfil.' using errcode = '42501';
  end if;
  update store.marketing_assets set download_count = download_count + 1
   where id = p_asset_id returning download_count into v_count;
  return v_count;
end;
$$;
revoke all on function store.increment_marketing_download(uuid) from public, anon;
grant execute on function store.increment_marketing_download(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
