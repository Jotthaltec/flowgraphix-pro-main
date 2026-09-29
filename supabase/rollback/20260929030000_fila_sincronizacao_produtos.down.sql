-- Reversão de 20260929030000_fila_sincronizacao_produtos.sql.
-- Reverta antes 20260929030100 (agendamento), se aplicada.
--   psql "$SUPABASE_DB_URL" -1 -v ON_ERROR_STOP=1 -f <este arquivo>
--   delete from supabase_migrations.schema_migrations where version = '20260929030000';
--
-- Perde: a fila (store.product_sync_queue, com seu histórico) e a coluna
-- auto_sync. Produtos marcados 'stale' continuam assim até a próxima publicação.

-- site_products volta a expor o status gravado.
create or replace view public.site_products
with (security_invoker = true)
as
select p.id,
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
  p.crm_id,
  p.active,
  p.sync_status,
  p.synced_at,
  p.sync_version,
  coalesce(stats.imagens, 0::bigint) as imagens,
  coalesce(stats.grupos, 0::bigint) as grupos_opcao,
  coalesce(stats.opcoes, 0::bigint) as opcoes,
  coalesce(stats.variantes, 0::bigint) as variantes,
  coalesce(stats.tiragens, 0::bigint) as tiragens
from store.products p
  left join store.categories c on c.id = p.category_id
  left join lateral (
    select i.url from store.product_images i
    where i.product_id = p.id and i.kind = any (array['foto'::text, 'mockup'::text])
    order by i."position", i.created_at
    limit 1
  ) img on true
  left join lateral (
    select
      (select count(*) from store.product_images i where i.product_id = p.id) as imagens,
      (select count(*) from store.product_option_groups g where g.product_id = p.id) as grupos,
      (select count(*) from store.product_options o
         join store.product_option_groups g on g.id = o.group_id where g.product_id = p.id) as opcoes,
      (select count(*) from store.product_variants v where v.product_id = p.id) as variantes,
      (select count(*) from store.product_variant_price_tiers t
         join store.product_variants v on v.id = t.variant_id where v.product_id = p.id) as tiragens
  ) stats on true;

drop view if exists store.crm_product_sync_health;

-- Publicação volta à versão da fase 3 (sem marca de publicação nem fila).
create or replace function store.publish_crm_product(p_crm_product_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
begin
  select company_id into v_company from public.products where id = p_crm_product_id;
  if not found then
    raise exception 'Produto do Flow nao encontrado.' using errcode = 'P0002';
  end if;
  if not private.is_company_member(v_company, array['owner','admin']) then
    raise exception 'Sem permissao para publicar este produto.' using errcode = '42501';
  end if;
  return store.publish_crm_product_internal(p_crm_product_id, 'manual');
end;
$$;

revoke all on function store.publish_crm_product(uuid) from public, anon;
grant execute on function store.publish_crm_product(uuid) to authenticated;

drop trigger if exists tr_crm_product_changed on public.products;
drop trigger if exists tr_crm_variants_changed on public.product_variants;
drop trigger if exists tr_crm_price_tiers_changed on public.product_price_tiers;
drop trigger if exists tr_crm_images_changed on public.product_images;
drop trigger if exists tr_crm_templates_changed on public.product_templates;
drop trigger if exists tr_crm_extras_changed on public.product_extras;

drop function if exists store.process_product_sync_queue(integer);
drop function if exists store.product_sync_backoff(integer);
drop function if exists store.crm_product_child_changed();
drop function if exists store.crm_product_changed();
drop function if exists store.enqueue_product_sync(uuid, text);
drop function if exists store.product_sync_state(uuid);

drop table if exists store.product_sync_queue;

alter table store.products drop column if exists auto_sync;
