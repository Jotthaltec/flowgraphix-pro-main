-- Despublicação, arquivamento e exclusão segura (migração 20260929040000).
-- Transação desfeita no fim. Depende da cópia restaurada por db-rehearsal.sh.
begin;
\o /dev/null

create function pg_temp.act_as(p_user uuid) returns void language sql as $f$
  select set_config('request.jwt.claims',
           case when p_user is null then '' else json_build_object('sub', p_user, 'role', 'authenticated')::text end, true),
         set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
$f$;

create function pg_temp.expect_error(p_sql text, p_errcode text, p_label text)
returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'FALHOU: % (esperava erro %, nada aconteceu)', p_label, p_errcode;
exception when others then
  if sqlstate = p_errcode then return; end if;
  if sqlerrm like 'FALHOU:%' then raise; end if;
  raise exception 'FALHOU: % (esperava erro %, veio % %)', p_label, p_errcode, sqlstate, sqlerrm;
end $$;

create function pg_temp.open_items(p_crm uuid) returns bigint language sql as $f$
  select count(*) from store.product_sync_queue where crm_product_id = p_crm and status in ('pending', 'processing');
$f$;

do $$
declare
  c_crm constant uuid := '00000000-0000-4000-8000-0000000000e1';
  c_draft constant uuid := '00000000-0000-4000-8000-0000000000e2';
  v_company uuid;
  v_owner uuid;
  v_id uuid;
  r jsonb;
  st record;
  v_p store.products%rowtype;
begin
  select p.company_id into v_company from public.products p join public.companies c on c.id = p.company_id
  where c.store_access limit 1;
  select coalesce(
    (select owner_id from public.companies where id = v_company),
    (select user_id from public.company_members where company_id = v_company and role in ('owner','admin') and active limit 1)
  ) into v_owner;
  perform pg_temp.act_as(v_owner);

  insert into public.products (id, company_id, name, category, sale_price, status)
  values (c_crm, v_company, 'QA retirar', 'QA Categoria', 40, 'Ativo'),
         (c_draft, v_company, 'QA rascunho', 'QA Categoria', 40, 'Ativo');
  r := store.publish_crm_product(c_crm);
  v_id := (r ->> 'product_id')::uuid;
  assert r ->> 'ok' = 'true' and (select active from store.products where id = v_id), format('0: publicado %s', r);

  -- 1. Produto publicado não é excluído no Flow; a loja fica intacta.
  begin
    delete from public.products where id = c_crm;
    raise exception 'FALHOU: 1 exclusão aceita';
  exception when foreign_key_violation then null;
  end;
  assert exists (select 1 from public.products where id = c_crm), '1: continua no Flow';
  assert exists (select 1 from store.products where id = v_id), '1: continua na loja';

  -- 2. Nunca publicado: exclusão definitiva liberada.
  delete from public.products where id = c_draft;
  assert not exists (select 1 from public.products where id = c_draft), '2: rascunho excluído';

  -- 3. Motivo é obrigatório; produto sem par na loja não é "despublicado".
  begin
    perform store.unpublish_crm_product(c_crm, '  ');
    raise exception 'FALHOU: 3 sem motivo';
  exception when invalid_parameter_value then null;
  end;

  -- 4. Despublicar: sai da vitrine, preserva tudo, registra autor e motivo.
  update public.products set sale_price = 41 where id = c_crm;  -- abre item na fila
  assert pg_temp.open_items(c_crm) = 1, '4: item aberto antes';
  r := store.unpublish_crm_product(c_crm, 'Fornecedor sem estoque');
  assert r ->> 'ok' = 'true' and r ->> 'action' = 'unpublish' and (r ->> 'cancelled_queue_items')::int = 1,
    format('4: %s', r);
  select * into v_p from store.products where id = v_id;
  assert not v_p.active and v_p.unpublished_at is not null and v_p.archived_at is null
    and v_p.withdrawn_reason = 'Fornecedor sem estoque' and v_p.withdrawn_by = v_owner and v_p.sync_status = 'pending',
    format('4: produto %s', row_to_json(v_p));
  assert (select count(*) from store.product_variants where product_id = v_id) > 0, '4: variantes preservadas';
  select * into st from store.product_sync_state(v_id);
  assert st.status = 'pending', format('4: estado %s', row_to_json(st));
  assert (select sync_status from public.site_products where id = v_id) = 'pending', '4: site_products';
  assert pg_temp.open_items(c_crm) = 0, '4: fila cancelada';
  assert exists (select 1 from store.sync_log where destino_id = v_id and acao = 'unpublish'
                 and payload ->> 'reason' = 'Fornecedor sem estoque' and (payload ->> 'by')::uuid = v_owner),
    '4: log com autor e motivo';

  -- 5. Alteração no Flow de produto despublicado não agenda nem marca stale.
  update public.products set sale_price = 42 where id = c_crm;
  assert pg_temp.open_items(c_crm) = 0, '5: sem fila';
  assert (select sync_status from store.products where id = v_id) = 'pending', '5: continua pending';

  -- 6. A loja não reativa por fora do Flow.
  begin
    update store.products set active = true where id = v_id;
    raise exception 'FALHOU: 6 reativado pela loja';
  exception when insufficient_privilege then null;
  end;

  -- 7. Publicar de novo traz de volta (não é noop) e limpa o motivo.
  r := store.publish_crm_product(c_crm);
  assert r ->> 'ok' = 'true' and r ->> 'action' = 'update', format('7: %s', r);
  select * into v_p from store.products where id = v_id;
  assert v_p.active and v_p.unpublished_at is null and v_p.withdrawn_reason is null and v_p.withdrawn_by is null
    and v_p.base_price = 42, format('7: %s', row_to_json(v_p));

  -- 8. Arquivar: fora de venda, status archived, fila cancelada.
  update public.products set sale_price = 43 where id = c_crm;
  r := store.archive_crm_product(c_crm, 'Linha descontinuada');
  select * into v_p from store.products where id = v_id;
  assert not v_p.active and v_p.archived_at is not null and v_p.sync_status = 'archived'
    and v_p.withdrawn_reason = 'Linha descontinuada', format('8: %s', row_to_json(v_p));
  assert pg_temp.open_items(c_crm) = 0, '8: fila cancelada';
  assert (select status from store.product_sync_state(v_id)) = 'archived', '8: estado archived';

  -- 9. Item que escapou para a fila não republica produto arquivado.
  insert into store.product_sync_queue (crm_product_id, company_id, next_attempt_at)
  values (c_crm, v_company, now() - interval '1 second');
  perform pg_temp.act_as(null);
  r := store.process_product_sync_queue(50);
  assert (r ->> 'cancelled')::int >= 1, format('9: %s', r);
  assert not (select active from store.products where id = v_id), '9: continua fora de venda';

  -- 10. "Restaurar" pelo painel da loja não passa (status archived exige archived_at
  --     e a trava recusa reativar produto retirado pelo Flow).
  begin
    update store.products set active = true where id = v_id;
    raise exception 'FALHOU: 10 reativado';
  exception when insufficient_privilege then null;
  end;

  -- 11. Admin da loja: produto do Flow é arquivado, nunca apagado.
  assert store.remove_product_internal(v_id, 'site') = 'archive', '11: archive';
  assert exists (select 1 from store.products where id = v_id), '11: continua existindo';

  -- 12. Apagar direto produto do Flow na loja é recusado.
  begin
    delete from store.products where id = v_id;
    raise exception 'FALHOU: 12 apagado';
  exception when insufficient_privilege then null;
  end;

  -- 13. Republicar arquivado (explícito) traz de volta.
  perform pg_temp.act_as(v_owner);
  r := store.publish_crm_product(c_crm);
  select * into v_p from store.products where id = v_id;
  assert r ->> 'ok' = 'true' and v_p.active and v_p.archived_at is null and v_p.sync_status in ('synced', 'attention'),
    format('13: %s %s', r, row_to_json(v_p));
