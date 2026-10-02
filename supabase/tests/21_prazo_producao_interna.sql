-- Prazo publicado soma a produção interna (migração 20261002010000).
-- Produto sintético; transação desfeita no fim.
begin;
\o /dev/null

do $$
declare
  v_company uuid := public.crm_default_company();
  v_crm uuid;
  v_store uuid;
  v_days integer;
  n integer;
begin
  if v_company is null then
    insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000b1', 'qa.prazo.dono@homolog.local');
    insert into public.companies (name, owner_id, store_access)
    values ('QA loja', '00000000-0000-4000-8000-0000000000b1', true);
    v_company := public.crm_default_company();
  end if;

  -- 1. "Total: 6 dias (fornecedor 1 + nossos 5)", combinações de 1 e 3 dias no fornecedor.
  insert into public.products (company_id, name, category, status, supplier_sku, production_deadline,
    variations, quantity_prices)
  values (v_company, 'QA prazo interno', 'QA', 'Rascunho', 'QA-SUP-1',
    'Total: 6 dias (fornecedor 1 + nossos 5) + frete',
    '[{"name": "Material", "values": [{"value": "Papel A", "selected": true}, {"value": "Papel B", "unit_price": 2}]}]',
    '[{"quantity": 50, "sellPrice": 50, "unitSellPrice": 1}]')
  returning id into v_crm;
  insert into public.product_variants (company_id, product_id, sku, production_days, raw_attributes)
  values (v_company, v_crm, 'QA-SUP-1', 1, '{"Material": "Papel A"}');
  with v as (
    insert into public.product_variants (company_id, product_id, sku, production_days, raw_attributes)
    values (v_company, v_crm, 'QA-SUP-2', 3, '{"Material": "Papel B"}') returning id
  )
  insert into public.product_price_tiers (company_id, variant_id, quantity, total_price, unit_price)
  select v_company, v.id, 100, 80, 0.8 from v;

  v_store := (store.publish_crm_product_apply(v_crm) ->> 'id')::uuid;

  select production_days into v_days from store.products where id = v_store;
  assert v_days = 6, 'produto: prazo total do Flow (6), veio ' || v_days;

  select count(*) into n from store.product_price_tiers where product_id = v_store and production_days <> 6;
  assert n = 0, 'tiragens do produto: fornecedor 1 + nossos 5 = 6';

  select count(*) into n
  from store.product_variant_price_tiers t join store.product_variants v on v.id = t.variant_id
  where v.product_id = v_store and v.is_default and t.production_days <> 6;
  assert n = 0, 'tiragens da variante padrão: 6 dias';

  select count(*) into n from store.product_variants
  where product_id = v_store and not is_default and production_days = 8;
  assert n = 1, 'variante Papel B: fornecedor 3 + nossos 5 = 8';

  select count(*) into n
  from store.product_variant_price_tiers t join store.product_variants v on v.id = t.variant_id
  where v.product_id = v_store and not v.is_default and t.production_days <> 8;
  assert n = 0, 'tiragens da variante Papel B: 8 dias';

  -- 2. Sem "nossos": o prazo do fornecedor segue como estava.
  update public.products set production_deadline = '3 dias úteis' where id = v_crm;
  perform store.publish_crm_product_apply(v_crm);
  select count(*) into n from store.product_variants
  where product_id = v_store and not is_default and production_days = 3;
  assert n = 1, 'sem produção interna informada, a variante mantém o prazo do fornecedor';

  raise notice 'prazo com produção interna: ok';
end $$;

\o
rollback;
