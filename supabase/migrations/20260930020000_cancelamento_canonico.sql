-- Cancelamento de pedido como uma operação única do banco.
--
-- Antes, o site cancelava em passos soltos, fora de uma transação, e a jornada
-- de homologação (30/09) encontrou:
--   * histórico com a transição para "cancelado" duas vezes (a ação inseria a
--     linha com o motivo e o gatilho log_order_status inseria outra);
--   * cobrança Pix "pendente" e payment_status "pendente" num pedido cancelado;
--   * cancelar de novo (ou clique duplo) devolvia o crédito interno outra vez;
--   * o lançamento já PAGO do financeiro virava "cancelado", tirando do "total
--     recebido" um dinheiro que continua recebido até ser devolvido.
--
-- store.cancel_order faz tudo numa transação: mesmas regras de quem pode
-- cancelar (equipe admin/vendedor; cliente só antes da produção), idempotente,
-- o motivo vai para a mesma linha de histórico gravada pelo gatilho, e o que
-- já foi pago fica como pago (devolução é outro fluxo, sinalizado no retorno).

-- 1. O gatilho de histórico aceita um motivo da própria transação ---------------

create or replace function store.log_order_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into store.order_status_history (order_id, from_status, to_status, note, changed_by)
    values (new.id, null, new.status, 'Pedido criado.', coalesce(auth.uid(), new.created_by));

  elsif new.status is distinct from old.status then
    -- app.status_note: motivo informado por quem mudou a situação (ex.: cancel_order).
    insert into store.order_status_history (order_id, from_status, to_status, note, changed_by)
    values (
      new.id, old.status, new.status,
      nullif(pg_catalog.current_setting('app.status_note', true), ''),
      coalesce(auth.uid(), new.created_by)
    );
  end if;

  return new;
end;
$$;

-- 2. Cancelamento canônico ------------------------------------------------------

create or replace function store.cancel_order(p_order_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
  v_order store.orders%rowtype;
  v_staff boolean;
  v_refund boolean := false;
begin
  if v_uid is null then
    raise exception 'Sessão expirada.' using errcode = '42501';
  end if;
  if v_reason is null then
    raise exception 'Informe o motivo do cancelamento.' using errcode = '22023';
  end if;

  select * into v_order from store.orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'Pedido não encontrado.' using errcode = 'P0002';
  end if;

  v_staff := store.auth_role() in ('admin', 'vendedor');
  if not v_staff and v_order.profile_id is distinct from v_uid then
    raise exception 'Você não pode cancelar este pedido.' using errcode = '42501';
  end if;

  -- Idempotente: cancelar de novo não repete estorno nem lançamentos.
  if v_order.status = 'cancelado' then
    return pg_catalog.jsonb_build_object('ok', true, 'already', true, 'number', v_order.number);
  end if;

  if not v_staff and v_order.status not in ('pedido_recebido', 'aguardando_pagamento', 'pagamento_analise', 'aguardando_arquivos') then
    raise exception 'Este pedido já entrou em produção. Abra um chamado para avaliarmos o cancelamento — produtos personalizados seguem a política de troca e cancelamento.'
      using errcode = '22023';
  end if;

  v_refund := v_order.payment_status = 'pago';

  perform pg_catalog.set_config('app.status_note', v_reason, true);
  update store.orders set
    status = 'cancelado',
    -- Pago continua pago até a devolução ser registrada.
    payment_status = case when payment_status in ('pago', 'estornado') then payment_status else 'cancelado' end
  where id = v_order.id;
  perform pg_catalog.set_config('app.status_note', '', true);

  update store.payments set status = 'cancelado'
  where order_id = v_order.id and status in ('pendente', 'processando');
  update store.finance_entries set status = 'cancelado'
  where order_id = v_order.id and status <> 'pago';
  update store.commissions set status = 'cancelado'
  where order_id = v_order.id and status <> 'pago';

  if coalesce(v_order.credit_used, 0) > 0 and v_order.profile_id is not null then
    insert into store.credits (profile_id, type, amount, reason, order_id, created_by)
    values (
      v_order.profile_id, 'estorno', v_order.credit_used,
      'Estorno do crédito usado no pedido ' || v_order.number || ' (cancelado)', v_order.id, v_uid
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'ok', true, 'already', false, 'number', v_order.number,
    'credit_refunded', coalesce(v_order.credit_used, 0),
    -- Já estava pago: a devolução do dinheiro precisa ser feita e registrada.
    'refund_pending', v_refund
  );
end;
$$;

comment on function store.cancel_order(uuid, text) is
  'Cancela um pedido numa transação: histórico com motivo, cobrança, financeiro, comissões e estorno de crédito. Idempotente.';

revoke all on function store.cancel_order(uuid, text) from public, anon;
grant execute on function store.cancel_order(uuid, text) to authenticated;
