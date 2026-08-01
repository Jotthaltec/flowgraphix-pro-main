-- =============================================================================
-- ADMIN INICIAL DA LOJA
--
-- Os dois sistemas dividem `auth.users`, mas não o conceito de permissão:
--
--   • CRM  (public.profiles) — não tem coluna `role`. Quem tem perfil com
--     `company_id` é da equipe; o acesso é por pertencer à empresa.
--   • Loja (store.profiles)  — tem `role`, e o RLS inteiro depende dele:
--     `store.is_admin()`, `store.is_staff()` e as 132 policies leem daqui.
--
-- Como o cadastro público só emite 'cliente' ou 'revendedor' (ver
-- store.handle_new_user), o primeiro admin precisa ser promovido fora do fluxo
-- normal — é o que este arquivo faz.
--
-- Promoção por e-mail, e não por "quem tem perfil no CRM": aquele critério
-- pareceria mais elegante, mas todo cadastro da loja também gera perfil no CRM,
-- então promoveria qualquer cliente a administrador.
--
-- Para adicionar outro admin depois, use o painel da loja (Admin → Usuários) ou
-- repita este update com o e-mail desejado.
-- =============================================================================

update store.profiles p
set role = 'admin'
from auth.users u
where u.id = p.id
  and lower(u.email) = 'jonathaslucas58@gmail.com'
  and p.role is distinct from 'admin';
