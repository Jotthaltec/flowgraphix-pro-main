-- =============================================================================
-- SINAIS DE CONVERSÃO (conversion-signals, fatia 2): Pixel + Conversions API
--
-- Fila de eventos de servidor para a Meta, alimentada pelo banco:
--   Purchase  → quando o pagamento é confirmado (nunca em pedido pendente)
--   Lead      → quando um orçamento do site é ligado à sessão do visitante
--
-- event_id determinístico (purchase:<pedido>, lead:<orçamento>) é o mesmo que
-- o Pixel usa no navegador; a Meta descarta a cópia. Sem consentimento de
-- anúncios o evento é registrado como 'skipped', sem dado pessoal. E-mail e
-- telefone entram na fila já em SHA-256: o texto puro nunca é gravado aqui.
--
-- Tudo nasce desligado (enabled = false). O token da Meta fica no Vault
-- ('meta_capi_access_token'), nunca em tabela nem no navegador.
-- =============================================================================

create table if not exists store.marketing_signal_settings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  enabled boolean not null default false,
  mode text not null default 'test' check (mode in ('test','live')),
  pixel_id text check (pixel_id ~ '^[0-9]{5,20}$'),
  test_event_code text check (test_event_code ~ '^[A-Za-z0-9]{3,40}$'),
  graph_api_version text not null default 'v25.0' check (graph_api_version ~ '^v[0-9]{2}\.0$'),
  site_url text not null default 'https://nexusprinti.com.br' check (site_url ~ '^https://[a-z0-9.-]+$'),
  version integer not null default 1,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists store.conversion_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  event_name text not null check (event_name in ('Purchase','Lead')),
  event_id text not null unique,
  order_id uuid references store.orders(id) on delete set null,
  quote_id uuid references store.quotes(id) on delete set null,
  session_id uuid references store.marketing_sessions(id) on delete set null,
  event_time timestamptz not null,
  -- Corpo do evento já minimizado (hashes, fbc/fbp, valor). Vazio quando skipped.
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending','in_progress','sent','failed','skipped','expired')),
  skip_reason text,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_until timestamptz,
  last_http_status integer,
  last_error_code text,
  last_error_message text,
  sent_mode text check (sent_mode in ('test','live')),
  fbtrace_id text,
  events_received integer,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists conversion_events_due_idx
  on store.conversion_events(next_attempt_at) where status in ('pending','in_progress');
create index if not exists conversion_events_order_idx on store.conversion_events(order_id);

