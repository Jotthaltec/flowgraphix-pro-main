-- Pagamento marcado no Financeiro do Flow passa a valer na loja.
--
-- A tela Financeiro gravava payment_status direto em public.orders, que é o
-- espelho de store.orders (gatilho store.sync_order_to_crm) e não tem caminho
-- de volta: a loja nunca via o pagamento, nenhum lançamento financeiro ou
-- comissão era gerado, e a próxima alteração do pedido na loja apagava a
-- marcação feita no Flow.
--
-- Esta função grava em store.orders, a fonte. Os gatilhos da loja fazem o
-- resto: lançamento em finance_entries, comissões, limite de revenda e o
-- espelho em public.orders.

create or replace function store.crm_set_order_payment(p_order_id uuid, p_crm_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text := case p_crm_status
    when 'pago' then 'pago'
    when 'entrada_paga' then 'processando'
    when 'nao_pago' then 'pendente'
  end;
begin
  if not store.is_staff() then
    raise exception 'Sem permissao para alterar pagamentos.' using errcode = '42501';
  end if;
  if v_status is null then
    raise exception 'Status de pagamento invalido: %', p_crm_status using errcode = '22023';
  end if;

  update store.orders set
    payment_status = v_status,
    status = case
      when v_status = 'pago' and status in ('pedido_recebido', 'aguardando_pagamento', 'pagamento_analise')
        then 'pago'
      else status
    end
  where id = p_order_id;
  if not found then
    raise exception 'Pedido nao encontrado na loja.' using errcode = 'P0002';
  end if;

  if v_status = 'pago' then
    update store.payments set status = 'pago', paid_at = pg_catalog.now(),
      note = coalesce(note, 'Confirmado pelo Financeiro do Flow.')
    where order_id = p_order_id and status = 'pendente';
  end if;
end;
$$;

revoke all on function store.crm_set_order_payment(uuid, text) from public, anon;
grant execute on function store.crm_set_order_payment(uuid, text) to authenticated;
