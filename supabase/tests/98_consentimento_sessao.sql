-- Consentimento depois da chegada (migração 20261001040000). Transação desfeita no fim.
begin;
\o /dev/null

do $$
declare
  v_company uuid := public.crm_default_company();
  v_cliente constant uuid := '00000000-0000-4000-8000-0000000000d1';
  v_sid uuid := gen_random_uuid();
  v_pedido uuid;
  e record;
begin
  insert into auth.users (id, email) values (v_cliente, 'qa.consent@homolog.local') on conflict do nothing;
  if v_company is null then
    insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000d3', 'qa.consent.dono@homolog.local');
    insert into public.companies (name, owner_id, store_access) values ('QA loja', '00000000-0000-4000-8000-0000000000d3', true);
  end if;
  insert into store.profiles (id, role, full_name, email, active)
  values (v_cliente, 'cliente', 'QA consentimento', 'qa.consent@homolog.local', true)
  on conflict (id) do update set role = 'cliente', active = true;

  -- 1. Chega pelo anúncio sem consentimento, compra e o pagamento é confirmado.
  perform store.record_marketing_touchpoint(v_sid,
    '{"utm_source": "facebook", "utm_medium": "paid_social", "utm_campaign": "qa", "fbclid": "present", "ads_consent": false}');
  insert into store.orders (profile_id, status, payment_status, payment_method, subtotal, total, billing)
  values (v_cliente, 'aguardando_pagamento', 'pendente', 'pix', 50, 50, '{"email": "c@exemplo.com"}')
  returning id into v_pedido;
  perform store.link_marketing_session(v_sid, 'order', v_pedido);
  update store.orders set payment_status = 'pago' where id = v_pedido;
  assert (select skip_reason from store.conversion_events where order_id = v_pedido) = 'sem_consentimento', '1: segurado';

  -- 2. Aceita depois: sessão marcada, _fbc/_fbp guardados, compra liberada com eles.
  assert store.record_marketing_consent(v_sid, true, 'Mozilla/5.0 QA',
    'fb.1.1790000000000.IwAR-qa', 'fb.1.1790000000000.987654321'), '2: registrado';
  assert (select ads_consent and client_user_agent = 'Mozilla/5.0 QA' from store.marketing_sessions where id = v_sid), '2: sessão';
  select * into e from store.conversion_events where order_id = v_pedido;
  assert e.status = 'pending', format('2: liberado (%s/%s)', e.status, e.skip_reason);
  assert e.payload -> 'user_data' ->> 'fbc' = 'fb.1.1790000000000.IwAR-qa', '2: fbc no evento';
  assert e.payload -> 'user_data' ->> 'fbp' = 'fb.1.1790000000000.987654321', '2: fbp no evento';

  -- 3. Formato inválido de cookie é descartado.
  perform store.record_marketing_consent(v_sid, true, 'UA', 'fb.1.123.<script>', 'abc');
  assert (select fbc = 'fb.1.1790000000000.IwAR-qa' from store.marketing_touchpoints where session_id = v_sid), '3: mantém o válido';

  -- 4. Revoga: identificadores apagados, evento não enviado é segurado.
  perform store.record_marketing_consent(v_sid, false);
  assert (select not ads_consent and client_user_agent is null from store.marketing_sessions where id = v_sid), '4: sessão limpa';
  assert (select bool_and(fbc is null and fbp is null and fbclid is null) from store.marketing_touchpoints where session_id = v_sid), '4: identificadores apagados';
  assert (select status = 'skipped' and skip_reason = 'consentimento_revogado' and payload = '{}'::jsonb
            from store.conversion_events where order_id = v_pedido), '4: evento segurado';

  -- 5. Aceita de novo: volta a sair (sem os identificadores apagados).
  perform store.record_marketing_consent(v_sid, true, 'UA2');
  select * into e from store.conversion_events where order_id = v_pedido;
  assert e.status = 'pending' and e.payload -> 'user_data' ->> 'fbc' is null, format('5: %s', e.status);

  -- 6. Evento já enviado nunca é tocado pela revogação.
  update store.conversion_events set status = 'sent' where order_id = v_pedido;
  perform store.record_marketing_consent(v_sid, false);
  assert (select status from store.conversion_events where order_id = v_pedido) = 'sent', '6: enviado permanece';

  -- 7. Só o servidor chama.
  set local role authenticated;
  begin
    perform store.record_marketing_consent(v_sid, true);
    raise exception 'FALHA 7: navegador registra consentimento';
  exception when insufficient_privilege then null;
  end;
  reset role;
end $$;

\o
select 'consentimento da sessão: ok' as resultado;
rollback;
