-- =============================================================================
-- PERFIS DA LOJA NO CADASTRO DE USUÁRIO
--
-- `auth.users` é compartilhado pelos dois sistemas, mas só existia um trigger:
-- `on_auth_user_created -> public.handle_new_user`, que cria o perfil do CRM.
-- A loja lê `store.profiles` para resolver papel e permissões — e nenhuma linha
-- era criada lá.
--
-- Consequência prática: o login até acontecia no Supabase, mas `store.auth_role()`
-- devolvia 'anon', o RLS tratava a pessoa como visitante e nada abria depois de
-- entrar. Nenhuma mensagem de erro apontava para isso.
--
-- A correção adiciona um SEGUNDO trigger em `auth.users`, em vez de alterar o do
-- CRM: os dois sistemas passam a receber o novo usuário sem que um dependa do
-- outro. Ao final, os usuários que já existiam são preenchidos.
-- =============================================================================

create or replace function store.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = store, public
as $$
declare
  desired_role text;
  new_name text;
  clean_document text;
  person_type text;
begin
  desired_role := coalesce(new.raw_user_meta_data->>'role', 'cliente');
  -- Só cliente e revendedor podem ser escolhidos no cadastro público; papéis
  -- internos (admin, vendedor) são atribuídos depois, por quem já tem acesso.
  if desired_role not in ('cliente', 'revendedor') then
    desired_role := 'cliente';
  end if;

  new_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    split_part(new.email, '@', 1)
  );

  clean_document := nullif(
    regexp_replace(coalesce(new.raw_user_meta_data->>'document', ''), '\D', '', 'g'),
    ''
  );

  person_type := coalesce(nullif(new.raw_user_meta_data->>'customer_type', ''), 'pf');

  insert into store.profiles (id, role, full_name, email, phone, document, customer_type, company_name)
  values (
    new.id,
    desired_role,
    new_name,
    new.email,
    nullif(new.raw_user_meta_data->>'phone', ''),
    clean_document,
    person_type,
    nullif(new.raw_user_meta_data->>'company_name', '')
  )
  on conflict (id) do nothing;

  -- Todo perfil tem um registro comercial correspondente: é o que liga a conta
  -- a pedidos, orçamentos e histórico.
  insert into store.customers (profile_id, name, company_name, customer_type, document, email, phone, created_by)
  values (
    new.id,
    new_name,
    nullif(new.raw_user_meta_data->>'company_name', ''),
    person_type,
    clean_document,
    new.email,
    nullif(new.raw_user_meta_data->>'phone', ''),
    new.id
  )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_store on auth.users;
create trigger on_auth_user_created_store
  after insert on auth.users
  for each row execute function store.handle_new_user();

-- -----------------------------------------------------------------------------
-- Backfill de quem já tinha conta antes deste trigger existir
-- -----------------------------------------------------------------------------

insert into store.profiles (id, role, full_name, email, phone, document, customer_type, company_name)
select
  u.id,
  -- O coalesce precisa vir antes da comparação E do resultado: sem metadado de
  -- papel, `->>'role'` é nulo e `role` é NOT NULL.
  case
    when coalesce(u.raw_user_meta_data->>'role', 'cliente') in ('cliente', 'revendedor')
      then coalesce(u.raw_user_meta_data->>'role', 'cliente')
    else 'cliente'
  end,
  coalesce(nullif(trim(u.raw_user_meta_data->>'full_name'), ''), split_part(u.email, '@', 1)),
  u.email,
  nullif(u.raw_user_meta_data->>'phone', ''),
  nullif(regexp_replace(coalesce(u.raw_user_meta_data->>'document', ''), '\D', '', 'g'), ''),
  coalesce(nullif(u.raw_user_meta_data->>'customer_type', ''), 'pf'),
  nullif(u.raw_user_meta_data->>'company_name', '')
from auth.users u
where not exists (select 1 from store.profiles p where p.id = u.id)
on conflict (id) do nothing;

insert into store.customers (profile_id, name, company_name, customer_type, document, email, phone, created_by)
select
  p.id, p.full_name, p.company_name, p.customer_type, p.document, p.email, p.phone, p.id
from store.profiles p
where not exists (select 1 from store.customers c where c.profile_id = p.id)
on conflict do nothing;
