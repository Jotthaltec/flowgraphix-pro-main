-- get_auth_company_id() procurava o perfil por profiles.id = auth.uid(), mas o
-- vínculo do perfil com o usuário é profiles.user_id (profiles.id é outra
-- chave). Resultado: a função devolvia null para todo mundo e as políticas
-- "*_isolation" escondiam e bloqueavam por completo o Motor de Produtos
-- (atributos técnicos, grupos, modelos) e a produção interna do CRM (OPs,
-- itens, etapas, checklists, máquinas, histórico).
--
-- Mesma semântica de antes (empresa do perfil do usuário logado), agora pela
-- coluna certa, com search_path fixo e marcada STABLE.
create or replace function public.get_auth_company_id()
returns uuid
language sql
stable
security definer
set search_path to ''
as $$
  select p.company_id
  from public.profiles p
  where p.user_id = (select auth.uid())
  limit 1;
$$;
