-- =============================================================================
-- RLS DO SCHEMA store
--
-- A migração 20260801000000_unify_store_schema.sql criou as 63 tabelas da loja
-- sem row level security e sem nenhuma policy. Como a loja é pública e o
-- navegador usa a chave anon, isso deixava clientes, pedidos, custos e
-- financeiro legíveis e graváveis por qualquer visitante.
--
-- Este arquivo porta para o schema store as policies que já existiam no Nexus
-- (supabase/migrations/0003_rls.sql), junto das cinco funções auxiliares de
-- 0002_functions.sql que elas usam. As 63 tabelas correspondem 1:1, então a
-- tradução é apenas de prefixo — `auth.` permanece intacto.
--
-- Princípios preservados:
--   • Cliente     -> somente os próprios dados.
--   • Revendedor  -> os próprios dados + clientes e pedidos que ele criou.
--   • Vendedor    -> clientes/pedidos vinculados a ele.
--   • Admin       -> acesso global.
--   • Visitante   -> apenas catálogo e conteúdo público, somente leitura.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Funções auxiliares usadas pelas policies
-- -----------------------------------------------------------------------------

create or replace function store.auth_role()
returns text
language sql
stable
security definer
set search_path = store, public
as $$
  select coalesce((select role from store.profiles where id = auth.uid()), 'anon');
$$;

