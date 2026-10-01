-- =============================================================================
-- RECONCILIAÇÃO DO SCHEMA public COM A PRODUÇÃO (achado A-01)
--
-- A produção nasceu de migrações herdadas que não estão no histórico; um banco
-- criado do zero pelas migrações versionadas ficava sem 18 colunas que o
-- código e os gatilhos usam (ex.: store.sync_order_items_to_crm grava
-- public.orders.product_desc). Esta migração só ACRESCENTA o que falta, com
-- tipo, padrão e nulidade lidos de information_schema da produção em
-- 2026-09-30. Na produção é uma operação nula: todas as colunas já existem.
-- =============================================================================

alter table public.contracts add column if not exists alteration_terms text;
alter table public.contracts add column if not exists approval_terms text;
alter table public.contracts add column if not exists down_payment numeric(10,2) default 0;
alter table public.contracts add column if not exists notes text;

alter table public.leads add column if not exists company_name text not null default '';
alter table public.leads alter column company_name drop default;

alter table public.orders add column if not exists machine_section text;
alter table public.orders add column if not exists payment_status text default 'Nao pago';
alter table public.orders add column if not exists product_desc text not null default '';
alter table public.orders alter column product_desc drop default;

alter table public.products add column if not exists marketplace_keywords jsonb default '[]'::jsonb;
alter table public.products add column if not exists notes text;
alter table public.products add column if not exists status text default 'Ativo';
alter table public.products add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;
alter table public.products add column if not exists unit_measure text;

alter table public.quotes add column if not exists discount numeric(10,2) default 0;
alter table public.quotes add column if not exists margin_percentage numeric(5,2) default 0;
alter table public.quotes add column if not exists measures text;
alter table public.quotes add column if not exists sale_price numeric(10,2) default 0;
alter table public.quotes add column if not exists service_desc text not null default '';
alter table public.quotes alter column service_desc drop default;
