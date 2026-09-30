-- Regressão: publicar de novo o produto real da cópia continua funcionando e
-- produz o mesmo catálogo. Transação desfeita no fim.
-- Depende da cópia de produção restaurada por scripts/db-rehearsal.sh.
begin;
\o /dev/null

-- auth.uid() lê request.jwt.claims (Supabase atual) ou request.jwt.claim.sub
-- (imagem local): grava as duas formas.
create function pg_temp.act_as(p_user uuid) returns void language sql as $f$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true),
         set_config('request.jwt.claim.sub', p_user::text, true);
$f$;

do $$
declare
  v_crm uuid;
  v_owner uuid;
  v_before jsonb;
  v_result jsonb;
  v_after jsonb;
begin
  select s.crm_id into v_crm from store.products s where s.sync_origin = 'crm' and s.active limit 1;
  if v_crm is null then
    raise notice 'sem produto do CRM ativo na cópia; teste ignorado';
    return;
  end if;
  select m.user_id into v_owner
  from public.company_members m join public.products p on p.company_id = m.company_id
  where p.id = v_crm and m.role in ('owner', 'admin') limit 1;
  perform pg_temp.act_as(v_owner);

  select to_jsonb(x) into v_before from (
    select sp.imagens, sp.grupos_opcao, sp.opcoes, sp.variantes, sp.tiragens, s.active, s.sync_origin
    from public.site_products sp join store.products s using (id) where s.crm_id = v_crm) x;

  v_result := store.publish_crm_product(v_crm);
  assert v_result ->> 'ok' = 'true', 'publicação retorna ok';
  -- Já publicado: update (sem assinatura ou com mudança) ou noop (igual). Nunca insert.
  assert v_result ->> 'action' in ('update', 'noop'), format('republicar não pode ser %s', v_result ->> 'action');

  select to_jsonb(x) into v_after from (
    select sp.imagens, sp.grupos_opcao, sp.opcoes, sp.variantes, sp.tiragens, s.active, s.sync_origin
    from public.site_products sp join store.products s using (id) where s.crm_id = v_crm) x;
  assert v_after = v_before, format('catálogo mudou ao republicar: antes %s, depois %s', v_before, v_after);
  assert (select count(*) from store.products where crm_id = v_crm) = 1, 'sem duplicação';

  -- Sem permissão: outro usuário qualquer é recusado.
  perform pg_temp.act_as(gen_random_uuid());
  begin
    perform store.publish_crm_product(v_crm);
    raise exception 'FALHOU: publicação sem permissão passou';
  exception when insufficient_privilege then null;
  end;
end $$;

rollback;
