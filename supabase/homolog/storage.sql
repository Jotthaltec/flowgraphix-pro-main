-- Buckets e políticas de storage da produção, para a homologação local.
-- Extraído de gkbbzypdakjrvxwvfjlc em 30/09/2026 (storage.buckets e
-- pg_policies de storage.objects). O dump dos schemas da aplicação não
-- carrega o schema storage. Idempotente.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('artes', 'artes', false, 52428800, '{application/pdf,image/png,image/jpeg,image/webp,image/tiff,application/postscript,image/vnd.adobe.photoshop,application/zip,application/octet-stream}') on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('documentos', 'documentos', false, 52428800, '{application/pdf,image/png,image/jpeg,image/webp,application/zip}') on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('imported-products', 'imported-products', true, null, null) on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('publico', 'publico', true, 10485760, '{image/png,image/jpeg,image/webp,image/svg+xml,image/avif}') on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists artes_atualiza_proprio on storage.objects;
drop policy if exists artes_envia_proprio on storage.objects;
drop policy if exists artes_le_proprio on storage.objects;
drop policy if exists artes_remove_proprio on storage.objects;
drop policy if exists documentos_atualiza on storage.objects;
drop policy if exists documentos_escrita on storage.objects;
drop policy if exists documentos_leitura on storage.objects;
drop policy if exists documentos_remove on storage.objects;
drop policy if exists "imported-products delete" on storage.objects;
drop policy if exists "imported-products insert" on storage.objects;
drop policy if exists "imported-products select" on storage.objects;
drop policy if exists "imported-products update" on storage.objects;
drop policy if exists publico_atualiza_admin on storage.objects;
drop policy if exists publico_escrita_admin on storage.objects;
drop policy if exists publico_leitura on storage.objects;
drop policy if exists publico_remove_admin on storage.objects;

create policy artes_atualiza_proprio on storage.objects as permissive for update to authenticated using (((bucket_id = 'artes'::text) and (((storage.foldername(name))[1] = (( select auth.uid() as uid))::text) or store.is_staff()))) with check (((bucket_id = 'artes'::text) and (((storage.foldername(name))[1] = (( select auth.uid() as uid))::text) or store.is_staff())));
create policy artes_envia_proprio on storage.objects as permissive for insert to authenticated with check (((bucket_id = 'artes'::text) and (((storage.foldername(name))[1] = (( select auth.uid() as uid))::text) or store.is_staff())));
create policy artes_le_proprio on storage.objects as permissive for select to authenticated using (((bucket_id = 'artes'::text) and (((storage.foldername(name))[1] = (( select auth.uid() as uid))::text) or store.is_staff())));
create policy artes_remove_proprio on storage.objects as permissive for delete to authenticated using (((bucket_id = 'artes'::text) and (((storage.foldername(name))[1] = (( select auth.uid() as uid))::text) or store.is_admin())));
create policy documentos_atualiza on storage.objects as permissive for update to authenticated using (((bucket_id = 'documentos'::text) and (store.is_admin() or ((storage.foldername(name))[1] = (( select auth.uid() as uid))::text)))) with check (((bucket_id = 'documentos'::text) and (store.is_admin() or ((storage.foldername(name))[1] = (( select auth.uid() as uid))::text))));
create policy documentos_escrita on storage.objects as permissive for insert to authenticated with check (((bucket_id = 'documentos'::text) and (store.is_admin() or ((storage.foldername(name))[1] = (( select auth.uid() as uid))::text))));
create policy documentos_leitura on storage.objects as permissive for select to authenticated using (((bucket_id = 'documentos'::text) and (store.is_staff() or ((storage.foldername(name))[1] = (( select auth.uid() as uid))::text) or (exists ( select 1 from store.marketing_assets a where ((a.storage_path = objects.name) and a.active and ((not a.whitelabel) or (exists ( select 1 from store.reseller_profiles r where ((r.profile_id = ( select auth.uid() as uid)) and r.approved and r.allow_whitelabel))))))))));
create policy documentos_remove on storage.objects as permissive for delete to authenticated using (((bucket_id = 'documentos'::text) and (store.is_admin() or ((storage.foldername(name))[1] = (( select auth.uid() as uid))::text))));
create policy "imported-products delete" on storage.objects as permissive for delete to authenticated using (((bucket_id = 'imported-products'::text) and public.user_owns_company(((storage.foldername(name))[1])::uuid)));
create policy "imported-products insert" on storage.objects as permissive for insert to authenticated with check (((bucket_id = 'imported-products'::text) and public.user_owns_company(((storage.foldername(name))[1])::uuid)));
create policy "imported-products select" on storage.objects as permissive for select to authenticated using (case when (bucket_id <> 'imported-products'::text) then false when ((storage.foldername(name))[1] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text) then false else public.user_owns_company(((storage.foldername(name))[1])::uuid) end);
create policy "imported-products update" on storage.objects as permissive for update to authenticated using (((bucket_id = 'imported-products'::text) and public.user_owns_company(((storage.foldername(name))[1])::uuid)));
create policy publico_atualiza_admin on storage.objects as permissive for update to authenticated using (((bucket_id = 'publico'::text) and store.is_admin())) with check (((bucket_id = 'publico'::text) and store.is_admin()));
create policy publico_escrita_admin on storage.objects as permissive for insert to authenticated with check (((bucket_id = 'publico'::text) and store.is_admin()));
create policy publico_leitura on storage.objects as permissive for select to anon, authenticated using ((bucket_id = 'publico'::text));
create policy publico_remove_admin on storage.objects as permissive for delete to authenticated using (((bucket_id = 'publico'::text) and store.is_admin()));
