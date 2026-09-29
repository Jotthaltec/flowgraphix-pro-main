-- Divergência real e fila de sincronização (migração 20260929030000).
-- Transação desfeita no fim. Depende da cópia restaurada por db-rehearsal.sh.
begin;
\o /dev/null

create function pg_temp.act_as(p_user uuid) returns void language sql as $f$
  select set_config('request.jwt.claims',
           case when p_user is null then '' else json_build_object('sub', p_user, 'role', 'authenticated')::text end, true),
         set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
$f$;

-- Força os itens do produto a vencer agora (a janela normal é de 30 s).
create function pg_temp.due(p_crm uuid) returns void language sql as $f$
  update store.product_sync_queue set next_attempt_at = now() - interval '1 second'
  where crm_product_id = p_crm and status = 'pending';
$f$;

create function pg_temp.open_items(p_crm uuid) returns bigint language sql as $f$
  select count(*) from store.product_sync_queue where crm_product_id = p_crm and status in ('pending', 'processing');
$f$;

do $$
declare
  c_crm constant uuid := '00000000-0000-4000-8000-0000000000d1';
  c_draft constant uuid := '00000000-0000-4000-8000-0000000000d2';
  v_company uuid;
  v_owner uuid;
  v_id uuid;
  v_hash text;
  r jsonb;
  q store.product_sync_queue%rowtype;
  st record;
