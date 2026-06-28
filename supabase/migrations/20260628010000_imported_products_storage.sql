-- ============================================================================
-- Storage de imagens importadas (seção 17).
-- Bucket público "imported-products". Caminho:
--   {company_id}/imported-products/{product_id}/{arquivo}
-- Leitura pública (bucket public); escrita restrita ao dono da empresa (1ª
-- pasta do caminho = company_id), reaproveitando user_owns_company().
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('imported-products', 'imported-products', true)
on conflict (id) do nothing;

-- INSERT
drop policy if exists "imported-products insert" on storage.objects;
create policy "imported-products insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'imported-products'
    and user_owns_company(((storage.foldername(name))[1])::uuid)
  );

-- UPDATE
drop policy if exists "imported-products update" on storage.objects;
create policy "imported-products update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'imported-products'
    and user_owns_company(((storage.foldername(name))[1])::uuid)
  );

-- DELETE
drop policy if exists "imported-products delete" on storage.objects;
create policy "imported-products delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'imported-products'
    and user_owns_company(((storage.foldername(name))[1])::uuid)
  );
