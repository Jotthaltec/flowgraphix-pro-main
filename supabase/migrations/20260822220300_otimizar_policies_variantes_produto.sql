-- Evita duas policies permissivas para o mesmo SELECT. A policy de leitura já
-- contempla equipe/admin; as policies administrativas ficam por operação.

create index if not exists product_variants_product_idx
  on public.product_variants(product_id);

drop policy if exists "variantes_admin" on store.product_variants;
drop policy if exists "variantes_admin_inserir" on store.product_variants;
create policy "variantes_admin_inserir" on store.product_variants
  for insert to authenticated
  with check ((select store.is_admin()));
drop policy if exists "variantes_admin_atualizar" on store.product_variants;
create policy "variantes_admin_atualizar" on store.product_variants
  for update to authenticated
  using ((select store.is_admin()))
  with check ((select store.is_admin()));
drop policy if exists "variantes_admin_excluir" on store.product_variants;
create policy "variantes_admin_excluir" on store.product_variants
  for delete to authenticated
  using ((select store.is_admin()));

drop policy if exists "tiragens_variante_admin" on store.product_variant_price_tiers;
drop policy if exists "tiragens_variante_admin_inserir" on store.product_variant_price_tiers;
create policy "tiragens_variante_admin_inserir" on store.product_variant_price_tiers
  for insert to authenticated
  with check ((select store.is_admin()));
drop policy if exists "tiragens_variante_admin_atualizar" on store.product_variant_price_tiers;
create policy "tiragens_variante_admin_atualizar" on store.product_variant_price_tiers
  for update to authenticated
  using ((select store.is_admin()))
  with check ((select store.is_admin()));
drop policy if exists "tiragens_variante_admin_excluir" on store.product_variant_price_tiers;
create policy "tiragens_variante_admin_excluir" on store.product_variant_price_tiers
  for delete to authenticated
  using ((select store.is_admin()));
