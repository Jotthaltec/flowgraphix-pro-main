-- =============================================================================
-- SHIM DE REPLAY — objetos que produção tinha ANTES do histórico versionado.
--
-- Achado A-01 (docs/auditoria-fluxo-real.md): o histórico em
-- supabase/migrations é a fonte de verdade (produção registra exatamente as
-- mesmas 49 versões), mas as primeiras migrações dependem de funções que
-- nasceram fora dele (herança Lovable). Este arquivo existe SÓ para o replay em
-- banco limpo (scripts/db-replay.sh). Nunca é aplicado em produção, e cada
-- objeto aqui é redefinido depois pelo próprio histórico.
--
-- Definições conferidas por leitura (pg_get_functiondef) no projeto de
-- produção em 2026-09-28.
-- =============================================================================
set check_function_bodies = off;

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path to 'public'
as $$ begin new.updated_at = now(); return new; end; $$;

-- Forma pré-J0 (dono da empresa). A migração 20260822185901 a substitui pela
-- versão baseada em company_members.
create or replace function public.user_owns_company(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid()) and p.company_id = target_company_id
  );
$$;
