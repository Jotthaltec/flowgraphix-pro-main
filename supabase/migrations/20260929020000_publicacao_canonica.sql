-- Publicação canônica CRM -> loja (fase 3 da integração).
--
-- store.publish_crm_product continua sendo a única entrada (mesma assinatura
-- chamada pelo Flow), mas agora:
--   * valida nome, categoria, preço e ao menos uma combinação comprável;
--   * calcula content_hash apenas dos campos publicados na loja;
--   * responde 'noop' quando nada mudou nos dois lados, sem remontar o
--     catálogo (ids e sync_version ficam como estão);
--   * falha sem deixar nada pela metade: a montagem roda numa subtransação;
--     o produto já publicado fica intacto, marcado 'error' com a mensagem, e a
--     tentativa fica registrada em store.sync_log (antes o raise apagava o log);
--   * avisa quando a publicação sobrescreve alterações feitas direto na loja.
--
-- A montagem em si (imagens, grupos, opções, variantes, tiragens) é a mesma de
-- 20260928120000/20260928130000, movida para store.publish_crm_product_apply.
--
-- Erros de permissão e produto inexistente continuam sendo exceções: não são
-- tentativas de publicação daquela empresa e não entram no log dela.

-- 1. Assinatura do conteúdo publicado ------------------------------------------
-- Calculada sobre as linhas da loja, não sobre o Flow: serve tanto para saber
-- se uma republicação muda algo quanto para detectar edição direta na loja.
-- Fica de fora o que não é conteúdo: ids (a publicação os recria), datas,
-- estatísticas de venda/visita e os próprios campos de sincronização.
-- Numéricos passam por trim_scale para 1.14 e 1.1400 serem o mesmo valor.

create or replace function store.product_content_hash(p_product_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.jsonb_build_object(
    'product', pg_catalog.jsonb_build_object(
      'sku', p.sku, 'name', p.name, 'slug', p.slug,
      'category_id', p.category_id, 'subcategory_id', p.subcategory_id,
      'short_description', p.short_description, 'description', p.description,
      'benefits', p.benefits, 'materials', p.materials, 'applications', p.applications, 'tags', p.tags,
      'price_unit', p.price_unit,
      'base_price', pg_catalog.trim_scale(p.base_price),
      'sale_price', pg_catalog.trim_scale(p.sale_price),
      'reseller_price', pg_catalog.trim_scale(p.reseller_price),
      'suggested_price', pg_catalog.trim_scale(p.suggested_price),
      'setup_fee', pg_catalog.trim_scale(p.setup_fee),
      'commission_pct', pg_catalog.trim_scale(p.commission_pct),
      'min_quantity', p.min_quantity, 'max_quantity', p.max_quantity,
      'quantity_step', p.quantity_step, 'quantity_mode', p.quantity_mode,
      'production_days', p.production_days, 'rush_days', p.rush_days,
      'rush_fee_pct', pg_catalog.trim_scale(p.rush_fee_pct),
      'default_width', pg_catalog.trim_scale(p.default_width),
      'default_height', pg_catalog.trim_scale(p.default_height),
      'min_width', pg_catalog.trim_scale(p.min_width), 'max_width', pg_catalog.trim_scale(p.max_width),
      'min_height', pg_catalog.trim_scale(p.min_height), 'max_height', pg_catalog.trim_scale(p.max_height),
      'dimension_unit', p.dimension_unit,
      'art_required', p.art_required, 'art_instructions', p.art_instructions, 'template_url', p.template_url,
      'active', p.active, 'featured', p.featured, 'is_new', p.is_new, 'on_sale', p.on_sale,
      'allow_reseller', p.allow_reseller, 'reseller_only', p.reseller_only,
      'business_only', p.business_only, 'digital_delivery', p.digital_delivery,
      'seo_title', p.seo_title, 'seo_description', p.seo_description
    ),
    'images', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(i.url, i.alt, i.kind, i.position)
        order by i.position, i.url, i.kind)
      from store.product_images i where i.product_id = p.id), '[]'::jsonb),
    'groups', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'key', g.key, 'name', g.name, 'input_type', g.input_type, 'required', g.required,
          'multiple', g.multiple, 'help_text', g.help_text, 'position', g.position,
          'options', coalesce((
            select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(
                o.label, o.value, o.description, o.modifier_type, pg_catalog.trim_scale(o.modifier_value),
                o.production_days_delta, o.image_url, o.position, o.active, o.default_selected)
              order by o.position, o.value, o.label)
            from store.product_options o where o.group_id = g.id), '[]'::jsonb))
        order by g.position, g.key)
      from store.product_option_groups g where g.product_id = p.id), '[]'::jsonb),
    'variants', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'sku', v.sku, 'title', v.title, 'selection', v.selection,
          'source_external_id', v.source_external_id, 'production_days', v.production_days,
          'available', v.available, 'is_default', v.is_default, 'position', v.position,
          'tiers', coalesce((
            select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(
                t.quantity, pg_catalog.trim_scale(t.unit_price), pg_catalog.trim_scale(t.total_price),
                t.production_days, t.position)
              order by t.quantity)
            from store.product_variant_price_tiers t where t.variant_id = v.id), '[]'::jsonb))
        order by v.position, v.sku)
      from store.product_variants v where v.product_id = p.id), '[]'::jsonb),
    'price_tiers', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(
          t.min_qty, t.max_qty, pg_catalog.trim_scale(t.unit_price),
          pg_catalog.trim_scale(t.reseller_unit_price), t.production_days, t.position)
        order by t.min_qty, t.position)
      from store.product_price_tiers t where t.product_id = p.id), '[]'::jsonb)
  )::text, 'UTF8')), 'hex')
  from store.products p
  where p.id = p_product_id;
$$;

comment on function store.product_content_hash(uuid) is
  'SHA-256 dos campos publicados de um produto da loja (sem ids, datas nem campos de sync).';

revoke all on function store.product_content_hash(uuid) from public, anon;
grant execute on function store.product_content_hash(uuid) to authenticated, service_role;

