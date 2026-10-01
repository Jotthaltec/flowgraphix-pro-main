-- =============================================================================
-- ATRIBUIÇÃO DE MARKETING (attribution-core, fatia 1)
--
-- visita com campanha → sessão → orçamento/pedido → pagamento → atribuição
--
-- Só cria objetos novos. `store.orders.source` mantém o significado atual: a
-- origem de marketing vive aqui. A loja é single-tenant; tudo o que nasce dela
-- recebe a empresa de `public.crm_default_company()`, e as tabelas novas
-- carregam `company_id` para que a RLS isole empresas.
--
-- Escritas vêm apenas do servidor (service_role) ou de funções que validam o
-- papel no banco. O navegador nunca grava diretamente.
-- =============================================================================

-- Permissão granular do módulo. Dono e admin sempre podem; demais membros só
-- com override explícito em company_members.permissions ("marketing.view" ou
-- "marketing.manage" = true). "manage" implica "view".
create or replace function private.has_marketing_permission(p_company_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_company_member(p_company_id, array['owner','admin'])
      or exists (
        select 1
          from public.company_members m
         where m.company_id = p_company_id
           and m.user_id = (select auth.uid())
           and m.active
           and (
             m.permissions ->> 'marketing.manage' = 'true'
             or (p_permission = 'marketing.view' and m.permissions ->> 'marketing.view' = 'true')
           )
      );
$$;
revoke all on function private.has_marketing_permission(uuid, text) from public;
grant execute on function private.has_marketing_permission(uuid, text) to authenticated, service_role;

-- ─── Configuração versionada ────────────────────────────────────────────────
create table if not exists store.marketing_attribution_settings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  window_days integer not null default 7 check (window_days between 1 and 90),
  primary_model text not null default 'last_touch' check (primary_model in ('first_touch','last_touch')),
  version integer not null default 1,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- ─── Sessão: o valor do cookie first-party `nx_sid`, gerado no servidor ─────
create table if not exists store.marketing_sessions (
  id uuid primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  profile_id uuid references store.profiles(id) on delete set null,
  ads_consent boolean not null default false,
  -- Só com consentimento; a Conversions API exige o user agent em eventos web.
  client_user_agent text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists marketing_sessions_company_idx on store.marketing_sessions(company_id, last_seen_at desc);

-- ─── Ponto de contato: só existe quando há sinal de origem ──────────────────
create table if not exists store.marketing_touchpoints (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references store.marketing_sessions(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  first_occurred_at timestamptz not null default now(),
  occurred_at timestamptz not null default now(),
  hits integer not null default 1,
  channel text not null check (channel in
    ('paid_social','organic_social','paid_search','organic_search','email','referral','other')),
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  meta_campaign_id text,
  meta_adset_id text,
  meta_ad_id text,
  fbclid text,
  fbc text,
  fbp text,
  landing_path text not null,
  referrer_host text,
  -- Mesmo anúncio na mesma sessão é um ponto só; recarregar não duplica.
  touch_key text not null,
  unique (session_id, touch_key)
);
create index if not exists marketing_touchpoints_session_idx on store.marketing_touchpoints(session_id, occurred_at desc);
create index if not exists marketing_touchpoints_campaign_idx on store.marketing_touchpoints(company_id, utm_campaign);

-- ─── Vínculo sessão ↔ orçamento/pedido ──────────────────────────────────────
create table if not exists store.marketing_session_links (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references store.marketing_sessions(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  subject_type text not null check (subject_type in ('quote','order')),
  subject_id uuid not null,
  linked_at timestamptz not null default now(),
  unique (subject_type, subject_id)
);
create index if not exists marketing_session_links_session_idx on store.marketing_session_links(session_id);

-- ─── Atribuição do pedido pago (um registro por modelo) ─────────────────────
create table if not exists store.order_attributions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references store.orders(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  order_number text not null,
  model text not null check (model in ('first_touch','last_touch')),
  is_primary boolean not null,
  touchpoint_id uuid references store.marketing_touchpoints(id) on delete set null,
  -- 'direct' = pedido pago sem nenhum ponto de contato na janela.
  channel text not null check (channel in
    ('paid_social','organic_social','paid_search','organic_search','email','referral','other','direct')),
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  meta_campaign_id text,
  meta_adset_id text,
  meta_ad_id text,
  touch_at timestamptz,
  revenue numeric(12,2) not null,
  shipping numeric(12,2) not null default 0,
  currency text not null default 'BRL',
  attributed_at timestamptz not null default now(),
  window_days integer not null,
  settings_version integer not null,
  status text not null default 'active' check (status in ('active','reversed')),
  reversed_at timestamptz,
  reversal_reason text,
  source text not null default 'auto' check (source in ('auto','manual')),
  updated_at timestamptz not null default now(),
  unique (order_id, model)
);
create index if not exists order_attributions_company_idx
  on store.order_attributions(company_id, attributed_at desc) where is_primary;
create index if not exists order_attributions_campaign_idx
  on store.order_attributions(company_id, meta_campaign_id) where is_primary;

-- ─── Auditoria append-only ─────────────────────────────────────────────────
create table if not exists store.marketing_attribution_audit (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  order_id uuid references store.orders(id) on delete set null,
  action text not null check (action in
    ('attributed','reattributed','reversed','reinstated','manual_correction','settings_changed')),
  actor uuid references auth.users(id) on delete set null,
  reason text,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
create index if not exists marketing_attribution_audit_order_idx
  on store.marketing_attribution_audit(order_id, created_at);

create or replace function store.marketing_audit_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Exceções das FKs: pedido apagado (order_id → null) e empresa removida (cascade).
  if tg_op = 'UPDATE' and old.order_id is not null and new.order_id is null
     and (to_jsonb(new) - 'order_id') = (to_jsonb(old) - 'order_id') then
    return new;
  end if;
  if tg_op = 'DELETE' and not exists (select 1 from public.companies c where c.id = old.company_id) then
    return old;
  end if;
  raise exception 'Auditoria de marketing é somente inclusão.' using errcode = '42501';
end;
$$;
drop trigger if exists tr_marketing_audit_append_only on store.marketing_attribution_audit;
create trigger tr_marketing_audit_append_only
  before update or delete on store.marketing_attribution_audit
  for each row execute function store.marketing_audit_append_only();

-- ─── Normalização e canal: regra única, usada por toda escrita ─────────────
create or replace function store.marketing_clean(p_value text, p_lower boolean default false)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(left(case when p_lower then lower(pg_catalog.btrim(p_value)) else pg_catalog.btrim(p_value) end, 200), '');
$$;

create or replace function store.marketing_channel(
  p_source text, p_medium text, p_fbclid text, p_meta_ad_id text, p_referrer_host text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_fbclid is not null or p_meta_ad_id is not null
      or (p_medium in ('cpc','ppc','paid','paid_social','paidsocial','ads','cpm')
          and p_source in ('facebook','fb','instagram','ig','meta','tiktok','linkedin','pinterest'))
      then 'paid_social'
    when p_medium in ('cpc','ppc','paid','paid_search') then 'paid_search'
    when p_medium in ('email','e-mail','newsletter') then 'email'
    when p_source in ('facebook','fb','instagram','ig','meta','whatsapp','tiktok','linkedin','pinterest')
      or p_medium in ('social','organic_social','bio')
      or p_referrer_host ~ '(^|\.)(facebook|instagram|whatsapp|tiktok|linkedin|pinterest|t)\.(com|co|me)$'
      or p_referrer_host in ('l.facebook.com','lm.facebook.com','l.instagram.com','wa.me')
      then 'organic_social'
    when p_referrer_host ~ '(^|\.)(google|bing|duckduckgo|yahoo|ecosia)\.'
      then 'organic_search'
    when p_source is null and p_referrer_host is not null then 'referral'
    else 'other'
  end;
$$;

-- ─── Registro de ponto de contato (somente servidor) ───────────────────────
-- p_payload: utm_*, meta_campaign_id, meta_adset_id, meta_ad_id, fbclid, fbc,
-- fbp, landing_path, referrer_host, ads_consent, client_user_agent.
-- Sem consentimento, identificadores da Meta e user agent são descartados aqui
-- (não dependem de o chamador lembrar). Retorna o id do ponto ou null.
create or replace function store.record_marketing_touchpoint(p_session_id uuid, p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := public.crm_default_company();
  v_consent boolean := coalesce((p_payload ->> 'ads_consent')::boolean, false);
  v_session_company uuid;
  v_source text := store.marketing_clean(p_payload ->> 'utm_source', true);
  v_medium text := store.marketing_clean(p_payload ->> 'utm_medium', true);
  v_campaign text := store.marketing_clean(p_payload ->> 'utm_campaign');
  v_content text := store.marketing_clean(p_payload ->> 'utm_content');
  v_term text := store.marketing_clean(p_payload ->> 'utm_term');
  v_meta_campaign text := store.marketing_clean(p_payload ->> 'meta_campaign_id');
  v_meta_adset text := store.marketing_clean(p_payload ->> 'meta_adset_id');
  v_meta_ad text := store.marketing_clean(p_payload ->> 'meta_ad_id');
  v_fbclid text;
  v_fbc text;
  v_fbp text;
  v_referrer text := store.marketing_clean(p_payload ->> 'referrer_host', true);
  v_landing text := coalesce(store.marketing_clean(p_payload ->> 'landing_path'), '/');
  v_key text;
  v_id uuid;
begin
  if p_session_id is null or v_company is null then
    return null;
  end if;
  -- IDs da Meta são numéricos; qualquer outra coisa é descartada.
  if v_meta_campaign !~ '^[0-9]{1,30}$' then v_meta_campaign := null; end if;
  if v_meta_adset !~ '^[0-9]{1,30}$' then v_meta_adset := null; end if;
  if v_meta_ad !~ '^[0-9]{1,30}$' then v_meta_ad := null; end if;
  if v_consent then
    v_fbclid := store.marketing_clean(p_payload ->> 'fbclid');
    v_fbc := store.marketing_clean(p_payload ->> 'fbc');
    v_fbp := store.marketing_clean(p_payload ->> 'fbp');
    -- Formato documentado pela Meta: fb.1.<criação em ms>.<fbclid>
    if v_fbc is null and v_fbclid is not null then
      v_fbc := 'fb.1.' || floor(extract(epoch from now()) * 1000)::bigint || '.' || v_fbclid;
    end if;
  end if;
  if left(v_landing, 1) <> '/' then v_landing := '/'; end if;

  insert into store.marketing_sessions as s (id, company_id, ads_consent, client_user_agent)
  values (p_session_id, v_company, v_consent,
          case when v_consent then left(p_payload ->> 'client_user_agent', 400) end)
  on conflict (id) do update
    set last_seen_at = now(),
        ads_consent = excluded.ads_consent,
        client_user_agent = case when excluded.ads_consent then coalesce(excluded.client_user_agent, s.client_user_agent) end
  returning s.company_id into v_session_company;

  if v_session_company is distinct from v_company then
    raise exception 'Sessão pertence a outra empresa.' using errcode = '42501';
  end if;

  if v_source is null and v_medium is null and v_campaign is null and v_meta_campaign is null
     and v_meta_ad is null and p_payload ->> 'fbclid' is null and v_referrer is null then
    return null;
  end if;

  v_key := md5(concat_ws('|', v_source, v_medium, v_campaign, v_content, v_term,
                         v_meta_campaign, v_meta_adset, v_meta_ad,
                         coalesce(v_fbclid, p_payload ->> 'fbclid'),
                         case when v_source is null and v_campaign is null then v_referrer end));

  insert into store.marketing_touchpoints as t (
    session_id, company_id, channel, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    meta_campaign_id, meta_adset_id, meta_ad_id, fbclid, fbc, fbp, landing_path, referrer_host, touch_key
  ) values (
    p_session_id, v_company,
    store.marketing_channel(v_source, v_medium, p_payload ->> 'fbclid', v_meta_ad, v_referrer),
    v_source, v_medium, v_campaign, v_content, v_term,
    v_meta_campaign, v_meta_adset, v_meta_ad, v_fbclid, v_fbc, v_fbp, v_landing, v_referrer, v_key
  )
  on conflict (session_id, touch_key) do update
    set occurred_at = now(),
        hits = t.hits + 1,
        fbc = coalesce(t.fbc, excluded.fbc),
        fbp = coalesce(excluded.fbp, t.fbp)
  returning t.id into v_id;
  return v_id;
end;
$$;
revoke all on function store.record_marketing_touchpoint(uuid, jsonb) from public, anon, authenticated;
grant execute on function store.record_marketing_touchpoint(uuid, jsonb) to service_role;

-- ─── Cálculo da atribuição de um pedido ────────────────────────────────────
-- Idempotente: só grava quando algo muda; correção manual nunca é sobrescrita.
create or replace function store.attribute_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := public.crm_default_company();
  v_order store.orders%rowtype;
  v_window integer := 7;
  v_primary text := 'last_touch';
  v_version integer := 0;
  v_anchor timestamptz;
  v_model text;
  v_tp store.marketing_touchpoints%rowtype;
  v_old store.order_attributions%rowtype;
  v_new jsonb;
begin
  if v_company is null then return; end if;
  select * into v_order from store.orders where id = p_order_id;
  if v_order.id is null or v_order.payment_status <> 'pago' then return; end if;

  select s.window_days, s.primary_model, s.version into v_window, v_primary, v_version
    from store.marketing_attribution_settings s where s.company_id = v_company;
  v_window := coalesce(v_window, 7);
  v_primary := coalesce(v_primary, 'last_touch');
  v_version := coalesce(v_version, 0);

  -- A janela conta do primeiro marco comercial: orçamento de origem ou pedido.
  select least(v_order.created_at, coalesce(q.created_at, v_order.created_at))
    into v_anchor from (select 1) x left join store.quotes q on q.id = v_order.quote_id;

  foreach v_model in array array['first_touch','last_touch'] loop
    v_tp := null;
    select t.* into v_tp
      from store.marketing_touchpoints t
      join store.marketing_session_links l on l.session_id = t.session_id
     where t.company_id = v_company
       and l.company_id = v_company
       and ((l.subject_type = 'order' and l.subject_id = v_order.id)
         or (l.subject_type = 'quote' and l.subject_id = v_order.quote_id))
       and t.first_occurred_at <= v_order.created_at
       and least(t.occurred_at, v_order.created_at) >= v_anchor - make_interval(days => v_window)
     order by
       case when v_model = 'first_touch' then t.first_occurred_at end asc,
       case when v_model = 'last_touch' then least(t.occurred_at, v_order.created_at) end desc,
       t.id
     limit 1;

    select * into v_old from store.order_attributions a where a.order_id = v_order.id and a.model = v_model;
    if v_old.id is not null and v_old.source = 'manual' then
      if v_old.status = 'reversed' then
        update store.order_attributions set status = 'active', reversed_at = null, reversal_reason = null,
               updated_at = now() where id = v_old.id;
        insert into store.marketing_attribution_audit (company_id, order_id, action, reason)
        values (v_company, v_order.id, 'reinstated', 'Pagamento confirmado novamente (correção manual mantida).');
      end if;
      continue;
    end if;
    if v_old.id is not null and v_old.status = 'active'
       and v_old.touchpoint_id is not distinct from v_tp.id
       and v_old.is_primary = (v_model = v_primary) then
      continue;
    end if;

    insert into store.order_attributions as a (
      order_id, company_id, order_number, model, is_primary, touchpoint_id, channel,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      meta_campaign_id, meta_adset_id, meta_ad_id, touch_at,
      revenue, shipping, window_days, settings_version
    ) values (
      v_order.id, v_company, v_order.number, v_model, v_model = v_primary, v_tp.id,
      coalesce(v_tp.channel, 'direct'),
      v_tp.utm_source, v_tp.utm_medium, v_tp.utm_campaign, v_tp.utm_content, v_tp.utm_term,
      v_tp.meta_campaign_id, v_tp.meta_adset_id, v_tp.meta_ad_id,
      case when v_model = 'first_touch' then v_tp.first_occurred_at else least(v_tp.occurred_at, v_order.created_at) end,
      v_order.total + v_order.credit_used, v_order.shipping_cost, v_window, v_version
    )
    on conflict (order_id, model) do update set
      is_primary = excluded.is_primary, touchpoint_id = excluded.touchpoint_id, channel = excluded.channel,
      utm_source = excluded.utm_source, utm_medium = excluded.utm_medium, utm_campaign = excluded.utm_campaign,
      utm_content = excluded.utm_content, utm_term = excluded.utm_term,
      meta_campaign_id = excluded.meta_campaign_id, meta_adset_id = excluded.meta_adset_id,
      meta_ad_id = excluded.meta_ad_id, touch_at = excluded.touch_at,
      revenue = excluded.revenue, shipping = excluded.shipping,
      window_days = excluded.window_days, settings_version = excluded.settings_version,
      status = 'active', reversed_at = null, reversal_reason = null, updated_at = now()
    returning to_jsonb(a.*) into v_new;

    insert into store.marketing_attribution_audit (company_id, order_id, action, before, after)
    values (v_company, v_order.id,
            case when v_old.id is null then 'attributed'
                 when v_old.status = 'reversed' then 'reinstated'
                 else 'reattributed' end,
            case when v_old.id is not null then to_jsonb(v_old) end, v_new);
  end loop;
end;
$$;
revoke all on function store.attribute_order(uuid) from public, anon, authenticated;
grant execute on function store.attribute_order(uuid) to service_role;

-- ─── Pagamento confirmado/revertido dispara a atribuição ───────────────────
create or replace function store.on_order_payment_attribution()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.payment_status = 'pago'
     and (tg_op = 'INSERT' or old.payment_status is distinct from 'pago') then
    perform store.attribute_order(new.id);
  elsif tg_op = 'UPDATE' and old.payment_status = 'pago'
        and new.payment_status in ('estornado','cancelado','recusado') then
    with changed as (
      update store.order_attributions
         set status = 'reversed', reversed_at = now(), reversal_reason = new.payment_status, updated_at = now()
       where order_id = new.id and status = 'active'
      returning company_id
    )
    insert into store.marketing_attribution_audit (company_id, order_id, action, reason)
    select distinct company_id, new.id, 'reversed', 'Pagamento ' || new.payment_status from changed;
  end if;
  return new;
end;
$$;
revoke all on function store.on_order_payment_attribution() from public, anon, authenticated;

drop trigger if exists tr_order_marketing_attribution on store.orders;
create trigger tr_order_marketing_attribution
  after insert or update of payment_status on store.orders
  for each row execute function store.on_order_payment_attribution();

-- ─── Vínculo sessão → orçamento/pedido (somente servidor) ──────────────────
-- Chamado logo após criar o orçamento/pedido. Idempotente. Se o pedido já
-- estiver pago (total zero, crédito interno), recalcula na hora.
create or replace function store.link_marketing_session(p_session_id uuid, p_subject_type text, p_subject_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := public.crm_default_company();
  v_profile uuid;
  v_order uuid;
  v_inserted boolean;
begin
  if p_session_id is null or p_subject_id is null or v_company is null then
    return false;
  end if;
  if p_subject_type = 'order' then
    select o.id, o.profile_id into v_order, v_profile from store.orders o where o.id = p_subject_id;
    if v_order is null then raise exception 'Pedido não encontrado.' using errcode = 'P0002'; end if;
  elsif p_subject_type = 'quote' then
    select q.converted_order_id, q.profile_id into v_order, v_profile from store.quotes q where q.id = p_subject_id;
    if not found then raise exception 'Orçamento não encontrado.' using errcode = 'P0002'; end if;
  else
    raise exception 'Tipo de vínculo inválido.' using errcode = '22023';
  end if;

  insert into store.marketing_sessions as s (id, company_id) values (p_session_id, v_company)
  on conflict (id) do update set last_seen_at = now();
  if (select company_id from store.marketing_sessions where id = p_session_id) is distinct from v_company then
    raise exception 'Sessão pertence a outra empresa.' using errcode = '42501';
  end if;
  if v_profile is not null then
    update store.marketing_sessions set profile_id = v_profile where id = p_session_id and profile_id is null;
  end if;

  insert into store.marketing_session_links (session_id, company_id, subject_type, subject_id)
  values (p_session_id, v_company, p_subject_type, p_subject_id)
  on conflict (subject_type, subject_id) do nothing
  returning true into v_inserted;

  if coalesce(v_inserted, false) and v_order is not null then
    perform store.attribute_order(v_order);
  end if;
  return coalesce(v_inserted, false);
end;
$$;
revoke all on function store.link_marketing_session(uuid, text, uuid) from public, anon, authenticated;
grant execute on function store.link_marketing_session(uuid, text, uuid) to service_role;

-- ─── Correção manual auditada ──────────────────────────────────────────────
-- p_touchpoint_id null = marcar como "direto/não rastreado".
create or replace function store.correct_order_attribution(p_order_id uuid, p_touchpoint_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := public.crm_default_company();
  v_primary text;
  v_old store.order_attributions%rowtype;
  v_tp store.marketing_touchpoints%rowtype;
  v_new jsonb;
begin
  if v_company is null or not private.has_marketing_permission(v_company, 'marketing.manage') then
    raise exception 'Sem permissão para corrigir atribuição.' using errcode = '42501';
  end if;
  if length(pg_catalog.btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Informe o motivo da correção.' using errcode = '22023';
  end if;
  select coalesce((select primary_model from store.marketing_attribution_settings where company_id = v_company), 'last_touch')
    into v_primary;
  select * into v_old from store.order_attributions
   where order_id = p_order_id and model = v_primary and company_id = v_company for update;
  if v_old.id is null then
    raise exception 'Pedido sem atribuição (ainda não pago?).' using errcode = 'P0002';
  end if;
  if p_touchpoint_id is not null then
    select * into v_tp from store.marketing_touchpoints where id = p_touchpoint_id and company_id = v_company;
    if v_tp.id is null then
      raise exception 'Ponto de contato não encontrado nesta empresa.' using errcode = 'P0002';
    end if;
  end if;

  update store.order_attributions a set
    touchpoint_id = v_tp.id, channel = coalesce(v_tp.channel, 'direct'),
    utm_source = v_tp.utm_source, utm_medium = v_tp.utm_medium, utm_campaign = v_tp.utm_campaign,
    utm_content = v_tp.utm_content, utm_term = v_tp.utm_term,
    meta_campaign_id = v_tp.meta_campaign_id, meta_adset_id = v_tp.meta_adset_id, meta_ad_id = v_tp.meta_ad_id,
    touch_at = v_tp.occurred_at, source = 'manual', updated_at = now()
  where a.id = v_old.id
  returning to_jsonb(a.*) into v_new;

  insert into store.marketing_attribution_audit (company_id, order_id, action, actor, reason, before, after)
  values (v_company, p_order_id, 'manual_correction', (select auth.uid()), pg_catalog.btrim(p_reason), to_jsonb(v_old), v_new);
  return v_new;
end;
$$;
revoke all on function store.correct_order_attribution(uuid, uuid, text) from public, anon;
grant execute on function store.correct_order_attribution(uuid, uuid, text) to authenticated, service_role;

-- ─── Configuração (versão incrementa a cada mudança) ───────────────────────
create or replace function store.set_marketing_attribution_settings(p_window_days integer, p_primary_model text)
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
    raise exception 'Sem permissão para alterar a atribuição.' using errcode = '42501';
  end if;
  select to_jsonb(s.*) into v_before from store.marketing_attribution_settings s where company_id = v_company;
  insert into store.marketing_attribution_settings as s (company_id, window_days, primary_model, updated_by)
  values (v_company, p_window_days, p_primary_model, (select auth.uid()))
  on conflict (company_id) do update set
    window_days = excluded.window_days, primary_model = excluded.primary_model,
    version = s.version + 1, updated_by = excluded.updated_by, updated_at = now()
  returning to_jsonb(s.*) into v_after;
  insert into store.marketing_attribution_audit (company_id, action, actor, before, after)
  values (v_company, 'settings_changed', (select auth.uid()), v_before, v_after);
  return v_after;
end;
$$;
revoke all on function store.set_marketing_attribution_settings(integer, text) from public, anon;
grant execute on function store.set_marketing_attribution_settings(integer, text) to authenticated, service_role;

-- ─── RLS: leitura por empresa com permissão; escrita só por função ─────────
alter table store.marketing_attribution_settings enable row level security;
alter table store.marketing_sessions enable row level security;
alter table store.marketing_touchpoints enable row level security;
alter table store.marketing_session_links enable row level security;
alter table store.order_attributions enable row level security;
alter table store.marketing_attribution_audit enable row level security;

drop policy if exists marketing_settings_select on store.marketing_attribution_settings;
create policy marketing_settings_select on store.marketing_attribution_settings
  for select to authenticated using (private.has_marketing_permission(company_id, 'marketing.view'));
drop policy if exists marketing_touchpoints_select on store.marketing_touchpoints;
create policy marketing_touchpoints_select on store.marketing_touchpoints
  for select to authenticated using (private.has_marketing_permission(company_id, 'marketing.view'));
drop policy if exists order_attributions_select on store.order_attributions;
create policy order_attributions_select on store.order_attributions
  for select to authenticated using (private.has_marketing_permission(company_id, 'marketing.view'));
drop policy if exists marketing_audit_select on store.marketing_attribution_audit;
create policy marketing_audit_select on store.marketing_attribution_audit
  for select to authenticated using (private.has_marketing_permission(company_id, 'marketing.manage'));
-- Sessões e vínculos não têm policy: contêm user agent e ligação a pessoas;
-- só o servidor lê.

revoke all on store.marketing_attribution_settings, store.marketing_sessions, store.marketing_touchpoints,
  store.marketing_session_links, store.order_attributions, store.marketing_attribution_audit
  from anon, authenticated;
grant select on store.marketing_attribution_settings, store.marketing_touchpoints,
  store.order_attributions, store.marketing_attribution_audit to authenticated;
grant all on store.marketing_attribution_settings, store.marketing_sessions, store.marketing_touchpoints,
  store.marketing_session_links, store.order_attributions, store.marketing_attribution_audit to service_role;

comment on table store.order_attributions is
  'Origem de marketing de pedidos pagos (primeiro e último contato). Escrita só por store.attribute_order e correção manual auditada.';
comment on table store.marketing_touchpoints is
  'Pontos de contato com sinal de origem. fbclid/fbc/fbp apenas com consentimento de anúncios.';
