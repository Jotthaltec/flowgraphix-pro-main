-- Reversão de 20260930030000: quadros de produção voltam a andar separados.
-- O CRM precisa voltar a gravar no espelho (reverter o deploy junto).
--   psql "$SUPABASE_DB_URL" -1 -v ON_ERROR_STOP=1 -f <este arquivo>
--   delete from supabase_migrations.schema_migrations where version = '20260930030000';
drop trigger if exists tr_sync_order_from_production on store.production_orders;
drop trigger if exists tr_finish_production_on_order_done on store.orders;
drop function if exists store.sync_order_from_production();
drop function if exists store.finish_production_on_order_done();
drop function if exists store.crm_move_order(uuid, text);
drop function if exists store.order_status_rank(text);
