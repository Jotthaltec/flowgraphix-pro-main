-- ============================================================================
-- MOTOR UNIVERSAL E ADAPTATIVO DE IMPORTAÇÃO DE FORNECEDORES
-- Etapa 3 — Fundação de governança/adaptação (schema).
--
-- Objetivo: sair de um importador FuturaIM hard-coded para um motor que MAPEIA,
-- COMPREENDE, VERSIONA e MONITORA a estrutura de múltiplos fornecedores.
--
-- Camadas:
--   1. Sites e credenciais por fornecedor (allowlist data-driven p/ anti-SSRF).
--   2. Perfis de mapeamento VERSIONADOS (tecnologia, seletores, saúde, confiança).
--   3. Descoberta: crawl runs, árvore de nós do site, páginas, categorias cruas.
--   4. Produtos/variantes CRUS do fornecedor (dado original preservado) ligados
--      ao catálogo canônico (products/product_variants).
--   5. Governança: histórico de preços, promoções, eventos de mudança (diff),
--      agendamentos, aprendizado por correção, erros, logs e alertas.
--
-- Todas as tabelas carregam company_id (multi-tenant) e usam user_owns_company()
-- para RLS — mesmo padrão das demais tabelas. Idempotente.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Colunas de governança em suppliers (§3, §5, §8, §14)
-- ---------------------------------------------------------------------------
alter table public.suppliers add column if not exists integration_status text not null default 'active'; -- active | paused | error
alter table public.suppliers add column if not exists technology text;
alter table public.suppliers add column if not exists active_profile_id uuid;
alter table public.suppliers add column if not exists health_score numeric;
alter table public.suppliers add column if not exists confidence_auto numeric not null default 95;      -- §8 limiar auto-atualização
alter table public.suppliers add column if not exists confidence_review numeric not null default 60;    -- §8 limiar revisão
alter table public.suppliers add column if not exists last_synced_at timestamptz;
alter table public.suppliers add column if not exists next_sync_at timestamptz;

-- ---------------------------------------------------------------------------
-- 1. Sites e credenciais
-- ---------------------------------------------------------------------------
create table if not exists public.supplier_sites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  domain text not null,
  base_url text,
  name text,
  is_primary boolean not null default true,
  allowed boolean not null default true,            -- allowlist data-driven (§19 anti-SSRF)
  technology text,
  robots_txt text,
  robots_checked_at timestamptz,
  sitemap_url text,
  navigation_strategy text,                          -- api | feed | sitemap | jsonld | html | browser | connector (§6)
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_credentials (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  site_id uuid references public.supplier_sites(id) on delete cascade,
  kind text not null default 'login',                -- login | api_key | token | oauth
  username text,
  secret_enc text,                                   -- write-only, criptografado no app (§19)
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. Perfis de mapeamento versionados (§5)
-- ---------------------------------------------------------------------------
create table if not exists public.supplier_mapping_profiles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  site_id uuid references public.supplier_sites(id) on delete cascade,
  name text not null default 'default',
  adapter_key text,                                  -- qual adaptador roda este perfil (futuraim | generic_jsonld | ...)
  technology text,
  url_patterns jsonb not null default '{}'::jsonb,   -- category/product/promo URL patterns
  category_pattern text,
  product_pattern text,
  selectors jsonb not null default '{}'::jsonb,      -- name/price/promo/images/variations/specs
  pagination jsonb not null default '{}'::jsonb,
  specs_source text,                                 -- jsonld | table | description | attributes
  normalization_rules jsonb not null default '{}'::jsonb,
  source_priority jsonb not null default '[]'::jsonb,-- §6 ordem das fontes
  status text not null default 'draft',              -- draft | active | deprecated
  version integer not null default 1,
  confidence numeric,
  health numeric,
  last_validated_at timestamptz,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_mapping_versions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  profile_id uuid not null references public.supplier_mapping_profiles(id) on delete cascade,
  version integer not null,
  snapshot jsonb not null,                           -- cópia imutável do perfil aprovado
  change_note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. Descoberta: crawl runs, árvore, páginas, categorias cruas (§4)
-- ---------------------------------------------------------------------------
create table if not exists public.supplier_crawl_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  site_id uuid references public.supplier_sites(id) on delete set null,
  profile_id uuid references public.supplier_mapping_profiles(id) on delete set null,
  run_type text not null default 'map',              -- map | remap | test | import | sync
  status text not null default 'queued',             -- queued | running | success | error | cancelled | needs_review
  pages_ok integer not null default 0,
  pages_error integer not null default 0,
  products_found integer not null default 0,
  confidence numeric,
  sample jsonb not null default '[]'::jsonb,          -- amostra de produtos p/ revisão
  stats jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.supplier_site_nodes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  site_id uuid references public.supplier_sites(id) on delete cascade,
  crawl_run_id uuid references public.supplier_crawl_runs(id) on delete cascade,
  parent_id uuid references public.supplier_site_nodes(id) on delete cascade,
  url text not null,
  canonical_url text,
  node_type text not null default 'unknown',         -- category | product | promotion | pagination | institutional | unknown
  title text,
  depth integer not null default 0,
  breadcrumb jsonb not null default '[]'::jsonb,
  product_count integer not null default 0,
  confidence numeric,
  ignored boolean not null default false,            -- páginas institucionais irrelevantes (§4)
  discovered_via text,                               -- menu | sitemap | breadcrumb | link | jsonld
  created_at timestamptz not null default now()
);