-- ─── Hash no formato exigido pela Meta (SHA-256 hex de valor normalizado) ───
create or replace function store.meta_hash(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when nullif(pg_catalog.btrim(p_value), '') is null then null
              else encode(sha256(convert_to(lower(pg_catalog.btrim(p_value)), 'UTF8')), 'hex') end;
$$;

-- Telefone brasileiro: só dígitos, com DDI 55.
create or replace function store.meta_phone(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when length(regexp_replace(coalesce(p_value, ''), '\D', '', 'g')) between 10 and 11
      then '55' || regexp_replace(p_value, '\D', '', 'g')
    when regexp_replace(coalesce(p_value, ''), '\D', '', 'g') ~ '^55[0-9]{10,11}$'
      then regexp_replace(p_value, '\D', '', 'g')
  end;
$$;

-- Escolhe a sessão do pedido (vínculo direto ou pelo orçamento de origem).
create or replace function store.conversion_session_for(p_order_id uuid, p_quote_id uuid)
returns store.marketing_sessions
language sql
stable
security definer
set search_path = ''
as $$
  select s.*
    from store.marketing_session_links l
    join store.marketing_sessions s on s.id = l.session_id
   where (l.subject_type = 'order' and l.subject_id = p_order_id)
      or (l.subject_type = 'quote' and l.subject_id = p_quote_id)
   order by s.ads_consent desc, (l.subject_type = 'order') desc, l.linked_at desc
   limit 1;
$$;
revoke all on function store.conversion_session_for(uuid, uuid) from public, anon, authenticated;

-- Grava ou promove um evento. Um evento já enviado nunca é reaberto; um
-- 'skipped' só vira 'pending' quando aparece consentimento depois.
create or replace function store.upsert_conversion_event(
  p_company uuid, p_name text, p_event_id text, p_order uuid, p_quote uuid,
  p_session uuid, p_event_time timestamptz, p_payload jsonb, p_skip_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into store.conversion_events as e (
    company_id, event_name, event_id, order_id, quote_id, session_id, event_time, payload, status, skip_reason
  ) values (
    p_company, p_name, p_event_id, p_order, p_quote, p_session, p_event_time,
    case when p_skip_reason is null then p_payload else '{}'::jsonb end,
    case when p_skip_reason is null then 'pending' else 'skipped' end, p_skip_reason
  )
  on conflict (event_id) do update set
    session_id = excluded.session_id, payload = excluded.payload, status = 'pending',
    skip_reason = null, next_attempt_at = now(), updated_at = now()
  where e.status = 'skipped' and excluded.status = 'pending'
    and e.skip_reason in ('sem_consentimento','sem_sessao');
end;
$$;
revoke all on function store.upsert_conversion_event(uuid, text, text, uuid, uuid, uuid, timestamptz, jsonb, text)
  from public, anon, authenticated;

-- ─── Purchase: só com pagamento confirmado ─────────────────────────────────
create or replace function store.enqueue_purchase_event(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := public.crm_default_company();
  v_order store.orders%rowtype;
  v_session store.marketing_sessions%rowtype;
  v_tp store.marketing_touchpoints%rowtype;
  v_cfg store.marketing_signal_settings%rowtype;
  v_email text;
  v_phone text;
  v_event_time timestamptz;
  v_payload jsonb;
begin
  if v_company is null then return; end if;
  select * into v_order from store.orders where id = p_order_id;
  if v_order.id is null or v_order.payment_status <> 'pago' or v_order.is_demo then return; end if;

  v_session := store.conversion_session_for(v_order.id, v_order.quote_id);
  -- Momento da confirmação; reprocessar não muda a hora original.
  select coalesce((select event_time from store.conversion_events where event_id = 'purchase:' || v_order.id), now())
    into v_event_time;

  if v_session.id is null or not v_session.ads_consent then
    perform store.upsert_conversion_event(v_company, 'Purchase', 'purchase:' || v_order.id, v_order.id,
      v_order.quote_id, v_session.id, v_event_time, '{}'::jsonb,
      case when v_session.id is null then 'sem_sessao' else 'sem_consentimento' end);
    return;
  end if;

  select * into v_cfg from store.marketing_signal_settings where company_id = v_company;
  select * into v_tp from store.marketing_touchpoints
   where session_id = v_session.id order by occurred_at desc limit 1;
  select coalesce(v_order.billing ->> 'email', p.email), coalesce(v_order.billing ->> 'phone', p.phone)
    into v_email, v_phone
    from (select 1) x left join store.profiles p on p.id = v_order.profile_id;

  v_payload := jsonb_strip_nulls(jsonb_build_object(
    'event_name', 'Purchase',
    'event_id', 'purchase:' || v_order.id,
    'event_time', floor(extract(epoch from v_event_time))::bigint,
    'action_source', 'website',
    'event_source_url', coalesce(v_cfg.site_url, 'https://nexusprinti.com.br') || coalesce(v_tp.landing_path, '/'),
    'user_data', jsonb_strip_nulls(jsonb_build_object(
      'em', case when store.meta_hash(v_email) is not null then jsonb_build_array(store.meta_hash(v_email)) end,
      'ph', case when store.meta_phone(v_phone) is not null then jsonb_build_array(store.meta_hash(store.meta_phone(v_phone))) end,
      'external_id', case when v_order.profile_id is not null then jsonb_build_array(store.meta_hash(v_order.profile_id::text)) end,
      'fbc', (select t.fbc from store.marketing_touchpoints t where t.session_id = v_session.id and t.fbc is not null
               order by t.occurred_at desc limit 1),
      'fbp', (select t.fbp from store.marketing_touchpoints t where t.session_id = v_session.id and t.fbp is not null
               order by t.occurred_at desc limit 1),
      'client_user_agent', v_session.client_user_agent
    )),
    'custom_data', jsonb_build_object(
      'currency', 'BRL',
      'value', v_order.total + v_order.credit_used,
      'order_id', v_order.number,
      'content_type', 'product',
      'contents', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', coalesce(i.product_id::text, i.sku, i.product_name),
                 'quantity', i.quantity,
                 'item_price', round(i.total_price / greatest(i.quantity, 1), 2)) order by i.created_at)
          from store.order_items i where i.order_id = v_order.id), '[]'::jsonb)
    )
  ));

  perform store.upsert_conversion_event(v_company, 'Purchase', 'purchase:' || v_order.id, v_order.id,
    v_order.quote_id, v_session.id, v_event_time, v_payload, null);
