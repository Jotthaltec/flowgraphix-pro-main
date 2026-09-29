-- Divergência real e fila de sincronização de produtos (fase 5 da integração).
--
-- 1. Status real: calculado dos dados, nunca só de synced_at.
--      site alterado   hash atual da loja <> content_hash publicado  -> attention
--      Flow alterado   edição depois da publicação (ou fila aberta)  -> stale
--      sem assinatura  publicado antes de existir content_hash        -> stale
--    public.site_products.sync_status passa a devolver esse status real.
--
-- 2. Fila persistente (store.product_sync_queue). Alterar no Flow um produto já
--    publicado (dados, preço, prazo, imagens, variações, tiragens, extras,
--    gabaritos) marca-o 'stale' e, se auto_sync, agenda a republicação:
--      * idempotente: no máximo um item aberto por produto (índice único
--        parcial); alterações repetidas são agrupadas no mesmo item;
--      * janela de 30 s: cada alteração adia o processamento, para não publicar
--        um grafo que o importador ainda está regravando;
--      * novas tentativas com intervalo crescente (1, 4, 16, 64 min) e, depois
--        de max_attempts, o item fica 'error' (o produto já está 'error');
--      * sobrevive a interrupções: o processamento de cada lote é uma
--        transação, então um item nunca fica preso em 'processing'.
--
-- 3. Sem laço Flow -> loja -> Flow: a publicação só lê o Flow; mesmo assim os
--    gatilhos ignoram escritas feitas durante uma publicação, e uma
--    republicação sem mudança é noop.
--
-- O agendamento (pg_cron) está na migração seguinte, 20260929030100.

-- 1. Publicação automática por produto -------------------------------------------

alter table store.products
  add column if not exists auto_sync boolean not null default true;

comment on column store.products.auto_sync is
  'Produto do Flow: alterações no Flow são republicadas sozinhas pela fila. Sem efeito em nativos.';

-- 2. Fila ---------------------------------------------------------------------------

create table if not exists store.product_sync_queue (
  id uuid primary key default gen_random_uuid(),
  crm_product_id uuid not null,
  company_id uuid,
  events text[] not null default '{}',
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'done', 'error', 'cancelled')),
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  last_error text,
  requested_at timestamptz not null default now(),
  next_attempt_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table store.product_sync_queue is
  'Republicações pendentes Flow -> loja. Um item aberto por produto; ver migração 20260929030000.';
comment on column store.product_sync_queue.requested_at is
  'Última alteração no Flow que pediu esta sincronização.';
comment on column store.product_sync_queue.events is
  'O que mudou (produto, preco, prazo, imagens, variacoes, extras, gabaritos, status), agrupado.';

-- Chave de idempotência: um único item aberto por produto.
create unique index if not exists product_sync_queue_open_uidx
  on store.product_sync_queue (crm_product_id) where status in ('pending', 'processing');
create index if not exists product_sync_queue_due_idx
  on store.product_sync_queue (next_attempt_at) where status = 'pending';
create index if not exists product_sync_queue_product_idx
  on store.product_sync_queue (crm_product_id, created_at desc);

alter table store.product_sync_queue enable row level security;

drop policy if exists product_sync_queue_leitura on store.product_sync_queue;
create policy product_sync_queue_leitura on store.product_sync_queue
  for select to authenticated
  using (private.is_company_member(company_id));

revoke all on store.product_sync_queue from anon, authenticated;
grant select on store.product_sync_queue to authenticated;
grant all on store.product_sync_queue to service_role;

-- 3. Estado real de um produto da loja ----------------------------------------------