begin
  select p.company_id into v_company from public.products p join public.companies c on c.id = p.company_id
  where c.store_access limit 1;
  select coalesce(
    (select owner_id from public.companies where id = v_company),
    (select user_id from public.company_members where company_id = v_company and role in ('owner','admin') and active limit 1)
  ) into v_owner;
  perform pg_temp.act_as(v_owner);

  insert into public.products (id, company_id, name, category, sale_price, status)
  values (c_crm, v_company, 'QA fila', 'QA Categoria', 40, 'Ativo'),
         (c_draft, v_company, 'QA nunca publicado', 'QA Categoria', 40, 'Ativo');

  -- 1. Publicar não realimenta a fila (sem laço Flow -> loja -> Flow).
  r := store.publish_crm_product(c_crm);
  v_id := (r ->> 'product_id')::uuid;
  v_hash := r ->> 'content_hash';
  assert pg_temp.open_items(c_crm) = 0, '1: publicação não gera item na fila';
  select * into st from store.product_sync_state(v_id);
  assert st.status in ('synced', 'attention') and not st.site_changed and not st.crm_changed,
    format('1: recém-publicado está em dia: %s', row_to_json(st));

  -- 2. Produto nunca publicado: alteração no Flow não agenda nada.
  update public.products set sale_price = 41 where id = c_draft;
  assert pg_temp.open_items(c_draft) = 0, '2: não publicado não entra na fila';

  -- 3. Mudança de preço marca stale e agenda; repetições são agrupadas.
  update public.products set sale_price = 45 where id = c_crm;
  select * into q from store.product_sync_queue where crm_product_id = c_crm and status = 'pending';
  assert q.id is not null and q.events = array['preco'], format('3: item com evento preco: %s', row_to_json(q));
  assert q.next_attempt_at > now(), '3: janela de agrupamento';
  assert (select sync_status from store.products where id = v_id) = 'stale', '3: produto stale';
  select * into st from store.product_sync_state(v_id);
  assert st.status = 'stale' and st.crm_changed and st.divergence = 'flow', format('3: estado real: %s', row_to_json(st));
  assert (select sync_status from public.site_products where id = v_id) = 'stale', '3: site_products mostra o real';

  update public.products set production_deadline = '7 dias úteis' where id = c_crm;
  insert into public.product_images (company_id, product_id, url, position)
  values (v_company, c_crm, 'https://example.com/qa-fila.jpg', 0);
  assert pg_temp.open_items(c_crm) = 1, '3: continua um item só';
  assert (select events from store.product_sync_queue where crm_product_id = c_crm and status = 'pending')
    = array['imagens', 'prazo', 'preco'], '3: eventos agrupados';

  -- 4. Antes de vencer, o processador não publica.
  perform pg_temp.act_as(null);
  r := store.process_product_sync_queue(50);
  assert pg_temp.open_items(c_crm) = 1 and (select sale_price from public.products where id = c_crm) = 45,
    '4: item ainda não venceu';
  assert (select base_price from store.products where id = v_id) = 40, '4: loja ainda com o preço antigo';

  -- 5. Vencido, o processador (sem sessão) publica e fecha o item.
  perform pg_temp.due(c_crm);
  r := store.process_product_sync_queue(50);
  assert (r ->> 'done')::int >= 1, format('5: %s', r);
  assert (select base_price from store.products where id = v_id) = 45, '5: preço novo na loja';
  assert (select production_days from store.products where id = v_id) = 7, '5: prazo novo na loja';
  assert (select count(*) from store.product_images where product_id = v_id and url = 'https://example.com/qa-fila.jpg') = 1,
    '5: imagem nova na loja';
  assert pg_temp.open_items(c_crm) = 0, '5: fila vazia';
  assert (select status from store.product_sync_queue where crm_product_id = c_crm order by created_at desc limit 1) = 'done',
    '5: item concluído';
  assert (select count(*) from store.sync_log where origem_id = c_crm and payload ->> 'origin' = 'fila' and sucesso) = 1,
    '5: log registra a origem fila';
  select * into st from store.product_sync_state(v_id);
  assert st.status in ('synced', 'attention') and not st.crm_changed, format('5: em dia: %s', row_to_json(st));
  v_hash := (select content_hash from store.products where id = v_id);

  -- 6. Edição direta na loja: attention, lado "site", sem item na fila.
  update store.products set short_description = 'editado na loja' where id = v_id;
  select * into st from store.product_sync_state(v_id);
  assert st.status = 'attention' and st.site_changed and st.divergence = 'site', format('6: %s', row_to_json(st));
  assert pg_temp.open_items(c_crm) = 0, '6: edição na loja não agenda';

  -- 7. Mudança nos dois lados é reconhecida como "ambos".
  update public.products set name = 'QA fila renomeado' where id = c_crm;
  select * into st from store.product_sync_state(v_id);
  assert st.divergence = 'ambos', format('7: %s', row_to_json(st));

  -- 8. Publicação manual resolve a fila e a divergência.
  perform pg_temp.act_as(v_owner);
  r := store.publish_crm_product(c_crm);
  assert r ->> 'ok' = 'true', format('8: %s', r);
  assert pg_temp.open_items(c_crm) = 0, '8: publicação manual fecha o item';
  select * into st from store.product_sync_state(v_id);
  assert st.divergence is null and st.status in ('synced', 'attention'), format('8: %s', row_to_json(st));

  -- 9. Falha: novas tentativas com intervalo crescente e, no fim, error.
  update public.products set category = '' where id = c_crm;
  perform pg_temp.act_as(null);
  perform pg_temp.due(c_crm);
  perform store.process_product_sync_queue(50);
  select * into q from store.product_sync_queue where crm_product_id = c_crm and status = 'pending';
  assert q.attempts = 1 and q.last_error like 'Defina a categoria%', format('9: %s', row_to_json(q));
  assert q.next_attempt_at between now() + interval '50 seconds' and now() + interval '70 seconds', '9: 1 min';
  assert (select sync_status from store.products where id = v_id) = 'error', '9: produto em erro';
  perform pg_temp.due(c_crm);
  perform store.process_product_sync_queue(50);
  select * into q from store.product_sync_queue where crm_product_id = c_crm and status = 'pending';
  assert q.attempts = 2 and q.next_attempt_at > now() + interval '3 minutes', '9: 4 min na segunda';
  update store.product_sync_queue set attempts = max_attempts - 1 where id = q.id;
  perform pg_temp.due(c_crm);
  perform store.process_product_sync_queue(50);
  assert (select status from store.product_sync_queue where id = q.id) = 'error', '9: desiste após max_attempts';
  select * into st from store.product_sync_state(v_id);
  assert st.status = 'error', '9: estado real error';

  -- 10. Nova alteração depois da desistência abre item novo, com tentativas zeradas.
  update public.products set category = 'QA Categoria' where id = c_crm;
  select * into q from store.product_sync_queue where crm_product_id = c_crm and status = 'pending';
  assert q.id is not null and q.attempts = 0, '10: item novo';
  perform pg_temp.due(c_crm);
  perform store.process_product_sync_queue(50);
  assert (select sync_status from store.products where id = v_id) in ('synced', 'attention'), '10: recuperado';

  -- 11. Interrupção: se o lote cair, o item volta intacto (transação).
  update public.products set sale_price = 46 where id = c_crm;
  perform pg_temp.due(c_crm);
  begin
    perform store.process_product_sync_queue(50);
    raise exception 'simula queda';
  exception when raise_exception then null;
  end;
  select * into q from store.product_sync_queue where crm_product_id = c_crm and status = 'pending';
  assert q.id is not null and q.attempts = 0, '11: item continua pendente, sem tentativa gasta';
  assert (select base_price from store.products where id = v_id) = 45, '11: nada aplicado';

  -- 12. auto_sync desligado: marca stale, mas não agenda.
  perform store.process_product_sync_queue(50);
  update store.products set auto_sync = false where id = v_id;
  update public.products set sale_price = 47 where id = c_crm;
  assert pg_temp.open_items(c_crm) = 0, '12: sem item com auto_sync desligado';
  select * into st from store.product_sync_state(v_id);
  assert st.status = 'stale', '12: continua visível como desatualizado';

  -- 13. Produto excluído no Flow com item aberto: cancelado, não erro.
  insert into store.product_sync_queue (crm_product_id, next_attempt_at)
  values ('00000000-0000-4000-8000-0000000000ff', now() - interval '1 second');
  perform store.process_product_sync_queue(50);
  assert (select status from store.product_sync_queue where crm_product_id = '00000000-0000-4000-8000-0000000000ff')
    = 'cancelled', '13: cancelado';

  -- 13b. Publicado antes da assinatura (sem content_hash nem source_updated_at),
  --      Flow editado antes da publicação: stale por falta de assinatura, não
  --      "Flow alterado".
  update store.products set auto_sync = true where id = v_id;
  perform store.process_product_sync_queue(50);
  update store.product_sync_queue set status = 'done' where crm_product_id = c_crm and status in ('pending', 'error');
  update store.products set content_hash = null, source_updated_at = null, sync_status = 'synced',
    synced_at = (select updated_at from public.products where id = c_crm) + interval '1 minute'
  where id = v_id;
  select * into st from store.product_sync_state(v_id);
  assert st.status = 'stale' and not st.crm_changed and st.divergence = 'sem_assinatura',
    format('13b: %s', row_to_json(st));

  -- 14. Nativo não tem estado de sincronização.
  assert (select status from store.product_sync_state((select id from store.products where sync_origin = 'site' limit 1)))
    = 'native', '14: nativo';
end $$;

-- 15. Só a fila (service_role / cron) processa; usuário comum não.
do $$
begin
  assert not has_function_privilege('authenticated', 'store.process_product_sync_queue(integer)', 'execute'),
    '15: authenticated não processa a fila';
  assert not has_function_privilege('authenticated', 'store.publish_crm_product_internal(uuid, text)', 'execute'),
    '15: authenticated não chama a publicação interna';
end $$;

rollback;
