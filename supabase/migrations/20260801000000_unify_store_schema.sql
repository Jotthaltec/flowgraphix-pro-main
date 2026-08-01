CREATE SCHEMA IF NOT EXISTS store;

-- =============================================================================
-- NEXUS PRINTI — Estrutura do banco de dados
-- Postgres / Supabase
-- =============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "unaccent";

-- -----------------------------------------------------------------------------
-- Utilitários
-- -----------------------------------------------------------------------------

create or replace function store.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Slug sem acentos, usado em categorias e produtos.
create or replace function store.slugify(value text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(
    lower(unaccent(coalesce(value, ''))),
    '[^a-z0-9]+', '-', 'g'
  ));
$$;

-- Sequências para numeração legível de pedidos, orçamentos, chamados e OPs.
create sequence if not exists store.order_number_seq start 1000;
create sequence if not exists store.quote_number_seq start 1000;
create sequence if not exists store.ticket_number_seq start 1000;
create sequence if not exists store.production_number_seq start 1000;

-- =============================================================================
-- PERFIS, CLIENTES E PERMISSÕES
-- =============================================================================

create table if not exists store.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'cliente'
    check (role in ('cliente', 'revendedor', 'vendedor', 'admin')),
  full_name text not null default '',
  email text,
  phone text,
  document text,                                   -- CPF ou CNPJ (somente dígitos)
  customer_type text default 'pf' check (customer_type in ('pf', 'pj')),
  company_name text,
  state_registration text,                         -- Inscrição estadual
  avatar_url text,
  seller_id uuid references store.profiles(id) on delete set null,
  reseller_id uuid references store.profiles(id) on delete set null,
  price_table_id uuid,
  credit_balance numeric(12,2) not null default 0,
  notification_prefs jsonb not null default '{"email":true,"whatsapp":true,"push":false,"sms":false}'::jsonb,
  active boolean not null default true,
  anonymized_at timestamptz,                       -- LGPD
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on store.profiles(role);
create index if not exists profiles_seller_idx on store.profiles(seller_id);
create index if not exists profiles_reseller_idx on store.profiles(reseller_id);
create index if not exists profiles_document_idx on store.profiles(document);

drop trigger if exists profiles_updated_at on store.profiles;
create trigger profiles_updated_at before update on store.profiles
  for each row execute function store.set_updated_at();

-- Clientes: registro comercial. Pode ou não ter conta de acesso (profile_id).
-- Revendedores e vendedores cadastram clientes que não acessam o sistema.
create table if not exists store.customers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references store.profiles(id) on delete set null,
  owner_reseller_id uuid references store.profiles(id) on delete set null,
  seller_id uuid references store.profiles(id) on delete set null,
  name text not null,
  company_name text,
  customer_type text not null default 'pf' check (customer_type in ('pf', 'pj')),
  document text,
  state_registration text,
  email text,
  phone text,
  notes text,
  tags text[] not null default '{}',
  total_orders integer not null default 0,
  total_spent numeric(12,2) not null default 0,
  last_order_at timestamptz,
  created_by uuid references store.profiles(id) on delete set null,
  is_demo boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customers_owner_idx on store.customers(owner_reseller_id);
create index if not exists customers_seller_idx on store.customers(seller_id);
create index if not exists customers_profile_idx on store.customers(profile_id);
create index if not exists customers_name_idx on store.customers using gin (to_tsvector('portuguese', coalesce(name,'') || ' ' || coalesce(company_name,'')));

drop trigger if exists customers_updated_at on store.customers;
create trigger customers_updated_at before update on store.customers
  for each row execute function store.set_updated_at();

-- Matriz de permissões editável pelo administrador.
create table if not exists store.permissions (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('cliente', 'revendedor', 'vendedor', 'admin')),
  resource text not null,
  can_view boolean not null default false,
  can_create boolean not null default false,
  can_edit boolean not null default false,
  can_delete boolean not null default false,
  can_approve boolean not null default false,
  unique (role, resource)
);

