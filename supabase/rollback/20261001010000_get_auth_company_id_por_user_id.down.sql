-- Volta à definição anterior (que comparava profiles.id com auth.uid()).
create or replace function public.get_auth_company_id()
returns uuid
language sql
security definer
as $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;
alter function public.get_auth_company_id() reset search_path;
