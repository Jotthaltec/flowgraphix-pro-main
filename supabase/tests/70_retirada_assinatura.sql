-- Retirada pelo Flow e assinatura de conteúdo (migração 20260930010000).
-- Transação desfeita no fim. Depende da cópia restaurada por db-rehearsal.sh.
begin;
\o /dev/null

create function pg_temp.act_as(p_user uuid) returns void language sql as $f$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true),
         set_config('request.jwt.claim.sub', p_user::text, true);
$f$;

do $$
declare
  c_limpo constant uuid := 'f1000000-0000-4000-8000-000000000000';
  c_editado constant uuid := 'f2000000-0000-4000-8000-000000000000';
  v_company uuid;
  v_owner uuid;
  r jsonb;
  v_aviso constant text := 'Alteracoes feitas direto na loja foram substituidas pelo conteudo do Flow.';
begin
  select p.company_id into v_company from public.products p join public.companies c on c.id = p.company_id
  where c.store_access limit 1;
  select coalesce(
    (select owner_id from public.companies where id = v_company),
    (select user_id from public.company_members where company_id = v_company and role in ('owner','admin') and active limit 1)
  ) into v_owner;
  perform pg_temp.act_as(v_owner);

  insert into public.products (id, company_id, name, category, sale_price, status)
  values (c_limpo, v_company, 'QA retirada limpa', 'QA Categoria', 30, 'Ativo'),
         (c_editado, v_company, 'QA retirada editada', 'QA Categoria', 30, 'Ativo');
  -- O SKU público vem dos 12 primeiros caracteres do id: ids distintos no início.
  assert store.publish_crm_product(c_limpo) ->> 'ok' = 'true', 'pré: publicar limpo';
  assert store.publish_crm_product(c_editado) ->> 'ok' = 'true', 'pré: publicar editado';

  -- 1. Arquivar pelo Flow e republicar: não é edição na loja.
  perform store.archive_crm_product(c_limpo, 'QA: teste de assinatura');
  assert (select status from store.product_sync_state((select id from store.products where crm_id = c_limpo)))
    = 'archived', '1: arquivado';
  r := store.publish_crm_product(c_limpo);
  assert r ->> 'ok' = 'true', format('1: %s', r);
  assert not (r -> 'warnings' ? v_aviso), format('1: aviso falso de edição na loja: %s', r -> 'warnings');

  -- 2. Despublicar também não gera o aviso.
  perform store.unpublish_crm_product(c_limpo, 'QA: teste de assinatura');
  r := store.publish_crm_product(c_limpo);
  assert not (r -> 'warnings' ? v_aviso), format('2: aviso falso: %s', r -> 'warnings');

  -- 3. Loja editada ANTES da retirada: a divergência real continua sendo avisada.
  update store.products set short_description = 'editado na loja' where crm_id = c_editado;
  perform store.archive_crm_product(c_editado, 'QA: teste de assinatura');
  r := store.publish_crm_product(c_editado);
  assert r -> 'warnings' ? v_aviso, format('3: edição real sumiu: %s', r -> 'warnings');
end $$;

rollback;
