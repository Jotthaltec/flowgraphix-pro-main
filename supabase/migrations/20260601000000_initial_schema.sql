-- Etapa 4: Schema Inicial do PrintFlow CRM V1

-- Tabelas core
create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cnpj text,
  phone text,
  whatsapp text,
  email text,
  address text,
  city text,
  state text,
  logo_url text,
  bank_info text,
  contract_terms text,
  created_at timestamptz default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid references companies(id) on delete cascade,
  full_name text not null,
  email text not null,
  role text default 'admin',
  avatar_url text,
  created_at timestamptz default now()
);

-- Domínio
create table clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  name text not null,
  company_name text,
  document text,
  whatsapp text,
  email text,
  address text,
  city text,
  state text,
  instagram text,
  client_type text default 'pessoa_fisica',
  status text default 'novo',
  notes text,
  last_purchase_at timestamptz,
  total_spent numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table leads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  name text not null,
  category text,
  address text,
  phone text,
  website text,
  rating numeric,
  reviews_count integer,
  google_maps_url text,
  place_id text,
  city text,
  neighborhood text,
  status text default 'novo',
  notes text,
  converted_client_id uuid references clients(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  name text not null,
  category text not null,
  description text,
  unit text,
  base_cost numeric default 0,
  min_price numeric default 0,
  suggested_price numeric default 0,
  desired_margin numeric default 0,
  production_time_minutes integer,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table quotes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  client_id uuid references clients(id),
  quote_number text not null,
  service_name text,
  quantity numeric default 1,
  width numeric,
  height numeric,
  material text,
  finishing text,
  deadline date,
  notes text,
  cost_value numeric default 0,
  sale_value numeric default 0,
  discount_value numeric default 0,
  final_value numeric default 0,
  estimated_profit numeric default 0,
  margin_percent numeric default 0,
  status text default 'rascunho',
  valid_until date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table contracts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  client_id uuid references clients(id),
  quote_id uuid references quotes(id),
  contract_number text not null,
  service_description text,
  quantity numeric,
  total_value numeric default 0,
  upfront_value numeric default 0,
  payment_method text,
  delivery_date date,
  production_deadline text,
  change_terms text,
  art_approval_terms text,
  general_terms text,
  client_signature text,
  signed_at timestamptz,
  status text default 'rascunho',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  client_id uuid references clients(id),
  quote_id uuid references quotes(id),
  contract_id uuid references contracts(id),
  order_number text not null,
  product_name text,
  quantity numeric default 1,
  total_value numeric default 0,
  cost_value numeric default 0,
  profit_value numeric default 0,
  financial_status text default 'nao_pago',
  production_status text default 'pedido_criado',
  deadline date,
  priority text default 'normal',
  machine text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  order_id uuid references orders(id) on delete cascade,
  client_id uuid references clients(id),
  total_value numeric default 0,
  paid_value numeric default 0,
  pending_value numeric default 0,
  payment_method text,
  status text default 'nao_pago',
  due_date date,
  paid_at timestamptz,
  notes text,
  created_at timestamptz default now()
);

create table production_tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  order_id uuid references orders(id) on delete cascade,
  title text not null,
  sector text,
  status text default 'pendente',
  priority text default 'normal',
  assigned_to uuid references profiles(id),
  deadline date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table files (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  client_id uuid references clients(id),
  order_id uuid references orders(id),
  quote_id uuid references quotes(id),
  contract_id uuid references contracts(id),
  file_name text not null,
  file_type text,
  file_url text not null,
  status text default 'recebido',
  uploaded_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table activity_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  user_id uuid references profiles(id),
  entity_type text,
  entity_id uuid,
  action text not null,
  description text,
  created_at timestamptz default now()
);

create table message_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  title text not null,
  category text,
  content text not null,
  active boolean default true,
  created_at timestamptz default now()
);
