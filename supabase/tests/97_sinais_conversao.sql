-- Sinais de conversão (migrações 20261001030000/030100). Transação desfeita no fim.
begin;
\o /dev/null

create function pg_temp.act_as(p_user uuid) returns void language sql as $f$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true),
         set_config('request.jwt.claim.sub', p_user::text, true);
$f$;

create function pg_temp.pedido(p_cliente uuid, p_quote uuid default null) returns uuid language plpgsql as $f$
declare v_id uuid;
begin
  insert into store.orders (profile_id, status, payment_status, payment_method, subtotal, total, credit_used,
                            quote_id, billing)
  values (p_cliente, 'aguardando_pagamento', 'pendente', 'pix', 100, 90, 10, p_quote,
          '{"email": "  Cliente.QA@Exemplo.com ", "phone": "(11) 98765-4321"}')
  returning id into v_id;
  insert into store.order_items (order_id, product_name, sku, quantity, unit_price, total_price)
  values (v_id, 'Cartão QA', 'CARTAO-QA', 100, 0.9, 90);
  return v_id;
end $f$;

create function pg_temp.sessao(p_consent boolean) returns uuid language plpgsql as $f$
declare v_sid uuid := gen_random_uuid();
begin
  perform store.record_marketing_touchpoint(v_sid, jsonb_build_object(
    'utm_source', 'facebook', 'utm_medium', 'paid_social', 'fbclid', 'IwAR-qa', 'fbp', 'fb.1.1700000000000.42',
    'ads_consent', p_consent, 'client_user_agent', 'Mozilla/5.0 QA', 'landing_path', '/produtos/cartao'));
  return v_sid;
end $f$;

do $$
declare
  v_company uuid := public.crm_default_company();
  v_owner uuid;
  v_cliente constant uuid := '00000000-0000-4000-8000-0000000000b1';
  v_intruso constant uuid := '00000000-0000-4000-8000-0000000000b2';
  v_pedido uuid;
  v_quote uuid;
  v_sid uuid;
  e record;
  v_ids uuid[];
  v_id2 uuid;
  v_status text;
