-- Retirar pelo Flow não parece mais "edição direta na loja".
--
-- Despublicar/arquivar (20260929040000) muda active, o que entra no
-- content_hash, sem atualizar a assinatura. A republicação seguinte comparava
-- a loja com a assinatura antiga e avisava "Alterações feitas direto na loja
-- foram substituídas" sem ninguém ter mexido na loja (visto na homologação de
-- 30/09). Agora a retirada renova a assinatura quando a loja estava igual ao
-- publicado; se já havia edição direta, a divergência continua visível.

create or replace function store.withdraw_crm_product_internal(p_product_id uuid, p_mode text, p_reason text, p_origin text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_site_hash text;
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

  -- Loja igual ao publicado antes da retirada? Então a mudança abaixo é do
  -- próprio Flow e a assinatura acompanha; senão a divergência real fica.
  v_site_hash := store.product_content_hash(p_product_id);

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

  if v_site_hash is not distinct from v_product.content_hash then
    update store.products set content_hash = store.product_content_hash(p_product_id)
    where id = p_product_id;
  end if;

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
$function$;

revoke all on function store.withdraw_crm_product_internal(uuid, text, text, text) from public, anon, authenticated;
