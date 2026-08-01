-- =============================================================================
-- PERMISSÕES DO SCHEMA store PARA A DATA API
--
-- O Supabase concede estes privilégios automaticamente no schema `public`, mas
-- não em schemas criados por migração. Sem eles, expor `store` em
-- Settings → API não basta: o PostgREST autentica, chega no Postgres e recebe
-- "permission denied for schema store".
--
-- Conceder `all` a `anon` e `authenticated` é o mesmo modelo que o Supabase usa
-- no `public`: quem realmente controla o acesso é o RLS, não o GRANT. As 63
-- tabelas estão com row level security ligado e 132 policies aplicadas pela
-- migração 20260801000002_store_rls.sql — sem elas, este arquivo abriria o
-- banco. Os dois andam juntos.
--
-- `alter default privileges` cobre o que for criado depois, para uma tabela
-- nova não nascer invisível para a aplicação.
-- =============================================================================

grant usage on schema store to anon, authenticated, service_role;

grant all on all tables    in schema store to anon, authenticated, service_role;
grant all on all sequences in schema store to anon, authenticated, service_role;
grant all on all functions in schema store to anon, authenticated, service_role;

alter default privileges in schema store
  grant all on tables to anon, authenticated, service_role;

alter default privileges in schema store
  grant all on sequences to anon, authenticated, service_role;

alter default privileges in schema store
  grant all on functions to anon, authenticated, service_role;