create or replace function store.product_sync_state(p_product_id uuid)
returns table (
  status text,
  site_changed boolean,
  crm_changed boolean,
  orphan boolean,
  site_hash text,
  divergence text
)
language sql
stable
set search_path = ''
as $$
  with s as (
    select
      p.sync_origin, p.sync_status, p.archived_at, p.content_hash, p.source_updated_at, p.synced_at,
      c.id is null and p.sync_origin = 'crm' as orphan,
      c.updated_at as crm_updated_at,
      case when p.sync_origin = 'crm' then store.product_content_hash(p.id) end as site_hash,
      exists (
        select 1 from store.product_sync_queue q
        where q.crm_product_id = p.crm_id and q.status in ('pending', 'processing', 'error')
      ) as queued
    from store.products p
    left join public.products c on c.id = p.crm_id
    where p.id = p_product_id
  ), f as (
    select s.*,
      s.sync_origin = 'crm' and s.content_hash is not null
        and s.site_hash is distinct from s.content_hash as site_changed,
      -- Publicado antes de existir source_updated_at: a referência é a própria
      -- publicação, senão toda edição antiga pareceria "Flow alterado".
      s.sync_origin = 'crm' and not s.orphan and (
        s.queued or s.sync_status = 'stale'
        or s.crm_updated_at > coalesce(s.source_updated_at, s.synced_at, '-infinity'::timestamptz)
      ) as crm_changed
    from s
  )
  select
    case
      when f.sync_origin = 'site' then 'native'
      when f.archived_at is not null then 'archived'
      when f.orphan then 'attention'
      when f.sync_status = 'error' then 'error'
      when f.site_changed then 'attention'
      when f.content_hash is null or f.crm_changed then 'stale'
      else f.sync_status
    end,
    coalesce(f.site_changed, false),
    coalesce(f.crm_changed, false),
    coalesce(f.orphan, false),
    f.site_hash,
    case
      when f.sync_origin = 'site' then null
      when f.orphan then 'orfao'
      when f.site_changed and f.crm_changed then 'ambos'
      when f.site_changed then 'site'
      when f.crm_changed then 'flow'
      when f.content_hash is null then 'sem_assinatura'
    end
  from f;
$$;

comment on function store.product_sync_state(uuid) is
  'Status de sincronização calculado dos dados reais (hash da loja x publicado, edições no Flow, fila, órfão).';

revoke all on function store.product_sync_state(uuid) from public, anon;
grant execute on function store.product_sync_state(uuid) to authenticated, service_role;

-- 4. Agendar republicação -------------------------------------------------------------