create or replace function store.is_admin()
returns boolean
language sql
stable
security definer
set search_path = store, public
as $$
  select exists (select 1 from store.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function store.is_staff()
returns boolean
language sql
stable
security definer
set search_path = store, public
as $$
  select exists (select 1 from store.profiles where id = auth.uid() and role in ('admin','vendedor'));
$$;

create or replace function store.is_reseller()
returns boolean
language sql
stable
security definer
set search_path = store, public
as $$
  select exists (select 1 from store.profiles where id = auth.uid() and role = 'revendedor');
$$;

create or replace function store.can_access_customer(target uuid)
returns boolean
language sql
stable
security definer
set search_path = store, public
as $$
  select case
    when target is null then false
    when store.is_admin() then true
    else exists (
      select 1 from store.customers c
      where c.id = target
        and (
          c.profile_id = auth.uid()
          or c.owner_reseller_id = auth.uid()
          or (c.seller_id = auth.uid() and store.auth_role() = 'vendedor')
        )
    )
  end;
$$;

-- -----------------------------------------------------------------------------
-- Policies
-- -----------------------------------------------------------------------------

-- =============================================================================
-- NEXUS PRINTI — Row Level Security
--
-- Princípios:
--   • Cliente     → somente os próprios dados.
--   • Revendedor  → os próprios dados + clientes e pedidos que ele criou.
--   • Vendedor    → clientes/pedidos vinculados a ele.
--   • Admin       → acesso global.
--   • Visitante   → apenas catálogo e conteúdo público, somente leitura.
--
-- Carrinhos de visitante não são acessíveis diretamente pelo cliente HTTP:
-- passam por server actions que validam o cookie de sessão no servidor.
-- =============================================================================

alter table store.profiles                enable row level security;
alter table store.customers               enable row level security;
alter table store.permissions             enable row level security;
alter table store.reseller_profiles       enable row level security;
alter table store.seller_profiles         enable row level security;
alter table store.price_tables            enable row level security;
alter table store.margin_tables           enable row level security;
alter table store.addresses               enable row level security;
alter table store.categories              enable row level security;
alter table store.products                enable row level security;
alter table store.product_costs           enable row level security;
alter table store.product_images          enable row level security;
alter table store.product_option_groups   enable row level security;
alter table store.product_options         enable row level security;
alter table store.product_price_tiers     enable row level security;
alter table store.product_faqs            enable row level security;
alter table store.related_products        enable row level security;
alter table store.product_reviews         enable row level security;
alter table store.price_rules             enable row level security;
alter table store.favorites               enable row level security;
alter table store.shipping_zones          enable row level security;
alter table store.product_shipping_rules  enable row level security;
alter table store.carts                   enable row level security;
alter table store.cart_items              enable row level security;
alter table store.orders                  enable row level security;
alter table store.order_items             enable row level security;
alter table store.order_status_history    enable row level security;
alter table store.payments                enable row level security;
alter table store.shipments               enable row level security;
alter table store.quotes                  enable row level security;
alter table store.quote_items             enable row level security;
alter table store.quote_history           enable row level security;
alter table store.art_files               enable row level security;
alter table store.art_approvals           enable row level security;
alter table store.production_orders       enable row level security;
alter table store.production_stage_history enable row level security;
alter table store.stock_items             enable row level security;
alter table store.stock_movements         enable row level security;
alter table store.product_materials       enable row level security;
alter table store.finance_entries         enable row level security;
alter table store.commissions             enable row level security;
alter table store.credits                 enable row level security;
alter table store.coupons                 enable row level security;
alter table store.coupon_uses             enable row level security;
alter table store.banners                 enable row level security;
alter table store.testimonials            enable row level security;
alter table store.portfolio_items         enable row level security;
alter table store.newsletter_subscribers  enable row level security;
alter table store.referrals               enable row level security;
alter table store.tickets                 enable row level security;
alter table store.messages                enable row level security;
alter table store.quick_replies           enable row level security;
alter table store.opportunities           enable row level security;
alter table store.opportunity_activities  enable row level security;
alter table store.discount_requests       enable row level security;
alter table store.credit_requests         enable row level security;
alter table store.notifications           enable row level security;
alter table store.activity_logs           enable row level security;
alter table store.settings                enable row level security;
alter table store.pages                   enable row level security;
alter table store.faqs                    enable row level security;
alter table store.order_templates         enable row level security;
alter table store.marketing_assets        enable row level security;

-- -----------------------------------------------------------------------------
-- CATÁLOGO E CONTEÚDO PÚBLICO (leitura livre / escrita apenas admin)
-- -----------------------------------------------------------------------------

drop policy if exists "catalogo_leitura_publica" on store.categories;
create policy "catalogo_leitura_publica" on store.categories
  for select using (active = true or store.is_staff());
drop policy if exists "catalogo_admin" on store.categories;
create policy "catalogo_admin" on store.categories
  for all using (store.is_admin()) with check (store.is_admin());

-- Produtos exclusivos de revenda não aparecem para visitantes nem clientes.
drop policy if exists "produtos_leitura_publica" on store.products;
create policy "produtos_leitura_publica" on store.products
  for select using (
    store.is_staff()
    or (
      active = true and archived_at is null
      and (reseller_only = false or store.is_reseller())
    )
  );
drop policy if exists "produtos_admin" on store.products;
create policy "produtos_admin" on store.products
  for all using (store.is_admin()) with check (store.is_admin());

-- Custo interno: exclusivo do administrador.
drop policy if exists "custos_admin" on store.product_costs;
create policy "custos_admin" on store.product_costs
  for all using (store.is_admin()) with check (store.is_admin());

drop policy if exists "imagens_leitura" on store.product_images;
create policy "imagens_leitura" on store.product_images for select using (true);
drop policy if exists "imagens_admin" on store.product_images;
create policy "imagens_admin" on store.product_images
  for all using (store.is_admin()) with check (store.is_admin());

drop policy if exists "grupos_opcao_leitura" on store.product_option_groups;
create policy "grupos_opcao_leitura" on store.product_option_groups for select using (true);
drop policy if exists "grupos_opcao_admin" on store.product_option_groups;
create policy "grupos_opcao_admin" on store.product_option_groups
  for all using (store.is_admin()) with check (store.is_admin());

drop policy if exists "opcoes_leitura" on store.product_options;
create policy "opcoes_leitura" on store.product_options for select using (true);
drop policy if exists "opcoes_admin" on store.product_options;
create policy "opcoes_admin" on store.product_options
  for all using (store.is_admin()) with check (store.is_admin());

drop policy if exists "faixas_leitura" on store.product_price_tiers;
create policy "faixas_leitura" on store.product_price_tiers for select using (true);
drop policy if exists "faixas_admin" on store.product_price_tiers;
create policy "faixas_admin" on store.product_price_tiers
  for all using (store.is_admin()) with check (store.is_admin());

drop policy if exists "produto_faq_leitura" on store.product_faqs;
create policy "produto_faq_leitura" on store.product_faqs for select using (true);
drop policy if exists "produto_faq_admin" on store.product_faqs;
create policy "produto_faq_admin" on store.product_faqs
  for all using (store.is_admin()) with check (store.is_admin());

drop policy if exists "relacionados_leitura" on store.related_products;
create policy "relacionados_leitura" on store.related_products for select using (true);
drop policy if exists "relacionados_admin" on store.related_products;
create policy "relacionados_admin" on store.related_products
  for all using (store.is_admin()) with check (store.is_admin());

drop policy if exists "regras_preco_leitura" on store.price_rules;
create policy "regras_preco_leitura" on store.price_rules
  for select using (active = true or store.is_staff());
drop policy if exists "regras_preco_admin" on store.price_rules;
create policy "regras_preco_admin" on store.price_rules
  for all using (store.is_admin()) with check (store.is_admin());

drop policy if exists "frete_leitura" on store.shipping_zones;
create policy "frete_leitura" on store.shipping_zones
  for select using (active = true or store.is_staff());
drop policy if exists "frete_admin" on store.shipping_zones;
create policy "frete_admin" on store.shipping_zones
  for all using (store.is_admin()) with check (store.is_admin());

drop policy if exists "frete_produto_leitura" on store.product_shipping_rules;
create policy "frete_produto_leitura" on store.product_shipping_rules for select using (true);
drop policy if exists "frete_produto_admin" on store.product_shipping_rules;
create policy "frete_produto_admin" on store.product_shipping_rules
  for all using (store.is_admin()) with check (store.is_admin());

drop policy if exists "banners_leitura" on store.banners;
create policy "banners_leitura" on store.banners
  for select using (
    store.is_staff()
    or (active = true
        and (starts_at is null or starts_at <= now())
        and (ends_at is null or ends_at >= now()))
  );
drop policy if exists "banners_admin" on store.banners;
create policy "banners_admin" on store.banners
  for all using (store.is_admin()) with check (store.is_admin());

drop policy if exists "depoimentos_leitura" on store.testimonials;
create policy "depoimentos_leitura" on store.testimonials
  for select using (active = true or store.is_staff());
drop policy if exists "depoimentos_admin" on store.testimonials;
create policy "depoimentos_admin" on store.testimonials
  for all using (store.is_admin()) with check (store.is_admin());

drop policy if exists "portfolio_leitura" on store.portfolio_items;
create policy "portfolio_leitura" on store.portfolio_items
  for select using (active = true or store.is_staff());
drop policy if exists "portfolio_admin" on store.portfolio_items;
create policy "portfolio_admin" on store.portfolio_items
  for all using (store.is_admin()) with check (store.is_admin());

drop policy if exists "paginas_leitura" on store.pages;
create policy "paginas_leitura" on store.pages
  for select using (active = true or store.is_staff());
drop policy if exists "paginas_admin" on store.pages;
create policy "paginas_admin" on store.pages
  for all using (store.is_admin()) with check (store.is_admin());

drop policy if exists "faq_leitura" on store.faqs;
create policy "faq_leitura" on store.faqs
  for select using (active = true or store.is_staff());
drop policy if exists "faq_admin" on store.faqs;
create policy "faq_admin" on store.faqs
  for all using (store.is_admin()) with check (store.is_admin());

-- Configurações públicas ficam no grupo "publico"; o restante é do admin.
drop policy if exists "config_leitura_publica" on store.settings;
create policy "config_leitura_publica" on store.settings
  for select using (group_name = 'publico' or store.is_staff());
drop policy if exists "config_admin" on store.settings;
create policy "config_admin" on store.settings
  for all using (store.is_admin()) with check (store.is_admin());

-- Avaliações: leitura das aprovadas; o autor cria a própria.
drop policy if exists "avaliacoes_leitura" on store.product_reviews;
create policy "avaliacoes_leitura" on store.product_reviews
  for select using (approved = true or profile_id = auth.uid() or store.is_staff());
drop policy if exists "avaliacoes_cria" on store.product_reviews;
create policy "avaliacoes_cria" on store.product_reviews
  for insert with check (profile_id = auth.uid());
drop policy if exists "avaliacoes_edita_autor" on store.product_reviews;
create policy "avaliacoes_edita_autor" on store.product_reviews
  for update using (profile_id = auth.uid() and approved = false)
  with check (profile_id = auth.uid());
drop policy if exists "avaliacoes_admin" on store.product_reviews;
create policy "avaliacoes_admin" on store.product_reviews
  for all using (store.is_admin()) with check (store.is_admin());

drop policy if exists "newsletter_inscreve" on store.newsletter_subscribers;
create policy "newsletter_inscreve" on store.newsletter_subscribers
  for insert with check (true);
drop policy if exists "newsletter_admin" on store.newsletter_subscribers;
create policy "newsletter_admin" on store.newsletter_subscribers
  for all using (store.is_admin()) with check (store.is_admin());

-- -----------------------------------------------------------------------------
-- PERFIS E CLIENTES
-- -----------------------------------------------------------------------------

drop policy if exists "perfil_proprio_leitura" on store.profiles;
create policy "perfil_proprio_leitura" on store.profiles
  for select using (
    id = auth.uid()
    or store.is_admin()
    or (store.auth_role() = 'vendedor' and (seller_id = auth.uid() or role in ('admin','vendedor')))
    or (store.auth_role() = 'revendedor' and reseller_id = auth.uid())
  );
drop policy if exists "perfil_proprio_atualiza" on store.profiles;
create policy "perfil_proprio_atualiza" on store.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists "perfil_admin" on store.profiles;
create policy "perfil_admin" on store.profiles
  for all using (store.is_admin()) with check (store.is_admin());

drop policy if exists "clientes_leitura" on store.customers;
create policy "clientes_leitura" on store.customers
  for select using (
    store.is_admin()
    or profile_id = auth.uid()
    or owner_reseller_id = auth.uid()
    or (store.auth_role() = 'vendedor' and seller_id = auth.uid())
  );
drop policy if exists "clientes_cria" on store.customers;
create policy "clientes_cria" on store.customers
  for insert with check (
    store.is_admin()
    or (store.is_reseller() and owner_reseller_id = auth.uid())
    or (store.auth_role() = 'vendedor' and seller_id = auth.uid())
    or profile_id = auth.uid()
  );
drop policy if exists "clientes_atualiza" on store.customers;
create policy "clientes_atualiza" on store.customers
  for update using (
    store.is_admin()
    or profile_id = auth.uid()
    or owner_reseller_id = auth.uid()
    or (store.auth_role() = 'vendedor' and seller_id = auth.uid())
  );
drop policy if exists "clientes_exclui_admin" on store.customers;
create policy "clientes_exclui_admin" on store.customers
  for delete using (store.is_admin());

drop policy if exists "permissoes_leitura" on store.permissions;
create policy "permissoes_leitura" on store.permissions
  for select using (auth.uid() is not null);
drop policy if exists "permissoes_admin" on store.permissions;
create policy "permissoes_admin" on store.permissions
  for all using (store.is_admin()) with check (store.is_admin());

drop policy if exists "revendedor_perfil_leitura" on store.reseller_profiles;
create policy "revendedor_perfil_leitura" on store.reseller_profiles
  for select using (profile_id = auth.uid() or store.is_staff());
drop policy if exists "revendedor_perfil_atualiza" on store.reseller_profiles;
create policy "revendedor_perfil_atualiza" on store.reseller_profiles
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());
drop policy if exists "revendedor_perfil_admin" on store.reseller_profiles;
create policy "revendedor_perfil_admin" on store.reseller_profiles
  for all using (store.is_admin()) with check (store.is_admin());

