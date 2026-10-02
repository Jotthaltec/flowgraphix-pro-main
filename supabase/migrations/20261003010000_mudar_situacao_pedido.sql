-- Mudar a situação do pedido com observação no histórico.
--
-- store.order_status_history só aceita INSERT (sem política de UPDATE): o
-- painel da loja grava a situação e depois tenta preencher a observação na
-- última linha do histórico, o que falha em silêncio. O gatilho
-- store.log_order_status já lê app.status_note (é assim que cancel_order grava
-- o motivo). Esta função usa o mesmo caminho, numa transação, para o CRM e
-- para o painel da loja.

create or replace function store.update_order_status(
  p_order_id uuid,
  p_status text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not store.is_staff() then
    raise exception 'Sem permissao para alterar a situacao do pedido.' using errcode = '42501';
  end if;
  if p_status = 'cancelado' then
    raise exception 'Para cancelar, use o cancelamento (informa o motivo e trata cobranca e estoque).'
      using errcode = '22023';
  end if;

  perform pg_catalog.set_config('app.status_note', coalesce(pg_catalog.btrim(p_note), ''), true);
  update store.orders set status = p_status where id = p_order_id;
  if not found then
    raise exception 'Pedido nao encontrado.' using errcode = 'P0002';
  end if;
  perform pg_catalog.set_config('app.status_note', '', true);
end;
$$;

revoke all on function store.update_order_status(uuid, text, text) from public, anon;
grant execute on function store.update_order_status(uuid, text, text) to authenticated;