end;
$$;
revoke all on function store.enqueue_purchase_event(uuid) from public, anon, authenticated;

-- ─── Lead: orçamento pedido pelo site ──────────────────────────────────────
create or replace function store.enqueue_lead_event(p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := public.crm_default_company();
  v_quote store.quotes%rowtype;
  v_session store.marketing_sessions%rowtype;
  v_cfg store.marketing_signal_settings%rowtype;
  v_payload jsonb;
begin
  if v_company is null then return; end if;
  select * into v_quote from store.quotes where id = p_quote_id;
  if v_quote.id is null or v_quote.source <> 'site' or v_quote.is_demo then return; end if;
  select s.* into v_session
    from store.marketing_session_links l join store.marketing_sessions s on s.id = l.session_id
   where l.subject_type = 'quote' and l.subject_id = v_quote.id;

  if v_session.id is null or not v_session.ads_consent then
    perform store.upsert_conversion_event(v_company, 'Lead', 'lead:' || v_quote.id, null, v_quote.id,
      v_session.id, v_quote.created_at, '{}'::jsonb,
      case when v_session.id is null then 'sem_sessao' else 'sem_consentimento' end);
    return;
  end if;

  select * into v_cfg from store.marketing_signal_settings where company_id = v_company;
  v_payload := jsonb_strip_nulls(jsonb_build_object(
    'event_name', 'Lead',
    'event_id', 'lead:' || v_quote.id,
    'event_time', floor(extract(epoch from v_quote.created_at))::bigint,
    'action_source', 'website',
    'event_source_url', coalesce(v_cfg.site_url, 'https://nexusprinti.com.br') || '/orcamento',
    'user_data', jsonb_strip_nulls(jsonb_build_object(
      'em', case when store.meta_hash(v_quote.contact_email) is not null then jsonb_build_array(store.meta_hash(v_quote.contact_email)) end,
      'ph', case when store.meta_phone(v_quote.contact_phone) is not null then jsonb_build_array(store.meta_hash(store.meta_phone(v_quote.contact_phone))) end,
      'fbc', (select t.fbc from store.marketing_touchpoints t where t.session_id = v_session.id and t.fbc is not null
               order by t.occurred_at desc limit 1),
      'fbp', (select t.fbp from store.marketing_touchpoints t where t.session_id = v_session.id and t.fbp is not null
               order by t.occurred_at desc limit 1),
      'client_user_agent', v_session.client_user_agent
    )),
    'custom_data', jsonb_build_object('currency', 'BRL', 'content_category', 'orcamento')
  ));
  perform store.upsert_conversion_event(v_company, 'Lead', 'lead:' || v_quote.id, null, v_quote.id,
    v_session.id, v_quote.created_at, v_payload, null);
end;
$$;
revoke all on function store.enqueue_lead_event(uuid) from public, anon, authenticated;

-- ─── Gatilhos: pagamento e vínculo de sessão ───────────────────────────────
create or replace function store.on_order_conversion_signal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.payment_status = 'pago' and (tg_op = 'INSERT' or old.payment_status is distinct from 'pago') then
    perform store.enqueue_purchase_event(new.id);
  elsif tg_op = 'UPDATE' and old.payment_status = 'pago'
        and new.payment_status in ('estornado','cancelado','recusado') then
    -- Não existe "desconversão" na Meta: o que ainda não saiu, não sai mais.
    update store.conversion_events
       set status = 'skipped', skip_reason = 'pagamento_revertido', payload = '{}'::jsonb, updated_at = now()
     where event_id = 'purchase:' || new.id and status in ('pending','in_progress');
  end if;
  return new;
end;
$$;
revoke all on function store.on_order_conversion_signal() from public, anon, authenticated;
drop trigger if exists tr_order_conversion_signal on store.orders;
create trigger tr_order_conversion_signal
  after insert or update of payment_status on store.orders
  for each row execute function store.on_order_conversion_signal();

create or replace function store.on_session_link_conversion_signal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order uuid;
begin
  if new.subject_type = 'quote' then
    perform store.enqueue_lead_event(new.subject_id);
    select converted_order_id into v_order from store.quotes where id = new.subject_id;
  else
    v_order := new.subject_id;
  end if;
  if v_order is not null then
    perform store.enqueue_purchase_event(v_order);
  end if;
  return new;
end;
$$;
revoke all on function store.on_session_link_conversion_signal() from public, anon, authenticated;
drop trigger if exists tr_session_link_conversion_signal on store.marketing_session_links;
create trigger tr_session_link_conversion_signal
  after insert on store.marketing_session_links
  for each row execute function store.on_session_link_conversion_signal();

-- ─── Worker: configuração, reserva e conclusão (somente servidor) ──────────
create or replace function store.meta_capi_config()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cfg store.marketing_signal_settings%rowtype;
  v_token text;
begin
  select * into v_cfg from store.marketing_signal_settings where company_id = public.crm_default_company();
  select decrypted_secret into v_token from vault.decrypted_secrets
   where name = 'meta_capi_access_token' order by created_at desc limit 1;
  return jsonb_build_object(
    'enabled', coalesce(v_cfg.enabled, false) and v_cfg.pixel_id is not null and coalesce(v_token, '') <> ''
               and (v_cfg.mode = 'live' or v_cfg.test_event_code is not null),
    'mode', coalesce(v_cfg.mode, 'test'),
    'pixel_id', v_cfg.pixel_id,
    'test_event_code', v_cfg.test_event_code,
    'graph_api_version', coalesce(v_cfg.graph_api_version, 'v25.0'),
    'access_token', v_token
  );
end;
$$;
revoke all on function store.meta_capi_config() from public, anon, authenticated;
grant execute on function store.meta_capi_config() to service_role;

-- Reserva eventos vencidos. Evento com mais de 7 dias é recusado pela Meta
-- (o lote inteiro falha): vira 'expired' antes de sair. Lock vencido de um
-- worker que caiu volta à fila — reenviar é seguro, a Meta deduplica pelo event_id.
create or replace function store.claim_conversion_events(p_limit integer default 25)
returns table (id uuid, event_name text, event_id text, payload jsonb, attempts integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  update store.conversion_events e
     set status = 'expired', updated_at = now(), last_error_code = 'janela_7_dias'
   where e.status in ('pending','in_progress')
     and e.event_time < now() - interval '7 days' + interval '1 hour';

  return query
  with due as (
    select e.id from store.conversion_events e
     where (e.status = 'pending' and e.next_attempt_at <= now())
        or (e.status = 'in_progress' and e.locked_until < now())
     order by e.next_attempt_at
     limit greatest(1, least(p_limit, 100))
     for update skip locked
  )
  update store.conversion_events e
     set status = 'in_progress', attempts = e.attempts + 1, locked_until = now() + interval '2 minutes',
         updated_at = now()
    from due where e.id = due.id
  returning e.id, e.event_name, e.event_id, e.payload, e.attempts;
end;
$$;
revoke all on function store.claim_conversion_events(integer) from public, anon, authenticated;
grant execute on function store.claim_conversion_events(integer) to service_role;

-- Resultado de uma tentativa. p_http_status = 0 significa sem resposta
-- (timeout/rede). Repete 429, 5xx e 0 com backoff; qualquer outro erro é final.
create or replace function store.complete_conversion_event(
  p_id uuid, p_http_status integer, p_mode text, p_error_code text default null,
  p_error_message text default null, p_fbtrace_id text default null, p_events_received integer default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempts integer;
  v_status text;
begin
  select attempts into v_attempts from store.conversion_events where id = p_id and status = 'in_progress' for update;
  if not found then return 'ignored'; end if;
  v_status := case
    when p_http_status between 200 and 299 then 'sent'
    when (p_http_status = 0 or p_http_status = 429 or p_http_status >= 500) and v_attempts < 6 then 'pending'
    else 'failed'
  end;
  update store.conversion_events set
    status = v_status,
    locked_until = null,
    next_attempt_at = case when v_status = 'pending'
                           then now() + make_interval(mins => least(power(2, v_attempts)::integer, 60))
                           else next_attempt_at end,
    last_http_status = p_http_status,
    last_error_code = left(p_error_code, 60),
    last_error_message = left(p_error_message, 300),
    fbtrace_id = left(p_fbtrace_id, 60),
    events_received = p_events_received,
    sent_mode = case when v_status = 'sent' then p_mode else sent_mode end,
    sent_at = case when v_status = 'sent' then now() else sent_at end,
    updated_at = now()
  where id = p_id;
  return v_status;
end;
$$;
revoke all on function store.complete_conversion_event(uuid, integer, text, text, text, text, integer)
  from public, anon, authenticated;
grant execute on function store.complete_conversion_event(uuid, integer, text, text, text, text, integer) to service_role;

-- ─── Configuração (owner/admin ou marketing.manage) ────────────────────────
create or replace function store.set_marketing_signal_settings(
  p_enabled boolean, p_mode text, p_pixel_id text, p_test_event_code text default null,
  p_graph_api_version text default 'v25.0'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := public.crm_default_company();
  v_before jsonb;
  v_after jsonb;
begin
  if v_company is null or not private.has_marketing_permission(v_company, 'marketing.manage') then
    raise exception 'Sem permissão para configurar sinais de conversão.' using errcode = '42501';
  end if;
  if p_enabled and nullif(p_pixel_id, '') is null then
    raise exception 'Informe o Pixel antes de ativar os sinais.' using errcode = '22023';
  end if;
  -- Modo teste sem código do Events Manager mandaria eventos como reais.
  if p_enabled and p_mode = 'test' and nullif(p_test_event_code, '') is null then
    raise exception 'Informe o código de teste do Events Manager.' using errcode = '22023';
  end if;
  select to_jsonb(s.*) into v_before from store.marketing_signal_settings s where company_id = v_company;
  insert into store.marketing_signal_settings as s
    (company_id, enabled, mode, pixel_id, test_event_code, graph_api_version, updated_by)
  values (v_company, p_enabled, p_mode, nullif(p_pixel_id, ''), nullif(p_test_event_code, ''),
          p_graph_api_version, (select auth.uid()))
  on conflict (company_id) do update set
    enabled = excluded.enabled, mode = excluded.mode, pixel_id = excluded.pixel_id,
    test_event_code = excluded.test_event_code, graph_api_version = excluded.graph_api_version,
    version = s.version + 1, updated_by = excluded.updated_by, updated_at = now()
  returning to_jsonb(s.*) into v_after;
  insert into store.marketing_attribution_audit (company_id, action, actor, reason, before, after)
  values (v_company, 'settings_changed', (select auth.uid()), 'Sinais de conversão', v_before, v_after);
  return v_after;
end;
$$;
revoke all on function store.set_marketing_signal_settings(boolean, text, text, text, text) from public, anon;
grant execute on function store.set_marketing_signal_settings(boolean, text, text, text, text) to authenticated, service_role;

-- Única informação pública: o Pixel, e só quando ativo. A loja lê daqui para
-- que navegador e servidor usem sempre o mesmo Pixel.
create or replace function store.public_tracking_config()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('pixel_id',
    (select s.pixel_id from store.marketing_signal_settings s
      where s.company_id = public.crm_default_company() and s.enabled));
$$;
revoke all on function store.public_tracking_config() from public;
grant execute on function store.public_tracking_config() to anon, authenticated, service_role;

-- ─── RLS ───────────────────────────────────────────────────────────────────
alter table store.marketing_signal_settings enable row level security;
alter table store.conversion_events enable row level security;
drop policy if exists marketing_signal_settings_select on store.marketing_signal_settings;
create policy marketing_signal_settings_select on store.marketing_signal_settings
  for select to authenticated using (private.has_marketing_permission(company_id, 'marketing.view'));
drop policy if exists conversion_events_select on store.conversion_events;
create policy conversion_events_select on store.conversion_events
  for select to authenticated using (private.has_marketing_permission(company_id, 'marketing.manage'));
revoke all on store.marketing_signal_settings, store.conversion_events from anon, authenticated;
grant select on store.marketing_signal_settings to authenticated;
-- Payload tem hashes de e-mail/telefone: a UI lê só o estado, nunca o corpo.
grant select (id, company_id, event_name, event_id, order_id, quote_id, event_time, status, skip_reason,
              attempts, next_attempt_at, last_http_status, last_error_code, last_error_message, sent_mode,
              fbtrace_id, events_received, sent_at, created_at, updated_at)
  on store.conversion_events to authenticated;
grant all on store.marketing_signal_settings, store.conversion_events to service_role;

comment on table store.conversion_events is
  'Fila da Conversions API (Meta). event_id compartilhado com o Pixel; PII só em SHA-256; sem consentimento = skipped.';
