-- Despublicação e arquivamento seguros (fase 6 da integração).
--
-- Produto publicado não é mais excluído: sai de venda e o histórico fica.
--
--   despublicar  store.unpublish_crm_product(id, motivo)
--                tira da vitrine (active = false, unpublished_at); volta com
--                "Publicar" no Flow. Status 'pending'.
--   arquivar     store.archive_crm_product(id, motivo)
--                fora de venda e preservado (archived_at). Status 'archived';
--                só uma nova publicação explícita pelo Flow o traz de volta.
--   excluir      só produto do Flow que nunca foi publicado. Excluir no Flow
--                um produto que tem par na loja é recusado pelo banco.
--
-- Nos dois primeiros: autor, data e motivo ficam no produto e em store.sync_log,
-- e itens abertos da fila são cancelados (a fila não republica produto retirado).
--
-- Admin da loja (store.admin_remove_product): produto do Flow é sempre
-- arquivado, nunca apagado; nativo só é apagado sem referência comercial
-- (pedido, orçamento, avaliação, cupom, regra de preço), senão é arquivado.
-- Antes só pedido e orçamento contavam, e o resto ia embora em cascata.
--
-- Órfão (produto da loja cujo crm_id sumiu do Flow) continua sendo apontado
-- por store.product_sync_state / store.crm_product_sync_health; nada aqui o
-- remove sozinho.

-- 1. Campos ---------------------------------------------------------------------

alter table store.products
  add column if not exists unpublished_at timestamptz,
  add column if not exists withdrawn_reason text,
  add column if not exists withdrawn_by uuid;

comment on column store.products.unpublished_at is
  'Produto do Flow tirado da vitrine (despublicado). Limpo pela próxima publicação.';
comment on column store.products.withdrawn_reason is
  'Motivo da última despublicação/arquivamento. Limpo pela próxima publicação.';
comment on column store.products.withdrawn_by is
  'auth.uid() de quem despublicou/arquivou (nulo quando foi uma regra automática).';

alter table store.sync_log drop constraint if exists sync_log_acao_check;
alter table store.sync_log add constraint sync_log_acao_check
  check (acao = any (array['insert', 'update', 'skip', 'erro', 'delete', 'archive', 'unpublish']));

-- 2. Referências comerciais -----------------------------------------------------

create or replace function store.product_commercial_refs(p_product_id uuid)
returns text[]
language sql
stable
set search_path = ''
as $$
  select array_remove(array[
    case when exists (select 1 from store.order_items where product_id = p_product_id) then 'pedidos' end,
    case when exists (select 1 from store.quote_items where product_id = p_product_id) then 'orçamentos' end,
    case when exists (select 1 from store.product_reviews where product_id = p_product_id) then 'avaliações' end,
    case when exists (select 1 from store.coupons where product_id = p_product_id) then 'cupons' end,
    case when exists (select 1 from store.price_rules where product_id = p_product_id) then 'regras de preço' end
  ], null);
$$;

comment on function store.product_commercial_refs(uuid) is
  'Registros comerciais que impedem apagar o produto da loja (apagar levaria junto, em cascata).';

revoke all on function store.product_commercial_refs(uuid) from public, anon;
grant execute on function store.product_commercial_refs(uuid) to authenticated, service_role;

-- 3. Retirar um produto do Flow da loja (interna) ---------------------------------

