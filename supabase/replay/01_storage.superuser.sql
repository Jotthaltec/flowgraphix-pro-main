-- =============================================================================
-- SHIM DE REPLAY — Storage. Executado como supabase_admin (sufixo .superuser).
--
-- No Supabase real as tabelas do Storage são criadas pelo serviço de storage;
-- a imagem Postgres do replay só tem o schema vazio, de supabase_admin. Aqui
-- entra só o que as migrações usam (buckets, objects, foldername), com os
-- mesmos nomes de colunas, e a posse vai para postgres porque as migrações
-- criam policies em storage.objects. Nunca é aplicado em produção.
-- =============================================================================
create table if not exists storage.buckets (
  id text primary key,
  name text not null unique,
  owner uuid,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid,
  owner_id text,
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text)
returns text[]
language sql
immutable
as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]; $$;
alter table storage.buckets owner to postgres;
alter table storage.objects owner to postgres;
alter function storage.foldername(text) owner to postgres;
grant usage on schema storage to postgres, anon, authenticated, service_role;