begin
  insert into auth.users (id, email) values (v_cliente, 'qa.sinais@homolog.local'), (v_intruso, 'qa.intruso@homolog.local')
  on conflict do nothing;
  if v_company is null then
    insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000b3', 'qa.sinais.dono@homolog.local');
    insert into public.companies (name, owner_id, store_access) values ('QA loja', '00000000-0000-4000-8000-0000000000b3', true);
    v_company := public.crm_default_company();
  end if;
  select owner_id into v_owner from public.companies where id = v_company;
  -- Pré-condição própria: o estado "nunca configurado" (a homologação pode
  -- estar com os sinais ligados; a transação é desfeita no fim).
  delete from store.marketing_signal_settings where company_id = v_company;
  insert into store.profiles (id, role, full_name, email, active)
  values (v_cliente, 'cliente', 'QA sinais', 'qa.sinais@homolog.local', true)
  on conflict (id) do update set role = 'cliente', active = true;

  -- 1. Pedido pendente não gera Purchase.
  v_pedido := pg_temp.pedido(v_cliente);
  perform store.link_marketing_session(pg_temp.sessao(true), 'order', v_pedido);
  assert not exists (select 1 from store.conversion_events where order_id = v_pedido), '1: pendente sem evento';

  -- 2. Pago com consentimento: um Purchase pendente, valor real, PII só em hash.
  update store.orders set payment_status = 'pago', status = 'pago' where id = v_pedido;
  select * into e from store.conversion_events where order_id = v_pedido;
  assert e.event_name = 'Purchase' and e.event_id = 'purchase:' || v_pedido and e.status = 'pending', format('2: %s', e.status);
  assert (e.payload -> 'custom_data' ->> 'value')::numeric = 100, '2: valor = total + crédito';
  assert e.payload -> 'custom_data' ->> 'currency' = 'BRL', '2: moeda';
  assert e.payload -> 'custom_data' -> 'contents' -> 0 ->> 'id' = 'CARTAO-QA', '2: produto';
  assert e.payload -> 'user_data' -> 'em' ->> 0 = encode(sha256(convert_to('cliente.qa@exemplo.com', 'UTF8')), 'hex'), '2: e-mail em hash normalizado';
  assert e.payload -> 'user_data' -> 'ph' ->> 0 = encode(sha256(convert_to('5511987654321', 'UTF8')), 'hex'), '2: telefone com DDI em hash';
  assert e.payload::text not ilike '%exemplo.com%' and e.payload::text not like '%98765%', '2: nada em texto puro';
  assert e.payload -> 'user_data' ->> 'fbc' like 'fb.1.%.IwAR-qa', '2: fbc';
  assert e.payload -> 'user_data' ->> 'client_user_agent' = 'Mozilla/5.0 QA', '2: user agent';
  assert e.payload ->> 'action_source' = 'website' and e.payload ->> 'event_source_url' like 'https://%/produtos/cartao', '2: origem';

  -- 3. Confirmar de novo não duplica.
  update store.orders set payment_status = 'pago' where id = v_pedido;
  perform store.enqueue_purchase_event(v_pedido);
  assert (select count(*) from store.conversion_events where order_id = v_pedido) = 1, '3: um evento só';

  -- 4. Estorno antes do envio: não sai mais.
  update store.orders set payment_status = 'estornado' where id = v_pedido;
  assert (select status = 'skipped' and skip_reason = 'pagamento_revertido' and payload = '{}'::jsonb
            from store.conversion_events where order_id = v_pedido), '4: revertido';

  -- 5. Sem consentimento: registrado como skipped, sem corpo.
  v_pedido := pg_temp.pedido(v_cliente);
  perform store.link_marketing_session(pg_temp.sessao(false), 'order', v_pedido);
  update store.orders set payment_status = 'pago' where id = v_pedido;
  assert (select status = 'skipped' and skip_reason = 'sem_consentimento' and payload = '{}'::jsonb
            from store.conversion_events where order_id = v_pedido), '5: sem consentimento';

  -- 6. Pago sem sessão e ligado depois com consentimento: promovido para pending.
  v_pedido := pg_temp.pedido(v_cliente);
  update store.orders set payment_status = 'pago' where id = v_pedido;
  assert (select skip_reason from store.conversion_events where order_id = v_pedido) = 'sem_sessao', '6: sem sessão';
  perform store.link_marketing_session(pg_temp.sessao(true), 'order', v_pedido);
  assert (select status from store.conversion_events where order_id = v_pedido) = 'pending', '6: promovido';

  -- 7. Lead: orçamento do site com consentimento; orçamento interno não gera.
  insert into store.quotes (status, title, source, contact_name, contact_email, contact_phone)
  values ('rascunho', 'QA', 'site', 'QA', 'lead.qa@exemplo.com', '11912345678') returning id into v_quote;
  perform store.link_marketing_session(pg_temp.sessao(true), 'quote', v_quote);
  select * into e from store.conversion_events where quote_id = v_quote and event_name = 'Lead';
  assert e.event_id = 'lead:' || v_quote and e.status = 'pending', '7: lead';
  assert e.payload::text not ilike '%lead.qa%', '7: lead sem e-mail puro';
  insert into store.quotes (status, title, source, contact_name) values ('rascunho', 'QA', 'painel', 'QA') returning id into v_quote;
  perform store.link_marketing_session(pg_temp.sessao(true), 'quote', v_quote);
  assert not exists (select 1 from store.conversion_events where quote_id = v_quote), '7: interno sem lead';

  -- 8. Worker: reserva exclusiva, sucesso, repetição seletiva, falha final, expiração.
  update store.conversion_events set next_attempt_at = now() + interval '1 day' where status = 'pending';
  v_pedido := pg_temp.pedido(v_cliente);
  perform store.link_marketing_session(pg_temp.sessao(true), 'order', v_pedido);
  update store.orders set payment_status = 'pago' where id = v_pedido;
  select array_agg(c.id) into v_ids from store.claim_conversion_events(10) c;
  assert array_length(v_ids, 1) = 1, format('8: um vencido, veio %s', array_length(v_ids, 1));
  assert not exists (select 1 from store.claim_conversion_events(10)), '8: reservado não volta';
  assert store.complete_conversion_event(v_ids[1], 503, 'test', 'http_503', 'Service Unavailable') = 'pending', '8: 5xx repete';
  assert (select next_attempt_at > now() from store.conversion_events where id = v_ids[1]), '8: com espera';
  update store.conversion_events set next_attempt_at = now() where id = v_ids[1];
  perform store.claim_conversion_events(10);
  assert store.complete_conversion_event(v_ids[1], 0, 'test', 'timeout') = 'pending', '8: timeout repete';
  update store.conversion_events set next_attempt_at = now() where id = v_ids[1];
  perform store.claim_conversion_events(10);
  assert store.complete_conversion_event(v_ids[1], 200, 'test', null, null, 'AbCtrace', 1) = 'sent', '8: enviado';
  assert (select sent_mode = 'test' and events_received = 1 and attempts = 3 from store.conversion_events where id = v_ids[1]), '8: registro';
  assert store.complete_conversion_event(v_ids[1], 500, 'test') = 'ignored', '8: concluído não reabre';

  v_pedido := pg_temp.pedido(v_cliente);
  perform store.link_marketing_session(pg_temp.sessao(true), 'order', v_pedido);
  update store.orders set payment_status = 'pago' where id = v_pedido;
  select c.id into v_id2 from store.claim_conversion_events(10) c;
  assert store.complete_conversion_event(v_id2, 400, 'test', '100', 'Invalid parameter') = 'failed', '8: 4xx é final';
  update store.conversion_events set status = 'pending', attempts = 5, next_attempt_at = now() where id = v_id2;
  perform store.claim_conversion_events(10);
  assert store.complete_conversion_event(v_id2, 429, 'test') = 'failed', '8: 6ª tentativa encerra';

  update store.conversion_events set status = 'pending', next_attempt_at = now(), event_time = now() - interval '8 days'
   where id = v_id2;
  perform store.claim_conversion_events(10);
  assert (select status from store.conversion_events where id = v_id2) = 'expired', '8: mais de 7 dias expira';

  -- 9. Configuração: desligada por padrão; só dono configura; Pixel público só quando ativo.
  assert store.public_tracking_config() ->> 'pixel_id' is null, '9: sem pixel por padrão';
  assert not (store.meta_capi_config() ->> 'enabled')::boolean, '9: desligado';
  assert not store.dispatch_conversion_events(), '9: não despacha desligado';
  perform pg_temp.act_as(v_intruso);
  begin
    perform store.set_marketing_signal_settings(true, 'test', '123456789012345');
    raise exception 'FALHA 9: intruso configurou';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.act_as(v_owner);
  begin
    perform store.set_marketing_signal_settings(true, 'live', '');
    raise exception 'FALHA 9: modo real sem pixel';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform store.set_marketing_signal_settings(true, 'test', '123456789012345', '');
    raise exception 'FALHA 9: modo teste sem código de teste';
  exception when sqlstate '22023' then null;
  end;
  perform store.set_marketing_signal_settings(true, 'test', '123456789012345', 'TEST123');
  assert store.public_tracking_config() ->> 'pixel_id' = '123456789012345', '9: pixel público quando ativo';
  -- sem token no Vault, o worker continua desligado
  if not exists (select 1 from vault.secrets where name = 'meta_capi_access_token') then
    assert not (store.meta_capi_config() ->> 'enabled')::boolean, '9: sem token não envia';
  end if;
  assert store.meta_capi_config() ->> 'mode' = 'test', '9: modo teste';

  -- 10. RLS: dono lê o estado, não o corpo; cliente e anônimo não leem nada.
  set local role authenticated;
  assert (select count(*) from store.conversion_events where event_name = 'Purchase') > 0, '10: dono lê estado';
  begin
    perform payload from store.conversion_events limit 1;
    raise exception 'FALHA 10: payload legível';
  exception when insufficient_privilege then null;
  end;
  begin
    perform store.claim_conversion_events(1);
    raise exception 'FALHA 10: navegador reserva';
  exception when insufficient_privilege then null;
  end;
  begin
    perform store.meta_capi_config();
    raise exception 'FALHA 10: navegador lê token';
  exception when insufficient_privilege then null;
  end;
  reset role;
  perform pg_temp.act_as(v_cliente);
  set local role authenticated;
  assert (select count(*) from store.conversion_events) = 0, '10: cliente não lê';
  reset role;
  set local role anon;
  assert store.public_tracking_config() ->> 'pixel_id' = '123456789012345', '10: anônimo lê só o pixel';
  reset role;
end $$;

\o
select 'sinais de conversão: ok' as resultado;
rollback;