create or replace function store.withdraw_crm_product_internal(
  p_product_id uuid, p_mode text, p_reason text, p_origin text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product store.products%rowtype;
  v_cancelled integer;
begin
  if p_mode not in ('unpublish', 'archive') then
    raise exception 'Modo invalido: %.', p_mode using errcode = '22023';
  end if;

  select * into v_product from store.products where id = p_product_id for update;
  if v_product.id is null then
    raise exception 'Produto da loja nao encontrado.' using errcode = 'P0002';
  end if;
  if v_product.sync_origin <> 'crm' then
    raise exception 'Produto nativo da loja: use o painel da loja.' using errcode = '42501';
  end if;

  update store.products set
    active = false,
    unpublished_at = case when p_mode = 'unpublish' then pg_catalog.now() else unpublished_at end,
    archived_at = case when p_mode = 'archive' then coalesce(archived_at, pg_catalog.now()) else archived_at end,
    sync_status = case
      when p_mode = 'archive' or archived_at is not null then 'archived'
      else 'pending'
    end,
    withdrawn_reason = p_reason,
    withdrawn_by = auth.uid()
  where id = p_product_id;

  -- A fila não pode republicar (e reativar) o que acabou de sair.
  update store.product_sync_queue set
    status = 'cancelled', completed_at = pg_catalog.now(), updated_at = pg_catalog.now(),
    last_error = case when p_mode = 'archive' then 'Produto arquivado.' else 'Produto despublicado.' end
  where crm_product_id = v_product.crm_id and status in ('pending', 'processing', 'error');
  get diagnostics v_cancelled = row_count;

  insert into store.sync_log(entidade, direcao, origem_id, destino_id, acao, sucesso, payload)
  values (
    'produtos', p_origin, v_product.crm_id, p_product_id, p_mode, true,
    pg_catalog.jsonb_build_object(
      'name', v_product.name, 'sku', v_product.sku, 'by', auth.uid(),
      'reason', p_reason, 'was_active', v_product.active, 'cancelled_queue_items', v_cancelled
    )
  );

  return pg_catalog.jsonb_build_object(
    'ok', true, 'action', p_mode, 'product_id', p_product_id,
    'sync_status', (select sync_status from store.products where id = p_product_id),
    'cancelled_queue_items', v_cancelled
  );
end;
$$;

revoke all on function store.withdraw_crm_product_internal(uuid, text, text, text) from public, anon, authenticated;

-- 4. Entradas públicas (Flow) ----------------------------------------------------

create or replace function store.withdraw_crm_product(p_crm_product_id uuid, p_mode text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  v_store_id uuid;
  v_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
begin
  select company_id into v_company from public.products where id = p_crm_product_id;
  if not found then
    raise exception 'Produto do Flow nao encontrado.' using errcode = 'P0002';
  end if;
  if not private.is_company_member(v_company, array['owner','admin']) then
    raise exception 'Sem permissao para retirar este produto da loja.' using errcode = '42501';
  end if;
  if v_reason is null then
    raise exception 'Informe o motivo.' using errcode = '22023';
  end if;
  if pg_catalog.length(v_reason) > 500 then
    raise exception 'Motivo muito longo (maximo 500 caracteres).' using errcode = '22023';
  end if;

  select id into v_store_id from store.products where crm_id = p_crm_product_id;
  if v_store_id is null then
    raise exception 'Este produto nao esta publicado na loja.' using errcode = 'P0002';
  end if;

  return store.withdraw_crm_product_internal(v_store_id, p_mode, v_reason, 'crm_para_site');
end;
$$;

revoke all on function store.withdraw_crm_product(uuid, text, text) from public, anon, authenticated;

create or replace function store.unpublish_crm_product(p_crm_product_id uuid, p_reason text)
returns jsonb
language sql
security definer
set search_path = ''
as $$ select store.withdraw_crm_product(p_crm_product_id, 'unpublish', p_reason); $$;

create or replace function store.archive_crm_product(p_crm_product_id uuid, p_reason text)
returns jsonb
language sql
security definer
set search_path = ''
as $$ select store.withdraw_crm_product(p_crm_product_id, 'archive', p_reason); $$;

comment on function store.unpublish_crm_product(uuid, text) is
  'Tira da vitrine um produto do Flow, com motivo. Transacional; registra em store.sync_log.';
comment on function store.archive_crm_product(uuid, text) is
  'Arquiva um produto do Flow na loja (fora de venda, histórico preservado), com motivo.';

revoke all on function store.unpublish_crm_product(uuid, text) from public, anon;
revoke all on function store.archive_crm_product(uuid, text) from public, anon;
grant execute on function store.unpublish_crm_product(uuid, text) to authenticated;
grant execute on function store.archive_crm_product(uuid, text) to authenticated;

-- 5. Admin da loja: nunca apaga produto do Flow nem registro comercial --------------

create or replace function store.remove_product_internal(p_product_id uuid, p_origin text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product store.products%rowtype;
  v_refs text[];
begin
  select * into v_product from store.products where id = p_product_id for update;
  if v_product.id is null then
    return 'not_found';
  end if;

  if v_product.sync_origin = 'crm' then
    perform store.withdraw_crm_product_internal(
      p_product_id, 'archive',
      case when p_origin = 'site' then 'Removido pelo admin da loja.' else 'Removido.' end,
      p_origin);
    return 'archive';
  end if;

  v_refs := store.product_commercial_refs(p_product_id);
  if pg_catalog.cardinality(v_refs) > 0 then
    update store.products
      set active = false, archived_at = coalesce(archived_at, pg_catalog.now())
      where id = p_product_id;
  else
    delete from store.products where id = p_product_id;
  end if;

  insert into store.sync_log(entidade, direcao, origem_id, destino_id, acao, sucesso, payload)
  values (
    'produtos', p_origin, null, p_product_id,
    case when pg_catalog.cardinality(v_refs) > 0 then 'archive' else 'delete' end, true,
    pg_catalog.jsonb_build_object('name', v_product.name, 'sku', v_product.sku, 'by', auth.uid(), 'refs', v_refs)
  );
  return case when pg_catalog.cardinality(v_refs) > 0 then 'archive' else 'delete' end;
end;
$$;

revoke all on function store.remove_product_internal(uuid, text) from public, anon, authenticated;

-- 6. Travas -----------------------------------------------------------------------

-- Flow: produto com par na loja não é excluído (antes o gatilho apagava a loja).
create or replace function store.guard_crm_product_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from store.products where crm_id = old.id) then
    raise exception 'O produto "%" ja foi publicado na loja e nao pode ser excluido. Despublique ou arquive.', old.name
      using errcode = '23503',
            hint = 'Produto publicado preserva historico: use Despublicar ou Arquivar.';
  end if;
  return old;
end;
$$;

revoke all on function store.guard_crm_product_delete() from public, anon, authenticated;

drop trigger if exists tr_crm_product_deleted on public.products;
drop function if exists store.crm_product_deleted();

drop trigger if exists tr_crm_product_delete_guard on public.products;
create trigger tr_crm_product_delete_guard
  before delete on public.products
  for each row execute function store.guard_crm_product_delete();

-- Loja: produto do Flow nunca é apagado (só arquivado).
create or replace function store.guard_store_crm_product_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.sync_origin = 'crm' then
    raise exception 'Produto vindo do Flow nao pode ser excluido da loja; arquive.' using errcode = '42501';
  end if;
  return old;
end;
$$;

revoke all on function store.guard_store_crm_product_delete() from public, anon, authenticated;

drop trigger if exists tr_products_guard_crm_delete on store.products;
create trigger tr_products_guard_crm_delete
  before delete on store.products
  for each row execute function store.guard_store_crm_product_delete();

-- Loja: produto do Flow despublicado ou arquivado só volta a venda por uma
-- publicação (que marca app.publishing_product). "Restaurar" no painel da loja
-- não o reativa por fora.
create or replace function store.guard_withdrawn_crm_product()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.sync_origin = 'crm' and new.active and not coalesce(old.active, false)
     and (new.unpublished_at is not null or new.sync_status = 'archived')
     and coalesce(pg_catalog.current_setting('app.publishing_product', true), '') <> 'on' then
    raise exception 'Produto retirado da loja pelo Flow: publique de novo pelo Flow.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function store.guard_withdrawn_crm_product() from public, anon, authenticated;

drop trigger if exists tr_products_guard_withdrawn on store.products;
create trigger tr_products_guard_withdrawn
  before update on store.products
  for each row execute function store.guard_withdrawn_crm_product();

-- Publicar de novo traz de volta: limpa despublicação e motivo junto com o arquivamento.
create or replace function store.crm_republish_unarchives()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.sync_origin = 'crm' and new.synced_at is distinct from old.synced_at
     and (old.archived_at is not null or old.unpublished_at is not null) then
    new.archived_at := null;
    new.unpublished_at := null;
    new.withdrawn_reason := null;
    new.withdrawn_by := null;
  end if;
  return new;
end;
$$;

revoke all on function store.crm_republish_unarchives() from public, anon, authenticated;

-- 7. Publicação: produto despublicado nunca é noop (precisa voltar à vitrine) ------

create or replace function store.publish_crm_product_internal(p_crm_product_id uuid, p_origin text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.products%rowtype;
  v_store store.products%rowtype;
  v_store_id uuid;
  v_result jsonb;
  v_warnings jsonb;
  v_status text;
  v_action text;
  v_hash text;
  v_site_hash text;
  v_problems text[];
  v_error text;
  v_code text;
  v_version integer;
  v_slug text;
begin
  -- Mesma ordem de travas da montagem: origem no Flow, depois a linha da loja.
  select * into v_source from public.products where id = p_crm_product_id for update;
  if v_source.id is null then
    raise exception 'Produto do Flow nao encontrado.' using errcode = 'P0002';
  end if;

  select * into v_store from store.products where crm_id = v_source.id for update;
  if v_store.id is not null then
    v_site_hash := store.product_content_hash(v_store.id);
  end if;

  begin
    v_result := store.publish_crm_product_apply(v_source.id);
    v_store_id := (v_result ->> 'id')::uuid;

    v_problems := store.product_publish_problems(v_store_id);
    if pg_catalog.cardinality(v_problems) > 0 then
      raise exception '%', pg_catalog.array_to_string(v_problems, ' ') using errcode = '22023';
    end if;

    v_hash := store.product_content_hash(v_store_id);

    -- Nada mudou nem no Flow nem na loja: desfaz a remontagem (os ids ficam).
    -- Retirado da loja nunca é noop: publicar é justamente trazê-lo de volta.
    if v_store.content_hash is not null
       and v_hash = v_store.content_hash
       and v_site_hash = v_store.content_hash
       and v_store.archived_at is null
       and v_store.unpublished_at is null then
      raise exception 'noop' using errcode = 'NXNOP';
    end if;
  exception
    when sqlstate 'NXNOP' then
      v_action := 'noop';
    when others then
      get stacked diagnostics v_error = message_text, v_code = returned_sqlstate;

      if v_store.id is not null then
        update store.products set sync_status = 'error', last_sync_error = v_error
        where id = v_store.id;
      end if;
      insert into store.sync_log(entidade, direcao, origem_id, destino_id, acao, sucesso, erro, payload)
      values (
        'produtos', 'crm_para_site', v_source.id, v_store.id, 'erro', false, v_error,
        pg_catalog.jsonb_build_object('name', v_source.name, 'code', v_code, 'origin', p_origin, 'published_by', auth.uid())
      );
      return pg_catalog.jsonb_build_object(
        'ok', false, 'action', 'error', 'product_id', v_store.id, 'id', v_store.id,
        'sync_status', case when v_store.id is null then null else 'error' end,
        'error', v_error, 'code', v_code,
        'content_hash', v_store.content_hash, 'warnings', '[]'::jsonb
      );
  end;

  v_warnings := coalesce(v_result -> 'warnings', '[]'::jsonb);
  v_status := case when pg_catalog.jsonb_array_length(v_warnings) > 0 then 'attention' else 'synced' end;

  if v_action = 'noop' then
    v_store_id := v_store.id;
    v_version := v_store.sync_version;
    update store.products set
      sync_status = v_status, last_sync_error = null, source_updated_at = v_source.updated_at
    where id = v_store_id;
  else
    v_action := v_result ->> 'action';
    if v_store.content_hash is not null and v_site_hash is distinct from v_store.content_hash then
      v_warnings := v_warnings || pg_catalog.to_jsonb(
        'Alteracoes feitas direto na loja foram substituidas pelo conteudo do Flow.'::text);
    end if;
    v_version := case when v_store.id is null then 1 else coalesce(v_store.sync_version, 0) + 1 end;
    update store.products set
      sync_status = v_status,
      synced_at = pg_catalog.now(),
      sync_version = v_version,
      source_updated_at = v_source.updated_at,
      content_hash = v_hash,
      last_sync_error = null,
      -- Publicar é a forma explícita de trazer de volta o que foi retirado.
      archived_at = null,
      unpublished_at = null,
      withdrawn_reason = null,
      withdrawn_by = null
    where id = v_store_id;
  end if;

  select slug into v_slug from store.products where id = v_store_id;

  insert into store.sync_log(entidade, direcao, origem_id, destino_id, acao, sucesso, payload)
  values (
    'produtos', 'crm_para_site', v_source.id, v_store_id,
    case when v_action = 'noop' then 'skip' else v_action end, true,
    pg_catalog.jsonb_build_object(
      'name', v_source.name,
      'action', v_action,
      'origin', p_origin,
      'published_by', auth.uid(),
      'sync_version', v_version,
      'content_hash', v_hash,
      'previous_hash', v_store.content_hash,
      'site_hash', v_site_hash,
      'counts', v_result -> 'counts',
      'warnings', v_warnings
    )
  );

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'action', v_action,
    'product_id', v_store_id,
    'id', v_store_id,
    'slug', v_slug,
    'sync_status', v_status,
    'sync_version', v_version,
    'content_hash', v_hash,
    'counts', v_result -> 'counts',
    'warnings', v_warnings
  );
end;
$$;

revoke all on function store.publish_crm_product_internal(uuid, text) from public, anon, authenticated;

-- 8. Fila: não agenda nem publica produto retirado ----------------------------------

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
  -- Nunca publicado, arquivado ou despublicado: nada a propagar.
  if v_store.id is null or v_store.archived_at is not null or v_store.unpublished_at is not null then
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
    -- Retirado da loja depois de agendado: a fila não o traz de volta.
    if exists (
      select 1 from store.products
      where crm_id = r.crm_product_id and (archived_at is not null or unpublished_at is not null)
    ) then
      update store.product_sync_queue set
        status = 'cancelled', last_error = 'Produto fora da loja (despublicado ou arquivado).',
        completed_at = pg_catalog.clock_timestamp(), updated_at = pg_catalog.clock_timestamp()
      where id = r.id;
      v_cancelled := v_cancelled + 1;
      continue;
    end if;

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

revoke all on function store.process_product_sync_queue(integer) from public, anon, authenticated;
grant execute on function store.process_product_sync_queue(integer) to service_role;

-- 9. Estado real: despublicado aparece como 'pending' -------------------------------

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
      p.sync_origin, p.sync_status, p.archived_at, p.unpublished_at, p.content_hash,
      p.source_updated_at, p.synced_at,
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
      when f.unpublished_at is not null then 'pending'
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

revoke all on function store.product_sync_state(uuid) from public, anon;
grant execute on function store.product_sync_state(uuid) to authenticated, service_role;

-- 10. Painel: quem retirou, quando e por quê ------------------------------------------

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
  q.next_attempt_at as queue_next_attempt_at, q.last_error as queue_last_error,
  p.unpublished_at, p.withdrawn_reason, p.withdrawn_by
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
