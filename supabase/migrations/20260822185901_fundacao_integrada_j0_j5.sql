-- =============================================================================
-- FUNDAÇÃO INTEGRADA J0–J5
-- Identidade compartilhada, membros da empresa, onboarding e Storage real.
-- =============================================================================

create schema if not exists private;
revoke all on schema private from public;

-- O primeiro schema do CRM e o schema encontrado em produção nasceram em
-- migrações diferentes. Estas colunas tornam o replay convergente.
alter table public.companies
  add column if not exists owner_id uuid references auth.users(id) on delete restrict,
  add column if not exists cnpj text,
  add column if not exists phone text,
  add column if not exists whatsapp text,
  add column if not exists email text,
  add column if not exists address text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists logo_url text,
  add column if not exists bank_info text,
  add column if not exists contract_terms text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.profiles
  add column if not exists role text not null default 'membro',
  add column if not exists avatar_url text,
  add column if not exists active boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_role_check'
  ) then
    alter table public.profiles add constraint profiles_role_check
      check (role in (
        'owner', 'admin', 'atendente', 'vendedor', 'designer',
        'producao', 'financeiro', 'membro', 'leitura'
      ));
  end if;
end $$;

create table if not exists public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'membro' check (role in (
    'owner', 'admin', 'atendente', 'vendedor', 'designer',
    'producao', 'financeiro', 'membro', 'leitura'
  )),
  permissions jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, user_id)
);

create index if not exists company_members_user_active_idx
  on public.company_members(user_id, company_id)
  where active;
create index if not exists company_members_company_role_idx
  on public.company_members(company_id, role)
  where active;

alter table public.company_members enable row level security;

