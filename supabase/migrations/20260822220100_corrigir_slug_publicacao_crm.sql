-- Corrige a publicação em instalações onde a extensão unaccent não está no
-- schema extensions. A transliteração explícita também mantém a função segura
-- com search_path vazio.
create or replace function store.publish_crm_product(p_crm_product_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.products%rowtype;
  v_store_id uuid;
  v_action text;
  v_image text;
  v_days integer;
begin
  select * into v_source from public.products where id = p_crm_product_id;
  if v_source.id is null then
    raise exception 'Produto do Flow nao encontrado.' using errcode = 'P0002';
  end if;
  if not private.is_company_member(v_source.company_id, array['owner','admin']) then
    raise exception 'Sem permissao para publicar este produto.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.companies where id = v_source.company_id and store_access) then
    raise exception 'Esta empresa nao esta vinculada a loja Nexus.' using errcode = '42501';
  end if;
  if coalesce(v_source.sale_price, v_source.suggested_price, v_source.min_price, 0) <= 0 then
    raise exception 'Defina um preco de venda valido antes de publicar.' using errcode = '22023';
  end if;

  v_days := case
    when coalesce(v_source.production_deadline, v_source.avg_production_time, '') ~ '[0-9]+'
      then greatest(1, (pg_catalog.regexp_match(coalesce(v_source.production_deadline, v_source.avg_production_time), '[0-9]+'))[1]::integer)
    else 3
  end;
  v_image := coalesce(nullif(v_source.main_image_url, ''), nullif(v_source.image_url, ''));
  select id into v_store_id from store.products where crm_id = v_source.id for update;
  v_action := case when v_store_id is null then 'insert' else 'update' end;

  insert into store.products (
    sku, name, slug, short_description, description, price_unit, base_price,
    min_quantity, production_days, active, sync_origin, crm_id
  ) values (
    'CRM-' || pg_catalog.upper(pg_catalog.substr(pg_catalog.replace(v_source.id::text, '-', ''), 1, 12)),
    coalesce(nullif(v_source.commercial_name, ''), v_source.name),
    pg_catalog.btrim(pg_catalog.regexp_replace(
      pg_catalog.lower(pg_catalog.translate(
        coalesce(nullif(v_source.commercial_name, ''), v_source.name),
        'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ',
        'aaaaaaeeeeiiiiooooouuuucnyy'
      )),
      '[^a-z0-9]+', '-', 'g'
    ), '-') || '-' || pg_catalog.substr(v_source.id::text, 1, 8),
    nullif(v_source.description, ''),
    coalesce(nullif(v_source.technical_description, ''), nullif(v_source.description, '')),
    case when v_source.unit_measure in ('m2','milheiro','pacote','metro_linear')
      then v_source.unit_measure else 'unidade' end,
    coalesce(v_source.sale_price, v_source.suggested_price, v_source.min_price),
    greatest(1, coalesce(v_source.minimum_quantity, 1)),
    v_days,
    coalesce(v_source.status, 'Ativo') = 'Ativo',
    'crm', v_source.id
  ) on conflict (crm_id) do update set
    name = excluded.name,
    slug = excluded.slug,
    short_description = excluded.short_description,
    description = excluded.description,
    price_unit = excluded.price_unit,
    base_price = excluded.base_price,
    min_quantity = excluded.min_quantity,
    production_days = excluded.production_days,
    active = excluded.active,
    sync_origin = 'crm'
  returning id into v_store_id;

  if v_image is not null then
    update store.product_images
       set url = v_image, alt = coalesce(nullif(v_source.commercial_name, ''), v_source.name)
     where id = (
       select id from store.product_images where product_id = v_store_id order by position, created_at limit 1
     );
    if not found then
      insert into store.product_images (product_id, url, alt, position)
      values (v_store_id, v_image, coalesce(nullif(v_source.commercial_name, ''), v_source.name), 0);
    end if;
  end if;

  insert into store.sync_log (
    entidade, direcao, origem_id, destino_id, acao, sucesso, payload
  ) values (
    'produtos', 'crm_para_site', v_source.id, v_store_id, v_action, true,
    jsonb_build_object('name', v_source.name, 'published_by', auth.uid())
  );

  return jsonb_build_object('ok', true, 'id', v_store_id, 'action', v_action);
end;
$$;

revoke all on function store.publish_crm_product(uuid) from public, anon;
grant execute on function store.publish_crm_product(uuid) to authenticated, service_role;
