-- Reversão de 20260929030100: para o processamento automático da fila.
-- Não remove a extensão pg_cron (outros jobs podem usá-la).
--   psql "$SUPABASE_DB_URL" -1 -v ON_ERROR_STOP=1 -f <este arquivo>
--   delete from supabase_migrations.schema_migrations where version = '20260929030100';
select cron.unschedule(jobid) from cron.job where jobname = 'store-product-sync-queue';
