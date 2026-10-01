-- =============================================================================
-- PAINEL "ANÚNCIOS E CRESCIMENTO" (leitura para o CRM)
--
-- Agregações no banco, com a permissão conferida aqui: o navegador nunca lê
-- sessões, vínculos nem o corpo dos eventos. Datas do filtro são dias civis em
-- America/Sao_Paulo. Investimento/ROAS só existirão com a importação da Meta;
-- até lá voltam null com o motivo, nunca zero.
-- =============================================================================

create or replace function store.marketing_overview(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_company uuid := public.crm_default_company();
  v_ini timestamptz;
  v_fim timestamptz;
  v_result jsonb;
begin
  if v_company is null or not private.has_marketing_permission(v_company, 'marketing.view') then
    raise exception 'Sem permissão para ver anúncios e crescimento.' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    raise exception 'Período inválido (máximo de 366 dias).' using errcode = '22023';
  end if;
  v_ini := p_from::timestamp at time zone 'America/Sao_Paulo';
  v_fim := (p_to + 1)::timestamp at time zone 'America/Sao_Paulo';

  with paid as (
    select a.* from store.order_attributions a
     where a.company_id = v_company and a.is_primary and a.status = 'active'
       and a.attributed_at >= v_ini and a.attributed_at < v_fim
  ),
  sess_paid as (
    select distinct t.session_id from store.marketing_touchpoints t
     where t.company_id = v_company and t.channel in ('paid_social','paid_search')
  ),
  links as (
    select l.*, (l.session_id in (select session_id from sess_paid)) as via_anuncio
      from store.marketing_session_links l
     where l.company_id = v_company and l.linked_at >= v_ini and l.linked_at < v_fim
  )
  select jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to, 'timezone', 'America/Sao_Paulo'),
    'funnel', jsonb_build_object(
      'tracked_sessions', (select count(distinct t.session_id) from store.marketing_touchpoints t
                            where t.company_id = v_company and t.occurred_at >= v_ini and t.occurred_at < v_fim),
      'ad_sessions', (select count(distinct t.session_id) from store.marketing_touchpoints t
                       where t.company_id = v_company and t.occurred_at >= v_ini and t.occurred_at < v_fim
                         and t.channel in ('paid_social','paid_search')),
      'quotes', (select count(*) from links where subject_type = 'quote'),
      'ad_quotes', (select count(*) from links where subject_type = 'quote' and via_anuncio),
      'orders', (select count(*) from links where subject_type = 'order'),
      'ad_orders', (select count(*) from links where subject_type = 'order' and via_anuncio),
      'paid_orders', (select count(*) from paid),
      'ad_paid_orders', (select count(*) from paid where channel in ('paid_social','paid_search'))
    ),
    'revenue', jsonb_build_object(
      'total', (select coalesce(sum(revenue), 0) from paid),
      'ads', (select coalesce(sum(revenue), 0) from paid where channel in ('paid_social','paid_search')),
      'reversed_orders', (select count(*) from store.order_attributions a
                           where a.company_id = v_company and a.is_primary and a.status = 'reversed'
                             and a.reversed_at >= v_ini and a.reversed_at < v_fim)
    ),
    'by_channel', coalesce((select jsonb_agg(x order by x.revenue desc) from (
        select channel, count(*) as orders, sum(revenue) as revenue from paid group by channel) x), '[]'::jsonb),
    'by_campaign', coalesce((select jsonb_agg(x order by x.revenue desc) from (
        select coalesce(utm_campaign, meta_campaign_id, '(sem nome)') as campaign,
               max(meta_campaign_id) as meta_campaign_id, max(utm_source) as source, max(channel) as channel,
               count(*) as orders, sum(revenue) as revenue, max(attributed_at) as last_order_at
          from paid where channel <> 'direct'
         group by coalesce(utm_campaign, meta_campaign_id, '(sem nome)')
         order by sum(revenue) desc limit 50) x), '[]'::jsonb),
    'spend', jsonb_build_object('value', null, 'reason', 'Conta Meta ainda não importada.'),
    'margin', jsonb_build_object(
      'available', false,
      'products_with_cost', (select count(*) from store.product_costs c where c.cost_price > 0 or c.supplier_cost > 0),
      'reason', 'Margem exige custo cadastrado e congelado no pagamento; ainda não calculada.')
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function store.marketing_overview(date, date) from public, anon;
grant execute on function store.marketing_overview(date, date) to authenticated, service_role;

