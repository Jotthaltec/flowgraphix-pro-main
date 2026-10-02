-- Cliente cadastrado no Flow passa a existir na loja.
--
-- public.clients só propagava EDIÇÕES para store.customers
-- (tr_sync_client_to_store_customer é AFTER UPDATE). Cliente novo criado nas
-- telas Clientes ou Leads do Flow ficava só no CRM, e as telas Orçamentos e
-- Custos — que listam store.customers — não conseguiam selecioná-lo.
--
-- Só clientes da empresa ligada à loja (public.crm_default_company()) são
-- copiados, com o mesmo id e sync_origin = 'crm'. O gatilho inverso
-- (store.sync_customer_to_client) encontra o registro igual e não reescreve.

create or replace function public.sync_new_client_to_store_customer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.company_id is distinct from public.crm_default_company() then
    return new;
  end if;

  insert into store.customers (
    id, name, company_name, document, email, phone, customer_type, notes, sync_origin
  ) values (
    new.id, new.name, new.company_name, new.document, new.email, new.whatsapp,
    public.map_client_type_back(new.client_type), new.notes, 'crm'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.sync_new_client_to_store_customer() from public, anon, authenticated;

drop trigger if exists tr_sync_new_client_to_store_customer on public.clients;
create trigger tr_sync_new_client_to_store_customer
  after insert on public.clients
  for each row execute function public.sync_new_client_to_store_customer();

-- Clientes já criados no Flow e ainda ausentes na loja.
insert into store.customers (
  id, name, company_name, document, email, phone, customer_type, notes, sync_origin
)
select c.id, c.name, c.company_name, c.document, c.email, c.whatsapp,
  public.map_client_type_back(c.client_type), c.notes, 'crm'
from public.clients c
where c.company_id = public.crm_default_company()
  and not exists (select 1 from store.customers s where s.id = c.id)
on conflict (id) do nothing;
