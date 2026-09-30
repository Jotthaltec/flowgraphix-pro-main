-- A assinatura de conteúdo precisa ler colunas que a API não expõe.
--
-- 20260928140000 tirou de anon/authenticated a leitura de
-- store.product_variants.title, source_variant_id e source_external_id (a
-- origem no fornecedor). store.product_content_hash lê title e
-- source_external_id, e rodava com as permissões de quem consulta: toda
-- leitura de store.crm_product_sync_health e de public.site_products feita
-- pelo CRM falhava com "permission denied for table product_variants".
--
-- A função passa a rodar com as permissões do dono. Ela devolve só um SHA-256
-- (nenhum valor das colunas), então a restrição das colunas continua valendo
-- para todo o resto. Quem pode chamá-la não muda (authenticated, service_role).

alter function store.product_content_hash(uuid) security definer;
