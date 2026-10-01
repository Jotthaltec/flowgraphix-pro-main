-- Atribuição de marketing (migração 20261001020000). Transação desfeita no fim.
begin;
\o /dev/null

create function pg_temp.act_as(p_user uuid) returns void language sql as $f$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true),
         set_config('request.jwt.claim.sub', p_user::text, true);
$f$;

create function pg_temp.pedido(p_cliente uuid, p_total numeric, p_credito numeric, p_quote uuid default null)
returns uuid language plpgsql as $f$
declare v_id uuid;
begin
  insert into store.orders (profile_id, status, payment_status, payment_method, subtotal, total, credit_used, shipping_cost, quote_id)
  values (p_cliente, 'aguardando_pagamento', 'pendente', 'pix', p_total, p_total, p_credito, 12, p_quote)
  returning id into v_id;
  return v_id;
end $f$;

create function pg_temp.pagar(p_order uuid) returns void language sql as $f$
  update store.orders set payment_status = 'pago', status = 'pago' where id = p_order;
$f$;

do $$
declare
  v_company uuid := public.crm_default_company();
  v_owner uuid;
  v_outro_dono constant uuid := '00000000-0000-4000-8000-0000000000a2';
  v_outra_empresa uuid;
  v_cliente constant uuid := '00000000-0000-4000-8000-0000000000a1';
  v_sid uuid := gen_random_uuid();
  v_sid2 uuid := gen_random_uuid();
  v_sid3 uuid := gen_random_uuid();
  v_tp uuid;
  v_tp2 uuid;
  v_pedido uuid;
  v_quote uuid;
  r record;
  n integer;
