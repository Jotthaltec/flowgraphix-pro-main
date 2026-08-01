-- =============================================================================
-- CORREÇÃO DO GUARD ANTI-RECURSÃO
--
-- A migração 20260801000001 usava `pg_trigger_depth() > 1` para cortar o eco
-- entre store.customers e public.clients. O critério é largo demais: ele mede
-- "estou dentro de algum trigger", não "esta mudança veio do meu par".
--
-- Efeito colateral real: no cadastro, `store.handle_new_user()` (disparado por
-- auth.users) insere em store.customers já na profundidade 2 — o guard cortava a
-- sincronização e o cliente novo nunca aparecia no CRM. Só quem era criado
-- direto na tabela, fora de trigger, era espelhado.
--
-- Troca de critério: propagar apenas quando algum campo relevante realmente
-- mudou. A ida grava, a volta encontra os mesmos valores, não atualiza nenhuma
-- linha e nenhum trigger dispara — o laço termina sozinho, sem depender de onde
-- a escrita nasceu. Cascatas legítimas passam.
-- =============================================================================

create or replace function store.sync_customer_to_client()
returns trigger
language plpgsql
security definer
set search_path = public, store
as $$
begin
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
    notes        = excluded.notes
  -- Sem diferença real, não grava — é isto que impede o vaivém.
  where public.clients.name         is distinct from excluded.name
     or public.clients.company_name is distinct from excluded.company_name
     or public.clients.document     is distinct from excluded.document
     or public.clients.email        is distinct from excluded.email
     or public.clients.whatsapp     is distinct from excluded.whatsapp
     or public.clients.client_type  is distinct from excluded.client_type
     or public.clients.notes        is distinct from excluded.notes;

  return new;
end;
$$;

create or replace function public.sync_client_to_store_customer()
returns trigger
language plpgsql
security definer
set search_path = public, store
as $$
begin
  update store.customers c set
    name          = new.name,
    company_name  = new.company_name,
    document      = new.document,
    email         = new.email,
    phone         = new.whatsapp,
    customer_type = public.map_client_type_back(new.client_type),
    notes         = new.notes
  where c.id = new.id
    and (c.name          is distinct from new.name
      or c.company_name  is distinct from new.company_name
      or c.document      is distinct from new.document
      or c.email         is distinct from new.email
      or c.phone         is distinct from new.whatsapp
      or c.customer_type is distinct from public.map_client_type_back(new.client_type)
      or c.notes         is distinct from new.notes);

  return new;
end;
$$;

/*
 * Pedidos não têm trigger de volta (public.orders não escreve em store.orders),
 * então aqui o guard de profundidade só atrapalhava: um pedido criado dentro de
 * qualquer outro trigger não chegava ao chão de fábrica.
 */
create or replace function store.sync_order_to_crm()
returns trigger
language plpgsql
security definer
set search_path = public, store
as $$
declare
  v_client_id uuid;
begin
  if new.customer_id is null then
    return new;
  end if;

  select id into v_client_id from public.clients where id = new.customer_id;

  if v_client_id is null then
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

-- -----------------------------------------------------------------------------
-- Backfill de quem ficou sem espelho enquanto o guard estava largo demais
-- -----------------------------------------------------------------------------

insert into public.clients (
  id, company_id, name, company_name, document, email, whatsapp, client_type, notes
)
select
  c.id,
  public.crm_default_company(),
  c.name,
  c.company_name,
  c.document,
  c.email,
  c.phone,
  public.map_customer_type(c.customer_type),
  c.notes
from store.customers c
where not exists (select 1 from public.clients cl where cl.id = c.id)
on conflict (id) do nothing;
