-- =============================================================================
-- CATÁLOGO DO SITE VISÍVEL NO CRM
--
-- O CRM inteiro consulta o schema `public` — seu client Supabase é criado sem
-- `db.schema`. Em vez de introduzir um segundo client só para ler o catálogo da
-- loja, expomos uma view em `public` que lê de `store`. A leitura fica com uma
-- entrada só, e nenhuma tela existente precisa mudar.
--
-- `security_invoker = true` é o ponto central: sem ele, a view rodaria com os
-- privilégios de quem a criou (postgres) e furaria o RLS de `store.products`,
-- entregando o catálogo inteiro a qualquer um. Com ele, cada consulta é avaliada
-- com as permissões de quem pergunta — as policies da loja continuam valendo.
--
-- A view é somente leitura por natureza (tem junções): o CRM enxerga o catálogo,
-- mas continua sendo a loja quem o edita. Isso é intencional — um só dono para
-- cada dado.
-- =============================================================================

create or replace view public.site_products
with (security_invoker = true)
as
select
  p.id,
  p.sku,
  p.name,
  p.slug,
  c.name                as categoria,
  p.price_unit          as unidade_preco,
  p.base_price          as preco_base,
  p.sale_price          as preco_promocional,
  p.reseller_price      as preco_revenda,
  p.min_quantity        as quantidade_minima,
  p.production_days     as prazo_producao_dias,
  p.featured            as destaque,
  p.is_new              as novidade,
  p.on_sale             as em_promocao,
  p.reseller_only       as exclusivo_revenda,
  p.updated_at,
  img.url               as imagem
from store.products p
left join store.categories c on c.id = p.category_id
-- Só a primeira imagem: a listagem do CRM é uma tabela, não uma galeria.
left join lateral (
  select i.url
  from store.product_images i
  where i.product_id = p.id
  order by i.position, i.created_at
  limit 1
) img on true
where p.active = true;

comment on view public.site_products is
  'Produtos publicados na loja Nexus Printi (store.products where active). Somente leitura — a edição é feita no painel da loja.';

grant select on public.site_products to anon, authenticated, service_role;
