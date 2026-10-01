-- Painel de marketing (migração 20261001050000). Transação desfeita no fim.
begin;
\o /dev/null

create function pg_temp.act_as(p_user uuid) returns void language sql as $f$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true),
         set_config('request.jwt.claim.sub', p_user::text, true);
$f$;

do $$
declare
  v_company uuid := public.crm_default_company();
  v_owner uuid;
  v_cliente constant uuid := '00000000-0000-4000-8000-0000000000e1';
  v_outro constant uuid := '00000000-0000-4000-8000-0000000000e2';
  v_sid uuid := gen_random_uuid();
  v_sid2 uuid := gen_random_uuid();
  v_pedido uuid;
  v_pedido2 uuid;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  r jsonb;
  b jsonb;
  n integer;
begin
  insert into auth.users (id, email) values (v_cliente, 'qa.painel@homolog.local'), (v_outro, 'qa.painel.outro@homolog.local')
  on conflict do nothing;
  if v_company is null then
    insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000e3', 'qa.painel.dono@homolog.local');
    insert into public.companies (name, owner_id, store_access) values ('QA loja', '00000000-0000-4000-8000-0000000000e3', true);
    v_company := public.crm_default_company();
  end if;
  select owner_id into v_owner from public.companies where id = v_company;
  insert into public.companies (name, owner_id) values ('QA outra', v_outro);
  insert into store.profiles (id, role, full_name, email, active)
  values (v_cliente, 'cliente', 'QA painel', 'qa.painel@homolog.local', true)
  on conflict (id) do update set role = 'cliente', active = true;

  -- Linha de base (a homologação já tem dados): o teste mede a diferença.
  perform pg_temp.act_as(v_owner);
  b := store.marketing_overview(v_hoje, v_hoje);

  -- Pedido vindo de anúncio, pago; e pedido direto, pago.
  perform store.record_marketing_touchpoint(v_sid,
    '{"utm_source": "facebook", "utm_medium": "paid_social", "utm_campaign": "qa-painel", "meta_campaign_id": "120200000000009"}');
  insert into store.orders (profile_id, status, payment_status, payment_method, subtotal, total)
  values (v_cliente, 'aguardando_pagamento', 'pendente', 'pix', 80, 80) returning id into v_pedido;
  perform store.link_marketing_session(v_sid, 'order', v_pedido);
  update store.orders set payment_status = 'pago' where id = v_pedido;
  insert into store.orders (profile_id, status, payment_status, payment_method, subtotal, total)
  values (v_cliente, 'pago', 'pago', 'pix', 20, 20) returning id into v_pedido2;
  perform store.record_marketing_touchpoint(v_sid2, '{"utm_source": "instagram", "utm_medium": "bio"}');

  -- 1. Visão geral soma o que aconteceu, separando anúncio de direto.
  r := store.marketing_overview(v_hoje, v_hoje);
  assert (r #>> '{funnel,paid_orders}')::int - (b #>> '{funnel,paid_orders}')::int = 2, format('1: pagos %s', r -> 'funnel');
  assert (r #>> '{funnel,ad_paid_orders}')::int - (b #>> '{funnel,ad_paid_orders}')::int = 1, '1: pagos via anúncio';
  assert (r #>> '{funnel,ad_orders}')::int - (b #>> '{funnel,ad_orders}')::int = 1, '1: pedido via anúncio';
  assert (r #>> '{funnel,tracked_sessions}')::int - (b #>> '{funnel,tracked_sessions}')::int = 2, '1: sessões rastreadas';
  assert (r #>> '{revenue,ads}')::numeric - (b #>> '{revenue,ads}')::numeric = 80, '1: receita de anúncio';
  assert (r #>> '{revenue,total}')::numeric - (b #>> '{revenue,total}')::numeric = 100, '1: receita total';
  assert exists (select 1 from jsonb_array_elements(r -> 'by_campaign') c
                  where c ->> 'campaign' = 'qa-painel' and (c ->> 'revenue')::numeric = 80
                    and c ->> 'meta_campaign_id' = '120200000000009'), '1: campanha';
  assert not exists (select 1 from jsonb_array_elements(r -> 'by_campaign') c where c ->> 'channel' = 'direct'),
    '1: direto não vira campanha';
  assert r #> '{spend,value}' = 'null'::jsonb and r #>> '{spend,reason}' is not null, '1: investimento indisponível, com motivo';
  assert (r #>> '{margin,available}')::boolean = false, '1: margem não inventada';

  -- 2. Estorno sai da receita e aparece como estornado.
  update store.orders set payment_status = 'estornado' where id = v_pedido;
  r := store.marketing_overview(v_hoje, v_hoje);
  assert (r #>> '{revenue,ads}')::numeric = (b #>> '{revenue,ads}')::numeric, '2: receita revertida';
  assert (r #>> '{revenue,reversed_orders}')::int - (b #>> '{revenue,reversed_orders}')::int = 1, '2: estornado contado';

  -- 3. Período em São Paulo: amanhã não tem nada novo; período inválido recusa.
  r := store.marketing_overview(v_hoje + 1, v_hoje + 1);
  assert (r #>> '{funnel,paid_orders}')::int = 0, '3: amanhã vazio';
  begin
    perform store.marketing_overview(v_hoje, v_hoje - 1);
    raise exception 'FALHA 3: período invertido aceito';
  exception when sqlstate '22023' then null;
  end;

  -- 4. Lista de pedidos atribuídos e opções de correção só da sessão do pedido.
  assert exists (select 1 from store.marketing_attributed_orders(v_hoje, v_hoje) o
                  where o.order_id = v_pedido and o.status = 'reversed' and o.payment_status = 'estornado'), '4: lista';
  select count(*) into n from store.marketing_correction_options(v_pedido);
  assert n = 1, format('4: opções %s', n);
  assert not exists (select 1 from store.marketing_correction_options(v_pedido) o where o.utm_source = 'instagram'),
    '4: não oferece ponto de outra sessão';

  -- 5. Status dos sinais: só booleanos sobre segredos.
  r := store.marketing_signal_status();
  assert jsonb_typeof(r -> 'token_configured') = 'boolean' and jsonb_typeof(r -> 'dispatch_configured') = 'boolean', '5: tipos';
  assert r::text !~* 'access_token|sb_secret|eyJ', '5: nada de segredo';

  -- 6. Permissões: outra empresa e cliente não veem; membro com override vê.
  perform pg_temp.act_as(v_outro);
  begin
    perform store.marketing_overview(v_hoje, v_hoje);
    raise exception 'FALHA 6: outra empresa viu o painel';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.act_as(v_cliente);
  begin
    perform store.marketing_signal_status();
    raise exception 'FALHA 6: cliente viu status';
  exception when insufficient_privilege then null;
  end;
  insert into public.company_members (company_id, user_id, role, permissions)
  values (v_company, v_cliente, 'vendedor', '{"marketing.view": true}');
  assert store.marketing_overview(v_hoje, v_hoje) is not null, '6: override de leitura';
  begin
    perform store.marketing_correction_options(v_pedido);
    raise exception 'FALHA 6: leitura corrigiu';
  exception when insufficient_privilege then null;
  end;
  set local role anon;
  begin
    perform store.marketing_overview(v_hoje, v_hoje);
    raise exception 'FALHA 6: anônimo viu o painel';
  exception when insufficient_privilege then null;
  end;
  reset role;
end $$;

\o
select 'painel de marketing: ok' as resultado;
rollback;