create table if not exists public.supplier_pages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  site_id uuid references public.supplier_sites(id) on delete cascade,
  crawl_run_id uuid references public.supplier_crawl_runs(id) on delete set null,
  url text not null,
  canonical_url text,
  page_type text,
  http_status integer,
  content_hash text,                                 -- sinal p/ sync incremental (§10)
  parse_status text default 'pending',
  confidence numeric,
  snapshot_id uuid references public.supplier_page_snapshots(id) on delete set null,
  fetched_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.supplier_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  site_id uuid references public.supplier_sites(id) on delete cascade,
  external_id text,
  name text not null,
  url text,
  parent_external_id text,
  path text,
  mapped_category_id uuid references public.product_categories(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. Produtos/variantes CRUS do fornecedor (dado original preservado) (§1, §7)
-- ---------------------------------------------------------------------------
create table if not exists public.supplier_products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  site_id uuid references public.supplier_sites(id) on delete set null,
  crawl_run_id uuid references public.supplier_crawl_runs(id) on delete set null,
  external_id text,
  source_url text not null,
  canonical_url text,
  raw_name text,
  raw_data jsonb not null default '{}'::jsonb,       -- SEMPRE o dado original do site
  normalized_data jsonb not null default '{}'::jsonb,-- dado normalizado pelo CRM
  content_hash text,
  status text not null default 'new',                -- new | active | changed | removed
  confidence numeric,
  catalog_product_id uuid references public.products(id) on delete set null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_changed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_product_variants (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  supplier_product_id uuid not null references public.supplier_products(id) on delete cascade,
  external_id text,
  sku text,
  raw_attributes jsonb not null default '{}'::jsonb,
  normalized_attributes jsonb not null default '{}'::jsonb,
  content_hash text,
  available boolean not null default true,
  catalog_variant_id uuid references public.product_variants(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 5. Vínculo N fornecedores ↔ 1 produto canônico (§13 comparação)
-- ---------------------------------------------------------------------------
create table if not exists public.product_supplier_links (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  supplier_product_id uuid references public.supplier_products(id) on delete set null,
  source_url text,
  cost numeric,
  freight numeric,
  lead_time_days integer,
  min_quantity integer,
  availability text,
  quality_rating numeric,
  delay_index numeric,
  problem_index numeric,
  is_preferred boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 6. Governança: histórico de preço, promoções, eventos de mudança (§10, §11, §22)
-- ---------------------------------------------------------------------------
create table if not exists public.supplier_price_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  supplier_product_id uuid references public.supplier_products(id) on delete cascade,
  variant_external_id text,
  quantity integer,
  old_price numeric,
  new_price numeric,
  change_percent numeric,
  currency text not null default 'BRL',
  source text,
  confidence numeric,
  crawl_run_id uuid references public.supplier_crawl_runs(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.supplier_promotions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  supplier_product_id uuid references public.supplier_products(id) on delete cascade,
  variant_external_id text,
  normal_price numeric,
  promo_price numeric,
  discount_percent numeric,
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'active',              -- scheduled | active | ended
  detected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_change_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  supplier_product_id uuid references public.supplier_products(id) on delete cascade,
  crawl_run_id uuid references public.supplier_crawl_runs(id) on delete set null,
  event_type text not null,                           -- product_new | product_removed | price_changed | promo_started | promo_ended | lead_time_changed | image_changed | material_changed | finishing_changed | variant_added | variant_removed | category_moved | structure_changed
  field text,
  old_value jsonb,
  new_value jsonb,
  change_percent numeric,
  confidence numeric,
  status text not null default 'pending',             -- pending | applied | reviewed | reverted | ignored
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 7. Agendamentos, aprendizado, erros, logs, alertas (§3, §9, §14, §15)
-- ---------------------------------------------------------------------------
create table if not exists public.supplier_sync_schedules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  site_id uuid references public.supplier_sites(id) on delete set null,
  profile_id uuid references public.supplier_mapping_profiles(id) on delete set null,
  cadence text not null default 'manual',             -- manual | hourly | daily | weekly | monthly | cron
  cron text,
  enabled boolean not null default true,
  options jsonb not null default '{}'::jsonb,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_mapping_feedback (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete cascade,
  supplier_product_id uuid references public.supplier_products(id) on delete set null,
  field text not null,
  found_value text,
  interpreted_value text,
  corrected_value text,
  applied_rule text,
  selector text,
  source text,
  scope text not null default 'supplier',             -- supplier | category | global (§9 separação)
  category text,
  context jsonb not null default '{}'::jsonb,
  user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.supplier_import_errors (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete cascade,
  crawl_run_id uuid references public.supplier_crawl_runs(id) on delete cascade,
  supplier_product_id uuid references public.supplier_products(id) on delete set null,
  url text,
  stage text,
  error_code text,
  message text,
  details jsonb not null default '{}'::jsonb,
  retry_count integer not null default 0,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.supplier_import_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete cascade,
  crawl_run_id uuid references public.supplier_crawl_runs(id) on delete cascade,
  supplier_product_id uuid references public.supplier_products(id) on delete set null,
  level text not null default 'info',                 -- debug | info | warn | error
  stage text,
  message text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.supplier_alerts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete cascade,
  alert_type text not null,                           -- health_low | structure_changed | margin | consecutive_errors | no_price | promo | review_needed
  severity text not null default 'warning',           -- info | warning | critical
  title text not null,
  message text,
  data jsonb not null default '{}'::jsonb,
  status text not null default 'open',                -- open | acknowledged | resolved
  acknowledged_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Índices para deduplicação, diffs e monitoramento
-- ---------------------------------------------------------------------------
create unique index if not exists uq_supplier_sites_domain on public.supplier_sites (company_id, supplier_id, domain);
create index if not exists idx_supplier_products_external on public.supplier_products (company_id, supplier_id, external_id);
create index if not exists idx_supplier_products_url on public.supplier_products (company_id, source_url);
create index if not exists idx_supplier_products_status on public.supplier_products (company_id, supplier_id, status);
create index if not exists idx_supplier_variants_product on public.supplier_product_variants (supplier_product_id);
create index if not exists idx_site_nodes_run on public.supplier_site_nodes (crawl_run_id);
create index if not exists idx_site_nodes_parent on public.supplier_site_nodes (parent_id);
create index if not exists idx_change_events_status on public.supplier_change_events (company_id, supplier_id, status);
create index if not exists idx_price_history_product on public.supplier_price_history (supplier_product_id);
create index if not exists idx_promotions_status on public.supplier_promotions (company_id, supplier_id, status);
create index if not exists idx_product_supplier_links_product on public.product_supplier_links (company_id, product_id);
create unique index if not exists uq_product_supplier_link on public.product_supplier_links (company_id, product_id, supplier_id);
create index if not exists idx_alerts_status on public.supplier_alerts (company_id, status);
create index if not exists idx_crawl_runs_supplier on public.supplier_crawl_runs (company_id, supplier_id, created_at desc);
create index if not exists idx_import_errors_run on public.supplier_import_errors (crawl_run_id);
create index if not exists idx_import_logs_run on public.supplier_import_logs (crawl_run_id);

-- ---------------------------------------------------------------------------
-- RLS uniforme via user_owns_company(company_id)
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'supplier_sites','supplier_credentials','supplier_mapping_profiles','supplier_mapping_versions',
    'supplier_crawl_runs','supplier_site_nodes','supplier_pages','supplier_categories',
    'supplier_products','supplier_product_variants','product_supplier_links',
    'supplier_price_history','supplier_promotions','supplier_change_events',
    'supplier_sync_schedules','supplier_mapping_feedback','supplier_import_errors',
    'supplier_import_logs','supplier_alerts'
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