drop policy if exists "vendedor_perfil_leitura" on store.seller_profiles;
create policy "vendedor_perfil_leitura" on store.seller_profiles
  for select using (profile_id = auth.uid() or store.is_admin());
drop policy if exists "vendedor_perfil_admin" on store.seller_profiles;
create policy "vendedor_perfil_admin" on store.seller_profiles
  for all using (store.is_admin()) with check (store.is_admin());

drop policy if exists "tabelas_preco_leitura" on store.price_tables;
create policy "tabelas_preco_leitura" on store.price_tables
  for select using (active = true or store.is_staff());
drop policy if exists "tabelas_preco_admin" on store.price_tables;
create policy "tabelas_preco_admin" on store.price_tables
  for all using (store.is_admin()) with check (store.is_admin());

drop policy if exists "margens_proprias" on store.margin_tables;
create policy "margens_proprias" on store.margin_tables
  for all using (reseller_id = auth.uid() or store.is_admin())
  with check (reseller_id = auth.uid() or store.is_admin());

drop policy if exists "enderecos_proprios" on store.addresses;
create policy "enderecos_proprios" on store.addresses
  for all using (
    profile_id = auth.uid()
    or store.is_admin()
    or store.can_access_customer(customer_id)
  )
  with check (
    profile_id = auth.uid()
    or store.is_admin()
    or store.can_access_customer(customer_id)
  );

