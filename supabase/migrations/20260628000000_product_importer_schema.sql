-- ============================================================================
-- IMPORTADOR DE PRODUTOS POR LINK — esquema de dados estruturado (seção 25)
--
-- Cria as tabelas que armazenam produtos importados de forma estruturada:
-- material, formato, cor e acabamento ficam SEPARADOS (nunca num campo único),
-- variantes só existem com id externo real e cada faixa de preço por tiragem é
-- gravada individualmente.
--
-- Todas as tabelas carregam company_id (multi-tenant) e usam a função
-- existente user_owns_company(company_id) para RLS, mantendo o mesmo padrão das
-- demais tabelas do projeto. Idempotente (IF NOT EXISTS / DROP POLICY IF EXISTS).
-- ============================================================================

-- --- Colunas adicionais em products (classificação da importação) ----------
alter table public.products add column if not exists subcategory text;
alter table public.products add column if not exists review_required boolean default false;
alter table public.products add column if not exists classification_confidence numeric;

-- --- Jobs de importação (seção 25) -----------------------------------------
create table if not exists public.product_import_jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  import_mode text not null default 'single', -- single | batch | catalog | price_update
  source_url text,
  status text not null default 'pendente',
  total_found integer default 0,
  total_processed integer default 0,
  total_success integer default 0,
  total_error integer default 0,
  started_at timestamptz,
  finished_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  error_log jsonb default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.product_import_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  import_job_id uuid references public.product_import_jobs(id) on delete cascade,
  source_url text not null,
  external_id text,
  status text not null default 'pendente',
  raw_data jsonb,
  normalized_data jsonb,
  warnings jsonb default '[]'::jsonb,
  errors jsonb default '[]'::jsonb,
  product_id uuid references public.products(id) on delete set null,
  created_at timestamptz not null default now()
);

-- --- Variantes e faixas de preço (seções 9, 11) ----------------------------
create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  external_id text,
  sku text,
  title text,
  material text,
  format_original text,
  width_mm numeric,
  height_mm numeric,
  depth_mm numeric,
  model text,
  size text,
  print_color text,
  enoblement text,
  finishing text,
  production_days integer,
  available boolean default true,
  raw_attributes jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.product_price_tiers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  quantity integer not null,
  unit text default 'unidade',
  total_price numeric not null,
  unit_price numeric,
  old_price numeric,
  promotional_price numeric,
  discount_percent numeric,
  currency text default 'BRL',
  available boolean default true,
  external_id text,
  collected_at timestamptz not null default now()
);

-- --- Atributos dinâmicos (seção 8) -----------------------------------------
create table if not exists public.product_attributes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  normalized_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.product_attribute_values (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  attribute_id uuid not null references public.product_attributes(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  value text not null,
  normalized_value text not null,
  external_id text,
  created_at timestamptz not null default now()
);

-- --- Mídia, gabaritos e extras (seções 16, 17, 20) -------------------------
create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  hires_url text,
  alt text,
  position integer default 0,
  is_main boolean default false,
  storage_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.product_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete set null,
  type text,
  name text,
  url text not null,
  format text,
  collected_at timestamptz not null default now()
);

create table if not exists public.product_extras (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  normalized_name text,
  price numeric default 0,
  currency text default 'BRL',
  extra_days integer,
  url text,
  created_at timestamptz not null default now()
);

-- --- Categorias, segmentos e mapeamentos (seções 21, 22, 24) ---------------
create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  parent_id uuid references public.product_categories(id) on delete cascade,
  slug text,
  created_at timestamptz not null default now()
);

create table if not exists public.product_segments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  slug text,
  created_at timestamptz not null default now()
);

create table if not exists public.product_category_mappings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  category_id uuid references public.product_categories(id) on delete set null,
  segment_id uuid references public.product_segments(id) on delete set null,
  confidence numeric,
  reason text,
  created_at timestamptz not null default now()
);

-- --- Índices úteis para deduplicação (seção 26) ----------------------------
create index if not exists idx_variants_external on public.product_variants (company_id, external_id);
create index if not exists idx_variants_sku on public.product_variants (company_id, sku);
create index if not exists idx_import_items_external on public.product_import_items (company_id, external_id);
create index if not exists idx_price_tiers_variant on public.product_price_tiers (variant_id);

-- --- RLS uniforme via user_owns_company(company_id) ------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'product_import_jobs','product_import_items','product_variants','product_price_tiers',
    'product_attributes','product_attribute_values','product_images','product_templates',
    'product_extras','product_categories','product_segments','product_category_mappings'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "owner company all" on public.%I;', t);
    execute format(
      'create policy "owner company all" on public.%I for all using (user_owns_company(company_id)) with check (user_owns_company(company_id));',
      t
    );
  end loop;
end $$;
