-- Copia de imagens do importador para o Storage nunca funcionou: o bucket
-- imported-products tinha politicas de INSERT/UPDATE/DELETE, mas nenhuma de
-- SELECT. A API do Storage le a linha recem-gravada (insert ... returning) e,
-- sem SELECT, todo upload falhava com "new row violates row-level security
-- policy". O importador caia no fallback e mantinha a URL do CDN do fornecedor.
--
-- A leitura PUBLICA dos arquivos continua pela URL publica do bucket; esta
-- politica so libera a leitura dos metadados para membros da empresa dona da
-- pasta ({company_id}/imported-products/...), a mesma regra das demais.

drop policy if exists "imported-products select" on storage.objects;
create policy "imported-products select"
  on storage.objects
  for select
  to authenticated
  -- CASE garante a ordem de avaliacao: o cast para uuid so roda em arquivos
  -- deste bucket com pasta em formato uuid. Sem isso, leituras de OUTROS
  -- buckets (ex.: "publico/banners/...") poderiam falhar no cast.
  using (
    case
      when bucket_id <> 'imported-products' then false
      when (storage.foldername(name))[1] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then false
      else public.user_owns_company(((storage.foldername(name))[1])::uuid)
    end
  );
