-- Reversão de 20260929060000 (volta a quebrar a leitura do status pelo CRM).
--   psql "$SUPABASE_DB_URL" -1 -v ON_ERROR_STOP=1 -f <este arquivo>
--   delete from supabase_migrations.schema_migrations where version = '20260929060000';
alter function store.product_content_hash(uuid) security invoker;