-- Helper não exposto pela Data API. A função verifica sempre auth.uid() e só
-- devolve um booleano; SECURITY DEFINER evita recursão das policies da própria
-- company_members e não concede acesso às linhas consultadas.
create or replace function private.is_company_member(
  p_company_id uuid,
  p_roles text[] default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and (
      exists (
        select 1
        from public.companies c
        where c.id = p_company_id
          and c.owner_id = (select auth.uid())
      )
      or exists (
        select 1
        from public.company_members m
        where m.company_id = p_company_id
          and m.user_id = (select auth.uid())
          and m.active
          and (p_roles is null or m.role = any(p_roles))
      )
    );
$$;

revoke all on function private.is_company_member(uuid, text[]) from public;
grant usage on schema private to anon, authenticated, service_role;
grant execute on function private.is_company_member(uuid, text[]) to anon, authenticated, service_role;

-- Nome preservado por compatibilidade com as policies antigas. Agora “dono”
-- significa dono OU membro ativo, que é o modelo operacional real do CRM.
create or replace function public.user_owns_company(target_company_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.is_company_member(target_company_id, null);
$$;

revoke all on function public.user_owns_company(uuid) from public;
grant execute on function public.user_owns_company(uuid) to anon, authenticated, service_role;

create or replace function public.get_user_company_id()
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select p.company_id
  from public.profiles p
  where p.user_id = (select auth.uid())
    and p.active
  limit 1;
$$;

revoke all on function public.get_user_company_id() from public;
grant execute on function public.get_user_company_id() to anon, authenticated, service_role;

-- Donos e perfis já existentes tornam-se membros explícitos sem alterar dados
-- comerciais. Isso permite que as policies novas funcionem no primeiro deploy.
update public.profiles p
set role = 'owner'
from public.companies c
where c.id = p.company_id
  and c.owner_id = p.user_id
  and p.role is distinct from 'owner';

insert into public.company_members (company_id, user_id, role)
select c.id, c.owner_id, 'owner'
from public.companies c
where c.owner_id is not null
on conflict (company_id, user_id) do update
set role = 'owner', active = true, updated_at = now();

insert into public.company_members (company_id, user_id, role)
select p.company_id, p.user_id, p.role
from public.profiles p
where p.company_id is not null
on conflict (company_id, user_id) do update
set role = excluded.role, active = excluded.active, updated_at = now();

drop policy if exists "company members read" on public.company_members;
create policy "company members read" on public.company_members
  for select to authenticated
  using (private.is_company_member(company_id, null));

drop policy if exists "company admins insert members" on public.company_members;
create policy "company admins insert members" on public.company_members
  for insert to authenticated
  with check (private.is_company_member(company_id, array['owner', 'admin']));

drop policy if exists "company admins update members" on public.company_members;
create policy "company admins update members" on public.company_members
  for update to authenticated
  using (private.is_company_member(company_id, array['owner', 'admin']))
  with check (private.is_company_member(company_id, array['owner', 'admin']));

drop policy if exists "company admins delete members" on public.company_members;
create policy "company admins delete members" on public.company_members
  for delete to authenticated
  using (private.is_company_member(company_id, array['owner', 'admin']));

-- Substitui as policies owner-only de empresas por vínculo de equipe.
drop policy if exists "owners view own company" on public.companies;
drop policy if exists "owners update own company" on public.companies;
drop policy if exists "owners insert own company" on public.companies;
drop policy if exists "Users can view their company" on public.companies;
drop policy if exists "Users can update their company" on public.companies;
drop policy if exists "members view company" on public.companies;
drop policy if exists "owners create company" on public.companies;
drop policy if exists "company admins update company" on public.companies;

create policy "members view company" on public.companies
  for select to authenticated
  using (private.is_company_member(id, null));
create policy "owners create company" on public.companies
  for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "company admins update company" on public.companies
  for update to authenticated
  using (private.is_company_member(id, array['owner', 'admin']))
  with check (private.is_company_member(id, array['owner', 'admin']));

-- Perfil é criado pelo trigger. O navegador pode atualizar apenas campos
-- pessoais; role, company_id e active ficam reservados ao fluxo administrativo.
drop policy if exists "users view own profile" on public.profiles;
drop policy if exists "users update own profile" on public.profiles;
drop policy if exists "users insert own profile" on public.profiles;
drop policy if exists "Users can view profiles of their company" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "members view company profiles" on public.profiles;
drop policy if exists "users update own profile" on public.profiles;

create policy "members view company profiles" on public.profiles
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (company_id is not null and private.is_company_member(company_id, null))
  );
create policy "users update own profile" on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke insert on public.profiles from anon, authenticated;
revoke update on public.profiles from authenticated;
grant update (full_name, email, avatar_url, updated_at) on public.profiles to authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.company_members to authenticated;
grant all on public.company_members to service_role;

-- ---------------------------------------------------------------------------
-- Onboarding compartilhado
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid;
  v_name text;
begin
  -- Cadastro da loja não deve criar uma gráfica vazia no CRM. O Flow envia
  -- app_origin=flow; esse valor só concede domínio sobre uma empresa nova do
  -- próprio usuário, nunca acesso à empresa de outra pessoa.
  if coalesce(new.raw_user_meta_data->>'app_origin', '') not in ('flow', 'crm') then
    return new;
  end if;

  v_name := coalesce(
    nullif(pg_catalog.btrim(new.raw_user_meta_data->>'full_name'), ''),
    pg_catalog.split_part(new.email, '@', 1)
  );

  insert into public.companies (name, owner_id, email)
  values (
    coalesce(nullif(pg_catalog.btrim(new.raw_user_meta_data->>'company_name'), ''), 'Minha Gráfica'),
    new.id,
    new.email
  )
  returning id into v_company_id;

  insert into public.profiles (user_id, company_id, full_name, email, role, active)
  values (new.id, v_company_id, v_name, new.email, 'owner', true)
  on conflict (user_id) do update
  set company_id = excluded.company_id,
      full_name = excluded.full_name,
      email = excluded.email,
      role = 'owner',
      active = true,
      updated_at = now();

  insert into public.company_members (company_id, user_id, role, active)
  values (v_company_id, new.id, 'owner', true)
  on conflict (company_id, user_id) do update
  set role = 'owner', active = true, updated_at = now();

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

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
begin
  v_role := coalesce(new.raw_user_meta_data->>'role', 'cliente');
  if v_role not in ('cliente', 'revendedor') then
    v_role := 'cliente';
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
    new.id,
    v_role,
    v_name,
    new.email,
    nullif(new.raw_user_meta_data->>'phone', ''),
    v_document,
    v_customer_type,
    nullif(new.raw_user_meta_data->>'company_name', '')
  )
  on conflict (id) do nothing;

  insert into store.customers (
    profile_id, name, company_name, customer_type, document, email, phone, created_by
  ) values (
    new.id,
    v_name,
    nullif(new.raw_user_meta_data->>'company_name', ''),
    v_customer_type,
    v_document,
    new.email,
    nullif(new.raw_user_meta_data->>'phone', ''),
    new.id
  )
  on conflict do nothing;

  return new;
end;
$$;

revoke all on function store.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_created_flow on auth.users;
create trigger on_auth_user_created_flow
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists on_auth_user_created_store on auth.users;
create trigger on_auth_user_created_store
  after insert on auth.users
  for each row execute function store.handle_new_user();

-- Backfill seguro para usuários anteriores aos triggers. Não cria empresas
-- novas no CRM sem saber sua origem; apenas restaura perfis da loja e os donos
-- de empresas que já existem.
insert into public.profiles (user_id, company_id, full_name, email, role, active)
select c.owner_id, c.id, coalesce(u.raw_user_meta_data->>'full_name', u.email), u.email, 'owner', true
from public.companies c
join auth.users u on u.id = c.owner_id
where c.owner_id is not null
on conflict (user_id) do update
set company_id = excluded.company_id,
    role = 'owner',
    active = true,
    updated_at = now();

