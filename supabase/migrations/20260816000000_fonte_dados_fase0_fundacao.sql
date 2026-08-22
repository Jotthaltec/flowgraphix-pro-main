-- =============================================================================
-- FONTE DE DADOS — FASE 0: FUNDAÇÃO
--
-- Ponto de partida do módulo que decide, por entidade (produtos, clientes,
-- orçamentos, pedidos), se os dados exibidos vêm da loja, do Flow Printi ou
-- dos dois. Esta migração não liga sincronização nenhuma — só constrói o
-- mecanismo genérico que as fases seguintes (produtos, clientes, orçamentos,
-- pedidos) vão usar:
--
--   1. Uma chave em store.settings com o modo de cada entidade.
--   2. public.data_mode(entidade) — leitura dessa chave a partir do CRM, que
--      só enxerga o schema `public` e não tem um segundo client Supabase.
--   3. sync_origin/crm_id nas quatro tabelas espelhadas, para saber quem é
--      dono de cada registro quando o modo for 'ambos'.
--   4. store.sync_log — auditoria de toda sincronização futura.
--
-- Os triggers já existentes (store.customers <-> public.clients,
-- store.orders -> public.orders) continuam exatamente como estão: passam a
-- consultar data_mode() nas Fases 3 e 5, quando cada entidade for trabalhada.
-- Mudar o comportamento deles agora, fora do escopo revisado, é o tipo de
-- mistura de fases que o projeto pediu para evitar.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Configuração: modo de cada entidade
-- -----------------------------------------------------------------------------

insert into store.settings (key, value, group_name, label, description)
values (
  'dados.origem',
  '{
    "produtos":   { "modo": "crm",   "auto_publicar": false },
    "clientes":   { "modo": "ambos" },
    "orcamentos": { "modo": "ambos" },
    "pedidos":    { "modo": "ambos" }
  }'::jsonb,
  'integracoes',
  'Fonte de dados',
  'De onde vem cada tipo de registro: só da loja, só do Flow Printi, ou dos dois.'
)
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- 2. Leitura compartilhada — é assim que o CRM enxerga o modo configurado sem
--    ganhar um segundo client Supabase apontando para o schema `store`.
-- -----------------------------------------------------------------------------

create or replace function public.data_mode(entidade text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select value -> entidade ->> 'modo'
      from store.settings
      where key = 'dados.origem'
        and entidade in ('produtos', 'clientes', 'orcamentos', 'pedidos')
    ),
    'site'
  );
$$;

comment on function public.data_mode(text) is
  'Modo de sincronização da entidade (site | crm | ambos), lido de store.settings[dados.origem]. Todo trigger de sincronização deve consultar esta função antes de propagar, e não fazer nada quando o modo não permitir.';

revoke all on function public.data_mode(text) from public, anon;
grant execute on function public.data_mode(text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. Marcação de posse nas tabelas espelhadas
--
-- Produtos e orçamentos ganham crm_id: a loja pode ter um registro próprio
-- que colide por acaso com um do CRM, então o vínculo entre os dois lados
-- precisa de uma coluna separada do id. Clientes e pedidos já usam o mesmo id
-- dos dois lados — é assim que os triggers de 20260801000001 funcionam hoje —
-- então ganham só sync_origin, sem crm_id, para não quebrar essa convenção.
-- -----------------------------------------------------------------------------

alter table store.products
  add column if not exists sync_origin text not null default 'site' check (sync_origin in ('site', 'crm')),
  add column if not exists crm_id uuid unique;

alter table store.customers
  add column if not exists sync_origin text not null default 'site' check (sync_origin in ('site', 'crm'));

alter table store.quotes
  add column if not exists sync_origin text not null default 'site' check (sync_origin in ('site', 'crm')),
  add column if not exists crm_id uuid unique;

alter table store.orders
  add column if not exists sync_origin text not null default 'site' check (sync_origin in ('site', 'crm'));

create index if not exists products_crm_id_idx on store.products(crm_id) where crm_id is not null;
create index if not exists quotes_crm_id_idx on store.quotes(crm_id) where crm_id is not null;

-- -----------------------------------------------------------------------------
-- 4. Auditoria de sincronização — é o que torna o painel da Fase 6 possível.
-- -----------------------------------------------------------------------------

create table if not exists store.sync_log (
  id uuid primary key default gen_random_uuid(),
  entidade text not null check (entidade in ('produtos', 'clientes', 'orcamentos', 'pedidos')),
  direcao text not null check (direcao in ('crm_para_site', 'site_para_crm')),
  origem_id uuid,
  destino_id uuid,
  acao text not null check (acao in ('insert', 'update', 'skip', 'erro')),
  sucesso boolean not null default true,
  erro text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists sync_log_entidade_idx on store.sync_log(entidade, created_at desc);
create index if not exists sync_log_falhas_idx on store.sync_log(created_at desc) where sucesso = false;

alter table store.sync_log enable row level security;

-- Só os triggers de sincronização gravam aqui (funções security definer,
-- donas da migração — bypassam RLS como qualquer trigger cross-schema deste
-- banco). A policy existe para a tela de auditoria não vazar para quem não é
-- admin, não para autorizar escrita.
drop policy if exists "sync_log_leitura_admin" on store.sync_log;
create policy "sync_log_leitura_admin" on store.sync_log
  for select using (store.is_admin());

-- -----------------------------------------------------------------------------
-- 5. Grants — mesma exigência de 20260801000003_store_grants.sql: sem isso a
--    Data API responde "permission denied for schema store" para a tabela nova,
--    mesmo com RLS configurado.
-- -----------------------------------------------------------------------------

revoke all on store.sync_log from anon, authenticated;
grant select on store.sync_log to authenticated;
grant all on store.sync_log to service_role;
