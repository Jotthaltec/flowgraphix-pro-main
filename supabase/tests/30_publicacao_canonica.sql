-- Publicação canônica (migração 20260929020000): idempotência, hash, falha
-- sem dados parciais, log de toda tentativa e proteção dos nativos.
-- Transação desfeita no fim. Depende da cópia restaurada por db-rehearsal.sh.
begin;
\o /dev/null

create function pg_temp.act_as(p_user uuid) returns void language sql as $f$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true),
         set_config('request.jwt.claim.sub', p_user::text, true);
$f$;

-- Falha provocada no meio da montagem: depois de imagens e opções gravadas.
create function pg_temp.boom() returns trigger language plpgsql as $f$
begin
  if exists (select 1 from store.product_variants v join store.products p on p.id = v.product_id
             where v.id = new.variant_id and p.name like 'QA explode%') then
    raise exception 'falha simulada ao gravar tiragem';
  end if;
  return new;
end $f$;
create trigger qa_boom before insert on store.product_variant_price_tiers
  for each row execute function pg_temp.boom();

do $$
declare
  c_crm constant uuid := '00000000-0000-4000-8000-0000000000c3';
  v_company uuid;
  v_owner uuid;
  r jsonb;
  v_id uuid;
  v_hash text;
  v_variant uuid;
  v_logs integer;
  v_native_hash text;
  v_native uuid;
begin
  select p.company_id into v_company from public.products p join public.companies c on c.id = p.company_id
  where c.store_access limit 1;
  select coalesce(
    (select owner_id from public.companies where id = v_company),
    (select user_id from public.company_members where company_id = v_company and role in ('owner','admin') and active limit 1)
  ) into v_owner;
  perform pg_temp.act_as(v_owner);

  select id into v_native from store.products where sync_origin = 'site' limit 1;
  v_native_hash := store.product_content_hash(v_native);

  insert into public.products (id, company_id, name, category, sale_price, status, production_deadline)
  values (c_crm, v_company, 'QA publicação', 'QA Categoria', 25.50, 'Ativo', '5 dias úteis');

  -- A. Primeira publicação cria o produto.
  r := store.publish_crm_product(c_crm);
  assert r ->> 'ok' = 'true' and r ->> 'action' = 'insert', format('A: %s', r);
  v_id := (r ->> 'product_id')::uuid;
  assert r ->> 'slug' = (select slug from store.products where id = v_id), 'A: slug devolvido';
  assert (r ->> 'sync_version')::int = 1, 'A: versão 1';
  assert (select content_hash = r ->> 'content_hash' and content_hash = store.product_content_hash(v_id)
          and sync_status in ('synced','attention') and synced_at is not null and last_sync_error is null
          and source_updated_at = (select updated_at from public.products where id = c_crm)
          from store.products where id = v_id), 'A: campos de sync gravados';
  assert (select count(*) from store.sync_log where origem_id = c_crm and acao = 'insert' and sucesso) = 1, 'A: log';
  select id into v_variant from store.product_variants where product_id = v_id and is_default;

  -- B. Republicar sem mudança é noop: nada é remontado.
  r := store.publish_crm_product(c_crm);
  assert r ->> 'action' = 'noop', format('B: %s', r);
  assert (r ->> 'sync_version')::int = 1, 'B: versão não muda';
  assert (select id from store.product_variants where product_id = v_id and is_default) = v_variant, 'B: ids preservados';
  assert (select count(*) from store.products where crm_id = c_crm) = 1, 'B: sem duplicação';
  assert (select count(*) from store.sync_log where origem_id = c_crm and acao = 'skip' and sucesso) = 1, 'B: noop registrado';

  -- C. Mudança no Flow gera update e hash novo.
  select content_hash into v_hash from store.products where id = v_id;
  update public.products set name = 'QA publicação renomeado' where id = c_crm;
  r := store.publish_crm_product(c_crm);
  assert r ->> 'action' = 'update' and (r ->> 'sync_version')::int = 2, format('C: %s', r);
  assert r ->> 'content_hash' <> v_hash, 'C: hash muda com o conteúdo';
  assert (select name from store.products where id = v_id) = 'QA publicação renomeado', 'C: nome publicado';
  assert (select source_updated_at = (select updated_at from public.products where id = c_crm)
          from store.products where id = v_id), 'C: source_updated_at acompanha o Flow';
  v_hash := r ->> 'content_hash';

  -- D. Edição direta na loja é detectada e sobrescrita, com aviso.
  update store.products set short_description = 'editado na loja' where id = v_id;
  assert store.product_content_hash(v_id) <> v_hash, 'D: edição na loja muda o hash';
  r := store.publish_crm_product(c_crm);
  assert r ->> 'action' = 'update', format('D: %s', r);
  assert r -> 'warnings' @> '["Alteracoes feitas direto na loja foram substituidas pelo conteudo do Flow."]', 'D: aviso';
  assert r ->> 'content_hash' = v_hash, 'D: conteúdo volta a ser o do Flow';

  -- E. Validação falha: produto publicado fica intacto, erro fica registrado.
  update public.products set category = '' where id = c_crm;
  r := store.publish_crm_product(c_crm);
  assert r ->> 'ok' = 'false' and r ->> 'sync_status' = 'error', format('E: %s', r);
  assert r ->> 'error' like 'Defina a categoria%', 'E: mensagem';
  assert (select sync_status = 'error' and last_sync_error like 'Defina a categoria%' and active
          and content_hash = v_hash and store.product_content_hash(v_id) = v_hash
          from store.products where id = v_id), 'E: loja intacta e marcada error';
  assert (select count(*) from store.sync_log where origem_id = c_crm and acao = 'erro' and not sucesso) = 1, 'E: falha no log';

  -- F. Corrigido o Flow, conteúdo igual ao publicado: noop limpa o erro.
  update public.products set category = 'QA Categoria' where id = c_crm;
  r := store.publish_crm_product(c_crm);
  assert r ->> 'action' = 'noop', format('F: %s', r);
  assert (select sync_status in ('synced','attention') and last_sync_error is null
          from store.products where id = v_id), 'F: erro limpo';

  -- G. Falha no meio da montagem não deixa dado parcial.
  update public.products set name = 'QA explode' where id = c_crm;
  r := store.publish_crm_product(c_crm);
  assert r ->> 'ok' = 'false' and r ->> 'error' like 'falha simulada%', format('G: %s', r);
  assert (select name = 'QA publicação renomeado' and store.product_content_hash(v_id) = v_hash
          from store.products where id = v_id), 'G: nada foi aplicado pela metade';

  -- H. Preço zero nunca é publicado.
  update public.products set name = 'QA publicação renomeado', sale_price = 0, suggested_price = null, min_price = null
  where id = c_crm;
  r := store.publish_crm_product(c_crm);
  assert r ->> 'ok' = 'false' and r ->> 'error' like '%preco de venda valido%', format('H: %s', r);

  -- I. Sem permissão é exceção, não tentativa registrada.
  select count(*) into v_logs from store.sync_log where origem_id = c_crm;
  perform pg_temp.act_as(gen_random_uuid());
  begin
    perform store.publish_crm_product(c_crm);
    raise exception 'FALHOU: I: publicação sem permissão passou';
  exception when insufficient_privilege then null;
  end;
  assert (select count(*) from store.sync_log where origem_id = c_crm) = v_logs, 'I: sem log de terceiros';

  -- J. Nativos nunca são tocados.
  assert store.product_content_hash(v_native) = v_native_hash, 'J: nativo intacto';