-- Pedidos atribuídos do período, para a lista do painel.
create or replace function store.marketing_attributed_orders(p_from date, p_to date, p_limit integer default 200)
returns table (
  order_id uuid, order_number text, attributed_at timestamptz, channel text, utm_source text,
  utm_campaign text, utm_content text, meta_campaign_id text, meta_ad_id text, touch_at timestamptz,
  revenue numeric, status text, reversal_reason text, source text, payment_status text, order_status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_company uuid := public.crm_default_company();
begin
  if v_company is null or not private.has_marketing_permission(v_company, 'marketing.view') then
    raise exception 'Sem permissão para ver anúncios e crescimento.' using errcode = '42501';
  end if;
  return query
  select a.order_id, a.order_number, a.attributed_at, a.channel, a.utm_source, a.utm_campaign, a.utm_content,
         a.meta_campaign_id, a.meta_ad_id, a.touch_at, a.revenue, a.status, a.reversal_reason, a.source,
         o.payment_status, o.status
    from store.order_attributions a
    join store.orders o on o.id = a.order_id
   where a.company_id = v_company and a.is_primary
     and a.attributed_at >= p_from::timestamp at time zone 'America/Sao_Paulo'
     and a.attributed_at < (p_to + 1)::timestamp at time zone 'America/Sao_Paulo'
   order by a.attributed_at desc
   limit greatest(1, least(p_limit, 500));
end;
$$;
revoke all on function store.marketing_attributed_orders(date, date, integer) from public, anon;
grant execute on function store.marketing_attributed_orders(date, date, integer) to authenticated, service_role;

-- Pontos de contato que podem ser escolhidos numa correção manual: só os das
-- sessões ligadas ao pedido (ou ao orçamento de origem).
create or replace function store.marketing_correction_options(p_order_id uuid)
returns table (touchpoint_id uuid, occurred_at timestamptz, channel text, utm_source text,
               utm_campaign text, utm_content text, meta_ad_id text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_company uuid := public.crm_default_company();
  v_quote uuid;
begin
  if v_company is null or not private.has_marketing_permission(v_company, 'marketing.manage') then
    raise exception 'Sem permissão para corrigir atribuição.' using errcode = '42501';
  end if;
  select quote_id into v_quote from store.orders where id = p_order_id;
  return query
  select distinct t.id, t.occurred_at, t.channel, t.utm_source, t.utm_campaign, t.utm_content, t.meta_ad_id
    from store.marketing_session_links l
    join store.marketing_touchpoints t on t.session_id = l.session_id
   where l.company_id = v_company
     and ((l.subject_type = 'order' and l.subject_id = p_order_id)
       or (l.subject_type = 'quote' and l.subject_id = v_quote))
   order by t.occurred_at desc;
end;
$$;
revoke all on function store.marketing_correction_options(uuid) from public, anon;
grant execute on function store.marketing_correction_options(uuid) to authenticated, service_role;

-- Saúde dos sinais de conversão, sem revelar segredos: só se existem.
create or replace function store.marketing_signal_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_company uuid := public.crm_default_company();
  v_cfg store.marketing_signal_settings%rowtype;
  v_secret_names text[];
  v_cron boolean := false;
begin
  if v_company is null or not private.has_marketing_permission(v_company, 'marketing.view') then
    raise exception 'Sem permissão para ver anúncios e crescimento.' using errcode = '42501';
  end if;
  select * into v_cfg from store.marketing_signal_settings where company_id = v_company;
  select coalesce(array_agg(distinct name), '{}') into v_secret_names from vault.secrets
   where name in ('meta_capi_access_token','marketing_dispatch_url','marketing_dispatch_secret');
  begin
    execute 'select exists (select 1 from cron.job where jobname = ''store-conversion-events-dispatch'' and active)'
      into v_cron;
  exception when others then
    v_cron := false;
  end;
  return jsonb_build_object(
    'settings', case when v_cfg.company_id is null then null else jsonb_build_object(
      'enabled', v_cfg.enabled, 'mode', v_cfg.mode, 'pixel_id', v_cfg.pixel_id,
      'test_event_code', v_cfg.test_event_code, 'graph_api_version', v_cfg.graph_api_version,
      'version', v_cfg.version, 'updated_at', v_cfg.updated_at) end,
    'token_configured', 'meta_capi_access_token' = any(v_secret_names),
    'dispatch_configured', 'marketing_dispatch_url' = any(v_secret_names)
                            and 'marketing_dispatch_secret' = any(v_secret_names),
    'cron_active', v_cron,
    'queue', coalesce((select jsonb_object_agg(status, n) from (
        select status, count(*) as n from store.conversion_events where company_id = v_company group by status) q),
      '{}'::jsonb),
    'oldest_pending_at', (select min(created_at) from store.conversion_events
                           where company_id = v_company and status in ('pending','in_progress')),
    'last_sent_at', (select max(sent_at) from store.conversion_events where company_id = v_company),
    'last_failure', (select jsonb_build_object('at', updated_at, 'code', last_error_code,
                                                'message', last_error_message, 'http', last_http_status)
                       from store.conversion_events
                      where company_id = v_company and status in ('failed','pending') and last_error_code is not null
                      order by updated_at desc limit 1)
  );
end;
$$;
revoke all on function store.marketing_signal_status() from public, anon;
grant execute on function store.marketing_signal_status() to authenticated, service_role;
