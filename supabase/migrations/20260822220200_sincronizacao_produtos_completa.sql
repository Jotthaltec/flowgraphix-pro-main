-- Sincronizacao completa e idempotente do catalogo Flow -> Nexus.
--
-- O produto da loja continua sendo o agregado de leitura rapida. As combinacoes
-- reais e suas tiragens ficam em tabelas proprias, preservando SKU, prazo e preco
-- sem expor custo de fornecedor. Produtos nativos da loja permanecem intactos.

create or replace function store.crm_slug(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.btrim(
    pg_catalog.regexp_replace(
      pg_catalog.lower(
        pg_catalog.translate(
          coalesce(value, ''),
          'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ',
          'aaaaaaeeeeiiiiooooouuuucnyy'
        )
      ),
      '[^a-z0-9]+', '-', 'g'
    ),
    '-'
  );
$$;

create or replace function store.jsonb_numeric(value jsonb, key_name text)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  raw_value text;
begin
  raw_value := nullif(value ->> key_name, '');
  if raw_value is null then return null; end if;
  if raw_value ~ '^-?[0-9]+([.][0-9]+)?$' then return raw_value::numeric; end if;
  return null;
exception when others then
  return null;
end;
$$;

revoke all on function store.crm_slug(text) from public, anon, authenticated;
revoke all on function store.jsonb_numeric(jsonb,text) from public, anon, authenticated;
grant execute on function store.crm_slug(text) to service_role;
grant execute on function store.jsonb_numeric(jsonb,text) to service_role;

alter table store.products add column if not exists quantity_mode text not null default 'any';
alter table store.products add column if not exists sync_status text not null default 'native';
alter table store.products add column if not exists synced_at timestamptz;
alter table store.products add column if not exists sync_version integer not null default 1;
alter table store.product_price_tiers add column if not exists production_days integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'products_quantity_mode_check'
      and conrelid = 'store.products'::regclass
  ) then
    alter table store.products add constraint products_quantity_mode_check
      check (quantity_mode in ('any', 'tiers_only'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'products_sync_status_check'
      and conrelid = 'store.products'::regclass
  ) then
    alter table store.products add constraint products_sync_status_check
      check (sync_status in ('native', 'synced', 'attention', 'error'));
  end if;
end $$;

create table if not exists store.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references store.products(id) on delete cascade,
  source_variant_id uuid,
  source_external_id text,
  sku text,
  title text not null,
  selection jsonb not null default '{}'::jsonb,
  production_days integer,
  available boolean not null default true,
  is_default boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists store.product_variant_price_tiers (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references store.product_variants(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,4) not null check (unit_price >= 0),
  total_price numeric(12,2) not null check (total_price >= 0),
  production_days integer,
  position integer not null default 0,
  unique (variant_id, quantity)
);

create index if not exists product_variants_product_idx
  on store.product_variants(product_id, available, position);
create unique index if not exists product_variants_source_idx
  on store.product_variants(product_id, source_variant_id)
  where source_variant_id is not null;
create index if not exists product_variant_tiers_variant_idx
  on store.product_variant_price_tiers(variant_id, quantity);

alter table store.product_variants enable row level security;
alter table store.product_variant_price_tiers enable row level security;

drop policy if exists "variantes_leitura" on store.product_variants;
create policy "variantes_leitura" on store.product_variants
  for select to anon, authenticated
  using (
    (select store.is_staff())
    or exists (
      select 1 from store.products p
      where p.id = product_id and p.active and p.archived_at is null
    )
  );
drop policy if exists "variantes_admin" on store.product_variants;
create policy "variantes_admin" on store.product_variants
  for all to authenticated
  using ((select store.is_admin()))
  with check ((select store.is_admin()));

drop policy if exists "tiragens_variante_leitura" on store.product_variant_price_tiers;
create policy "tiragens_variante_leitura" on store.product_variant_price_tiers
  for select to anon, authenticated
  using (
    (select store.is_staff())
    or exists (
      select 1
      from store.product_variants v
      join store.products p on p.id = v.product_id
      where v.id = variant_id and v.available and p.active and p.archived_at is null
    )
  );
drop policy if exists "tiragens_variante_admin" on store.product_variant_price_tiers;
create policy "tiragens_variante_admin" on store.product_variant_price_tiers
  for all to authenticated
  using ((select store.is_admin()))
  with check ((select store.is_admin()));

grant select on store.product_variants, store.product_variant_price_tiers to anon, authenticated;
grant all on store.product_variants, store.product_variant_price_tiers to service_role;

create or replace function store.publish_crm_product(p_crm_product_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
    coalesce(nullif(v_source.internal_sku, ''), 'CRM-' || pg_catalog.upper(pg_catalog.substr(pg_catalog.replace(v_source.id::text, '-', ''), 1, 12))),
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
    'crm', v_source.id, 'synced', pg_catalog.now(), 2
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
    sync_status = 'synced', synced_at = pg_catalog.now(), sync_version = 2
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
  if pg_catalog.jsonb_typeof(v_source.specifications) = 'object' then
    for v_axis_name, v_option_label in select key, value from pg_catalog.jsonb_each_text(v_source.specifications)
    loop
      v_axis_key := store.crm_slug(v_axis_name);
      v_option_value := store.crm_slug(v_option_label);
      select id into v_group_id from store.product_option_groups
      where product_id = v_store_id and key = v_axis_key;
      if v_group_id is null then
        insert into store.product_option_groups(product_id, key, name, input_type, required, multiple, position)
        values (v_store_id, v_axis_key, v_axis_name, 'select', true, false, v_group_position)
        returning id into v_group_id;
        v_group_position := v_group_position + 1;
      end if;
      if not exists (select 1 from store.product_options where group_id = v_group_id and value = v_option_value) then
        insert into store.product_options(group_id, label, value, position, active, default_selected)
        values (v_group_id, v_option_label, v_option_value, 0, true, true);
      else
        update store.product_options set active = true, default_selected = true
        where group_id = v_group_id and value = v_option_value;
      end if;
      v_default_selection := v_default_selection || pg_catalog.jsonb_build_object(v_axis_key, v_option_value);
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

  -- Variante padrao: representa exatamente a configuracao/precos exibidos no
  -- produto do Flow. As tiragens sao discretas; nao se inventa interpolacao.
  select id into v_source_variant_id
  from public.product_variants
  where product_id = v_source.id
    and (sku = v_source.supplier_sku or external_id = v_source.supplier_sku)
  order by created_at, id limit 1;

  insert into store.product_variants(
    product_id, source_variant_id, source_external_id, sku, title, selection,
    production_days, available, is_default, position
  ) values (
    v_store_id, v_source_variant_id, v_source.supplier_sku,
    coalesce(nullif(v_source.internal_sku, ''), nullif(v_source.supplier_sku, '')),
    v_name, v_default_selection, v_days, true, true, 0
  ) returning id into v_variant_id;
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

  -- Variantes adicionais realmente distintas. Linhas antigas que representam
  -- apenas SKUs de quantidade tem a mesma selecao da padrao e sao consolidadas.
  for v_variant in
    with prepared as (
      select v.*,
        coalesce((
          select pg_catalog.jsonb_object_agg(store.crm_slug(k), store.crm_slug(val))
          from pg_catalog.jsonb_each_text(coalesce(v.raw_attributes, '{}'::jsonb)) attrs(k, val)
        ), '{}'::jsonb) as normalized_selection
      from public.product_variants v
      where v.product_id = v_source.id and coalesce(v.available, true)
    ), distinct_variants as (
      select distinct on (normalized_selection) *
      from prepared
      where normalized_selection <> '{}'::jsonb
        and not (v_default_selection @> normalized_selection)
      order by normalized_selection, (sku = v_source.supplier_sku) desc, created_at, id
    )
    select * from distinct_variants
  loop
    v_selection := v_variant.normalized_selection;
    insert into store.product_variants(
      product_id, source_variant_id, source_external_id, sku, title, selection,
      production_days, available, is_default, position
    ) values (
      v_store_id, v_variant.id, v_variant.external_id, v_variant.sku,
      coalesce(nullif(v_variant.title, ''), v_name), v_selection,
      coalesce(v_variant.production_days, v_days), true, false, v_variant_count
    ) returning id into v_variant_id;
    v_variant_count := v_variant_count + 1;
    v_position := 0;
    for v_extra in
      select t.quantity, t.unit_price, t.total_price, t.collected_at
      from public.product_price_tiers t
      where t.variant_id = v_variant.id and coalesce(t.available, true) and t.quantity > 0 and t.total_price > 0
      order by t.quantity, t.collected_at desc
    loop
      v_unit_price := round(coalesce(v_extra.unit_price, v_extra.total_price / v_extra.quantity) * (1 + v_margin / 100), 4);
      v_total_price := round(v_extra.total_price * (1 + v_margin / 100), 2);
      insert into store.product_variant_price_tiers(
        variant_id, quantity, unit_price, total_price, production_days, position
      ) values (
        v_variant_id, v_extra.quantity, v_unit_price, v_total_price,
        coalesce(v_variant.production_days, v_days), v_position
      ) on conflict (variant_id, quantity) do update set
        unit_price = excluded.unit_price, total_price = excluded.total_price,
        production_days = excluded.production_days, position = excluded.position;
      v_tier_count := v_tier_count + 1;
      v_position := v_position + 1;
    end loop;

    -- Toda opcao que participa de uma variante real passa a ser compravel.
    for v_axis_key, v_option_value in select key, value from pg_catalog.jsonb_each_text(v_selection)
    loop
      update store.product_options o set active = true
      from store.product_option_groups g
      where o.group_id = g.id and g.product_id = v_store_id
        and g.key = v_axis_key and o.value = v_option_value;
    end loop;
  end loop;

  if v_inactive_options > 0 then
    v_warnings := pg_catalog.array_append(
      v_warnings,
      v_inactive_options || ' opcao(oes) preservada(s), mas bloqueada(s) por falta de preco real.'
    );
  end if;

  update store.products set
    sync_status = case when pg_catalog.cardinality(v_warnings) > 0 then 'attention' else 'synced' end,
    synced_at = pg_catalog.now(), sync_version = 2
  where id = v_store_id;

  insert into store.sync_log(
    entidade, direcao, origem_id, destino_id, acao, sucesso, payload
  ) values (
    'produtos', 'crm_para_site', v_source.id, v_store_id, v_action, true,
    pg_catalog.jsonb_build_object(
      'name', v_source.name,
      'published_by', auth.uid(),
      'sync_version', 2,
      'images', v_image_count,
      'option_groups', v_group_count,
      'options', v_option_count,
      'variants', v_variant_count,
      'tiers', v_tier_count,
      'warnings', to_jsonb(v_warnings)
    )
  );

  return pg_catalog.jsonb_build_object(
    'ok', true, 'id', v_store_id, 'action', v_action,
    'sync_status', case when pg_catalog.cardinality(v_warnings) > 0 then 'attention' else 'synced' end,
    'counts', pg_catalog.jsonb_build_object(
      'images', v_image_count, 'option_groups', v_group_count, 'options', v_option_count,
      'variants', v_variant_count, 'tiers', v_tier_count
    ),
    'warnings', to_jsonb(v_warnings)
  );
end;
$$;

revoke all on function store.publish_crm_product(uuid) from public, anon;
grant execute on function store.publish_crm_product(uuid) to authenticated, service_role;

create or replace view public.site_products
with (security_invoker = true)
as
select
  p.id,
  p.sku,
  p.name,
  p.slug,
  c.name as categoria,
  p.price_unit as unidade_preco,
  p.base_price as preco_base,
  p.sale_price as preco_promocional,
  p.reseller_price as preco_revenda,
  p.min_quantity as quantidade_minima,
  p.production_days as prazo_producao_dias,
  p.featured as destaque,
  p.is_new as novidade,
  p.on_sale as em_promocao,
  p.reseller_only as exclusivo_revenda,
  p.updated_at,
  img.url as imagem,
  -- Colunas novas precisam vir depois das existentes para que CREATE OR REPLACE
  -- preserve o contrato historico da view consumida pelo Flow.
  p.crm_id,
  p.active,
  p.sync_status,
  p.synced_at,
  p.sync_version,
  coalesce(stats.imagens, 0) as imagens,
  coalesce(stats.grupos, 0) as grupos_opcao,
  coalesce(stats.opcoes, 0) as opcoes,
  coalesce(stats.variantes, 0) as variantes,
  coalesce(stats.tiragens, 0) as tiragens
from store.products p
left join store.categories c on c.id = p.category_id
left join lateral (
  select i.url from store.product_images i
  where i.product_id = p.id and i.kind in ('foto','mockup')
  order by i.position, i.created_at limit 1
) img on true
left join lateral (
  select
    (select count(*) from store.product_images i where i.product_id = p.id) imagens,
    (select count(*) from store.product_option_groups g where g.product_id = p.id) grupos,
    (select count(*) from store.product_options o join store.product_option_groups g on g.id = o.group_id where g.product_id = p.id) opcoes,
    (select count(*) from store.product_variants v where v.product_id = p.id) variantes,
    (select count(*) from store.product_variant_price_tiers t join store.product_variants v on v.id = t.variant_id where v.product_id = p.id) tiragens
) stats on true;

comment on view public.site_products is
  'Catalogo Nexus visivel no Flow, incluindo vinculo CRM e diagnostico da ultima sincronizacao.';
grant select on public.site_products to anon, authenticated, service_role;