-- 2. O produto montado pode ser vendido? ----------------------------------------
-- Vazio = pode. Validado sobre o que foi montado na loja, não sobre o Flow.

create or replace function store.product_publish_problems(p_product_id uuid)
returns text[]
language sql
stable
set search_path = ''
as $$
  select array_remove(array[
    case when nullif(pg_catalog.btrim(p.name), '') is null
      then 'Produto sem nome.' end,
    case when p.category_id is null
      then 'Produto sem categoria.' end,
    case when coalesce(p.base_price, 0) <= 0
      then 'Produto sem preço de venda válido.' end,
    case when not exists (
        select 1
        from store.product_variants v
        join store.product_variant_price_tiers t on t.variant_id = v.id
        where v.product_id = p.id and v.available and t.unit_price > 0 and t.total_price > 0)
      then 'Nenhuma combinação com preço de venda: nada poderia ser comprado.' end,
    (select 'Grupo obrigatório sem opção disponível: '
        || pg_catalog.string_agg(g.name, ', ' order by g.position) || '.'
     from store.product_option_groups g
     where g.product_id = p.id and g.required
       and not exists (select 1 from store.product_options o where o.group_id = g.id and o.active))
  ], null)
  from store.products p
  where p.id = p_product_id;
$$;

revoke all on function store.product_publish_problems(uuid) from public, anon;
grant execute on function store.product_publish_problems(uuid) to authenticated, service_role;

-- 3. Montagem do catálogo (interna) ---------------------------------------------