-- Perfil complementar do revendedor.
create table if not exists store.reseller_profiles (
  profile_id uuid primary key references store.profiles(id) on delete cascade,
  company_name text,
  logo_url text,
  default_margin_type text not null default 'percentual' check (default_margin_type in ('percentual', 'valor_fixo')),
  default_margin_value numeric(10,2) not null default 30,
  credit_limit numeric(12,2) not null default 0,
  credit_used numeric(12,2) not null default 0,
  cashback_balance numeric(12,2) not null default 0,
  commission_pct numeric(5,2) not null default 0,
  monthly_goal numeric(12,2) not null default 0,
  tier text not null default 'bronze' check (tier in ('bronze', 'prata', 'ouro', 'diamante')),
  allow_whitelabel boolean not null default false,
  payment_terms text,
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists reseller_profiles_updated_at on store.reseller_profiles;
create trigger reseller_profiles_updated_at before update on store.reseller_profiles
  for each row execute function store.set_updated_at();

-- Perfil complementar do vendedor.
create table if not exists store.seller_profiles (
  profile_id uuid primary key references store.profiles(id) on delete cascade,
  monthly_goal numeric(12,2) not null default 0,
  commission_pct numeric(5,2) not null default 3,
  discount_limit_pct numeric(5,2) not null default 10,
  team text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists seller_profiles_updated_at on store.seller_profiles;
create trigger seller_profiles_updated_at before update on store.seller_profiles
  for each row execute function store.set_updated_at();

-- Tabelas de preço (consumidor, revenda bronze/prata/ouro, corporativo...).
create table if not exists store.price_tables (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  role text not null default 'cliente' check (role in ('cliente', 'revendedor', 'vendedor', 'admin')),
  discount_pct numeric(5,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table store.profiles
  drop constraint if exists profiles_price_table_fk;
alter table store.profiles
  add constraint profiles_price_table_fk
  foreign key (price_table_id) references store.price_tables(id) on delete set null;

-- Tabelas de margem salvas pelo revendedor.
create table if not exists store.margin_tables (
  id uuid primary key default gen_random_uuid(),
  reseller_id uuid not null references store.profiles(id) on delete cascade,
  name text not null,
  margin_type text not null default 'percentual' check (margin_type in ('percentual', 'valor_fixo')),
  margin_value numeric(10,2) not null default 0,
  category_id uuid,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists margin_tables_reseller_idx on store.margin_tables(reseller_id);

-- Endereços de clientes.
create table if not exists store.addresses (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references store.profiles(id) on delete cascade,
  customer_id uuid references store.customers(id) on delete cascade,
  label text not null default 'Principal',
  recipient text,
  cep text not null,
  street text not null,
  number text not null,
  complement text,
  district text not null,
  city text not null,
  state text not null,
  reference text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint addresses_owner_check check (profile_id is not null or customer_id is not null)
);

create index if not exists addresses_profile_idx on store.addresses(profile_id);
create index if not exists addresses_customer_idx on store.addresses(customer_id);

drop trigger if exists addresses_updated_at on store.addresses;
create trigger addresses_updated_at before update on store.addresses
  for each row execute function store.set_updated_at();

-- =============================================================================
-- CATÁLOGO
-- =============================================================================

create table if not exists store.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references store.categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  description text,
  icon text,
  image_url text,
  position integer not null default 0,
  active boolean not null default true,
  featured boolean not null default false,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists categories_parent_idx on store.categories(parent_id);
create index if not exists categories_active_idx on store.categories(active, position);

drop trigger if exists categories_updated_at on store.categories;
create trigger categories_updated_at before update on store.categories
  for each row execute function store.set_updated_at();

create table if not exists store.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  slug text not null unique,
  category_id uuid references store.categories(id) on delete set null,
  subcategory_id uuid references store.categories(id) on delete set null,
  short_description text,
  description text,
  benefits text[] not null default '{}',
  materials text[] not null default '{}',
  applications text[] not null default '{}',
  tags text[] not null default '{}',

  -- Preço e prazo
  price_unit text not null default 'unidade'
    check (price_unit in ('unidade', 'milheiro', 'm2', 'pacote', 'metro_linear')),
  base_price numeric(12,2) not null default 0,     -- preço por unidade de cobrança
  setup_fee numeric(12,2) not null default 0,      -- taxa fixa de preparação
  sale_price numeric(12,2),                        -- preço promocional
  reseller_price numeric(12,2),                    -- preço de revenda (custo do revendedor)
  suggested_price numeric(12,2),                   -- preço sugerido ao consumidor
  commission_pct numeric(5,2) not null default 0,
  min_quantity integer not null default 1,
  quantity_step integer not null default 1,
  production_days integer not null default 3,
  rush_days integer,                               -- prazo com urgência
  rush_fee_pct numeric(5,2) not null default 30,   -- acréscimo da urgência

  -- Dimensões (usado quando price_unit = m2 / metro_linear)
  default_width numeric(10,2),
  default_height numeric(10,2),
  min_width numeric(10,2),
  max_width numeric(10,2),
  min_height numeric(10,2),
  max_height numeric(10,2),
  dimension_unit text not null default 'cm' check (dimension_unit in ('cm', 'mm', 'm')),

  -- Arte
  art_required boolean not null default true,
  art_instructions text,
  template_url text,

  -- Publicação
  active boolean not null default true,
  featured boolean not null default false,
  is_new boolean not null default false,
  on_sale boolean not null default false,
  allow_reseller boolean not null default true,
  reseller_only boolean not null default false,
  business_only boolean not null default false,
  digital_delivery boolean not null default false,

  rating_avg numeric(3,2) not null default 0,
  rating_count integer not null default 0,
  sales_count integer not null default 0,
  view_count integer not null default 0,

  seo_title text,
  seo_description text,
  is_demo boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_category_idx on store.products(category_id);
create index if not exists products_active_idx on store.products(active, featured);
create index if not exists products_slug_idx on store.products(slug);
-- array_to_string é declarada STABLE (por causa da assinatura genérica
-- anyarray), o que a proíbe em expressões de índice. Para text[] o resultado é
-- de fato imutável, então usamos este envelope restrito a text[].
create or replace function store.text_array_to_string(value text[])
returns text
language sql
immutable
as $$
  select coalesce(array_to_string(value, ' '), '');
$$;

create index if not exists products_search_idx on store.products
  using gin (to_tsvector('portuguese',
    coalesce(name,'') || ' ' || coalesce(short_description,'') || ' ' ||
    coalesce(description,'') || ' ' || coalesce(sku,'') || ' ' ||
    store.text_array_to_string(tags) || ' ' || store.text_array_to_string(materials) || ' ' ||
    store.text_array_to_string(applications)));

drop trigger if exists products_updated_at on store.products;
create trigger products_updated_at before update on store.products
  for each row execute function store.set_updated_at();

-- Custo interno da Nexus Printi. Fica em tabela separada para que nenhuma
-- consulta de cliente, revendedor ou vendedor possa lê-lo: o RLS desta tabela
-- libera apenas administradores.
create table if not exists store.product_costs (
  product_id uuid primary key references store.products(id) on delete cascade,
  cost_price numeric(12,2) not null default 0,
  supplier_cost numeric(12,2) not null default 0,
  notes text,
  updated_by uuid references store.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

drop trigger if exists product_costs_updated_at on store.product_costs;
create trigger product_costs_updated_at before update on store.product_costs
  for each row execute function store.set_updated_at();

create table if not exists store.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references store.products(id) on delete cascade,
  url text not null,
  alt text,
  kind text not null default 'foto' check (kind in ('foto', 'mockup', 'video', 'gabarito')),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists product_images_product_idx on store.product_images(product_id, position);

-- Grupos de opções configuráveis (Material, Acabamento, Cores, Orientação...).
create table if not exists store.product_option_groups (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references store.products(id) on delete cascade,
  key text not null,
  name text not null,
  input_type text not null default 'select'
    check (input_type in ('select', 'radio', 'checkbox', 'dimensao', 'texto')),
  required boolean not null default true,
  multiple boolean not null default false,
  help_text text,
  position integer not null default 0,
  unique (product_id, key)
);

create index if not exists product_option_groups_product_idx on store.product_option_groups(product_id, position);

create table if not exists store.product_options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references store.product_option_groups(id) on delete cascade,
  label text not null,
  value text not null,
  description text,
  -- Como o valor afeta o preço final
  modifier_type text not null default 'fixo'
    check (modifier_type in ('fixo', 'percentual', 'por_unidade', 'por_m2', 'multiplicador')),
  modifier_value numeric(12,4) not null default 0,
  production_days_delta integer not null default 0,
  image_url text,
  position integer not null default 0,
  active boolean not null default true,
  default_selected boolean not null default false
);

create index if not exists product_options_group_idx on store.product_options(group_id, position);

-- Faixas de quantidade com preço progressivo.
create table if not exists store.product_price_tiers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references store.products(id) on delete cascade,
  min_qty integer not null,
  max_qty integer,
  unit_price numeric(12,4) not null,
  reseller_unit_price numeric(12,4),
  position integer not null default 0
);

create index if not exists product_price_tiers_product_idx on store.product_price_tiers(product_id, min_qty);

create table if not exists store.product_faqs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references store.products(id) on delete cascade,
  question text not null,
  answer text not null,
  position integer not null default 0
);

create table if not exists store.related_products (
  product_id uuid not null references store.products(id) on delete cascade,
  related_id uuid not null references store.products(id) on delete cascade,
  position integer not null default 0,
  primary key (product_id, related_id)
);

create table if not exists store.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references store.products(id) on delete cascade,
  profile_id uuid references store.profiles(id) on delete set null,
  order_id uuid,
  author_name text not null,
  rating integer not null check (rating between 1 and 5),
  service_rating integer check (service_rating between 1 and 5),
  title text,
  comment text,
  approved boolean not null default false,
  reply text,
  replied_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists product_reviews_product_idx on store.product_reviews(product_id, approved);

-- Regras de preço criadas pelo administrador, sem alterar código.
create table if not exists store.price_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  scope text not null default 'global' check (scope in ('global', 'categoria', 'produto')),
  category_id uuid references store.categories(id) on delete cascade,
  product_id uuid references store.products(id) on delete cascade,
  -- Condições: {"min_qty":500,"payment_method":"pix","urgency":true,"roles":["revendedor"],"shipping_method":"retirada"}
  conditions jsonb not null default '{}'::jsonb,
  adjustment_type text not null default 'percentual'
    check (adjustment_type in ('percentual', 'valor_fixo', 'preco_final')),
  adjustment_value numeric(12,4) not null default 0,
  applies_to text not null default 'total' check (applies_to in ('total', 'unitario')),
  priority integer not null default 0,
  stackable boolean not null default true,
  active boolean not null default true,
  valid_from timestamptz,
  valid_to timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists price_rules_active_idx on store.price_rules(active, priority);

drop trigger if exists price_rules_updated_at on store.price_rules;
create trigger price_rules_updated_at before update on store.price_rules
  for each row execute function store.set_updated_at();

create table if not exists store.favorites (
  profile_id uuid not null references store.profiles(id) on delete cascade,
  product_id uuid not null references store.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, product_id)
);

-- =============================================================================
-- FRETE E ENTREGA
-- =============================================================================

create table if not exists store.shipping_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  method text not null check (method in
    ('retirada','motoboy','transportadora','correios','melhor_envio','entrega_propria','frete_combinado','digital')),
  cep_start text,
  cep_end text,
  price numeric(10,2) not null default 0,
  price_per_kg numeric(10,2) not null default 0,
  free_above numeric(12,2),
  min_order numeric(12,2) not null default 0,
  delivery_days integer not null default 3,
  active boolean not null default true,
  position integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shipping_zones_active_idx on store.shipping_zones(active, position);

drop trigger if exists shipping_zones_updated_at on store.shipping_zones;
create trigger shipping_zones_updated_at before update on store.shipping_zones
  for each row execute function store.set_updated_at();

create table if not exists store.product_shipping_rules (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references store.products(id) on delete cascade,
  method text not null,
  extra_cost numeric(10,2) not null default 0,
  extra_days integer not null default 0,
  blocked boolean not null default false
);

-- =============================================================================
-- CARRINHO
-- =============================================================================

create table if not exists store.carts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references store.profiles(id) on delete cascade,
  session_token text unique,
  share_token text unique,
  coupon_code text,
  notes text,
  shipping_method text,
  shipping_cep text,
  shipping_cost numeric(10,2) not null default 0,
  shipping_days integer,
  converted_order_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists carts_profile_idx on store.carts(profile_id);

drop trigger if exists carts_updated_at on store.carts;
create trigger carts_updated_at before update on store.carts
  for each row execute function store.set_updated_at();

create table if not exists store.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references store.carts(id) on delete cascade,
  product_id uuid not null references store.products(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric(12,4) not null default 0,
  total_price numeric(12,2) not null default 0,
  -- Configuração escolhida: {"material":{"label":"Couché 300g","value":"couche300"}, "largura":9, "altura":5, ...}
  options jsonb not null default '{}'::jsonb,
  price_breakdown jsonb not null default '[]'::jsonb,
  production_days integer not null default 3,
  art_flow text,
  notes text,
  saved_for_later boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cart_items_cart_idx on store.cart_items(cart_id);

drop trigger if exists cart_items_updated_at on store.cart_items;
create trigger cart_items_updated_at before update on store.cart_items
  for each row execute function store.set_updated_at();

-- =============================================================================
-- PEDIDOS
-- =============================================================================

create table if not exists store.orders (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  customer_id uuid references store.customers(id) on delete set null,
  profile_id uuid references store.profiles(id) on delete set null,
  reseller_id uuid references store.profiles(id) on delete set null,
  seller_id uuid references store.profiles(id) on delete set null,
  created_by uuid references store.profiles(id) on delete set null,

  status text not null default 'pedido_recebido' check (status in (
    'pedido_recebido','aguardando_pagamento','pagamento_analise','pago','aguardando_arquivos',
    'arte_analise','arte_criacao','aguardando_aprovacao','alteracao_solicitada','aprovado_producao',
    'em_producao','acabamento','controle_qualidade','embalagem','pronto_retirada','enviado',
    'entregue','concluido','cancelado')),
  payment_status text not null default 'pendente'
    check (payment_status in ('pendente','processando','pago','recusado','estornado','cancelado')),
  payment_method text check (payment_method in
    ('pix','cartao_credito','boleto','link_pagamento','credito_interno','combinado','aprovado_manual')),
  installments integer not null default 1,

  subtotal numeric(12,2) not null default 0,
  discount_total numeric(12,2) not null default 0,
  coupon_code text,
  coupon_discount numeric(12,2) not null default 0,
  shipping_cost numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  credit_used numeric(12,2) not null default 0,

  shipping_method text,
  shipping_address jsonb,
  billing jsonb,                                       -- dados de nota fiscal
  tracking_code text,
  estimated_delivery date,
  delivered_at timestamptz,

  art_flow text,
  priority text not null default 'normal' check (priority in ('baixa','normal','alta','urgente')),
  is_rush boolean not null default false,
  notes text,                                          -- observações do cliente
  internal_notes text,                                 -- somente equipe
  source text not null default 'loja' check (source in ('loja','painel','vendedor','revendedor','orcamento','whatsapp')),
  quote_id uuid,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_profile_idx on store.orders(profile_id);
create index if not exists orders_customer_idx on store.orders(customer_id);
create index if not exists orders_reseller_idx on store.orders(reseller_id);
create index if not exists orders_seller_idx on store.orders(seller_id);
create index if not exists orders_status_idx on store.orders(status);
create index if not exists orders_created_idx on store.orders(created_at desc);
create index if not exists orders_number_idx on store.orders(number);

drop trigger if exists orders_updated_at on store.orders;
create trigger orders_updated_at before update on store.orders
  for each row execute function store.set_updated_at();

create table if not exists store.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references store.orders(id) on delete cascade,
  product_id uuid references store.products(id) on delete set null,
  product_name text not null,
  product_slug text,
  sku text,
  quantity integer not null default 1,
  unit_price numeric(12,4) not null default 0,
  total_price numeric(12,2) not null default 0,
  -- Preço de tabela antes da margem do revendedor. Não é o custo interno da
  -- Nexus Printi (esse fica em product_costs, visível apenas ao administrador).
  base_price numeric(12,4) not null default 0,
  options jsonb not null default '{}'::jsonb,
  price_breakdown jsonb not null default '[]'::jsonb,
  production_days integer not null default 3,
  art_flow text,
  art_status text not null default 'pendente'
    check (art_status in ('pendente','em_analise','aguardando_aprovacao','aprovada','reprovada','alteracao_solicitada')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists order_items_order_idx on store.order_items(order_id);
create index if not exists order_items_product_idx on store.order_items(product_id);

drop trigger if exists order_items_updated_at on store.order_items;
create trigger order_items_updated_at before update on store.order_items
  for each row execute function store.set_updated_at();

create table if not exists store.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references store.orders(id) on delete cascade,
  from_status text,
  to_status text not null,
  note text,
  changed_by uuid references store.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists order_status_history_order_idx on store.order_status_history(order_id, created_at desc);

create table if not exists store.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references store.orders(id) on delete cascade,
  method text not null,
  status text not null default 'pendente'
    check (status in ('pendente','processando','pago','recusado','estornado','cancelado')),
  amount numeric(12,2) not null,
  installments integer not null default 1,
  gateway text,
  gateway_payment_id text,
  payment_link text,
  qr_code text,
  barcode text,
  due_date date,
  paid_at timestamptz,
  raw jsonb,
  note text,
  created_by uuid references store.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payments_order_idx on store.payments(order_id);

drop trigger if exists payments_updated_at on store.payments;
create trigger payments_updated_at before update on store.payments
  for each row execute function store.set_updated_at();

create table if not exists store.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references store.orders(id) on delete cascade,
  method text not null,
  carrier text,
  tracking_code text,
  tracking_url text,
  cost numeric(10,2) not null default 0,
  estimated_days integer,
  shipped_at timestamptz,
  delivered_at timestamptz,
  received_by text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists shipments_order_idx on store.shipments(order_id);

-- =============================================================================
-- ORÇAMENTOS
-- =============================================================================

create table if not exists store.quotes (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  customer_id uuid references store.customers(id) on delete set null,
  profile_id uuid references store.profiles(id) on delete set null,
  reseller_id uuid references store.profiles(id) on delete set null,
  seller_id uuid references store.profiles(id) on delete set null,
  created_by uuid references store.profiles(id) on delete set null,

  status text not null default 'rascunho' check (status in
    ('rascunho','enviado','visualizado','em_negociacao','aprovado','recusado','expirado','convertido')),
  title text,
  subtotal numeric(12,2) not null default 0,
  discount_type text default 'percentual' check (discount_type in ('percentual','valor_fixo')),
  discount_value numeric(12,2) not null default 0,
  discount_total numeric(12,2) not null default 0,
  shipping_cost numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,

  -- Margem aplicada pelo revendedor sobre o preço de revenda
  margin_type text default 'percentual' check (margin_type in ('percentual','valor_fixo')),
  margin_value numeric(12,2) not null default 0,
  hide_cost boolean not null default true,

  payment_terms text,
  shipping_method text,
  delivery_days integer,
  notes text,
  internal_notes text,
  valid_until date,
  public_token text unique,
  viewed_at timestamptz,
  responded_at timestamptz,
  converted_order_id uuid references store.orders(id) on delete set null,
  contact_name text,
  contact_email text,
  contact_phone text,
  source text not null default 'painel',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quotes_profile_idx on store.quotes(profile_id);
create index if not exists quotes_customer_idx on store.quotes(customer_id);
create index if not exists quotes_reseller_idx on store.quotes(reseller_id);
create index if not exists quotes_seller_idx on store.quotes(seller_id);
create index if not exists quotes_status_idx on store.quotes(status);

drop trigger if exists quotes_updated_at on store.quotes;
create trigger quotes_updated_at before update on store.quotes
  for each row execute function store.set_updated_at();

alter table store.orders
  drop constraint if exists orders_quote_fk;
alter table store.orders
  add constraint orders_quote_fk foreign key (quote_id) references store.quotes(id) on delete set null;

create table if not exists store.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references store.quotes(id) on delete cascade,
  product_id uuid references store.products(id) on delete set null,
  description text not null,
  detail text,
  quantity integer not null default 1,
  unit_price numeric(12,4) not null default 0,       -- já com a margem do revendedor
  total_price numeric(12,2) not null default 0,
  base_price numeric(12,4) not null default 0,       -- preço de tabela, antes da margem
  options jsonb not null default '{}'::jsonb,
  production_days integer,
  position integer not null default 0
);

create index if not exists quote_items_quote_idx on store.quote_items(quote_id, position);

create table if not exists store.quote_history (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references store.quotes(id) on delete cascade,
  action text not null,
  note text,
  actor_id uuid references store.profiles(id) on delete set null,
  actor_label text,
  created_at timestamptz not null default now()
);

create index if not exists quote_history_quote_idx on store.quote_history(quote_id, created_at desc);

-- =============================================================================
-- ARQUIVOS E APROVAÇÃO DE ARTE
-- =============================================================================

create table if not exists store.art_files (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references store.orders(id) on delete cascade,
  order_item_id uuid references store.order_items(id) on delete cascade,
  quote_id uuid references store.quotes(id) on delete cascade,
  profile_id uuid references store.profiles(id) on delete set null,
  customer_id uuid references store.customers(id) on delete set null,
  file_name text not null,
  storage_path text not null,
  file_size bigint not null default 0,
  mime_type text,
  extension text,
  kind text not null default 'arte' check (kind in ('arte','referencia','prova','final','gabarito','anexo')),
  version integer not null default 1,
  status text not null default 'pendente'
    check (status in ('pendente','em_analise','aguardando_aprovacao','aprovada','reprovada','alteracao_solicitada')),
  analysis_note text,
  uploaded_by uuid references store.profiles(id) on delete set null,
  is_current boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists art_files_order_idx on store.art_files(order_id);
create index if not exists art_files_item_idx on store.art_files(order_item_id, version desc);
create index if not exists art_files_profile_idx on store.art_files(profile_id);

create table if not exists store.art_approvals (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references store.orders(id) on delete cascade,
  order_item_id uuid references store.order_items(id) on delete cascade,
  art_file_id uuid references store.art_files(id) on delete set null,
  status text not null check (status in ('aprovada','reprovada','alteracao_solicitada')),
  comment text,
  version integer not null default 1,
  decided_by uuid references store.profiles(id) on delete set null,
  decided_by_name text,
  created_at timestamptz not null default now()
);

create index if not exists art_approvals_order_idx on store.art_approvals(order_id, created_at desc);

-- =============================================================================
-- PRODUÇÃO
-- =============================================================================

create table if not exists store.production_orders (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  order_id uuid not null references store.orders(id) on delete cascade,
  order_item_id uuid references store.order_items(id) on delete cascade,
  stage text not null default 'fila_entrada' check (stage in
    ('fila_entrada','conferencia','pre_impressao','impressao','recorte','acabamento',
     'montagem','controle_qualidade','embalagem','finalizado')),
  priority text not null default 'normal' check (priority in ('baixa','normal','alta','urgente')),
  assigned_to uuid references store.profiles(id) on delete set null,
  product_name text not null,
  quantity integer not null default 1,
  material text,
  measure text,
  finishing text,
  due_date date,
  started_at timestamptz,
  finished_at timestamptz,
  estimated_minutes integer not null default 60,
  actual_minutes integer,
  checklist jsonb not null default '[]'::jsonb,
  notes text,
  position integer not null default 0,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists production_orders_stage_idx on store.production_orders(stage, position);
create index if not exists production_orders_order_idx on store.production_orders(order_id);

drop trigger if exists production_orders_updated_at on store.production_orders;
create trigger production_orders_updated_at before update on store.production_orders
  for each row execute function store.set_updated_at();

create table if not exists store.production_stage_history (
  id uuid primary key default gen_random_uuid(),
  production_order_id uuid not null references store.production_orders(id) on delete cascade,
  from_stage text,
  to_stage text not null,
  changed_by uuid references store.profiles(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

-- =============================================================================
-- ESTOQUE
-- =============================================================================

create table if not exists store.stock_items (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  kind text not null default 'materia_prima'
    check (kind in ('materia_prima','produto_pronto','embalagem','insumo')),
  unit text not null default 'un',
  quantity numeric(12,3) not null default 0,
  min_quantity numeric(12,3) not null default 0,
  avg_cost numeric(12,4) not null default 0,
  supplier text,
  location text,
  notes text,
  active boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stock_items_kind_idx on store.stock_items(kind, active);

drop trigger if exists stock_items_updated_at on store.stock_items;
create trigger stock_items_updated_at before update on store.stock_items
  for each row execute function store.set_updated_at();

create table if not exists store.stock_movements (
  id uuid primary key default gen_random_uuid(),
  stock_item_id uuid not null references store.stock_items(id) on delete cascade,
  type text not null check (type in ('entrada','saida','ajuste','consumo_producao','inventario')),
  quantity numeric(12,3) not null,
  unit_cost numeric(12,4),
  balance_after numeric(12,3),
  reference text,
  order_id uuid references store.orders(id) on delete set null,
  production_order_id uuid references store.production_orders(id) on delete set null,
  note text,
  created_by uuid references store.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists stock_movements_item_idx on store.stock_movements(stock_item_id, created_at desc);

-- Consumo de material por produto.
create table if not exists store.product_materials (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references store.products(id) on delete cascade,
  stock_item_id uuid not null references store.stock_items(id) on delete cascade,
  quantity_per_unit numeric(12,4) not null default 0,
  unique (product_id, stock_item_id)
);

-- =============================================================================
-- FINANCEIRO
-- =============================================================================

create table if not exists store.finance_entries (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('receber','pagar')),
  description text not null,
  category text,
  amount numeric(12,2) not null,
  due_date date not null,
  paid_at timestamptz,
  status text not null default 'aberto' check (status in ('aberto','pago','atrasado','cancelado')),
  order_id uuid references store.orders(id) on delete set null,
  customer_id uuid references store.customers(id) on delete set null,
  supplier text,
  payment_method text,
  document_number text,
  notes text,
  created_by uuid references store.profiles(id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists finance_entries_status_idx on store.finance_entries(type, status, due_date);

drop trigger if exists finance_entries_updated_at on store.finance_entries;
create trigger finance_entries_updated_at before update on store.finance_entries
  for each row execute function store.set_updated_at();

create table if not exists store.commissions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references store.orders(id) on delete cascade,
  profile_id uuid not null references store.profiles(id) on delete cascade,
  role text not null check (role in ('vendedor','revendedor')),
  base_amount numeric(12,2) not null default 0,
  percentage numeric(5,2) not null default 0,
  amount numeric(12,2) not null default 0,
  status text not null default 'previsto' check (status in ('previsto','aprovado','pago','cancelado')),
  paid_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists commissions_profile_idx on store.commissions(profile_id, status);

drop trigger if exists commissions_updated_at on store.commissions;
create trigger commissions_updated_at before update on store.commissions
  for each row execute function store.set_updated_at();

create table if not exists store.credits (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references store.profiles(id) on delete cascade,
  type text not null check (type in ('credito','debito','cashback','estorno')),
  amount numeric(12,2) not null,
  balance_after numeric(12,2) not null default 0,
  reason text not null,
  order_id uuid references store.orders(id) on delete set null,
  expires_at date,
  created_by uuid references store.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists credits_profile_idx on store.credits(profile_id, created_at desc);

-- =============================================================================
-- MARKETING
-- =============================================================================

create table if not exists store.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  discount_type text not null default 'percentual' check (discount_type in ('percentual','valor_fixo','frete_gratis')),
  discount_value numeric(12,2) not null default 0,
  min_order numeric(12,2) not null default 0,
  max_discount numeric(12,2),
  usage_limit integer,
  used_count integer not null default 0,
  per_customer_limit integer not null default 1,
  applies_to_role text check (applies_to_role in ('cliente','revendedor','vendedor','admin')),
  category_id uuid references store.categories(id) on delete cascade,
  product_id uuid references store.products(id) on delete cascade,
  first_purchase_only boolean not null default false,
  valid_from timestamptz,
  valid_to timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists coupons_updated_at on store.coupons;
create trigger coupons_updated_at before update on store.coupons
  for each row execute function store.set_updated_at();

create table if not exists store.coupon_uses (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references store.coupons(id) on delete cascade,
  order_id uuid references store.orders(id) on delete cascade,
  profile_id uuid references store.profiles(id) on delete set null,
  discount_amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists store.banners (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  description text,
  image_url text,
  mobile_image_url text,
  link_url text,
  cta_label text,
  secondary_cta_label text,
  secondary_link_url text,
  placement text not null default 'home_hero'
    check (placement in ('home_hero','home_secundario','categoria','revenda','popup','topbar')),
  theme text not null default 'menta' check (theme in ('menta','escuro','claro')),
  position integer not null default 0,
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists banners_placement_idx on store.banners(placement, active, position);

drop trigger if exists banners_updated_at on store.banners;
create trigger banners_updated_at before update on store.banners
  for each row execute function store.set_updated_at();

create table if not exists store.testimonials (
  id uuid primary key default gen_random_uuid(),
  author_name text not null,
  author_role text,
  company text,
  content text not null,
  rating integer not null default 5 check (rating between 1 and 5),
  avatar_url text,
  position integer not null default 0,
  active boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists store.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category_id uuid references store.categories(id) on delete set null,
  image_url text,
  client_name text,
  position integer not null default 0,
  active boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists store.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  source text default 'rodape',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists store.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references store.profiles(id) on delete cascade,
  code text not null unique,
  referred_email text,
  referred_profile_id uuid references store.profiles(id) on delete set null,
  status text not null default 'pendente' check (status in ('pendente','cadastrado','convertido','expirado')),
  reward_amount numeric(12,2) not null default 0,
  rewarded_at timestamptz,
  created_at timestamptz not null default now()
);

-- =============================================================================
-- ATENDIMENTO E MENSAGENS
-- =============================================================================

create table if not exists store.tickets (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  profile_id uuid references store.profiles(id) on delete set null,
  customer_id uuid references store.customers(id) on delete set null,
  order_id uuid references store.orders(id) on delete set null,
  subject text not null,
  category text not null default 'duvida',
  priority text not null default 'normal' check (priority in ('baixa','normal','alta','urgente')),
  status text not null default 'aberto'
    check (status in ('aberto','em_atendimento','aguardando_cliente','resolvido','fechado')),
  assigned_to uuid references store.profiles(id) on delete set null,
  resolved_at timestamptz,
  rating integer check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tickets_profile_idx on store.tickets(profile_id, status);
create index if not exists tickets_assigned_idx on store.tickets(assigned_to, status);

drop trigger if exists tickets_updated_at on store.tickets;
create trigger tickets_updated_at before update on store.tickets
  for each row execute function store.set_updated_at();

create table if not exists store.messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references store.tickets(id) on delete cascade,
  order_id uuid references store.orders(id) on delete cascade,
  order_item_id uuid references store.order_items(id) on delete cascade,
  quote_id uuid references store.quotes(id) on delete cascade,
  author_id uuid references store.profiles(id) on delete set null,
  author_name text,
  author_role text,
  body text not null,
  attachment_path text,
  attachment_name text,
  internal boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint messages_context_check check (
    ticket_id is not null or order_id is not null or quote_id is not null
  )
);

create index if not exists messages_ticket_idx on store.messages(ticket_id, created_at);
create index if not exists messages_order_idx on store.messages(order_id, created_at);
create index if not exists messages_item_idx on store.messages(order_item_id, created_at);

create table if not exists store.quick_replies (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  category text,
  position integer not null default 0,
  active boolean not null default true
);

-- =============================================================================
-- CRM — OPORTUNIDADES
-- =============================================================================

create table if not exists store.opportunities (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references store.customers(id) on delete cascade,
  seller_id uuid references store.profiles(id) on delete set null,
  title text not null,
  contact_name text,
  company_name text,
  phone text,
  email text,
  stage text not null default 'novo_lead' check (stage in
    ('novo_lead','primeiro_contato','levantamento','orcamento_enviado','negociacao',
     'aguardando_pagamento','venda_concluida','perdido','pos_venda')),
  source text not null default 'site',
  product_interest text,
  estimated_value numeric(12,2) not null default 0,
  probability integer not null default 50 check (probability between 0 and 100),
  next_action text,
  next_contact_at timestamptz,
  notes text,
  lost_reason text,
  quote_id uuid references store.quotes(id) on delete set null,
  order_id uuid references store.orders(id) on delete set null,
  position integer not null default 0,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists opportunities_seller_idx on store.opportunities(seller_id, stage);
create index if not exists opportunities_stage_idx on store.opportunities(stage, position);

drop trigger if exists opportunities_updated_at on store.opportunities;
create trigger opportunities_updated_at before update on store.opportunities
  for each row execute function store.set_updated_at();

create table if not exists store.opportunity_activities (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references store.opportunities(id) on delete cascade,
  type text not null default 'nota' check (type in ('nota','ligacao','whatsapp','email','reuniao','tarefa','mudanca_etapa')),
  description text not null,
  due_at timestamptz,
  done boolean not null default false,
  done_at timestamptz,
  created_by uuid references store.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists opportunity_activities_opp_idx on store.opportunity_activities(opportunity_id, created_at desc);
create index if not exists opportunity_activities_due_idx on store.opportunity_activities(due_at) where done = false;

-- Solicitações de desconto acima do limite do vendedor.
create table if not exists store.discount_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references store.profiles(id) on delete cascade,
  order_id uuid references store.orders(id) on delete cascade,
  quote_id uuid references store.quotes(id) on delete cascade,
  requested_pct numeric(5,2) not null,
  reason text,
  status text not null default 'pendente' check (status in ('pendente','aprovado','recusado')),
  reviewed_by uuid references store.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);

-- Solicitações de limite de crédito do revendedor.
create table if not exists store.credit_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references store.profiles(id) on delete cascade,
  requested_limit numeric(12,2) not null,
  reason text,
  status text not null default 'pendente' check (status in ('pendente','aprovado','recusado')),
  reviewed_by uuid references store.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);

-- =============================================================================
-- SISTEMA — NOTIFICAÇÕES, LOGS, CONFIGURAÇÕES, CONTEÚDO
-- =============================================================================

create table if not exists store.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references store.profiles(id) on delete cascade,
  event text not null,
  title text not null,
  body text,
  link text,
  channel text not null default 'interno' check (channel in ('interno','email','whatsapp','push','sms')),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_profile_idx on store.notifications(profile_id, read_at, created_at desc);

create table if not exists store.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references store.profiles(id) on delete set null,
  actor_name text,
  action text not null,
  entity text,
  entity_id text,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  ip text,
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_created_idx on store.activity_logs(created_at desc);
create index if not exists activity_logs_entity_idx on store.activity_logs(entity, entity_id);

create table if not exists store.settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  group_name text not null default 'geral',
  label text,
  description text,
  updated_by uuid references store.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists store.pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  subtitle text,
  content text not null default '',
  seo_title text,
  seo_description text,
  active boolean not null default true,
  position integer not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

drop trigger if exists pages_updated_at on store.pages;
create trigger pages_updated_at before update on store.pages
  for each row execute function store.set_updated_at();

create table if not exists store.faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  category text default 'geral',
  position integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Modelos de pedido recorrente (revendedor/cliente).
create table if not exists store.order_templates (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references store.profiles(id) on delete cascade,
  name text not null,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Materiais comerciais para revendedores.
create table if not exists store.marketing_assets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  storage_path text not null,
  file_type text,
  file_size bigint,
  category text default 'geral',
  whitelabel boolean not null default false,
  active boolean not null default true,
  download_count integer not null default 0,
  created_at timestamptz not null default now()
);
-- =============================================================================
-- INTEGRAÇÃO EM TEMPO REAL: STORE <-> PUBLIC (CRM)
-- =============================================================================

-- Sincronizar store.customers -> public.clients
CREATE OR REPLACE FUNCTION store.sync_customer_to_client()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.clients (id, name, company_name, document, email, whatsapp, client_type, status, notes)
    VALUES (NEW.id, NEW.name, NEW.company_name, NEW.document, NEW.email, NEW.phone, NEW.customer_type, 'novo', NEW.notes)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      company_name = EXCLUDED.company_name,
      document = EXCLUDED.document,
      email = EXCLUDED.email,
      whatsapp = EXCLUDED.whatsapp,
      client_type = EXCLUDED.client_type,
      notes = EXCLUDED.notes;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.clients SET
      name = NEW.name,
      company_name = NEW.company_name,
      document = NEW.document,
      email = NEW.email,
      whatsapp = NEW.phone,
      client_type = NEW.customer_type,
      notes = NEW.notes
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_sync_customer_to_client
AFTER INSERT OR UPDATE ON store.customers
FOR EACH ROW EXECUTE FUNCTION store.sync_customer_to_client();

-- Sincronizar public.clients -> store.customers
CREATE OR REPLACE FUNCTION public.sync_client_to_store_customer()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    UPDATE store.customers SET
      name = NEW.name,
      company_name = NEW.company_name,
      document = NEW.document,
      email = NEW.email,
      phone = NEW.whatsapp,
      customer_type = NEW.client_type,
      notes = NEW.notes
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_sync_client_to_store_customer
AFTER UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.sync_client_to_store_customer();

-- Sincronizar store.orders -> public.orders
CREATE OR REPLACE FUNCTION store.sync_order_to_crm()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.orders (id, client_id, order_number, total_value, financial_status, production_status, notes)
    VALUES (NEW.id, NEW.customer_id, NEW.number, NEW.total, NEW.payment_status, 'pedido_criado', NEW.notes)
    ON CONFLICT (id) DO UPDATE SET
      client_id = EXCLUDED.client_id,
      order_number = EXCLUDED.order_number,
      total_value = EXCLUDED.total_value,
      financial_status = EXCLUDED.financial_status,
      notes = EXCLUDED.notes;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.orders SET
      client_id = NEW.customer_id,
      order_number = NEW.number,
      total_value = NEW.total,
      financial_status = NEW.payment_status,
      notes = NEW.notes
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_sync_order_to_crm
AFTER INSERT OR UPDATE ON store.orders
FOR EACH ROW EXECUTE FUNCTION store.sync_order_to_crm();
-- =============================================================================
-- LIMPEZA DA INTEGRAÇÃO ANTIGA NO CRM
-- =============================================================================

DROP TRIGGER IF EXISTS clients_nexus_sync ON public.clients;
DROP TRIGGER IF EXISTS leads_nexus_sync ON public.leads;
DROP TRIGGER IF EXISTS quotes_nexus_sync ON public.quotes;
DROP TRIGGER IF EXISTS orders_nexus_sync ON public.orders;

DROP FUNCTION IF EXISTS public.enqueue_nexus_event;
DROP FUNCTION IF EXISTS public.purge_nexus_outbox;
DROP TABLE IF EXISTS public.nexus_outbox;