drop policy if exists "favoritos_proprios" on store.favorites;
create policy "favoritos_proprios" on store.favorites
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- -----------------------------------------------------------------------------
-- CARRINHO (apenas usuários autenticados; visitantes usam server actions)
-- -----------------------------------------------------------------------------

drop policy if exists "carrinho_proprio" on store.carts;
create policy "carrinho_proprio" on store.carts
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

drop policy if exists "itens_carrinho_proprio" on store.cart_items;
create policy "itens_carrinho_proprio" on store.cart_items
  for all using (
    exists (select 1 from store.carts c where c.id = cart_id and c.profile_id = auth.uid())
  )
  with check (
    exists (select 1 from store.carts c where c.id = cart_id and c.profile_id = auth.uid())
  );

-- -----------------------------------------------------------------------------
-- PEDIDOS
-- -----------------------------------------------------------------------------

drop policy if exists "pedidos_leitura" on store.orders;
create policy "pedidos_leitura" on store.orders
  for select using (
    store.is_admin()
    or profile_id = auth.uid()
    or reseller_id = auth.uid()
    or (store.auth_role() = 'vendedor' and seller_id = auth.uid())
    or store.can_access_customer(customer_id)
  );

drop policy if exists "pedidos_cria" on store.orders;
create policy "pedidos_cria" on store.orders
  for insert with check (
    store.is_admin()
    or profile_id = auth.uid()
    or (store.is_reseller() and reseller_id = auth.uid())
    or (store.auth_role() = 'vendedor' and seller_id = auth.uid())
  );

