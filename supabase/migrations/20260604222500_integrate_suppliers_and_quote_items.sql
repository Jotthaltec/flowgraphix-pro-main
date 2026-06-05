-- Alterações na tabela products para unificação dos produtos e fornecedores
alter table public.products add column if not exists commercial_name text;
alter table public.products add column if not exists type text default 'product';
alter table public.products add column if not exists origin text default 'manual';
alter table public.products add column if not exists supplier_name text;
alter table public.products add column if not exists internal_sku text;
alter table public.products add column if not exists technical_description text;
alter table public.products add column if not exists image_url text;
alter table public.products add column if not exists minimum_quantity integer default 1;
alter table public.products add column if not exists quantity_price_table jsonb default '[]'::jsonb;
alter table public.products add column if not exists production_deadline text;

-- Restrições de tipo e origem na tabela products
alter table public.products drop constraint if exists products_type_check;
alter table public.products add constraint products_type_check check (type in ('product', 'service'));

alter table public.products drop constraint if exists products_origin_check;
alter table public.products add constraint products_origin_check check (origin in ('manual', 'supplier_import'));

-- Criar tabela quote_items
create table if not exists public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  product_service_id uuid references public.products(id) on delete set null,
  item_name text not null,
  description text,
  quantity numeric not null default 1,
  unit_price numeric not null default 0,
  total_price numeric not null default 0,
  cost_price numeric not null default 0,
  margin_percent numeric not null default 0,
  supplier_id uuid references public.suppliers(id) on delete set null,
  source_origin text not null default 'manual',
  notes text,
  created_at timestamptz not null default now()
);

-- Ativar Row Level Security
alter table public.quote_items enable row level security;

-- Políticas de RLS para quote_items (usando user_owns_company para verificar o acesso à empresa dona do orçamento)
drop policy if exists "owner comp select" on public.quote_items;
create policy "owner comp select" on public.quote_items
  for select using (
    exists (
      select 1 from public.quotes q
      where q.id = quote_items.quote_id
        and user_owns_company(q.company_id)
    )
  );

drop policy if exists "owner comp insert" on public.quote_items;
create policy "owner comp insert" on public.quote_items
  for insert with check (
    exists (
      select 1 from public.quotes q
      where q.id = quote_items.quote_id
        and user_owns_company(q.company_id)
    )
  );

drop policy if exists "owner comp update" on public.quote_items;
create policy "owner comp update" on public.quote_items
  for update using (
    exists (
      select 1 from public.quotes q
      where q.id = quote_items.quote_id
        and user_owns_company(q.company_id)
    )
  );

drop policy if exists "owner comp delete" on public.quote_items;
create policy "owner comp delete" on public.quote_items
  for delete using (
    exists (
      select 1 from public.quotes q
      where q.id = quote_items.quote_id
        and user_owns_company(q.company_id)
    )
  );
