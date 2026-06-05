-- Adiciona coluna imported_from_supplier na tabela products
alter table public.products add column if not exists imported_from_supplier boolean default false;
alter table public.products add column if not exists import_status text default 'manual';
alter table public.products add column if not exists source_url text;
alter table public.products add column if not exists main_image_url text;
alter table public.products add column if not exists gallery_images jsonb default '[]'::jsonb;
alter table public.products add column if not exists specifications jsonb default '{}'::jsonb;
alter table public.products add column if not exists variations jsonb default '[]'::jsonb;
alter table public.products add column if not exists extra_services jsonb default '[]'::jsonb;
alter table public.products add column if not exists template_links jsonb default '[]'::jsonb;
alter table public.products add column if not exists quantity_prices jsonb default '[]'::jsonb;
alter table public.products add column if not exists marketplace_title text;
alter table public.products add column if not exists marketplace_description text;
alter table public.products add column if not exists supplier_sku text;
alter table public.products add column if not exists margin_percent numeric default 0;
alter table public.products add column if not exists target_margin numeric default 0;
alter table public.products add column if not exists cost_price numeric default 0;
alter table public.products add column if not exists base_cost numeric default 0;
alter table public.products add column if not exists sale_price numeric default 0;
alter table public.products add column if not exists suggested_price numeric default 0;
alter table public.products add column if not exists min_price numeric default 0;
alter table public.products add column if not exists avg_production_time text;

-- Atualiza produtos já importados via origin=supplier_import que não têm o flag
update public.products
set imported_from_supplier = true
where origin = 'supplier_import' and (imported_from_supplier is null or imported_from_supplier = false);