-- Cliente e revendedor só alteram enquanto o pedido não entrou em produção.
drop policy if exists "pedidos_atualiza" on store.orders;
create policy "pedidos_atualiza" on store.orders
  for update using (
    store.is_staff()
    or ((profile_id = auth.uid() or reseller_id = auth.uid())
        and status in ('pedido_recebido','aguardando_pagamento','aguardando_arquivos','alteracao_solicitada'))
  );

drop policy if exists "pedidos_exclui_admin" on store.orders;
create policy "pedidos_exclui_admin" on store.orders
  for delete using (store.is_admin());

drop policy if exists "itens_pedido_leitura" on store.order_items;
create policy "itens_pedido_leitura" on store.order_items
  for select using (
    exists (
      select 1 from store.orders o
      where o.id = order_id
        and (store.is_admin() or o.profile_id = auth.uid() or o.reseller_id = auth.uid()
             or (store.auth_role() = 'vendedor' and o.seller_id = auth.uid())
             or store.can_access_customer(o.customer_id))
    )
  );
drop policy if exists "itens_pedido_escrita" on store.order_items;
create policy "itens_pedido_escrita" on store.order_items
  for all using (
    store.is_staff()
    or exists (
      select 1 from store.orders o
      where o.id = order_id and (o.profile_id = auth.uid() or o.reseller_id = auth.uid())
        and o.status in ('pedido_recebido','aguardando_pagamento','aguardando_arquivos')
    )
  )
  with check (
    store.is_staff()
    or exists (
      select 1 from store.orders o
      where o.id = order_id and (o.profile_id = auth.uid() or o.reseller_id = auth.uid())
    )
  );

drop policy if exists "historico_pedido_leitura" on store.order_status_history;
create policy "historico_pedido_leitura" on store.order_status_history
  for select using (
    exists (
      select 1 from store.orders o
      where o.id = order_id
        and (store.is_admin() or o.profile_id = auth.uid() or o.reseller_id = auth.uid()
             or (store.auth_role() = 'vendedor' and o.seller_id = auth.uid()))
    )
  );
drop policy if exists "historico_pedido_escrita" on store.order_status_history;
create policy "historico_pedido_escrita" on store.order_status_history
  for insert with check (store.is_staff());

drop policy if exists "pagamentos_leitura" on store.payments;
create policy "pagamentos_leitura" on store.payments
  for select using (
    exists (
      select 1 from store.orders o
      where o.id = order_id
        and (store.is_admin() or o.profile_id = auth.uid() or o.reseller_id = auth.uid()
             or (store.auth_role() = 'vendedor' and o.seller_id = auth.uid()))
    )
  );
drop policy if exists "pagamentos_admin" on store.payments;
create policy "pagamentos_admin" on store.payments
  for all using (store.is_staff()) with check (store.is_staff());

drop policy if exists "entregas_leitura" on store.shipments;
create policy "entregas_leitura" on store.shipments
  for select using (
    exists (
      select 1 from store.orders o
      where o.id = order_id
        and (store.is_admin() or o.profile_id = auth.uid() or o.reseller_id = auth.uid()
             or (store.auth_role() = 'vendedor' and o.seller_id = auth.uid()))
    )
  );
drop policy if exists "entregas_equipe" on store.shipments;
create policy "entregas_equipe" on store.shipments
  for all using (store.is_staff()) with check (store.is_staff());

-- -----------------------------------------------------------------------------
-- ORÇAMENTOS
-- -----------------------------------------------------------------------------

drop policy if exists "orcamentos_leitura" on store.quotes;
create policy "orcamentos_leitura" on store.quotes
  for select using (
    store.is_admin()
    or profile_id = auth.uid()
    or reseller_id = auth.uid()
    or created_by = auth.uid()
    or (store.auth_role() = 'vendedor' and seller_id = auth.uid())
    or store.can_access_customer(customer_id)
  );
drop policy if exists "orcamentos_cria" on store.quotes;
create policy "orcamentos_cria" on store.quotes
  for insert with check (
    store.is_admin()
    or created_by = auth.uid()
    or profile_id = auth.uid()
  );
drop policy if exists "orcamentos_atualiza" on store.quotes;
create policy "orcamentos_atualiza" on store.quotes
  for update using (
    store.is_admin()
    or created_by = auth.uid()
    or reseller_id = auth.uid()
    or (store.auth_role() = 'vendedor' and seller_id = auth.uid())
  );
