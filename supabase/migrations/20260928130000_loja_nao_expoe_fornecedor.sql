-- A loja nunca expoe a origem do produto.
--
-- A FuturaIM anexa "<id> - <descritor da combinacao>" ao fim da descricao
-- (ex.: "... impacte. 104756 - 50 Cartao de Visita - 88x48mm ... - Refile").
-- O parser do Flow passou a remover esse trecho na importacao; este gatilho
-- garante o mesmo para produtos ja importados e para qualquer caminho que
-- grave um produto vindo do Flow (publish_crm_product ou edicao manual).

create or replace function store.crm_strip_supplier_ref(p_text text, p_supplier_sku text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_text is null or nullif(p_supplier_sku, '') is null then p_text
    else nullif(pg_catalog.btrim(pg_catalog.regexp_replace(
      p_text,
      '(^|[^0-9])' || pg_catalog.regexp_replace(p_supplier_sku, '([^[:alnum:]])', '\\\1', 'g') || '\s+-\s.*$',
      '\1'
    )), '')
  end;
$$;

create or replace function store.crm_products_hide_supplier()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_supplier_sku text;
begin
  if new.crm_id is null then
    return new;
  end if;
  select nullif(p.supplier_sku, '') into v_supplier_sku from public.products p where p.id = new.crm_id;
  if v_supplier_sku is not null then
    new.description := store.crm_strip_supplier_ref(new.description, v_supplier_sku);
    new.short_description := store.crm_strip_supplier_ref(new.short_description, v_supplier_sku);
    new.art_instructions := store.crm_strip_supplier_ref(new.art_instructions, v_supplier_sku);
  end if;
  return new;
end;
$$;

drop trigger if exists tr_crm_products_hide_supplier on store.products;
create trigger tr_crm_products_hide_supplier
  before insert or update of description, short_description, art_instructions, crm_id on store.products
  for each row execute function store.crm_products_hide_supplier();

revoke all on function store.crm_strip_supplier_ref(text, text) from public, anon, authenticated;
revoke all on function store.crm_products_hide_supplier() from public, anon, authenticated;

-- Reaplica nos produtos ja publicados (o gatilho faz a limpeza).
update store.products set description = description where crm_id is not null;
