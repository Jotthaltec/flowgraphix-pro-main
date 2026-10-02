-- Promoção do fornecedor na loja (migração 20261002050000). Transação desfeita no fim.
begin;
\o /dev/null

do $$
declare
  v_company uuid := public.crm_default_company();
  v_crm uuid;
  v_store uuid;
  r record;
  n integer;
begin
  if v_company is null then
    insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000e1', 'qa.promo.dono@homolog.local');
    insert into public.companies (name, owner_id, store_access)
    values ('QA loja', '00000000-0000-4000-8000-0000000000e1', true);
    v_company := public.crm_default_company();
  end if;

  -- 50 un em promoção (normal 50,98 → por 38,24); 100 un sem promoção.
  insert into public.products (company_id, name, category, status, supplier_sku, quantity_prices)
  values (v_company, 'QA promo', 'QA', 'Ativo', 'QA-PROMO-1',
    '[{"quantity": 50, "price": 30, "listPrice": 40, "sellPrice": 50.98, "unitSellPrice": 1.0196, "promoSellPrice": 38.24},
      {"quantity": 100, "price": 38.99, "sellPrice": 58.48, "unitSellPrice": 0.5848}]')
  returning id into v_crm;

  v_store := (store.publish_crm_product_apply(v_crm) ->> 'id')::uuid;

  select * into r from store.product_price_tiers where product_id = v_store and min_qty = 50;
  assert r.unit_price = 0.7648 and r.compare_at_unit_price = 1.0196,
    'tiragem em promoção: por 0,7648 / de 1,0196, veio ' || r.unit_price || ' / ' || coalesce(r.compare_at_unit_price::text, 'nulo');
  select * into r from store.product_price_tiers where product_id = v_store and min_qty = 100;
  assert r.unit_price = 0.5848 and r.compare_at_unit_price is null, 'tiragem sem promoção fica normal';

  select count(*) into n
  from store.product_variant_price_tiers t join store.product_variants v on v.id = t.variant_id
  where v.product_id = v_store and t.quantity = 50 and t.total_price = 38.24 and t.compare_at_unit_price = 1.0196;
  assert n = 1, 'variante padrão recebe o mesmo de/por';

  select * into r from store.products where id = v_store;
  assert r.on_sale and r.sale_price = 0.76 and r.base_price = 1.02,
    'produto com selo: base ' || r.base_price || ', promo ' || coalesce(r.sale_price::text, 'nulo');

  -- Fornecedor encerrou a promoção: volta tudo ao normal.
  update public.products set quantity_prices =
    '[{"quantity": 50, "price": 40, "sellPrice": 50.98, "unitSellPrice": 1.0196},
      {"quantity": 100, "price": 38.99, "sellPrice": 58.48, "unitSellPrice": 0.5848}]'
  where id = v_crm;
  perform store.publish_crm_product_apply(v_crm);

  select * into r from store.product_price_tiers where product_id = v_store and min_qty = 50;
  assert r.unit_price = 1.0196 and r.compare_at_unit_price is null, 'fim da promoção: preço normal e sem "de"';
  select * into r from store.products where id = v_store;
  assert not r.on_sale and r.sale_price is null, 'fim da promoção: sem selo';

  raise notice 'promoção do fornecedor: ok';
end $$;

\o
rollback;
