-- Credenciais de fornecedor: remove a chave fixa de desenvolvimento e usa um
-- segredo aleatorio persistente, inacessivel pela Data API.
create table if not exists private.app_secrets (
  key text primary key,
  secret text not null,
  created_at timestamptz not null default now()
);
revoke all on private.app_secrets from public, anon, authenticated, service_role;
insert into private.app_secrets(key, secret)
values ('supplier_credentials', pg_catalog.encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (key) do nothing;

create or replace function public.upsert_supplier_account(
  p_company_id uuid,
  p_supplier_id uuid,
  p_registration_name text default null,
  p_registration_cnpj text default null,
  p_registration_email text default null,
  p_registration_phone text default null,
  p_login_username text default null,
  p_login_password text default null,
  p_delivery_override boolean default false,
  p_delivery_recipient text default null,
  p_delivery_zip text default null,
  p_delivery_address text default null,
  p_delivery_number text default null,
  p_delivery_complement text default null,
  p_delivery_neighborhood text default null,
  p_delivery_city text default null,
  p_delivery_state text default null,
  p_delivery_phone text default null,
  p_receiving_mode text default null,
  p_preferred_pickup_point text default null,
  p_notes text default null
)
returns setof public.supplier_accounts_safe
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enc_password text;
  v_existing uuid;
  v_enc_key text;
begin
  if not public.user_owns_company(p_company_id) then
    raise exception 'Acesso negado: empresa nao pertence ao usuario.' using errcode = '42501';
  end if;

  select secret into v_enc_key from private.app_secrets where key='supplier_credentials';
  if v_enc_key is null then
    raise exception 'Chave de credenciais nao configurada.' using errcode = '55000';
  end if;
  if p_login_password is not null and p_login_password <> '' then
    v_enc_password := pg_catalog.encode(
      extensions.pgp_sym_encrypt(p_login_password, v_enc_key), 'base64'
    );
  end if;

  select id into v_existing from public.supplier_accounts
   where company_id=p_company_id and supplier_id=p_supplier_id for update;
  if v_existing is not null then
    update public.supplier_accounts set
      registration_name=coalesce(p_registration_name,registration_name),
      registration_cnpj=coalesce(p_registration_cnpj,registration_cnpj),
      registration_email=coalesce(p_registration_email,registration_email),
      registration_phone=coalesce(p_registration_phone,registration_phone),
      login_username=coalesce(p_login_username,login_username),
      login_password_enc=coalesce(v_enc_password,login_password_enc),
      delivery_override=p_delivery_override,
      delivery_recipient=p_delivery_recipient,
      delivery_zip=p_delivery_zip,
      delivery_address=p_delivery_address,
      delivery_number=p_delivery_number,
      delivery_complement=p_delivery_complement,
      delivery_neighborhood=p_delivery_neighborhood,
      delivery_city=p_delivery_city,
      delivery_state=p_delivery_state,
      delivery_phone=p_delivery_phone,
      receiving_mode=p_receiving_mode,
      preferred_pickup_point=p_preferred_pickup_point,
      notes=p_notes,
      updated_at=now()
    where id=v_existing;
  else
    insert into public.supplier_accounts (
      company_id,supplier_id,registration_name,registration_cnpj,registration_email,
      registration_phone,login_username,login_password_enc,delivery_override,
      delivery_recipient,delivery_zip,delivery_address,delivery_number,
      delivery_complement,delivery_neighborhood,delivery_city,delivery_state,
      delivery_phone,receiving_mode,preferred_pickup_point,notes
    ) values (
      p_company_id,p_supplier_id,p_registration_name,p_registration_cnpj,
      p_registration_email,p_registration_phone,p_login_username,v_enc_password,
      p_delivery_override,p_delivery_recipient,p_delivery_zip,p_delivery_address,
      p_delivery_number,p_delivery_complement,p_delivery_neighborhood,p_delivery_city,
      p_delivery_state,p_delivery_phone,p_receiving_mode,p_preferred_pickup_point,p_notes
    );
  end if;

  return query select * from public.supplier_accounts_safe
   where company_id=p_company_id and supplier_id=p_supplier_id;
end;
$$;

revoke all on function public.upsert_supplier_account(
  uuid,uuid,text,text,text,text,text,text,boolean,text,text,text,text,text,text,text,text,text,text,text,text
) from public, anon;
grant execute on function public.upsert_supplier_account(
  uuid,uuid,text,text,text,text,text,text,boolean,text,text,text,text,text,text,text,text,text,text,text,text
) to authenticated, service_role;
