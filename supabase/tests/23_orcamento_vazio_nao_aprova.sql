-- Orçamento vazio não é aprovado (migração 20261002030000). Transação desfeita no fim.
begin;
\o /dev/null

do $$
declare
  v_vazio uuid;
  v_ok uuid;
  v_st text;
begin
  insert into store.quotes (status, title, subtotal, total, source)
  values ('rascunho', 'QA vazio', 0, 0, 'site') returning id into v_vazio;
  begin
    update store.quotes set status = 'aprovado' where id = v_vazio;
    assert false, 'orçamento sem valor não pode ser aprovado';
  exception when invalid_parameter_value then null;
  end;

  update store.quotes set total = 100, subtotal = 100 where id = v_vazio;
  begin
    update store.quotes set status = 'aprovado' where id = v_vazio;
    assert false, 'orçamento sem item não pode ser aprovado';
  exception when invalid_parameter_value then null;
  end;

  insert into store.quotes (status, title, subtotal, total, source)
  values ('enviado', 'QA ok', 100, 100, 'flow') returning id into v_ok;
  insert into store.quote_items (quote_id, description, quantity, unit_price, total_price, position)
  values (v_ok, 'Item QA', 1, 100, 100, 0);
  update store.quotes set status = 'aprovado' where id = v_ok;
  select status into v_st from store.quotes where id = v_ok;
  assert v_st = 'aprovado', 'orçamento com item e valor é aprovado';

  -- Outras mudanças de status seguem livres.
  update store.quotes set status = 'recusado' where id = v_vazio;

  raise notice 'orçamento vazio não aprova: ok';
end $$;

\o
rollback;
