-- ============================================================================
-- Fase 1 — Configurações completas da gráfica.
-- Amplia `companies` com dados cadastrais, endereço fiscal, endereço de entrega
-- (onde o fornecedor entrega) e preferência de recebimento (entrega × retirada).
-- Idempotente (add column if not exists).
-- ============================================================================

-- Dados cadastrais
alter table public.companies add column if not exists legal_name text;          -- razão social
alter table public.companies add column if not exists state_registration text;   -- inscrição estadual

-- Endereço fiscal (complementa address/city/state já existentes)
alter table public.companies add column if not exists zip_code text;
alter table public.companies add column if not exists address_number text;
alter table public.companies add column if not exists complement text;
alter table public.companies add column if not exists neighborhood text;

-- Recebimento do fornecedor
-- 'delivery' = entregar na gráfica | 'pickup' = retirar no balcão do fornecedor
alter table public.companies add column if not exists default_receiving_mode text default 'delivery';
alter table public.companies add column if not exists preferred_pickup_point text;

-- Endereço de entrega (quando diferente do fiscal)
alter table public.companies add column if not exists delivery_same_as_fiscal boolean default true;
alter table public.companies add column if not exists delivery_recipient text;
alter table public.companies add column if not exists delivery_zip text;
alter table public.companies add column if not exists delivery_address text;
alter table public.companies add column if not exists delivery_number text;
alter table public.companies add column if not exists delivery_complement text;
alter table public.companies add column if not exists delivery_neighborhood text;
alter table public.companies add column if not exists delivery_city text;
alter table public.companies add column if not exists delivery_state text;
alter table public.companies add column if not exists delivery_phone text;

alter table public.companies drop constraint if exists companies_receiving_mode_check;
alter table public.companies add constraint companies_receiving_mode_check
  check (default_receiving_mode in ('delivery', 'pickup'));
