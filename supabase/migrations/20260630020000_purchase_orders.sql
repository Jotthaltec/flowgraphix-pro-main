-- ============================================================================
-- Fase 4 — Pedidos de compra ao fornecedor (purchase_orders).
-- A partir de um pedido do cliente (orders) + itens vinculados a fornecedor
-- (Fase 3: products.supplier_id), geramos um pedido de compra POR FORNECEDOR,
-- com snapshot do modo de recebimento e endereço (Fase 1/2). É a base da
-- compra assistida (Fase 5): cada item guarda source_url + variação escolhida.
-- ============================================================================

create table if not exists public.purchase_orders (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references public.companies(id) on delete cascade,
  supplier_id          uuid references public.suppliers(id) on delete set null,
  supplier_account_id  uuid references public.supplier_accounts(id) on delete set null,
  order_id             uuid references public.orders(id) on delete set null,
  quote_id             uuid references public.quotes(id) on delete set null,
  po_number            text not null,
  -- rascunho | pronto_para_compra | comprado | recebido | cancelado
  status               text not null default 'rascunho',
  -- delivery | pickup (herdado de supplier_accounts.receiving_mode ou companies.default_receiving_mode)
  receiving_mode       text,
  -- snapshot do destino no momento da geração (destinatário, cep, endereço, ponto de retirada...)
  delivery_snapshot    jsonb,
  total_cost           numeric not null default 0,
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table if not exists public.purchase_order_items (
  id                 uuid primary key default gen_random_uuid(),
  purchase_order_id  uuid not null references public.purchase_orders(id) on delete cascade,
  product_id         uuid references public.products(id) on delete set null,
  quote_item_id      uuid references public.quote_items(id) on delete set null,
  product_name       text not null,
  source_url         text,        -- link no fornecedor (compra assistida)
  supplier_sku       text,
  variant_selection  jsonb,       -- eixos de variação escolhidos
  quantity           integer not null default 1,
  unit_cost          numeric not null default 0,
  total_cost         numeric not null default 0,
  created_at         timestamptz not null default now()
);

create index if not exists idx_po_company  on public.purchase_orders (company_id);
create index if not exists idx_po_supplier on public.purchase_orders (supplier_id);
create index if not exists idx_po_order    on public.purchase_orders (order_id);
create index if not exists idx_poi_po      on public.purchase_order_items (purchase_order_id);

-- updated_at
drop trigger if exists trg_purchase_orders_updated on public.purchase_orders;
create trigger trg_purchase_orders_updated
  before update on public.purchase_orders
  for each row execute function update_updated_at_column();

-- ─── RLS ────────────────────────────────────────────────────────────────────
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;

drop policy if exists "po owner all" on public.purchase_orders;
create policy "po owner all"
  on public.purchase_orders for all
  using (user_owns_company(company_id))
  with check (user_owns_company(company_id));

-- Itens herdam a posse via pedido de compra pai.
drop policy if exists "poi owner all" on public.purchase_order_items;
create policy "poi owner all"
  on public.purchase_order_items for all
  using (exists (
    select 1 from public.purchase_orders po
     where po.id = purchase_order_id and user_owns_company(po.company_id)
  ))
  with check (exists (
    select 1 from public.purchase_orders po
     where po.id = purchase_order_id and user_owns_company(po.company_id)
  ));