drop policy if exists "orcamentos_exclui" on store.quotes;
create policy "orcamentos_exclui" on store.quotes
  for delete using (store.is_admin() or (created_by = auth.uid() and status = 'rascunho'));

drop policy if exists "itens_orcamento" on store.quote_items;
create policy "itens_orcamento" on store.quote_items
  for all using (
    exists (
      select 1 from store.quotes q
      where q.id = quote_id
        and (store.is_admin() or q.created_by = auth.uid() or q.profile_id = auth.uid()
             or q.reseller_id = auth.uid()
             or (store.auth_role() = 'vendedor' and q.seller_id = auth.uid()))
    )
  )
  with check (
    exists (
      select 1 from store.quotes q
      where q.id = quote_id
        and (store.is_admin() or q.created_by = auth.uid()
             or q.reseller_id = auth.uid()
             or (store.auth_role() = 'vendedor' and q.seller_id = auth.uid()))
    )
  );

drop policy if exists "historico_orcamento" on store.quote_history;
create policy "historico_orcamento" on store.quote_history
  for select using (
    exists (
      select 1 from store.quotes q
      where q.id = quote_id
        and (store.is_admin() or q.created_by = auth.uid() or q.profile_id = auth.uid()
             or q.reseller_id = auth.uid()
             or (store.auth_role() = 'vendedor' and q.seller_id = auth.uid()))
    )
  );
drop policy if exists "historico_orcamento_cria" on store.quote_history;
create policy "historico_orcamento_cria" on store.quote_history
  for insert with check (auth.uid() is not null);

-- -----------------------------------------------------------------------------
-- ARTES E APROVAÇÕES
-- -----------------------------------------------------------------------------

drop policy if exists "arquivos_leitura" on store.art_files;
create policy "arquivos_leitura" on store.art_files
  for select using (
    store.is_staff()
    or profile_id = auth.uid()
    or uploaded_by = auth.uid()
    or exists (
      select 1 from store.orders o
      where o.id = order_id
        and (o.profile_id = auth.uid() or o.reseller_id = auth.uid()
             or (store.auth_role() = 'vendedor' and o.seller_id = auth.uid()))
    )
  );
drop policy if exists "arquivos_envia" on store.art_files;
create policy "arquivos_envia" on store.art_files
  for insert with check (
    store.is_staff()
    or (uploaded_by = auth.uid() and (
      order_id is null
      or exists (
        select 1 from store.orders o
        where o.id = order_id and (o.profile_id = auth.uid() or o.reseller_id = auth.uid())
      )
    ))
  );
drop policy if exists "arquivos_equipe_atualiza" on store.art_files;
create policy "arquivos_equipe_atualiza" on store.art_files
  for update using (store.is_staff()) with check (store.is_staff());
drop policy if exists "arquivos_exclui" on store.art_files;
create policy "arquivos_exclui" on store.art_files
  for delete using (store.is_admin() or (uploaded_by = auth.uid() and status = 'pendente'));

drop policy if exists "aprovacoes_leitura" on store.art_approvals;
create policy "aprovacoes_leitura" on store.art_approvals
  for select using (
    store.is_staff()
    or exists (
      select 1 from store.orders o
      where o.id = order_id
        and (o.profile_id = auth.uid() or o.reseller_id = auth.uid())
    )
  );