end $$;

-- 14. Nativo: com registro comercial é arquivado; sem, é apagado.
insert into store.products (id, sku, name, slug, price_unit, base_price) values
  ('00000000-0000-4000-8000-0000000000f1', 'QA-N1', 'QA nativo cupom', 'qa-nativo-cupom', 'unidade', 10),
  ('00000000-0000-4000-8000-0000000000f2', 'QA-N2', 'QA nativo avaliado', 'qa-nativo-avaliado', 'unidade', 10),
  ('00000000-0000-4000-8000-0000000000f3', 'QA-N3', 'QA nativo livre', 'qa-nativo-livre', 'unidade', 10);
insert into store.coupons (code, product_id) values ('QA-CUPOM-F1', '00000000-0000-4000-8000-0000000000f1');
insert into store.product_reviews (product_id, author_name, rating)
  values ('00000000-0000-4000-8000-0000000000f2', 'QA', 5);
do $$ begin
  assert store.product_commercial_refs('00000000-0000-4000-8000-0000000000f1') = array['cupons'], '14: refs cupom';
  assert store.remove_product_internal('00000000-0000-4000-8000-0000000000f1', 'site') = 'archive', '14: cupom arquiva';
  assert store.remove_product_internal('00000000-0000-4000-8000-0000000000f2', 'site') = 'archive', '14: avaliação arquiva';
  assert exists (select 1 from store.coupons where code = 'QA-CUPOM-F1'), '14: cupom preservado';
  assert exists (select 1 from store.product_reviews where product_id = '00000000-0000-4000-8000-0000000000f2'),
    '14: avaliação preservada';
  assert (select sync_status = 'native' and archived_at is not null and not active from store.products
          where id = '00000000-0000-4000-8000-0000000000f1'), '14: nativo arquivado continua native';
  assert store.remove_product_internal('00000000-0000-4000-8000-0000000000f3', 'site') = 'delete', '14: livre apaga';
  assert not exists (select 1 from store.products where id = '00000000-0000-4000-8000-0000000000f3'), '14: apagado';
  -- Nativo arquivado pela loja pode ser restaurado pela loja.
  update store.products set archived_at = null, active = true where id = '00000000-0000-4000-8000-0000000000f1';
end $$;

-- 15. Permissões.
do $$
declare
  c_crm constant uuid := '00000000-0000-4000-8000-0000000000e1';
begin
  assert not has_function_privilege('authenticated', 'store.withdraw_crm_product_internal(uuid, text, text, text)', 'execute'),
    '15: interna fechada';
  assert not has_function_privilege('authenticated', 'store.withdraw_crm_product(uuid, text, text)', 'execute'),
    '15: genérica fechada';
  assert not has_function_privilege('anon', 'store.unpublish_crm_product(uuid, text)', 'execute'), '15: anon';
  assert has_function_privilege('authenticated', 'store.archive_crm_product(uuid, text)', 'execute'), '15: authenticated';
  -- Usuário sem vínculo com a empresa não retira o produto.
  perform pg_temp.act_as('00000000-0000-4000-8000-00000000dead');
  begin
    perform store.unpublish_crm_product(c_crm, 'intruso');
    raise exception 'FALHOU: 15 intruso despublicou';
  exception when insufficient_privilege then null;
  end;
end $$;

rollback;