insert into store.profiles (id, role, full_name, email, phone, document, customer_type, company_name)
select
  u.id,
  case
    when coalesce(u.raw_user_meta_data->>'role', 'cliente') in ('cliente', 'revendedor')
      then coalesce(u.raw_user_meta_data->>'role', 'cliente')
    else 'cliente'
  end,
  coalesce(nullif(pg_catalog.btrim(u.raw_user_meta_data->>'full_name'), ''), pg_catalog.split_part(u.email, '@', 1)),
  u.email,
  nullif(u.raw_user_meta_data->>'phone', ''),
  nullif(pg_catalog.regexp_replace(coalesce(u.raw_user_meta_data->>'document', ''), '\D', '', 'g'), ''),
  coalesce(nullif(u.raw_user_meta_data->>'customer_type', ''), 'pf'),
  nullif(u.raw_user_meta_data->>'company_name', '')
from auth.users u
where not exists (select 1 from store.profiles p where p.id = u.id)
on conflict (id) do nothing;

insert into store.customers (profile_id, name, company_name, customer_type, document, email, phone, created_by)
select p.id, p.full_name, p.company_name, coalesce(p.customer_type, 'pf'), p.document, p.email, p.phone, p.id
from store.profiles p
where not exists (select 1 from store.customers c where c.profile_id = p.id)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Storage real, privado e conectado aos papéis da loja
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'artes', 'artes', false, 52428800,
    array[
      'application/pdf','image/png','image/jpeg','image/webp','image/tiff',
      'application/postscript','image/vnd.adobe.photoshop','application/zip',
      'application/octet-stream'
    ]
  ),
  (
    'publico', 'publico', true, 10485760,
    array['image/png','image/jpeg','image/webp','image/svg+xml','image/avif']
  ),
  (
    'documentos', 'documentos', false, 52428800,
    array['application/pdf','image/png','image/jpeg','image/webp','application/zip']
  )
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "qa_j2_artes_envia_proprio" on storage.objects;
drop policy if exists "qa_j2_artes_le_proprio" on storage.objects;
drop policy if exists "artes_envia_proprio" on storage.objects;
drop policy if exists "artes_le_proprio" on storage.objects;
drop policy if exists "artes_atualiza_proprio" on storage.objects;
drop policy if exists "artes_remove_proprio" on storage.objects;

create policy "artes_envia_proprio" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'artes'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or store.is_staff()
    )
  );
create policy "artes_le_proprio" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'artes'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or store.is_staff()
    )
  );
create policy "artes_atualiza_proprio" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'artes'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or store.is_staff())
  )
  with check (
    bucket_id = 'artes'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or store.is_staff())
  );
create policy "artes_remove_proprio" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'artes'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or store.is_admin())
  );

drop policy if exists "publico_leitura" on storage.objects;
drop policy if exists "publico_escrita_admin" on storage.objects;
drop policy if exists "publico_atualiza_admin" on storage.objects;
drop policy if exists "publico_remove_admin" on storage.objects;
create policy "publico_leitura" on storage.objects
  for select to anon, authenticated using (bucket_id = 'publico');
create policy "publico_escrita_admin" on storage.objects
  for insert to authenticated with check (bucket_id = 'publico' and store.is_admin());
create policy "publico_atualiza_admin" on storage.objects
  for update to authenticated
  using (bucket_id = 'publico' and store.is_admin())
  with check (bucket_id = 'publico' and store.is_admin());
create policy "publico_remove_admin" on storage.objects
  for delete to authenticated using (bucket_id = 'publico' and store.is_admin());

drop policy if exists "documentos_leitura" on storage.objects;
drop policy if exists "documentos_escrita" on storage.objects;
drop policy if exists "documentos_atualiza" on storage.objects;
drop policy if exists "documentos_remove" on storage.objects;

create policy "documentos_leitura" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documentos'
    and (
      store.is_staff()
      or (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1
        from store.marketing_assets a
        where a.storage_path = name
          and a.active
          and (
            not a.whitelabel
            or exists (
              select 1
              from store.reseller_profiles r
              where r.profile_id = (select auth.uid())
                and r.approved
                and r.allow_whitelabel
            )
          )
      )
    )
  );
create policy "documentos_escrita" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documentos'
    and (store.is_admin() or (storage.foldername(name))[1] = (select auth.uid())::text)
  );
create policy "documentos_atualiza" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documentos'
    and (store.is_admin() or (storage.foldername(name))[1] = (select auth.uid())::text)
  )
  with check (
    bucket_id = 'documentos'
    and (store.is_admin() or (storage.foldername(name))[1] = (select auth.uid())::text)
  );
create policy "documentos_remove" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documentos'
    and (store.is_admin() or (storage.foldername(name))[1] = (select auth.uid())::text)
  );

notify pgrst, 'reload schema';