begin
  insert into auth.users (id, email) values
    (v_cliente, 'qa.atrib@homolog.local'), (v_outro_dono, 'qa.atrib.outro@homolog.local')
  on conflict do nothing;
  if v_company is null then
    insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000a3', 'qa.atrib.dono@homolog.local');
    insert into public.companies (name, owner_id, store_access)
    values ('QA loja', '00000000-0000-4000-8000-0000000000a3', true);
    v_company := public.crm_default_company();
  end if;
  select owner_id into v_owner from public.companies where id = v_company;
  insert into public.companies (name, owner_id, store_access) values ('QA outra', v_outro_dono, false)
  returning id into v_outra_empresa;
  insert into store.profiles (id, role, full_name, email, active)
  values (v_cliente, 'cliente', 'QA atribuição', 'qa.atrib@homolog.local', true)
  on conflict (id) do update set role = 'cliente', active = true;

  -- 1. Visita com UTMs de anúncio, sem consentimento: fbclid não é guardado.
  v_tp := store.record_marketing_touchpoint(v_sid, jsonb_build_object(
    'utm_source', ' Facebook ', 'utm_medium', 'CPC', 'utm_campaign', 'cartao-visita-set',
    'utm_content', 'reel-a', 'meta_campaign_id', '120200000000001', 'meta_adset_id', '120200000000002',
    'meta_ad_id', '120200000000003', 'fbclid', 'IwAR-teste', 'landing_path', '/produto/cartao',
    'client_user_agent', 'Mozilla/5.0 QA', 'ads_consent', false));
  assert v_tp is not null, '1: ponto criado';
  select * into r from store.marketing_touchpoints where id = v_tp;
  assert r.utm_source = 'facebook' and r.utm_medium = 'cpc', '1: normalização';
  assert r.channel = 'paid_social', format('1: canal %s', r.channel);
  assert r.fbclid is null and r.fbc is null, '1: sem consentimento não guarda fbclid/fbc';
  assert (select client_user_agent is null and not ads_consent from store.marketing_sessions where id = v_sid),
    '1: sem consentimento não guarda user agent';

  -- 2. Recarregar a mesma URL não duplica.
  assert store.record_marketing_touchpoint(v_sid, jsonb_build_object(
    'utm_source', 'facebook', 'utm_medium', 'cpc', 'utm_campaign', 'cartao-visita-set', 'utm_content', 'reel-a',
    'meta_campaign_id', '120200000000001', 'meta_adset_id', '120200000000002', 'meta_ad_id', '120200000000003',
    'fbclid', 'IwAR-teste', 'landing_path', '/produto/cartao')) = v_tp, '2: mesmo ponto';
  assert (select hits from store.marketing_touchpoints where id = v_tp) = 2, '2: hits';
  assert (select count(*) from store.marketing_touchpoints where session_id = v_sid) = 1, '2: um ponto só';

  -- 3. Navegação interna sem sinal só renova a sessão; ID de anúncio inválido é descartado.
  assert store.record_marketing_touchpoint(v_sid, '{"landing_path": "/carrinho"}') is null, '3: sem sinal';
  v_tp2 := store.record_marketing_touchpoint(v_sid3, '{"utm_source": "x", "meta_ad_id": "1; drop table"}');
  assert (select meta_ad_id is null from store.marketing_touchpoints where id = v_tp2), '3: id inválido descartado';

  -- 4. Pedido pendente ligado à sessão: ainda sem atribuição.
  v_pedido := pg_temp.pedido(v_cliente, 100, 10);
  assert store.link_marketing_session(v_sid, 'order', v_pedido), '4: vínculo criado';
  assert not store.link_marketing_session(v_sid, 'order', v_pedido), '4: vínculo idempotente';
  assert (select profile_id from store.marketing_sessions where id = v_sid) = v_cliente, '4: sessão ganha o perfil';
  assert not exists (select 1 from store.order_attributions where order_id = v_pedido), '4: pendente não atribui';

  -- 5. Pagamento confirmado: dois modelos, último contato é o principal, receita = total + crédito.
  perform pg_temp.pagar(v_pedido);
  assert (select count(*) from store.order_attributions where order_id = v_pedido) = 2, '5: dois modelos';
  select * into r from store.order_attributions where order_id = v_pedido and is_primary;
  assert r.model = 'last_touch' and r.utm_campaign = 'cartao-visita-set' and r.meta_ad_id = '120200000000003',
    format('5: principal %s', row_to_json(r));
  assert r.revenue = 110 and r.shipping = 12 and r.status = 'active', format('5: valores %s/%s', r.revenue, r.shipping);

  -- 6. Recalcular e reconfirmar não duplica nem gera auditoria nova.
  select count(*) into n from store.marketing_attribution_audit where order_id = v_pedido;
  perform store.attribute_order(v_pedido);
  update store.orders set payment_status = 'pago' where id = v_pedido;
  assert (select count(*) from store.order_attributions where order_id = v_pedido) = 2, '6: sem duplicar';
  assert (select count(*) from store.marketing_attribution_audit where order_id = v_pedido) = n, '6: sem auditoria nova';

  -- 7. Primeiro contato orgânico, último pago.
  v_pedido := pg_temp.pedido(v_cliente, 50, 0);
  v_tp := store.record_marketing_touchpoint(v_sid2, '{"utm_source": "instagram", "utm_medium": "bio", "landing_path": "/"}');
  v_tp2 := store.record_marketing_touchpoint(v_sid2, '{"utm_source": "facebook", "utm_medium": "paid", "utm_campaign": "remarketing", "landing_path": "/"}');
  update store.marketing_touchpoints set first_occurred_at = now() - interval '3 days', occurred_at = now() - interval '3 days' where id = v_tp;
  update store.marketing_touchpoints set first_occurred_at = now() - interval '1 day', occurred_at = now() - interval '1 day' where id = v_tp2;
  perform store.link_marketing_session(v_sid2, 'order', v_pedido);
  perform pg_temp.pagar(v_pedido);
  assert (select touchpoint_id from store.order_attributions where order_id = v_pedido and model = 'first_touch') = v_tp, '7: primeiro';
  assert (select touchpoint_id from store.order_attributions where order_id = v_pedido and model = 'last_touch') = v_tp2, '7: último';
  assert (select channel from store.order_attributions where order_id = v_pedido and model = 'first_touch') = 'organic_social', '7: canal orgânico';

  -- 8. Fora da janela (padrão 7 dias) vira direto.
  v_pedido := pg_temp.pedido(v_cliente, 30, 0);
  v_sid := gen_random_uuid();
  v_tp := store.record_marketing_touchpoint(v_sid, '{"utm_source": "facebook", "utm_medium": "cpc", "utm_campaign": "antiga"}');
  update store.marketing_touchpoints set first_occurred_at = now() - interval '10 days', occurred_at = now() - interval '10 days' where id = v_tp;
  perform store.link_marketing_session(v_sid, 'order', v_pedido);
  perform pg_temp.pagar(v_pedido);
  assert (select channel from store.order_attributions where order_id = v_pedido and is_primary) = 'direct', '8: fora da janela';

  -- 9. Orçamento pelo site convertido em pedido herda a origem do orçamento.
  v_sid := gen_random_uuid();
  v_tp := store.record_marketing_touchpoint(v_sid, '{"utm_source": "facebook", "utm_medium": "cpc", "utm_campaign": "orcamento-banner"}');
  insert into store.quotes (status, title, source, contact_name) values ('aprovado', 'QA', 'site', 'QA') returning id into v_quote;
  perform store.link_marketing_session(v_sid, 'quote', v_quote);
  v_pedido := pg_temp.pedido(v_cliente, 200, 0, v_quote);
  perform pg_temp.pagar(v_pedido);
  assert (select utm_campaign from store.order_attributions where order_id = v_pedido and is_primary) = 'orcamento-banner', '9: via orçamento';

  -- 10. Pedido pago sem nenhum rastreio aparece como direto (não some).
  v_pedido := pg_temp.pedido(v_cliente, 40, 0);
  perform pg_temp.pagar(v_pedido);
  assert (select channel from store.order_attributions where order_id = v_pedido and is_primary) = 'direct', '10: direto';

  -- 11. Pedido que nasce pago (total zero) e só depois é ligado à sessão.
  v_sid := gen_random_uuid();
  v_tp := store.record_marketing_touchpoint(v_sid, '{"utm_source": "facebook", "utm_medium": "cpc", "utm_campaign": "credito"}');
  insert into store.orders (profile_id, status, payment_status, payment_method, subtotal, total, credit_used)
  values (v_cliente, 'pago', 'pago', 'credito_interno', 80, 0, 80) returning id into v_pedido;
  assert (select channel from store.order_attributions where order_id = v_pedido and is_primary) = 'direct', '11: nasce direto';
  perform store.link_marketing_session(v_sid, 'order', v_pedido);
  select * into r from store.order_attributions where order_id = v_pedido and is_primary;
  assert r.utm_campaign = 'credito' and r.revenue = 80, format('11: religado %s', row_to_json(r));
  assert exists (select 1 from store.marketing_attribution_audit where order_id = v_pedido and action = 'reattributed'), '11: auditoria';

  -- 12. Estorno reverte sem apagar; reconfirmação reativa.
  update store.orders set payment_status = 'estornado' where id = v_pedido;
  assert (select bool_and(status = 'reversed' and reversal_reason = 'estornado') from store.order_attributions where order_id = v_pedido), '12: revertido';
  assert exists (select 1 from store.marketing_attribution_audit where order_id = v_pedido and action = 'reversed'), '12: auditoria';
  perform pg_temp.pagar(v_pedido);
  assert (select bool_and(status = 'active') from store.order_attributions where order_id = v_pedido), '12: reativado';

  -- 13. Correção manual: dono corrige com motivo; recálculo não sobrescreve.
  perform pg_temp.act_as(v_owner);
  perform store.correct_order_attribution(v_pedido, null, 'Cliente veio por indicação do balcão');
  select * into r from store.order_attributions where order_id = v_pedido and is_primary;
  assert r.source = 'manual' and r.channel = 'direct', '13: corrigido';
  perform store.attribute_order(v_pedido);
  assert (select source = 'manual' and channel = 'direct' from store.order_attributions where order_id = v_pedido and is_primary), '13: manual preservado';
  begin
    perform store.correct_order_attribution(v_pedido, null, 'x');
    raise exception 'FALHA 13: motivo curto aceito';
  exception when sqlstate '22023' then null;
  end;
  perform pg_temp.act_as(v_outro_dono);
  begin
    perform store.correct_order_attribution(v_pedido, null, 'Tentativa de outra empresa');
    raise exception 'FALHA 13: outra empresa corrigiu';
  exception when insufficient_privilege then null;
  end;

  -- 14. RLS: dono lê; dono de outra empresa e cliente não leem nada; ninguém grava direto.
  perform pg_temp.act_as(v_owner);
  set local role authenticated;
  assert (select count(*) from store.order_attributions where order_id = v_pedido) = 2, '14: dono lê';
  reset role;
  perform pg_temp.act_as(v_outro_dono);
  set local role authenticated;
  assert (select count(*) from store.order_attributions) = 0, '14: outra empresa não lê';
  assert (select count(*) from store.marketing_touchpoints) = 0, '14: outra empresa não lê pontos';
  begin
    insert into store.order_attributions (order_id, company_id, order_number, model, is_primary, channel, revenue, window_days, settings_version)
    values (v_pedido, v_outra_empresa, 'X', 'first_touch', false, 'direct', 1, 7, 0);
    raise exception 'FALHA 14: insert direto aceito';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from store.marketing_sessions;
    raise exception 'FALHA 14: sessões legíveis';
  exception when insufficient_privilege then null;
  end;
  reset role;
  perform pg_temp.act_as(v_cliente);
  set local role authenticated;
  assert (select count(*) from store.order_attributions) = 0, '14: cliente não lê';
  begin
    perform store.record_marketing_touchpoint(gen_random_uuid(), '{"utm_source": "x"}');
    raise exception 'FALHA 14: navegador grava ponto';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- 15. Sessão de outra empresa é recusada (sem atribuição cruzada).
  v_sid := gen_random_uuid();
  insert into store.marketing_sessions (id, company_id) values (v_sid, v_outra_empresa);
  begin
    perform store.record_marketing_touchpoint(v_sid, '{"utm_source": "facebook"}');
    raise exception 'FALHA 15: sessão cruzada aceita';
  exception when insufficient_privilege then null;
  end;

  -- 16. Com consentimento: fbc no formato da Meta e user agent guardados.
  v_sid := gen_random_uuid();
  v_tp := store.record_marketing_touchpoint(v_sid, '{"utm_source": "facebook", "fbclid": "IwAR-ok", "ads_consent": true, "client_user_agent": "UA"}');
  assert (select fbclid = 'IwAR-ok' and fbc ~ '^fb\.1\.[0-9]{13}\.IwAR-ok$' from store.marketing_touchpoints where id = v_tp), '16: fbc';
  assert (select client_user_agent = 'UA' from store.marketing_sessions where id = v_sid), '16: user agent';

  -- 17. Auditoria é somente inclusão.
  begin
    update store.marketing_attribution_audit set reason = 'x' where order_id = v_pedido;
    raise exception 'FALHA 17: auditoria alterada';
  exception when insufficient_privilege then null;
  end;

  -- 18. Configuração versionada muda o modelo principal.
  perform pg_temp.act_as(v_owner);
  perform store.set_marketing_attribution_settings(14, 'first_touch');
  assert (select version = 1 and window_days = 14 from store.marketing_attribution_settings where company_id = v_company), '18: criada';
  perform store.set_marketing_attribution_settings(7, 'last_touch');
  assert (select version = 2 from store.marketing_attribution_settings where company_id = v_company), '18: versão';
end $$;

\o
select 'atribuição de marketing: ok' as resultado;
rollback;