end $$;

-- K. Validação comercial e estabilidade do hash sobre um produto montado à mão.
do $$
declare
  v_id uuid;
  v_group uuid;
  v_hash text;
begin
  insert into store.products (sku, name, slug, price_unit, base_price)
  values ('QA-PROB', 'QA problemas', 'qa-problemas', 'unidade', 10) returning id into v_id;
  insert into store.product_option_groups (product_id, key, name, input_type, required, position)
  values (v_id, 'cor', 'Cor', 'select', true, 0) returning id into v_group;
  insert into store.product_options (group_id, label, value, position, active) values (v_group, 'Azul', 'azul', 0, false);
  assert store.product_publish_problems(v_id) @> array[
    'Produto sem categoria.',
    'Nenhuma combinação com preço de venda: nada poderia ser comprado.',
    'Grupo obrigatório sem opção disponível: Cor.'], format('K: %s', store.product_publish_problems(v_id));

  v_hash := store.product_content_hash(v_id);
  update store.products set base_price = 10.0000 where id = v_id;
  assert store.product_content_hash(v_id) = v_hash, 'K: 10 e 10.0000 têm o mesmo hash';
  update store.products set view_count = view_count + 7, sales_count = sales_count + 1 where id = v_id;
  assert store.product_content_hash(v_id) = v_hash, 'K: estatísticas não entram no hash';
  update store.products set base_price = 11 where id = v_id;
  assert store.product_content_hash(v_id) <> v_hash, 'K: preço entra no hash';
end $$;

rollback;
