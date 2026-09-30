-- Autenticação da homologação local.
--
-- 1. Gatilhos de cadastro: vivem em auth.users, que o dump da aplicação não
--    carrega. Mesmas definições da produção (30/09/2026).
-- 2. Login local para o dono da empresa: a cópia traz os usuários como
--    esqueletos (só id). O dono ganha e-mail e senha APENAS no banco local,
--    mantendo o id real, para herdar empresa, perfil de admin e permissões.

drop trigger if exists on_auth_user_created_flow on auth.users;
create trigger on_auth_user_created_flow
  after insert on auth.users for each row execute function public.handle_new_user();

drop trigger if exists on_auth_user_created_store on auth.users;
create trigger on_auth_user_created_store
  after insert on auth.users for each row execute function store.handle_new_user();

-- O GoTrue não aceita nulos nas colunas de token; o esqueleto nasceu com eles.
update auth.users u set
  instance_id = '00000000-0000-0000-0000-000000000000',
  aud = 'authenticated',
  role = 'authenticated',
  email = 'dono@homolog.local',
  encrypted_password = extensions.crypt('Homolog#2026', extensions.gen_salt('bf')),
  email_confirmed_at = now(),
  raw_app_meta_data = '{"provider":"email","providers":["email"]}',
  raw_user_meta_data = '{"full_name":"Dono (homologação)"}',
  created_at = coalesce(u.created_at, now()),
  updated_at = now(),
  confirmation_token = '', recovery_token = '', email_change_token_new = '',
  email_change = '', email_change_token_current = '', reauthentication_token = '',
  phone_change = '', phone_change_token = ''
where u.id = (select owner_id from public.companies order by created_at limit 1);

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id::text, u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users u
where u.email = 'dono@homolog.local'
on conflict do nothing;