create or replace function store.publish_crm_product_apply(p_crm_product_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_source public.products%rowtype;
  v_store_id uuid;
  v_category_id uuid;
  v_subcategory_id uuid;
  v_variant_id uuid;
  v_group_id uuid;
  v_source_variant_id uuid;
  v_action text;
  v_name text;
  v_slug text;
  v_category_slug text;
  v_subcategory_slug text;
  v_days integer;
  v_tier_days integer;
  v_quantity integer;
  v_position integer;
  v_group_position integer := 0;
  v_option_position integer;
  v_image_count integer := 0;
  v_group_count integer := 0;
  v_option_count integer := 0;
  v_variant_count integer := 0;
  v_tier_count integer := 0;
  v_inactive_options integer := 0;
  v_margin numeric;
  v_base_price numeric;
  v_unit_price numeric;
  v_total_price numeric;
  v_promo_price numeric;
  v_default_width numeric;
  v_default_height numeric;
  v_meta jsonb;
  v_axes jsonb;
  v_quantity_rows jsonb;
  v_default_selection jsonb := '{}'::jsonb;
  v_selection jsonb;
  v_axis jsonb;
  v_option jsonb;
  v_tier jsonb;
  v_variant record;
  v_extra record;
  v_axis_name text;
  v_axis_key text;
  v_option_label text;
  v_option_value text;
  v_template_url text;
  v_video_url text;
  v_materials text[] := '{}'::text[];
  v_tags text[] := '{}'::text[];
  v_warnings text[] := '{}'::text[];
  v_is_default boolean;
  v_is_available boolean;
  v_has_manual_variations boolean;
  v_default_variant_id uuid;
  v_attrs jsonb;
  v_unmatched text[] := '{}'::text[];
  v_merged_count integer := 0;
  v_source_variant_total integer := 0;
  v_base_sku text;
begin
  select * into v_source
  from public.products
  where id = p_crm_product_id
  for update;

  if v_source.id is null then
    raise exception 'Produto do Flow nao encontrado.' using errcode = 'P0002';
  end if;
  if not private.is_company_member(v_source.company_id, array['owner','admin']) then
    raise exception 'Sem permissao para publicar este produto.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.companies where id = v_source.company_id and store_access) then
    raise exception 'Esta empresa nao esta vinculada a loja Nexus.' using errcode = '42501';
  end if;

  v_meta := coalesce(v_source.editor_meta, '{}'::jsonb);
  -- Codigo publico da loja. Nunca expoe o id do fornecedor (supplier_sku ou
  -- derivados como "HUB-<id>"): com ele qualquer revendedor acha a origem.
  v_base_sku := case
    when nullif(v_source.internal_sku, '') is not null
      and (nullif(v_source.supplier_sku, '') is null
        or pg_catalog.strpos(v_source.internal_sku, v_source.supplier_sku) = 0)
      then v_source.internal_sku
    else 'CRM-' || pg_catalog.upper(pg_catalog.substr(pg_catalog.replace(v_source.id::text, '-', ''), 1, 12))
  end;
  v_axes := case when pg_catalog.jsonb_typeof(v_source.variations) = 'array'
    then v_source.variations else '[]'::jsonb end;
  v_quantity_rows := case
    when pg_catalog.jsonb_typeof(v_source.quantity_prices) = 'array'
      and pg_catalog.jsonb_array_length(v_source.quantity_prices) > 0 then v_source.quantity_prices
    when pg_catalog.jsonb_typeof(v_source.quantity_price_table) = 'array'
      then v_source.quantity_price_table
    else '[]'::jsonb
  end;
  v_margin := greatest(0, coalesce(v_source.margin_percent, v_source.target_margin, 0));
  v_name := coalesce(
    nullif(v_meta #>> '{marketplace,store_title}', ''),
    nullif(v_source.commercial_name, ''),
    v_source.name
  );
  if nullif(pg_catalog.btrim(v_name), '') is null then
    raise exception 'Defina o nome do produto antes de publicar.' using errcode = '22023';
  end if;
  if nullif(pg_catalog.btrim(v_source.category), '') is null then
    raise exception 'Defina a categoria do produto antes de publicar.' using errcode = '22023';
  end if;
  v_slug := store.crm_slug(v_name) || '-' || pg_catalog.substr(v_source.id::text, 1, 8);
  v_days := case
    when coalesce(v_source.production_deadline, v_source.avg_production_time, '') ~ '[0-9]+'
      then greatest(1, (pg_catalog.regexp_match(
        coalesce(v_source.production_deadline, v_source.avg_production_time), '[0-9]+'
      ))[1]::integer)
    else 3
  end;

  select coalesce(
    store.jsonb_numeric(row_value, 'unitSellPrice'),
    store.jsonb_numeric(row_value, 'unit_sell_price'),
    store.jsonb_numeric(row_value, 'sellPrice') / nullif(store.jsonb_numeric(row_value, 'quantity'), 0),
    store.jsonb_numeric(row_value, 'sellTotal') / nullif(store.jsonb_numeric(row_value, 'quantity'), 0),
    store.jsonb_numeric(row_value, 'unitPrice') * (1 + v_margin / 100),
    store.jsonb_numeric(row_value, 'unit_price') * (1 + v_margin / 100),
    store.jsonb_numeric(row_value, 'price') / nullif(store.jsonb_numeric(row_value, 'quantity'), 0) * (1 + v_margin / 100)
  )
  into v_base_price
  from pg_catalog.jsonb_array_elements(v_quantity_rows) row_value
  where coalesce(store.jsonb_numeric(row_value, 'quantity'), 0) > 0
  order by store.jsonb_numeric(row_value, 'quantity')
  limit 1;

  v_base_price := round(coalesce(
    v_base_price,
    v_source.sale_price,
    v_source.suggested_price,
    v_source.min_price,
    0
  ), 2);
  if v_base_price <= 0 then
    raise exception 'Defina um preco de venda valido antes de publicar.' using errcode = '22023';
  end if;

  v_promo_price := store.jsonb_numeric(v_meta #> '{pricing}', 'promo_price');
  if coalesce(v_promo_price, 0) <= 0 or v_promo_price >= v_base_price then
    v_promo_price := null;
  end if;

  if nullif(v_source.category, '') is not null then
    v_category_slug := store.crm_slug(v_source.category);
    insert into store.categories (name, slug, active)
    values (v_source.category, v_category_slug, true)
    on conflict (slug) do update set name = excluded.name, active = true
    returning id into v_category_id;
  end if;
  if nullif(v_source.subcategory, '') is not null then
    v_subcategory_slug := store.crm_slug(coalesce(v_source.category || ' ', '') || v_source.subcategory);
    insert into store.categories (parent_id, name, slug, active)
    values (v_category_id, v_source.subcategory, v_subcategory_slug, true)
    on conflict (slug) do update set
      parent_id = excluded.parent_id, name = excluded.name, active = true
    returning id into v_subcategory_id;
  end if;

  select coalesce(pg_catalog.array_agg(distinct material_value) filter (where material_value <> ''), '{}'::text[])
  into v_materials
  from (
    select coalesce(option_value ->> 'value', '') as material_value
    from pg_catalog.jsonb_array_elements(v_axes) axis_value
    cross join lateral pg_catalog.jsonb_array_elements(
      case when pg_catalog.jsonb_typeof(axis_value -> 'values') = 'array'
        then axis_value -> 'values' else '[]'::jsonb end
    ) option_value
    where store.crm_slug(coalesce(axis_value ->> 'normalized_name', axis_value ->> 'name')) = 'material'
    union
    select coalesce(v_source.specifications ->> 'Material', '')
    union
    select coalesce(material, '') from public.product_variants where product_id = v_source.id
  ) material_source;

  select coalesce(pg_catalog.array_agg(distinct tag_value) filter (where tag_value <> ''), '{}'::text[])
  into v_tags
  from (
    select case when pg_catalog.jsonb_typeof(tag_item) = 'string'
      then tag_item #>> '{}' else coalesce(tag_item ->> 'value', tag_item ->> 'name', '') end tag_value
    from pg_catalog.jsonb_array_elements(
      case
        when pg_catalog.jsonb_typeof(v_meta -> 'tags') = 'array' then v_meta -> 'tags'
        when pg_catalog.jsonb_typeof(v_source.marketplace_keywords) = 'array' then v_source.marketplace_keywords
        else '[]'::jsonb
      end
    ) tag_item
  ) tag_source;

  select min(width_mm), min(height_mm)
  into v_default_width, v_default_height
  from public.product_variants
  where product_id = v_source.id and coalesce(available, true);

  select url into v_template_url
  from public.product_templates
  where product_id = v_source.id
  order by collected_at, id
  limit 1;
  v_video_url := nullif(v_meta #>> '{media,video_url}', '');

  select id into v_store_id
  from store.products
  where crm_id = v_source.id
  for update;
  v_action := case when v_store_id is null then 'insert' else 'update' end;

  insert into store.products (
    sku, name, slug, category_id, subcategory_id, short_description, description,
    benefits, materials, applications, tags,
    price_unit, base_price, sale_price, suggested_price, commission_pct,
    min_quantity, max_quantity, quantity_step, quantity_mode, production_days,
    default_width, default_height, min_width, max_width, min_height, max_height, dimension_unit,
    art_required, art_instructions, template_url,
    active, featured, is_new, on_sale, allow_reseller, reseller_only, business_only, digital_delivery,
    seo_title, seo_description, sync_origin, crm_id, sync_status, synced_at, sync_version
  ) values (
    v_base_sku,
    v_name, v_slug, v_category_id, v_subcategory_id,
    nullif(coalesce(v_source.description, v_source.marketplace_description), ''),
    nullif(coalesce(v_source.technical_description, v_source.description, v_source.marketplace_description), ''),
    '{}'::text[], v_materials, '{}'::text[], v_tags,
    case when pg_catalog.lower(coalesce(v_source.unit_measure, '')) in ('m2','milheiro','pacote','metro_linear')
      then pg_catalog.lower(v_source.unit_measure) else 'unidade' end,
    v_base_price, v_promo_price, v_source.suggested_price,
    coalesce(store.jsonb_numeric(v_meta #> '{pricing}', 'commission_pct'), 0),
    coalesce((select min(store.jsonb_numeric(row_value, 'quantity'))::integer
      from pg_catalog.jsonb_array_elements(v_quantity_rows) row_value
      where coalesce(store.jsonb_numeric(row_value, 'quantity'), 0) > 0), greatest(1, coalesce(v_source.minimum_quantity, 1))),
    (select max(store.jsonb_numeric(row_value, 'quantity'))::integer
      from pg_catalog.jsonb_array_elements(v_quantity_rows) row_value),
    1,
    case when pg_catalog.jsonb_array_length(v_quantity_rows) > 0 then 'tiers_only' else 'any' end,
    v_days,
    v_default_width, v_default_height, v_default_width, v_default_width,
    v_default_height, v_default_height,
    case when v_default_width is not null then 'mm' else 'cm' end,
    case when v_meta #> '{production,needs_art}' is null then true
      else v_meta #> '{production,needs_art}' = 'true'::jsonb end,
    nullif(coalesce(v_meta #>> '{production,production_notes}', v_source.technical_description), ''),
    v_template_url,
    coalesce(v_source.status, 'Ativo') = 'Ativo'
      and coalesce(v_meta #> '{production,available_order}', 'true'::jsonb) <> 'false'::jsonb,
    coalesce(v_meta #> '{commercial,highlight}', 'false'::jsonb) = 'true'::jsonb,
    false, v_promo_price is not null, true, false, false, false,
    nullif(v_meta #>> '{marketplace,seo_title}', ''),
    nullif(v_meta #>> '{marketplace,seo_description}', ''),
    'crm', v_source.id, 'syncing', null, 0
  ) on conflict (crm_id) do update set
    sku = excluded.sku, name = excluded.name, slug = excluded.slug,
    category_id = excluded.category_id, subcategory_id = excluded.subcategory_id,
    short_description = excluded.short_description, description = excluded.description,
    benefits = excluded.benefits, materials = excluded.materials,
    applications = excluded.applications, tags = excluded.tags,
    price_unit = excluded.price_unit, base_price = excluded.base_price,
    sale_price = excluded.sale_price, suggested_price = excluded.suggested_price,
    commission_pct = excluded.commission_pct, min_quantity = excluded.min_quantity,
    max_quantity = excluded.max_quantity, quantity_step = excluded.quantity_step,
    quantity_mode = excluded.quantity_mode, production_days = excluded.production_days,
    default_width = excluded.default_width, default_height = excluded.default_height,
    min_width = excluded.min_width, max_width = excluded.max_width,
    min_height = excluded.min_height, max_height = excluded.max_height,
    dimension_unit = excluded.dimension_unit, art_required = excluded.art_required,
    art_instructions = excluded.art_instructions, template_url = excluded.template_url,
    active = excluded.active, featured = excluded.featured, is_new = excluded.is_new,
    on_sale = excluded.on_sale, allow_reseller = excluded.allow_reseller,
    reseller_only = excluded.reseller_only, business_only = excluded.business_only,
    digital_delivery = excluded.digital_delivery, seo_title = excluded.seo_title,
    seo_description = excluded.seo_description, sync_origin = 'crm',
    sync_status = 'syncing'
  returning id into v_store_id;

  -- Filhos de produto CRM tem o Flow como unica fonte. A substituicao ocorre na
  -- mesma transacao da funcao: nunca existe catalogo parcialmente atualizado.
  delete from store.product_images where product_id = v_store_id;
  delete from store.product_option_groups where product_id = v_store_id;
  delete from store.product_price_tiers where product_id = v_store_id;
  delete from store.product_variants where product_id = v_store_id;

  with image_candidates as (
    select coalesce(nullif(i.hires_url, ''), i.url) url, i.alt, 'foto'::text kind,
      coalesce(i.position, 0) position, 1 priority
    from public.product_images i where i.product_id = v_source.id
    union all
    select nullif(v_source.main_image_url, ''), v_name, 'foto', 0, 2
    union all
    select nullif(v_source.image_url, ''), v_name, 'foto', 0, 3
    union all
    select nullif(case when pg_catalog.jsonb_typeof(gallery_item) = 'string'
      then gallery_item #>> '{}'
      else coalesce(gallery_item ->> 'url', gallery_item ->> 'hires_url') end, ''),
      v_name, 'foto', gallery_position::integer, 4
    from pg_catalog.jsonb_array_elements(
      case when pg_catalog.jsonb_typeof(v_source.gallery_images) = 'array'
        then v_source.gallery_images else '[]'::jsonb end
    ) with ordinality gallery(gallery_item, gallery_position)
  ), dedup as (
    select distinct on (url) url, alt, kind, position
    from image_candidates
    where url is not null
    order by url, priority, position
  )
  insert into store.product_images(product_id, url, alt, kind, position)
  select v_store_id, url, alt, kind, position from dedup order by position;

  insert into store.product_images(product_id, url, alt, kind, position)
  select v_store_id, t.url, coalesce(t.name, 'Gabarito de ' || v_name), 'gabarito',
    (1000 + row_number() over(order by t.collected_at, t.id))::integer
  from public.product_templates t
  where t.product_id = v_source.id
    and not exists (select 1 from store.product_images i where i.product_id = v_store_id and i.url = t.url);

  if v_video_url is not null and not exists (
    select 1 from store.product_images where product_id = v_store_id and url = v_video_url
  ) then
    insert into store.product_images(product_id, url, alt, kind, position)
    values (v_store_id, v_video_url, 'Video de ' || v_name, 'video', 2000);
  end if;
  select count(*) into v_image_count from store.product_images where product_id = v_store_id;
  if v_image_count = 0 then v_warnings := pg_catalog.array_append(v_warnings, 'Produto sem imagem publica.'); end if;

  -- Opcoes editadas manualmente tem prioridade. Sem edicao, usa os eixos reais
  -- importados. Alternativas sem preco/varredura sao preservadas, mas inativas.
  v_has_manual_variations := pg_catalog.jsonb_typeof(v_meta -> 'variation_rows') = 'array'
    and pg_catalog.jsonb_array_length(v_meta -> 'variation_rows') > 0;

  if v_has_manual_variations then
    for v_axis_name in
      select distinct coalesce(nullif(row_value ->> 'type', ''), 'Variacao')
      from pg_catalog.jsonb_array_elements(v_meta -> 'variation_rows') row_value
      order by 1
    loop
      v_axis_key := store.crm_slug(v_axis_name);
      insert into store.product_option_groups(product_id, key, name, input_type, required, multiple, position)
      values (v_store_id, v_axis_key, v_axis_name, 'select', true, false, v_group_position)
      returning id into v_group_id;
      v_group_position := v_group_position + 1;
      v_option_position := 0;
      for v_option in
        select row_value from pg_catalog.jsonb_array_elements(v_meta -> 'variation_rows') row_value
        where coalesce(nullif(row_value ->> 'type', ''), 'Variacao') = v_axis_name
        order by row_value ->> 'name'
      loop
        v_option_label := coalesce(nullif(v_option ->> 'name', ''), 'Opcao');
        v_option_value := store.crm_slug(v_option_label);
        v_is_available := coalesce(v_option ->> 'active', 'true') <> 'false';
        v_is_default := v_is_available and v_option_position = 0;
        v_unit_price := coalesce(
          store.jsonb_numeric(v_option, 'price'),
          store.jsonb_numeric(v_option, 'unit_price'),
          store.jsonb_numeric(v_option, 'sell'),
          store.jsonb_numeric(v_option, 'total_price')
        );
        insert into store.product_options(
          group_id, label, value, description, modifier_type, modifier_value,
          production_days_delta, position, active, default_selected
        ) values (
          v_group_id, v_option_label, v_option_value, null, 'fixo',
          round(coalesce(v_unit_price, v_base_price) - v_base_price, 4),
          0, v_option_position, v_is_available, v_is_default
        );
        if v_is_default then
          v_default_selection := v_default_selection || pg_catalog.jsonb_build_object(v_axis_key, v_option_value);
        end if;
        v_option_position := v_option_position + 1;
      end loop;
    end loop;
  else
    for v_axis in select axis_value from pg_catalog.jsonb_array_elements(v_axes) axis_value
    loop
      v_axis_name := coalesce(nullif(v_axis ->> 'name', ''), 'Variacao');
      v_axis_key := store.crm_slug(coalesce(nullif(v_axis ->> 'normalized_name', ''), v_axis_name));
      insert into store.product_option_groups(product_id, key, name, input_type, required, multiple, position)
      values (v_store_id, v_axis_key, v_axis_name, 'select', true, false, v_group_position)
      returning id into v_group_id;
      v_group_position := v_group_position + 1;
      v_option_position := 0;
      for v_option in
        select option_value
        from pg_catalog.jsonb_array_elements(
          case when pg_catalog.jsonb_typeof(v_axis -> 'values') = 'array'
            then v_axis -> 'values'
            when pg_catalog.jsonb_typeof(v_axis -> 'options') = 'array'
            then v_axis -> 'options'
            else '[]'::jsonb end
        ) option_value
      loop
        v_option_label := case when pg_catalog.jsonb_typeof(v_option) = 'string'
          then v_option #>> '{}' else coalesce(v_option ->> 'value', v_option ->> 'name', 'Opcao') end;
        v_option_value := store.crm_slug(v_option_label);
        v_is_default := coalesce(v_option ->> 'selected', 'false') = 'true'
          or (v_option_position = 0 and pg_catalog.jsonb_array_length(
            case when pg_catalog.jsonb_typeof(v_axis -> 'values') = 'array'
              then v_axis -> 'values'
              when pg_catalog.jsonb_typeof(v_axis -> 'options') = 'array'
              then v_axis -> 'options' else '[]'::jsonb end
          ) = 1);
        v_is_available := v_is_default
          or coalesce(
            pg_catalog.jsonb_typeof(v_option -> 'tiers') = 'array'
              and pg_catalog.jsonb_array_length(v_option -> 'tiers') > 0,
            false
          )
          or coalesce(
            store.jsonb_numeric(v_option, 'unit_price'), store.jsonb_numeric(v_option, 'total_price'),
            store.jsonb_numeric(v_option, 'sell'), store.jsonb_numeric(v_option, 'cost')
          ) is not null;
        v_unit_price := coalesce(
          store.jsonb_numeric(v_option, 'unit_price'),
          store.jsonb_numeric(v_option, 'total_price'),
          store.jsonb_numeric(v_option, 'sell'),
          store.jsonb_numeric(v_option, 'cost'),
          v_base_price
        );
        insert into store.product_options(
          group_id, label, value, description, modifier_type, modifier_value,
          production_days_delta, position, active, default_selected
        ) values (
          v_group_id, v_option_label, v_option_value,
          case when v_is_available then null else 'Opcao ainda sem preco sincronizado.' end,
          'fixo', round(v_unit_price - v_base_price, 4), 0, v_option_position, v_is_available, v_is_default
        );
        if v_is_default then
          v_default_selection := v_default_selection || pg_catalog.jsonb_build_object(v_axis_key, v_option_value);
        end if;
        if not v_is_available then v_inactive_options := v_inactive_options + 1; end if;
        v_option_position := v_option_position + 1;
      end loop;
    end loop;
  end if;

  -- Especificacoes selecionadas completam eixos ausentes da lista de variacoes.
  -- "specifications" e um campo legado do CRM que nao acompanha edicoes feitas
  -- em variation_rows/eixos detectados: se o eixo ja existe (veio de la), ele
  -- e a fonte de verdade e nao pode ser sobrescrito, senao a variante padrao
  -- passa a apontar para um valor de opcao que nao existe mais na UI e nenhuma
  -- combinacao real fica disponivel no site (tudo aparece "Indisponivel").
  if pg_catalog.jsonb_typeof(v_source.specifications) = 'object' then
    for v_axis_name, v_option_label in select key, value from pg_catalog.jsonb_each_text(v_source.specifications)
    loop
      v_axis_key := store.crm_slug(v_axis_name);
      select id into v_group_id from store.product_option_groups
      where product_id = v_store_id and key = v_axis_key;
      if v_group_id is null then
        v_option_value := store.crm_slug(v_option_label);
        insert into store.product_option_groups(product_id, key, name, input_type, required, multiple, position)
        values (v_store_id, v_axis_key, v_axis_name, 'select', true, false, v_group_position)
        returning id into v_group_id;
        v_group_position := v_group_position + 1;
        insert into store.product_options(group_id, label, value, position, active, default_selected)
        values (v_group_id, v_option_label, v_option_value, 0, true, true);
        v_default_selection := v_default_selection || pg_catalog.jsonb_build_object(v_axis_key, v_option_value);
      end if;
    end loop;
  end if;

  -- Servicos adicionais viram escolhas reais (Nao incluir / Adicionar).
  for v_extra in
    select e.name, e.price, e.extra_days, e.url, row_number() over(order by e.created_at, e.id) pos
    from public.product_extras e where e.product_id = v_source.id
  loop
    v_axis_key := 'extra-' || store.crm_slug(v_extra.name);
    insert into store.product_option_groups(product_id, key, name, input_type, required, multiple, help_text, position)
    values (v_store_id, v_axis_key, v_extra.name, 'radio', true, false, v_extra.url, v_group_position)
    returning id into v_group_id;
    v_group_position := v_group_position + 1;
    insert into store.product_options(group_id, label, value, modifier_type, modifier_value, production_days_delta, position, active, default_selected)
    values
      (v_group_id, 'Nao incluir', 'nao', 'fixo', 0, 0, 0, true, true),
      (v_group_id, 'Adicionar', 'sim', 'fixo', coalesce(v_extra.price, 0), coalesce(v_extra.extra_days, 0), 1, true, false);
  end loop;

  if not exists (select 1 from public.product_extras where product_id = v_source.id)
    and pg_catalog.jsonb_typeof(v_source.extra_services) = 'array' then
    for v_option in select option_value from pg_catalog.jsonb_array_elements(v_source.extra_services) option_value
    loop
      v_option_label := coalesce(nullif(v_option ->> 'name', ''), 'Servico adicional');
      v_axis_key := 'extra-' || store.crm_slug(v_option_label);
      insert into store.product_option_groups(product_id, key, name, input_type, required, multiple, help_text, position)
      values (v_store_id, v_axis_key, v_option_label, 'radio', true, false, nullif(v_option ->> 'url', ''), v_group_position)
      returning id into v_group_id;
      v_group_position := v_group_position + 1;
      insert into store.product_options(group_id, label, value, modifier_type, modifier_value, production_days_delta, position, active, default_selected)
      values
        (v_group_id, 'Nao incluir', 'nao', 'fixo', 0, 0, 0, true, true),
        (v_group_id, 'Adicionar', 'sim', 'fixo', coalesce(store.jsonb_numeric(v_option, 'price'), 0),
          coalesce(store.jsonb_numeric(v_option, 'extra_days'), 0)::integer, 1, true, false);
    end loop;
  end if;

  select count(*), coalesce(sum(option_total), 0)
  into v_group_count, v_option_count
  from (
    select g.id, count(o.id) option_total
    from store.product_option_groups g
    left join store.product_options o on o.group_id = g.id
    where g.product_id = v_store_id
    group by g.id
  ) counted_groups;

  -- Variante padrao: a linha REAL do SKU do Flow (supplier_sku), com os
  -- atributos dela ligados as opcoes publicadas. As opcoes "padrao" (1a de
  -- cada eixo) so completam eixos que a variante nao descreve.
  select id, raw_attributes into v_source_variant_id, v_attrs
  from public.product_variants
  where product_id = v_source.id
    and (sku = v_source.supplier_sku or external_id = v_source.supplier_sku)
  order by created_at, id limit 1;

  if v_source_variant_id is not null then
    v_selection := store.crm_variant_selection(v_store_id, v_attrs);
    if v_selection is null then
      v_warnings := pg_catalog.array_append(v_warnings,
        'Variante padrao (SKU ' || coalesce(v_source.supplier_sku, '?') || ') nao corresponde as opcoes publicadas; usada a selecao padrao das opcoes.');
    else
      v_default_selection := v_default_selection || v_selection;
    end if;
  end if;

  -- A opcao marcada como padrao no site e exatamente a da variante padrao.
  update store.product_options o
  set default_selected = (o.value = v_default_selection ->> g.key)
  from store.product_option_groups g
  where o.group_id = g.id and g.product_id = v_store_id
    and v_default_selection ? g.key;

  insert into store.product_variants(
    product_id, source_variant_id, source_external_id, sku, title, selection,
    production_days, available, is_default, position
  ) values (
    v_store_id, v_source_variant_id, v_source.supplier_sku,
    v_base_sku,
    v_name, v_default_selection, v_days, true, true, 0
  ) returning id into v_default_variant_id;
  v_variant_id := v_default_variant_id;
  v_variant_count := 1;

  v_position := 0;
  for v_tier in
    select row_value from pg_catalog.jsonb_array_elements(v_quantity_rows) row_value
    order by store.jsonb_numeric(row_value, 'quantity')
  loop
    v_quantity := coalesce(store.jsonb_numeric(v_tier, 'quantity'), 0)::integer;
    if v_quantity <= 0 then continue; end if;
    v_unit_price := coalesce(
      store.jsonb_numeric(v_tier, 'unitSellPrice'),
      store.jsonb_numeric(v_tier, 'unit_sell_price'),
      store.jsonb_numeric(v_tier, 'sellPrice') / nullif(v_quantity, 0),
      store.jsonb_numeric(v_tier, 'sellTotal') / nullif(v_quantity, 0),
      store.jsonb_numeric(v_tier, 'unitPrice') * (1 + v_margin / 100),
      store.jsonb_numeric(v_tier, 'unit_price') * (1 + v_margin / 100),
      store.jsonb_numeric(v_tier, 'price') / nullif(v_quantity, 0) * (1 + v_margin / 100)
    );
    if coalesce(v_unit_price, 0) <= 0 then continue; end if;
    v_total_price := coalesce(
      store.jsonb_numeric(v_tier, 'sellTotal'),
      store.jsonb_numeric(v_tier, 'sellPrice'),
      round(v_unit_price * v_quantity, 2)
    );
    select production_days into v_tier_days
    from public.product_variants
    where product_id = v_source.id
      and coalesce(sku, external_id) = coalesce(nullif(v_tier ->> 'external_id', ''), v_source.supplier_sku)
    order by created_at, id limit 1;

    insert into store.product_variant_price_tiers(
      variant_id, quantity, unit_price, total_price, production_days, position
    ) values (
      v_variant_id, v_quantity, round(v_unit_price, 4), round(v_total_price, 2),
      coalesce(v_tier_days, v_days), v_position
    ) on conflict (variant_id, quantity) do update set
      unit_price = excluded.unit_price, total_price = excluded.total_price,
      production_days = excluded.production_days, position = excluded.position;
    insert into store.product_price_tiers(
      product_id, min_qty, max_qty, unit_price, reseller_unit_price, production_days, position
    ) values (
      v_store_id, v_quantity, v_quantity, round(v_unit_price, 4), null,
      coalesce(v_tier_days, v_days), v_position
    );
    v_tier_count := v_tier_count + 1;
    v_position := v_position + 1;
  end loop;

  if v_tier_count = 0 then
    insert into store.product_variant_price_tiers(
      variant_id, quantity, unit_price, total_price, production_days, position
    ) values (
      v_variant_id, greatest(1, coalesce(v_source.minimum_quantity, 1)),
      v_base_price, round(v_base_price * greatest(1, coalesce(v_source.minimum_quantity, 1)), 2), v_days, 0
    );
    v_tier_count := 1;
  end if;

  -- Demais combinacoes reais. Cada linha do Flow e ligada as opcoes publicadas
  -- (store.crm_variant_selection). Linhas com a MESMA selecao (SKUs de tiragem
  -- da mesma combinacao) viram uma variante so, com as tiragens unidas. Linha
  -- que nao casa com as opcoes NAO e publicada: vira aviso explicito.
  for v_variant in
    select v.*, store.crm_variant_selection(v_store_id, v.raw_attributes) as linked_selection
    from public.product_variants v
    where v.product_id = v_source.id and coalesce(v.available, true)
      and (v_source_variant_id is null or v.id <> v_source_variant_id)
    order by v.created_at, v.id
  loop
    v_selection := v_variant.linked_selection;
    if v_selection is null or v_selection = '{}'::jsonb then
      v_unmatched := pg_catalog.array_append(v_unmatched, coalesce(v_variant.sku, v_variant.external_id, v_variant.id::text));
      continue;
    end if;

    -- Mesma combinacao da padrao: todos os eixos que a linha descreve batem.
    v_variant_id := null;
    if v_default_selection @> v_selection then
      v_variant_id := v_default_variant_id;
    else
      select id into v_variant_id from store.product_variants
      where product_id = v_store_id and selection = v_selection
      limit 1;
    end if;

    if v_variant_id is null then
      insert into store.product_variants(
        product_id, source_variant_id, source_external_id, sku, title, selection,
        production_days, available, is_default, position
      ) values (
        v_store_id, v_variant.id, v_variant.external_id,
        v_base_sku || '-' || pg_catalog.lpad((v_variant_count + 1)::text, 2, '0'),
        coalesce(nullif(v_variant.title, ''), v_name), v_selection,
        coalesce(v_variant.production_days, v_days), true, false, v_variant_count
      ) returning id into v_variant_id;
      v_variant_count := v_variant_count + 1;
    else
      v_merged_count := v_merged_count + 1;
    end if;

    select coalesce(max(position) + 1, 0) into v_position
    from store.product_variant_price_tiers where variant_id = v_variant_id;
    for v_extra in
      select distinct on (t.quantity) t.quantity, t.unit_price, t.total_price
      from public.product_price_tiers t
      where t.variant_id = v_variant.id and coalesce(t.available, true) and t.quantity > 0 and t.total_price > 0
      order by t.quantity, t.collected_at desc
    loop
      v_unit_price := round(coalesce(v_extra.unit_price, v_extra.total_price / v_extra.quantity) * (1 + v_margin / 100), 4);
      v_total_price := round(v_extra.total_price * (1 + v_margin / 100), 2);
      -- Tiragem ja existente (da padrao ou de outra linha da mesma combinacao)
      -- e preservada: a padrao carrega os precos curados no Flow.
      insert into store.product_variant_price_tiers(
        variant_id, quantity, unit_price, total_price, production_days, position
      ) values (
        v_variant_id, v_extra.quantity, v_unit_price, v_total_price,
        coalesce(v_variant.production_days, v_days), v_position
      ) on conflict (variant_id, quantity) do nothing;
      if found then
        v_tier_count := v_tier_count + 1;
        v_position := v_position + 1;
      end if;
    end loop;
  end loop;

  if pg_catalog.cardinality(v_unmatched) > 0 then
    v_warnings := pg_catalog.array_append(v_warnings,
      pg_catalog.cardinality(v_unmatched) || ' combinacao(oes) do Flow sem correspondencia nas opcoes publicadas (SKU '
      || pg_catalog.array_to_string(v_unmatched[1:10], ', ') || '). Refaca a varredura do produto no Flow.');
  end if;

  -- Opcao de eixo so e compravel se alguma combinacao real a usa (ou se uma
  -- combinacao nao restringe aquele eixo). O preco vem SEMPRE da variante:
  -- modificador em opcao de eixo seria contado duas vezes.
  update store.product_options o set
    active = exists (
      select 1 from store.product_variants pv
      where pv.product_id = v_store_id and pv.available
        and (not (pv.selection ? g.key) or pv.selection ->> g.key = o.value)
    ),
    modifier_type = 'fixo',
    modifier_value = 0,
    production_days_delta = 0
  from store.product_option_groups g
  where o.group_id = g.id and g.product_id = v_store_id
    and g.key not like 'extra-%';

  update store.product_options o set description = case
    when o.active then null else 'Sem combinacao com preco real no fornecedor.' end
  from store.product_option_groups g
  where o.group_id = g.id and g.product_id = v_store_id and g.key not like 'extra-%';

  select count(*) into v_inactive_options
  from store.product_options o join store.product_option_groups g on g.id = o.group_id
  where g.product_id = v_store_id and g.key not like 'extra-%' and not o.active;

  if v_inactive_options > 0 then
    v_warnings := pg_catalog.array_append(
      v_warnings,
      v_inactive_options || ' opcao(oes) sem combinacao real ficaram ocultas no site.'
    );
  end if;

  select count(*) into v_source_variant_total
  from public.product_variants where product_id = v_source.id and coalesce(available, true);

  -- Status, hash, versao e log ficam com store.publish_crm_product.
  return pg_catalog.jsonb_build_object(
    'ok', true, 'id', v_store_id, 'action', v_action,
    'sync_status', case when pg_catalog.cardinality(v_warnings) > 0 then 'attention' else 'synced' end,
    'counts', pg_catalog.jsonb_build_object(
      'images', v_image_count, 'option_groups', v_group_count, 'options', v_option_count,
      'variants', v_variant_count, 'tiers', v_tier_count,
      'source_variants', v_source_variant_total, 'merged_variants', v_merged_count,
      'unmatched_variants', pg_catalog.cardinality(v_unmatched)
    ),
    'warnings', to_jsonb(v_warnings)
  );
end;
$function$;

revoke all on function store.publish_crm_product_apply(uuid) from public, anon, authenticated;

-- 4. Publicação canônica -----------------------------------------------------------

create or replace function store.publish_crm_product(p_crm_product_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.products%rowtype;
  v_store store.products%rowtype;
  v_store_id uuid;
  v_result jsonb;
  v_warnings jsonb;
  v_status text;
  v_action text;
  v_hash text;
  v_site_hash text;
  v_problems text[];
  v_error text;
  v_code text;
  v_version integer;
begin
  -- Mesma ordem de travas da montagem: origem no Flow, depois a linha da loja.
  select * into v_source from public.products where id = p_crm_product_id for update;
  if v_source.id is null then
    raise exception 'Produto do Flow nao encontrado.' using errcode = 'P0002';
  end if;
  if not private.is_company_member(v_source.company_id, array['owner','admin']) then
    raise exception 'Sem permissao para publicar este produto.' using errcode = '42501';
  end if;

  select * into v_store from store.products where crm_id = v_source.id for update;
  if v_store.id is not null then
    v_site_hash := store.product_content_hash(v_store.id);
  end if;

  begin
    v_result := store.publish_crm_product_apply(v_source.id);
    v_store_id := (v_result ->> 'id')::uuid;

    v_problems := store.product_publish_problems(v_store_id);
    if pg_catalog.cardinality(v_problems) > 0 then
      raise exception '%', pg_catalog.array_to_string(v_problems, ' ') using errcode = '22023';
    end if;

    v_hash := store.product_content_hash(v_store_id);

    -- Nada mudou nem no Flow nem na loja: desfaz a remontagem (os ids ficam).
    if v_store.content_hash is not null
       and v_hash = v_store.content_hash
       and v_site_hash = v_store.content_hash
       and v_store.archived_at is null then
      raise exception 'noop' using errcode = 'NXNOP';
    end if;
  exception
    when sqlstate 'NXNOP' then
      v_action := 'noop';
    when others then
      get stacked diagnostics v_error = message_text, v_code = returned_sqlstate;

      if v_store.id is not null then
        update store.products set sync_status = 'error', last_sync_error = v_error
        where id = v_store.id;
      end if;
      insert into store.sync_log(entidade, direcao, origem_id, destino_id, acao, sucesso, erro, payload)
      values (
        'produtos', 'crm_para_site', v_source.id, v_store.id, 'erro', false, v_error,
        pg_catalog.jsonb_build_object('name', v_source.name, 'code', v_code, 'published_by', auth.uid())
      );
      return pg_catalog.jsonb_build_object(
        'ok', false, 'action', 'error', 'product_id', v_store.id, 'id', v_store.id,
        'sync_status', case when v_store.id is null then null else 'error' end,
        'error', v_error, 'code', v_code,
        'content_hash', v_store.content_hash, 'warnings', '[]'::jsonb
      );
  end;

  v_warnings := coalesce(v_result -> 'warnings', '[]'::jsonb);
  v_status := case when pg_catalog.jsonb_array_length(v_warnings) > 0 then 'attention' else 'synced' end;

  if v_action = 'noop' then
    v_store_id := v_store.id;
    v_version := v_store.sync_version;
    update store.products set
      sync_status = v_status, last_sync_error = null, source_updated_at = v_source.updated_at
    where id = v_store_id;
  else
    v_action := v_result ->> 'action';
    if v_store.content_hash is not null and v_site_hash is distinct from v_store.content_hash then
      v_warnings := v_warnings || pg_catalog.to_jsonb(
        'Alteracoes feitas direto na loja foram substituidas pelo conteudo do Flow.'::text);
    end if;
    v_version := case when v_store.id is null then 1 else coalesce(v_store.sync_version, 0) + 1 end;
    update store.products set
      sync_status = v_status,
      synced_at = pg_catalog.now(),
      sync_version = v_version,
      source_updated_at = v_source.updated_at,
      content_hash = v_hash,
      last_sync_error = null
    where id = v_store_id;
  end if;

  insert into store.sync_log(entidade, direcao, origem_id, destino_id, acao, sucesso, payload)
  values (
    'produtos', 'crm_para_site', v_source.id, v_store_id,
    case when v_action = 'noop' then 'skip' else v_action end, true,
    pg_catalog.jsonb_build_object(
      'name', v_source.name,
      'action', v_action,
      'published_by', auth.uid(),
      'sync_version', v_version,
      'content_hash', v_hash,
      'previous_hash', v_store.content_hash,
      'site_hash', v_site_hash,
      'counts', v_result -> 'counts',
      'warnings', v_warnings
    )
  );

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'action', v_action,
    'product_id', v_store_id,
    'id', v_store_id,
    'sync_status', v_status,
    'sync_version', v_version,
    'content_hash', v_hash,
    'counts', v_result -> 'counts',
    'warnings', v_warnings
  );
end;
$$;

comment on function store.publish_crm_product(uuid) is
  'Única entrada de publicação Flow -> loja. Transacional, idempotente (noop), registra toda tentativa em store.sync_log.';

revoke all on function store.publish_crm_product(uuid) from public, anon;
grant execute on function store.publish_crm_product(uuid) to authenticated;
