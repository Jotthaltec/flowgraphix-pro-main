-- Reversão de 20260930010000: volta à definição de 20260929040000.
--   psql "$SUPABASE_DB_URL" -1 -v ON_ERROR_STOP=1 -f <este arquivo>
--   delete from supabase_migrations.schema_migrations where version = '20260930010000';

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
