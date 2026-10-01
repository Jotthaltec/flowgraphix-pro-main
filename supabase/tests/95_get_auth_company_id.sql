-- get_auth_company_id por profiles.user_id (migração 20261001010000).
-- Transação desfeita no fim.
begin;
\o /dev/null

create function pg_temp.act_as(p_user uuid) returns void language sql as $f$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true),
         set_config('request.jwt.claim.sub', p_user::text, true);
$f$;

do $$
declare
  v_user uuid := gen_random_uuid();
  v_outro uuid := gen_random_uuid();
  v_empresa uuid;
  v_outra uuid;
begin
  insert into auth.users (id, email) values (v_user, 'qa-gacid@teste.local'), (v_outro, 'qa-gacid2@teste.local');
  insert into public.companies (name, owner_id) values ('QA empresa', v_user) returning id into v_empresa;
  insert into public.companies (name, owner_id) values ('QA outra', v_outro) returning id into v_outra;
  -- perfil com id próprio, diferente do user_id (caso real de produção)
  insert into public.profiles (id, user_id, company_id, full_name)
  values (gen_random_uuid(), v_user, v_empresa, 'QA'), (gen_random_uuid(), v_outro, v_outra, 'QA2')
  on conflict (user_id) do update set company_id = excluded.company_id;

  perform pg_temp.act_as(v_user);
  if public.get_auth_company_id() is distinct from v_empresa then
    raise exception 'FALHA: empresa do usuário não resolvida pelo user_id';
  end if;

  -- a política de isolamento passa a deixar gravar e ler na própria empresa…
  set local role authenticated;
  insert into public.technical_attributes (company_id, name, code, type)
  values (v_empresa, 'QA papel', 'QA_PAPEL', 'text');
  if (select count(*) from public.technical_attributes where code = 'QA_PAPEL') <> 1 then
    raise exception 'FALHA: atributo da própria empresa não visível';
  end if;
  -- …e continua barrando outra empresa
  begin
    insert into public.technical_attributes (company_id, name, code, type)
    values (v_outra, 'QA alheio', 'QA_ALHEIO', 'text');
    raise exception 'FALHA: gravou em outra empresa';
  exception when insufficient_privilege then null;
  end;
  reset role;

  perform pg_temp.act_as(v_outro);
  set local role authenticated;
  if exists (select 1 from public.technical_attributes where code = 'QA_PAPEL') then
    raise exception 'FALHA: outra empresa enxerga o atributo';
  end if;
  reset role;
end $$;

\o
select 'ok 95_get_auth_company_id';
rollback;
