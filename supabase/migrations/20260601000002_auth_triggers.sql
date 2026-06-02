-- Etapa 3: Autenticação Real - Trigger de Criação

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_company_id uuid;
begin
  -- Criar empresa
  insert into public.companies (name, email)
  values (
    coalesce(new.raw_user_meta_data->>'company_name', 'Minha Gráfica'),
    new.email
  )
  returning id into new_company_id;

  -- Criar perfil atrelado ao usuário da auth e à empresa criada
  insert into public.profiles (id, company_id, full_name, email, role)
  values (
    new.id,
    new_company_id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    'admin'
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
