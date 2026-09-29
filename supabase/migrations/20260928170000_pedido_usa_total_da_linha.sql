-- Checkout: "Totais do pedido sao inconsistentes." em pedidos validos.
--
-- store.create_order reconstruia cada linha como round(unit_price x quantidade)
-- e exigia igualdade exata com o subtotal. O servidor do site envia o unitario
-- arredondado a 2 casas e o total real da linha, que nao coincidem quando:
--   * a tiragem tem total fechado (50 un. = R$ 56,98 -> unitario 1,14 -> 57,00);
--   * ha extra de valor fixo por pedido (criacao de arte, revisao de arquivo).
-- Agora a linha usa o total_price enviado (o calculado pelo motor de precos do
-- servidor, via create_order_as). O item do pedido tambem passa a gravar esse
-- total, em vez do unitario x quantidade (que gravaria R$ 57,00).

CREATE OR REPLACE FUNCTION store.create_order(p_order jsonb, p_items jsonb, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_actor_role text;
  v_order_id uuid;
  v_number text;
  v_item jsonb;
  v_item_id uuid;
  v_profile_id uuid;
  v_customer_id uuid;
  v_reseller_id uuid;
  v_seller_id uuid;
  v_quote_id uuid;
  v_subtotal numeric(12,2);
  v_discount numeric(12,2);
  v_shipping numeric(12,2);
  v_total numeric(12,2);
  v_credit numeric(12,2);
  v_items_total numeric(12,2) := 0;
  v_quantity integer;
  v_unit numeric(12,4);
  v_line numeric(12,2);
  v_product_id uuid;
  v_coupon_id uuid;
  v_coupon store.coupons%rowtype;
  v_pct numeric(5,2);
  v_create_production boolean;
  v_payment_status text;
  v_payment_method text;
  v_limit numeric(12,2);
  v_limit_used numeric(12,2);
  v_cash_session_id uuid;
begin
  if v_actor is null then
    raise exception 'Sessão expirada.' using errcode = '42501';
  end if;
  if p_idempotency_key is null or length(p_idempotency_key) not between 12 and 200 then
    raise exception 'Chave de idempotência inválida.' using errcode = '22023';
  end if;

  select o.id, o.number into v_order_id, v_number
    from store.orders o where o.idempotency_key = p_idempotency_key;
  if v_order_id is not null then
    return jsonb_build_object('id', v_order_id, 'number', v_number, 'reused', true);
  end if;

  select p.role into v_actor_role
    from store.profiles p where p.id = v_actor and p.active for update;
  if v_actor_role is null then
    raise exception 'Perfil operacional ausente ou inativo.' using errcode = '42501';
  end if;
  if v_actor_role not in ('admin','vendedor','atendente')
     and coalesce(current_setting('app.trusted_order', true), '') <> 'true' then
    raise exception 'Pedidos de cliente e revendedor devem passar pelo checkout validado do servidor.' using errcode = '42501';
  end if;

  v_profile_id := coalesce(nullif(p_order->>'profile_id','')::uuid, v_actor);
  v_customer_id := nullif(p_order->>'customer_id','')::uuid;
  v_reseller_id := nullif(p_order->>'reseller_id','')::uuid;
  v_seller_id := nullif(p_order->>'seller_id','')::uuid;
  v_quote_id := nullif(p_order->>'quote_id','')::uuid;

  if coalesce(p_order->>'source','') = 'balcao' and v_customer_id is null then
    if v_actor_role not in ('admin','vendedor','atendente') then
      raise exception 'Somente a equipe pode registrar venda de balcão.' using errcode = '42501';
    end if;
    insert into store.customers (
      name, customer_type, tags, created_by, system_key
    ) values (
      'Consumidor balcão', 'pf', array['sistema','balcao'], v_actor, 'walk_in_customer'
    ) on conflict (system_key) where system_key is not null do update
      set active = true
    returning id into v_customer_id;
  end if;

  if v_actor_role not in ('admin','vendedor','atendente') and v_profile_id <> v_actor then
    raise exception 'Não é permitido criar pedido para outro perfil.' using errcode = '42501';
  end if;
  if v_reseller_id is not null and v_reseller_id <> v_actor and v_actor_role not in ('admin','vendedor','atendente') then
    raise exception 'Revendedor inválido para esta sessão.' using errcode = '42501';
  end if;
  if v_customer_id is not null
     and v_actor_role not in ('admin','vendedor','atendente')
     and not store.can_access_customer(v_customer_id) then
    raise exception 'Cliente não pertence a esta sessão.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'O pedido precisa ter ao menos um item.' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_quantity := (v_item->>'quantity')::integer;
    v_unit := (v_item->>'unit_price')::numeric;
    v_product_id := nullif(v_item->>'product_id','')::uuid;
    if v_quantity <= 0 or v_unit < 0 then
      raise exception 'Quantidade ou preço inválido.' using errcode = '22023';
    end if;
    if v_product_id is not null and not exists (
      select 1 from store.products p
      where p.id = v_product_id and p.active
        and v_quantity >= p.min_quantity
        and (p.max_quantity is null or v_quantity <= p.max_quantity)
    ) then
      raise exception 'Produto indisponível ou quantidade fora do limite operacional.' using errcode = '22023';
    end if;
    -- O total da linha e o calculado pelo motor de precos do servidor
    -- (tiragem real + extras de valor fixo). unit_price x quantidade nao
    -- reconstroi esse valor: a tiragem de 50 un. por R$ 56,98 tem unitario
    -- 1,1396, e um extra fixo (ex.: criacao de arte) nao e por unidade.
    -- Sem total informado (ex.: chamadas antigas), vale unitario x quantidade.
    v_line := round(coalesce((v_item->>'total_price')::numeric, v_unit * v_quantity), 2);
    if v_line < 0 then
      raise exception 'Total do item invalido.' using errcode = '22023';
    end if;
    v_items_total := v_items_total + v_line;
  end loop;

  v_subtotal := round(coalesce((p_order->>'subtotal')::numeric, 0), 2);
  v_discount := round(coalesce((p_order->>'discount_total')::numeric, 0), 2);
  v_shipping := round(coalesce((p_order->>'shipping_cost')::numeric, 0), 2);
  v_total := round(coalesce((p_order->>'total')::numeric, 0), 2);
  v_credit := round(coalesce((p_order->>'credit_used')::numeric, 0), 2);
  if v_items_total <> v_subtotal or v_discount < 0 or v_shipping < 0 or v_credit < 0
     or v_total <> round(greatest(0, v_subtotal - v_discount + v_shipping - v_credit), 2) then
    raise exception 'Totais do pedido são inconsistentes.' using errcode = '22023';
  end if;

  v_payment_status := coalesce(nullif(p_order->>'payment_status',''), 'pendente');
  v_payment_method := nullif(p_order->>'payment_method','');
  v_create_production := coalesce((p_order->>'create_production')::boolean, false);

  if v_payment_method = 'faturado' then
    if v_actor_role <> 'revendedor' or v_reseller_id <> v_actor or v_payment_status <> 'pendente' then
      raise exception 'Compra faturada disponivel apenas para o revendedor titular e com pagamento pendente.' using errcode = '42501';
    end if;
    select credit_limit, credit_used into v_limit, v_limit_used
      from store.reseller_profiles
     where profile_id = v_actor and approved
     for update;
    if v_limit is null or v_total <= 0 or v_limit - v_limit_used < v_total then
      raise exception 'Limite faturado insuficiente para este pedido.' using errcode = '22023';
    end if;
  end if;

  if nullif(p_order->>'coupon_code','') is not null then
    select * into v_coupon from store.coupons c
      where upper(c.code) = upper(p_order->>'coupon_code') for update;
    if v_coupon.id is null or not v_coupon.active
       or (v_coupon.valid_from is not null and v_coupon.valid_from > now())
       or (v_coupon.valid_to is not null and v_coupon.valid_to < now())
       or (v_coupon.usage_limit is not null and v_coupon.used_count >= v_coupon.usage_limit)
       or v_subtotal < v_coupon.min_order then
      raise exception 'Cupom indisponível.' using errcode = '22023';
    end if;
    if (select count(*) from store.coupon_uses cu
        where cu.coupon_id = v_coupon.id and cu.profile_id = v_profile_id) >= v_coupon.per_customer_limit then
      raise exception 'Limite de uso deste cupom atingido.' using errcode = '22023';
    end if;
    v_coupon_id := v_coupon.id;
  end if;

  insert into store.orders (
    customer_id, profile_id, reseller_id, seller_id, created_by,
    status, payment_status, payment_method, installments,
    subtotal, discount_total, coupon_code, coupon_discount, shipping_cost, total, credit_used,
    shipping_method, shipping_address, billing, estimated_delivery, art_flow,
    priority, notes, source, quote_id, idempotency_key
  ) values (
    v_customer_id, v_profile_id, v_reseller_id, v_seller_id, v_actor,
    coalesce(nullif(p_order->>'status',''), 'pedido_recebido'), v_payment_status,
    v_payment_method, coalesce((p_order->>'installments')::integer, 1),
    v_subtotal, v_discount, nullif(p_order->>'coupon_code',''),
    coalesce((p_order->>'coupon_discount')::numeric, 0), v_shipping, v_total, v_credit,
    nullif(p_order->>'shipping_method',''), p_order->'shipping_address', p_order->'billing',
    nullif(p_order->>'estimated_delivery','')::date, nullif(p_order->>'art_flow',''),
    coalesce(nullif(p_order->>'priority',''), 'normal'), nullif(p_order->>'notes',''),
    coalesce(nullif(p_order->>'source',''), 'loja'), v_quote_id, p_idempotency_key
  ) returning id, number into v_order_id, v_number;

  if v_payment_method = 'faturado' then
    update store.reseller_profiles
       set credit_used = credit_used + v_total
     where profile_id = v_actor
     returning credit_used into v_limit_used;
    insert into store.reseller_limit_movements (
      profile_id, order_id, type, amount, used_after, idempotency_key
    ) values (
      v_actor, v_order_id, 'reserva', v_total, v_limit_used, p_idempotency_key || ':limite:reserva'
    );
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_quantity := (v_item->>'quantity')::integer;
    v_unit := (v_item->>'unit_price')::numeric;
    v_product_id := nullif(v_item->>'product_id','')::uuid;
    insert into store.order_items (
      order_id, product_id, product_name, product_slug, sku, quantity,
      unit_price, total_price, base_price, options, price_breakdown,
      production_days, art_flow, notes
    ) values (
      v_order_id, v_product_id, v_item->>'product_name', nullif(v_item->>'product_slug',''),
      nullif(v_item->>'sku',''), v_quantity, v_unit,
      round(coalesce((v_item->>'total_price')::numeric, v_unit * v_quantity), 2),
      coalesce((v_item->>'base_price')::numeric, v_unit), coalesce(v_item->'options','{}'::jsonb),
      coalesce(v_item->'price_breakdown','[]'::jsonb),
      coalesce((v_item->>'production_days')::integer, 3), nullif(v_item->>'art_flow',''),
      nullif(v_item->>'notes','')
    ) returning id into v_item_id;

    if v_create_production then
      insert into store.production_orders (
        order_id, order_item_id, product_name, quantity, priority, assigned_section
      ) values (
        v_order_id, v_item_id, v_item->>'product_name', v_quantity,
        coalesce(nullif(p_order->>'priority',''), 'normal'), nullif(p_order->>'assigned_section','')
      );
    end if;
  end loop;

  if v_credit > 0 then
    insert into store.credits (profile_id, type, amount, reason, order_id, created_by)
    values (v_profile_id, 'debito', v_credit, 'Crédito aplicado no pedido ' || v_number, v_order_id, v_actor);
    insert into store.payments (order_id, method, status, amount, paid_at, created_by, idempotency_key)
    values (v_order_id, 'credito_interno', 'pago', v_credit, now(), v_actor, p_idempotency_key || ':credito');
  end if;

  if v_total > 0 then
    insert into store.payments (
      order_id, method, status, amount, installments, gateway_payment_id,
      paid_at, created_by, idempotency_key
    ) values (
      v_order_id, coalesce(v_payment_method,'combinado'), v_payment_status, v_total,
      coalesce((p_order->>'installments')::integer, 1), nullif(p_order->>'payment_reference',''),
      case when v_payment_status = 'pago' then now() else null end,
      v_actor, p_idempotency_key || ':principal'
    );
  end if;

  if coalesce(p_order->>'source','') = 'balcao' and v_payment_status = 'pago' then
    select id into v_cash_session_id from store.cash_sessions
     where operator_id = v_actor and status = 'aberto' for update;
    if v_cash_session_id is null then
      raise exception 'Abra o caixa antes de registrar uma venda de balcao recebida.' using errcode = 'P0001';
    end if;
    if v_total > 0 then
      insert into store.cash_movements (
        cash_session_id, order_id, type, payment_method, amount, reference, created_by, idempotency_key
      ) values (
        v_cash_session_id, v_order_id, 'venda', v_payment_method, v_total,
        nullif(p_order->>'payment_reference',''), v_actor, p_idempotency_key || ':caixa'
      );
    end if;
  end if;

  if v_coupon_id is not null then
    insert into store.coupon_uses (coupon_id, order_id, profile_id, discount_amount)
    values (v_coupon_id, v_order_id, v_profile_id,
            coalesce((p_order->>'coupon_discount')::numeric, 0));
  end if;

  insert into store.finance_entries (
    type, description, category, amount, due_date, paid_at, status,
    order_id, customer_id, payment_method, created_by
  ) values (
    'receber', 'Pedido ' || v_number, 'vendas', v_total + v_credit, current_date,
    case when v_payment_status = 'pago' then now() else null end,
    case when v_payment_status = 'pago' then 'pago' else 'aberto' end,
    v_order_id, v_customer_id, v_payment_method, v_actor
  ) on conflict (order_id) where order_id is not null and type = 'receber' do update
    set amount = excluded.amount, payment_method = excluded.payment_method,
        status = excluded.status, paid_at = excluded.paid_at;

  if v_reseller_id is not null then
    select rp.commission_pct into v_pct from store.reseller_profiles rp
      where rp.profile_id = v_reseller_id and rp.approved for update;
    if coalesce(v_pct, 0) <= 0 then
      raise exception 'Comissão do revendedor não está configurada.' using errcode = '22023';
    end if;
    insert into store.commissions (order_id, profile_id, role, base_amount, percentage, amount, status)
    values (v_order_id, v_reseller_id, 'revendedor', v_subtotal, v_pct,
            round(v_subtotal * v_pct / 100, 2),
            case when v_payment_status = 'pago' then 'aprovado' else 'previsto' end);
  end if;

  if v_seller_id is not null then
    select sp.commission_pct into v_pct from store.seller_profiles sp where sp.profile_id = v_seller_id;
    if coalesce(v_pct, 0) > 0 then
      insert into store.commissions (order_id, profile_id, role, base_amount, percentage, amount, status)
      values (v_order_id, v_seller_id, 'vendedor', v_subtotal, v_pct,
              round(v_subtotal * v_pct / 100, 2),
              case when v_payment_status = 'pago' then 'aprovado' else 'previsto' end)
      on conflict (order_id, profile_id, role) where order_id is not null do nothing;
    end if;
  end if;

  return jsonb_build_object('id', v_order_id, 'number', v_number, 'reused', false);
exception
  when unique_violation then
    select o.id, o.number into v_order_id, v_number
      from store.orders o where o.idempotency_key = p_idempotency_key;
    if v_order_id is not null then
      return jsonb_build_object('id', v_order_id, 'number', v_number, 'reused', true);
    end if;
    raise;
end;
$function$;
