-- APLICAR SOMENTE DEPOIS DO DEPLOY DO SITE (Nexus-Printi) que consulta as
-- variantes por campos explicitos (catalog.ts / pricing-server.ts). A versao
-- anterior do site usa select * e teria o carrinho quebrado por esta migration.
--
-- Colunas de origem das variantes nao sao lidas pela vitrine (a loja so
-- consulta os campos publicos). Visitantes e clientes nao podem le-las nem
-- pela API: o acesso por coluna substitui o acesso a tabela inteira.
revoke select on store.product_variants from anon, authenticated;
grant select (id, product_id, sku, selection, production_days, available, is_default, position, created_at, updated_at)
  on store.product_variants to anon, authenticated;