create or replace function store.enqueue_product_sync(p_crm_product_id uuid, p_event text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store store.products%rowtype;
begin
  -- Escrita feita pela própria publicação: nunca realimenta a fila.
  if coalesce(pg_catalog.current_setting('app.publishing_product', true), '') = 'on' then
    return;
  end if;

  select * into v_store from store.products
  where crm_id = p_crm_product_id and sync_origin = 'crm';
  -- Nunca publicado, ou arquivado: nada a propagar.
  if v_store.id is null or v_store.archived_at is not null then
    return;
  end if;

  update store.products set sync_status = 'stale'
  where id = v_store.id and sync_status in ('synced', 'attention');

  if not v_store.auto_sync then
    return;
  end if;

  insert into store.product_sync_queue as q (crm_product_id, company_id, events, next_attempt_at)
  select p_crm_product_id, c.company_id, array[p_event], pg_catalog.now() + interval '30 seconds'
  from public.products c where c.id = p_crm_product_id
  on conflict (crm_product_id) where status in ('pending', 'processing') do update set
    events = (select pg_catalog.array_agg(distinct e order by e) from pg_catalog.unnest(q.events || excluded.events) e),
    requested_at = pg_catalog.now(),
    updated_at = pg_catalog.now(),
    -- Conteúdo novo merece tentativas novas; item em processamento é decidido
    -- pelo processador, que o devolve à fila se requested_at avançou.
    attempts = case when q.status = 'pending' then 0 else q.attempts end,
    next_attempt_at = case when q.status = 'pending' then excluded.next_attempt_at else q.next_attempt_at end;
end;
$$;

revoke all on function store.enqueue_product_sync(uuid, text) from public, anon, authenticated;

-- Produto do Flow: só mudanças reais (updated_at sozinho não conta).
create or replace function store.crm_product_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_keys text[];
  v_event text;
begin
  select pg_catalog.array_agg(n.key) into v_keys
  from pg_catalog.jsonb_each(pg_catalog.to_jsonb(new)) n
  where n.key <> 'updated_at' and n.value is distinct from pg_catalog.to_jsonb(old) -> n.key;
  if v_keys is null then
    return new;
  end if;

  v_event := case
    when v_keys && array['status'] then 'status'
    when v_keys && array['sale_price', 'suggested_price', 'min_price', 'cost_price', 'base_cost',
                         'margin_percent', 'target_margin', 'quantity_prices', 'quantity_price_table'] then 'preco'
    when v_keys && array['production_deadline', 'avg_production_time'] then 'prazo'
    when v_keys && array['main_image_url', 'image_url', 'gallery_images'] then 'imagens'
    when v_keys && array['variations', 'specifications', 'extra_services'] then 'variacoes'
    else 'produto'
  end;
  perform store.enqueue_product_sync(new.id, v_event);
  return new;
end;
$$;

revoke all on function store.crm_product_changed() from public, anon, authenticated;

drop trigger if exists tr_crm_product_changed on public.products;
create trigger tr_crm_product_changed
  after update on public.products
  for each row execute function store.crm_product_changed();

-- Tabelas do grafo que a publicação lê. TG_ARGV[0] = evento.
create or replace function store.crm_product_child_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := pg_catalog.to_jsonb(case when tg_op = 'DELETE' then old else new end);
  v_product_id uuid;
begin
  if tg_table_name = 'product_price_tiers' then
    -- Na exclusão em cascata a variante já pode ter sumido; o gatilho da
    -- variante cobre esse caso.
    select v.product_id into v_product_id
    from public.product_variants v where v.id = (v_row ->> 'variant_id')::uuid;
  else
    v_product_id := (v_row ->> 'product_id')::uuid;
  end if;

  if v_product_id is not null then
    perform store.enqueue_product_sync(v_product_id, tg_argv[0]);
  end if;
  return null;
end;
$$;

revoke all on function store.crm_product_child_changed() from public, anon, authenticated;

drop trigger if exists tr_crm_variants_changed on public.product_variants;
create trigger tr_crm_variants_changed
  after insert or update or delete on public.product_variants
  for each row execute function store.crm_product_child_changed('variacoes');

drop trigger if exists tr_crm_price_tiers_changed on public.product_price_tiers;
create trigger tr_crm_price_tiers_changed
  after insert or update or delete on public.product_price_tiers
  for each row execute function store.crm_product_child_changed('preco');

drop trigger if exists tr_crm_images_changed on public.product_images;
create trigger tr_crm_images_changed
  after insert or update or delete on public.product_images
  for each row execute function store.crm_product_child_changed('imagens');

drop trigger if exists tr_crm_templates_changed on public.product_templates;
create trigger tr_crm_templates_changed
  after insert or update or delete on public.product_templates
  for each row execute function store.crm_product_child_changed('gabaritos');

drop trigger if exists tr_crm_extras_changed on public.product_extras;
create trigger tr_crm_extras_changed
  after insert or update or delete on public.product_extras
  for each row execute function store.crm_product_child_changed('extras');

-- 5. Publicação: não realimenta a fila e fecha o que ela resolveu -------------------

-- A marca vale só para a transação; os gatilhos acima a consultam.
create or replace function store.publish_crm_product(p_crm_product_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  v_result jsonb;
begin
  select company_id into v_company from public.products where id = p_crm_product_id;
  if not found then
    raise exception 'Produto do Flow nao encontrado.' using errcode = 'P0002';
  end if;
  if not private.is_company_member(v_company, array['owner','admin']) then
    raise exception 'Sem permissao para publicar este produto.' using errcode = '42501';
  end if;

  perform pg_catalog.set_config('app.publishing_product', 'on', true);
  v_result := store.publish_crm_product_internal(p_crm_product_id, 'manual');
  perform pg_catalog.set_config('app.publishing_product', 'off', true);

  -- Publicação manual bem-sucedida resolve o que a fila pedia até agora.
  if (v_result ->> 'ok')::boolean then
    update store.product_sync_queue set
      status = 'done', completed_at = pg_catalog.now(), updated_at = pg_catalog.now(),
      last_error = null, result = v_result
    where crm_product_id = p_crm_product_id
      and status in ('pending', 'error')
      and requested_at <= pg_catalog.now();
  end if;
  return v_result;
end;
$$;

revoke all on function store.publish_crm_product(uuid) from public, anon;
grant execute on function store.publish_crm_product(uuid) to authenticated;

-- 6. Processador -------------------------------------------------------------------------

create or replace function store.product_sync_backoff(p_attempts integer)
returns interval
language sql
immutable
set search_path = ''
as $$
  select least(interval '1 minute' * pg_catalog.power(4, greatest(p_attempts, 1) - 1), interval '6 hours');
$$;

create or replace function store.process_product_sync_queue(p_limit integer default 20)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r store.product_sync_queue%rowtype;
  v_result jsonb;
  v_attempts integer;
  v_again boolean;
  v_done integer := 0;
  v_requeued integer := 0;
  v_retry integer := 0;
  v_failed integer := 0;
  v_cancelled integer := 0;
begin
  for r in
    select * from store.product_sync_queue
    where status = 'pending' and next_attempt_at <= pg_catalog.now()
    order by next_attempt_at, created_at
    limit greatest(p_limit, 0)
    for update skip locked
  loop
    v_attempts := r.attempts + 1;
    update store.product_sync_queue set
      status = 'processing', attempts = v_attempts,
      started_at = pg_catalog.clock_timestamp(), updated_at = pg_catalog.clock_timestamp()
    where id = r.id;

    begin
      perform pg_catalog.set_config('app.publishing_product', 'on', true);
      v_result := store.publish_crm_product_internal(r.crm_product_id, 'fila');
      perform pg_catalog.set_config('app.publishing_product', 'off', true);
    exception when others then
      perform pg_catalog.set_config('app.publishing_product', 'off', true);
      v_result := pg_catalog.jsonb_build_object('ok', false, 'error', sqlerrm, 'code', sqlstate);
    end;

    if (v_result ->> 'ok')::boolean then
      -- Se o Flow mudou de novo enquanto publicava, volta para a fila.
      update store.product_sync_queue q set
        status = case when q.requested_at > r.requested_at then 'pending' else 'done' end,
        next_attempt_at = case when q.requested_at > r.requested_at
          then pg_catalog.now() + interval '30 seconds' else q.next_attempt_at end,
        attempts = case when q.requested_at > r.requested_at then 0 else q.attempts end,
        completed_at = case when q.requested_at > r.requested_at then null else pg_catalog.clock_timestamp() end,
        last_error = null, result = v_result, updated_at = pg_catalog.clock_timestamp()
      where q.id = r.id
      returning (q.status = 'pending') into strict v_again;
      if v_again then v_requeued := v_requeued + 1; else v_done := v_done + 1; end if;
    elsif v_result ->> 'code' = 'P0002' then
      -- Produto excluído no Flow: não há mais o que publicar.
      update store.product_sync_queue set
        status = 'cancelled', last_error = v_result ->> 'error', result = v_result,
        completed_at = pg_catalog.clock_timestamp(), updated_at = pg_catalog.clock_timestamp()
      where id = r.id;
      v_cancelled := v_cancelled + 1;
    elsif v_attempts >= r.max_attempts then
      update store.product_sync_queue set
        status = 'error', last_error = v_result ->> 'error', result = v_result,
        completed_at = pg_catalog.clock_timestamp(), updated_at = pg_catalog.clock_timestamp()
      where id = r.id;
      v_failed := v_failed + 1;
    else
      update store.product_sync_queue set
        status = 'pending', last_error = v_result ->> 'error', result = v_result,
        next_attempt_at = pg_catalog.now() + store.product_sync_backoff(v_attempts),
        updated_at = pg_catalog.clock_timestamp()
      where id = r.id;
      v_retry := v_retry + 1;
    end if;
  end loop;

  return pg_catalog.jsonb_build_object(
    'done', v_done, 'requeued', v_requeued, 'retry', v_retry,
    'failed', v_failed, 'cancelled', v_cancelled
  );
end;
$$;

comment on function store.process_product_sync_queue(integer) is
  'Processa itens vencidos da fila de republicação. Chamado pelo pg_cron (migração 20260929030100).';

revoke all on function store.process_product_sync_queue(integer) from public, anon, authenticated;
revoke all on function store.product_sync_backoff(integer) from public, anon, authenticated;
grant execute on function store.process_product_sync_queue(integer) to service_role;

-- 7. Visões ----------------------------------------------------------------------------

-- Painel de saúde: um produto do Flow por linha, com o status real e o porquê.
create or replace view store.crm_product_sync_health
with (security_invoker = true)
as
select
  p.id, p.crm_id, p.name, p.slug, p.active, p.auto_sync, p.archived_at,
  p.sync_status as stored_status,
  st.status as sync_status,
  st.divergence, st.site_changed, st.crm_changed, st.orphan,
  p.synced_at, p.sync_version, p.source_updated_at,
  c.updated_at as crm_updated_at,
  p.updated_at as site_updated_at,
  p.content_hash, st.site_hash, p.last_sync_error,
  q.status as queue_status, q.events as queue_events, q.attempts as queue_attempts,
  q.next_attempt_at as queue_next_attempt_at, q.last_error as queue_last_error
from store.products p
left join public.products c on c.id = p.crm_id
cross join lateral store.product_sync_state(p.id) st
left join lateral (
  select * from store.product_sync_queue q
  where q.crm_product_id = p.crm_id and q.status in ('pending', 'processing', 'error')
  order by q.created_at desc limit 1
) q on true
where p.sync_origin = 'crm';

revoke all on store.crm_product_sync_health from anon;
grant select on store.crm_product_sync_health to authenticated, service_role;

-- site_products.sync_status deixa de ser o valor gravado e passa a ser o real.
create or replace view public.site_products
with (security_invoker = true)
as
select p.id,
  p.sku,
  p.name,
  p.slug,
  c.name as categoria,
  p.price_unit as unidade_preco,
  p.base_price as preco_base,
  p.sale_price as preco_promocional,
  p.reseller_price as preco_revenda,
  p.min_quantity as quantidade_minima,
  p.production_days as prazo_producao_dias,
  p.featured as destaque,
  p.is_new as novidade,
  p.on_sale as em_promocao,
  p.reseller_only as exclusivo_revenda,
  p.updated_at,
  img.url as imagem,
  p.crm_id,
  p.active,
  (select st.status from store.product_sync_state(p.id) st) as sync_status,
  p.synced_at,
  p.sync_version,
  coalesce(stats.imagens, 0::bigint) as imagens,
  coalesce(stats.grupos, 0::bigint) as grupos_opcao,
  coalesce(stats.opcoes, 0::bigint) as opcoes,
  coalesce(stats.variantes, 0::bigint) as variantes,
  coalesce(stats.tiragens, 0::bigint) as tiragens
from store.products p
  left join store.categories c on c.id = p.category_id
  left join lateral (
    select i.url from store.product_images i
    where i.product_id = p.id and i.kind = any (array['foto'::text, 'mockup'::text])
    order by i."position", i.created_at
    limit 1
  ) img on true
  left join lateral (
    select
      (select count(*) from store.product_images i where i.product_id = p.id) as imagens,
      (select count(*) from store.product_option_groups g where g.product_id = p.id) as grupos,
      (select count(*) from store.product_options o
         join store.product_option_groups g on g.id = o.group_id where g.product_id = p.id) as opcoes,
      (select count(*) from store.product_variants v where v.product_id = p.id) as variantes,
      (select count(*) from store.product_variant_price_tiers t
         join store.product_variants v on v.id = t.variant_id where v.product_id = p.id) as tiragens
  ) stats on true;
