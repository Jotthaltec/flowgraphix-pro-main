-- Reversão de 20260930020000: gatilho de histórico original, sem cancel_order.
-- O site precisa voltar a cancelar pelos passos antigos (reverter o deploy junto).
--   psql "$SUPABASE_DB_URL" -1 -v ON_ERROR_STOP=1 -f <este arquivo>
--   delete from supabase_migrations.schema_migrations where version = '20260930020000';

drop function if exists store.cancel_order(uuid, text);

create or replace function store.log_order_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into store.order_status_history (order_id, from_status, to_status, note, changed_by)
    values (new.id, null, new.status, 'Pedido criado.', coalesce(auth.uid(), new.created_by));

  elsif new.status is distinct from old.status then
    insert into store.order_status_history (order_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, coalesce(auth.uid(), new.created_by));
  end if;

  return new;
end;
$$;