-- Só o dono do pedido (ou a equipe) decide sobre a arte.
drop policy if exists "aprovacoes_registra" on store.art_approvals;
create policy "aprovacoes_registra" on store.art_approvals
  for insert with check (
    store.is_staff()
    or exists (
      select 1 from store.orders o
      where o.id = order_id
        and (o.profile_id = auth.uid() or o.reseller_id = auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- PRODUÇÃO E ESTOQUE (equipe interna)
-- -----------------------------------------------------------------------------

drop policy if exists "producao_leitura" on store.production_orders;
create policy "producao_leitura" on store.production_orders
  for select using (
    store.is_staff()
    or exists (
      select 1 from store.orders o
      where o.id = order_id and (o.profile_id = auth.uid() or o.reseller_id = auth.uid())
    )
  );
drop policy if exists "producao_admin" on store.production_orders;
create policy "producao_admin" on store.production_orders
  for all using (store.is_admin()) with check (store.is_admin());
drop policy if exists "producao_vendedor_atualiza" on store.production_orders;
create policy "producao_vendedor_atualiza" on store.production_orders
  for update using (store.is_staff()) with check (store.is_staff());

drop policy if exists "producao_historico_leitura" on store.production_stage_history;
create policy "producao_historico_leitura" on store.production_stage_history
  for select using (store.is_staff());
drop policy if exists "producao_historico_cria" on store.production_stage_history;
create policy "producao_historico_cria" on store.production_stage_history
  for insert with check (store.is_staff());

drop policy if exists "estoque_leitura" on store.stock_items;
create policy "estoque_leitura" on store.stock_items
  for select using (store.is_staff());
drop policy if exists "estoque_admin" on store.stock_items;
create policy "estoque_admin" on store.stock_items
  for all using (store.is_admin()) with check (store.is_admin());

drop policy if exists "movimentacoes_leitura" on store.stock_movements;
create policy "movimentacoes_leitura" on store.stock_movements
  for select using (store.is_staff());
drop policy if exists "movimentacoes_escrita" on store.stock_movements;
create policy "movimentacoes_escrita" on store.stock_movements
  for insert with check (store.is_staff());

drop policy if exists "materiais_produto_leitura" on store.product_materials;
create policy "materiais_produto_leitura" on store.product_materials
  for select using (store.is_staff());
drop policy if exists "materiais_produto_admin" on store.product_materials;
create policy "materiais_produto_admin" on store.product_materials
  for all using (store.is_admin()) with check (store.is_admin());

-- -----------------------------------------------------------------------------
-- FINANCEIRO
-- -----------------------------------------------------------------------------

drop policy if exists "financeiro_admin" on store.finance_entries;
create policy "financeiro_admin" on store.finance_entries
  for all using (store.is_admin()) with check (store.is_admin());

drop policy if exists "comissoes_proprias" on store.commissions;
create policy "comissoes_proprias" on store.commissions
  for select using (profile_id = auth.uid() or store.is_admin());
drop policy if exists "comissoes_admin" on store.commissions;
create policy "comissoes_admin" on store.commissions
  for all using (store.is_admin()) with check (store.is_admin());

drop policy if exists "creditos_proprios" on store.credits;
create policy "creditos_proprios" on store.credits
  for select using (profile_id = auth.uid() or store.is_admin());
drop policy if exists "creditos_admin" on store.credits;
create policy "creditos_admin" on store.credits
  for all using (store.is_admin()) with check (store.is_admin());

-- Cupons: a validação acontece no servidor; o cliente não lista cupons.
drop policy if exists "cupons_equipe" on store.coupons;
create policy "cupons_equipe" on store.coupons
  for select using (store.is_staff());
drop policy if exists "cupons_admin" on store.coupons;
create policy "cupons_admin" on store.coupons
  for all using (store.is_admin()) with check (store.is_admin());

drop policy if exists "uso_cupom_leitura" on store.coupon_uses;
create policy "uso_cupom_leitura" on store.coupon_uses
  for select using (profile_id = auth.uid() or store.is_staff());
drop policy if exists "uso_cupom_admin" on store.coupon_uses;
create policy "uso_cupom_admin" on store.coupon_uses
  for all using (store.is_admin()) with check (store.is_admin());

drop policy if exists "indicacoes_proprias" on store.referrals;
create policy "indicacoes_proprias" on store.referrals
  for all using (referrer_id = auth.uid() or store.is_admin())
  with check (referrer_id = auth.uid() or store.is_admin());

-- -----------------------------------------------------------------------------
-- ATENDIMENTO
-- -----------------------------------------------------------------------------

drop policy if exists "chamados_leitura" on store.tickets;
create policy "chamados_leitura" on store.tickets
  for select using (
    store.is_admin()
    or profile_id = auth.uid()
    or assigned_to = auth.uid()
    or (store.auth_role() = 'vendedor' and store.can_access_customer(customer_id))
  );
drop policy if exists "chamados_cria" on store.tickets;
create policy "chamados_cria" on store.tickets
  for insert with check (profile_id = auth.uid() or store.is_staff());
drop policy if exists "chamados_atualiza" on store.tickets;
create policy "chamados_atualiza" on store.tickets
  for update using (store.is_staff() or profile_id = auth.uid());

drop policy if exists "mensagens_leitura" on store.messages;
create policy "mensagens_leitura" on store.messages
  for select using (
    store.is_staff()
    or (internal = false and (
      author_id = auth.uid()
      or exists (select 1 from store.tickets t where t.id = ticket_id and t.profile_id = auth.uid())
      or exists (select 1 from store.orders o where o.id = order_id
                 and (o.profile_id = auth.uid() or o.reseller_id = auth.uid()))
      or exists (select 1 from store.quotes q where q.id = quote_id
                 and (q.profile_id = auth.uid() or q.reseller_id = auth.uid() or q.created_by = auth.uid()))
    ))
  );
drop policy if exists "mensagens_cria" on store.messages;
create policy "mensagens_cria" on store.messages
  for insert with check (
    author_id = auth.uid()
    and (
      store.is_staff()
      or (internal = false and (
        exists (select 1 from store.tickets t where t.id = ticket_id and t.profile_id = auth.uid())
        or exists (select 1 from store.orders o where o.id = order_id
                   and (o.profile_id = auth.uid() or o.reseller_id = auth.uid()))
        or exists (select 1 from store.quotes q where q.id = quote_id
                   and (q.profile_id = auth.uid() or q.reseller_id = auth.uid() or q.created_by = auth.uid()))
      ))
    )
  );

drop policy if exists "respostas_rapidas_equipe" on store.quick_replies;
create policy "respostas_rapidas_equipe" on store.quick_replies
  for select using (store.is_staff());
drop policy if exists "respostas_rapidas_admin" on store.quick_replies;
create policy "respostas_rapidas_admin" on store.quick_replies
  for all using (store.is_admin()) with check (store.is_admin());

-- -----------------------------------------------------------------------------
-- CRM
-- -----------------------------------------------------------------------------

drop policy if exists "oportunidades_leitura" on store.opportunities;
create policy "oportunidades_leitura" on store.opportunities
  for select using (
    store.is_admin() or (store.auth_role() = 'vendedor' and seller_id = auth.uid())
  );
drop policy if exists "oportunidades_escrita" on store.opportunities;
create policy "oportunidades_escrita" on store.opportunities
  for all using (
    store.is_admin() or (store.auth_role() = 'vendedor' and seller_id = auth.uid())
  )
  with check (
    store.is_admin() or (store.auth_role() = 'vendedor' and seller_id = auth.uid())
  );

drop policy if exists "atividades_oportunidade" on store.opportunity_activities;
create policy "atividades_oportunidade" on store.opportunity_activities
  for all using (
    store.is_admin()
    or exists (select 1 from store.opportunities o where o.id = opportunity_id and o.seller_id = auth.uid())
  )
  with check (
    store.is_admin()
    or exists (select 1 from store.opportunities o where o.id = opportunity_id and o.seller_id = auth.uid())
  );

drop policy if exists "descontos_leitura" on store.discount_requests;
create policy "descontos_leitura" on store.discount_requests
  for select using (requested_by = auth.uid() or store.is_admin());
drop policy if exists "descontos_cria" on store.discount_requests;
create policy "descontos_cria" on store.discount_requests
  for insert with check (requested_by = auth.uid());
drop policy if exists "descontos_admin" on store.discount_requests;
create policy "descontos_admin" on store.discount_requests
  for all using (store.is_admin()) with check (store.is_admin());

drop policy if exists "limite_credito_leitura" on store.credit_requests;
create policy "limite_credito_leitura" on store.credit_requests
  for select using (profile_id = auth.uid() or store.is_admin());
drop policy if exists "limite_credito_cria" on store.credit_requests;
create policy "limite_credito_cria" on store.credit_requests
  for insert with check (profile_id = auth.uid());
drop policy if exists "limite_credito_admin" on store.credit_requests;
create policy "limite_credito_admin" on store.credit_requests
  for all using (store.is_admin()) with check (store.is_admin());

-- -----------------------------------------------------------------------------
-- SISTEMA
-- -----------------------------------------------------------------------------

drop policy if exists "notificacoes_proprias" on store.notifications;
create policy "notificacoes_proprias" on store.notifications
  for select using (profile_id = auth.uid() or store.is_admin());
drop policy if exists "notificacoes_marca_lida" on store.notifications;
create policy "notificacoes_marca_lida" on store.notifications
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());
drop policy if exists "notificacoes_admin" on store.notifications;
create policy "notificacoes_admin" on store.notifications
  for all using (store.is_admin()) with check (store.is_admin());

drop policy if exists "logs_admin" on store.activity_logs;
create policy "logs_admin" on store.activity_logs
  for select using (store.is_admin());
drop policy if exists "logs_registra" on store.activity_logs;
create policy "logs_registra" on store.activity_logs
  for insert with check (auth.uid() is not null);

drop policy if exists "modelos_pedido_proprios" on store.order_templates;
create policy "modelos_pedido_proprios" on store.order_templates
  for all using (profile_id = auth.uid() or store.is_admin())
  with check (profile_id = auth.uid() or store.is_admin());

-- Materiais comerciais: apenas revendedores aprovados e equipe.
drop policy if exists "materiais_comerciais_leitura" on store.marketing_assets;
create policy "materiais_comerciais_leitura" on store.marketing_assets
  for select using (
    active = true and (store.is_staff() or store.is_reseller())
  );
drop policy if exists "materiais_comerciais_admin" on store.marketing_assets;
create policy "materiais_comerciais_admin" on store.marketing_assets
  for all using (store.is_admin()) with check (store.is_admin());
