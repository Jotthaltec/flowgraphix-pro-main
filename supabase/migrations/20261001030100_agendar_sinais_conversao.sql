-- Aciona o worker da Conversions API (rota do Flow) a cada minuto.
--
-- Separada de 20261001030000 para ser aplicada ou revertida sozinha: sem
-- este agendamento os eventos continuam entrando na fila e podem ser
-- despachados chamando a rota manualmente. Só chama a rota quando os sinais
-- estão ligados e há evento vencido, então não gera tráfego ocioso.
-- URL e segredo vêm do Vault ('marketing_dispatch_url', 'marketing_dispatch_secret');
-- sem eles, nada acontece.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create or replace function store.dispatch_conversion_events()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (
    select 1 from store.marketing_signal_settings s
     where s.company_id = public.crm_default_company() and s.enabled and s.pixel_id is not null
  ) then
    return false;
  end if;
  if not exists (
    select 1 from store.conversion_events e
     where (e.status = 'pending' and e.next_attempt_at <= now())
        or (e.status = 'in_progress' and e.locked_until < now())
  ) then
    return false;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets
   where name = 'marketing_dispatch_url' order by created_at desc limit 1;
  select decrypted_secret into v_secret from vault.decrypted_secrets
   where name = 'marketing_dispatch_secret' order by created_at desc limit 1;
  if coalesce(v_url, '') = '' or coalesce(v_secret, '') = '' then
    return false;
  end if;

  perform net.http_post(
    url := v_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 5000
  );
  return true;
end;
$$;
revoke all on function store.dispatch_conversion_events() from public, anon, authenticated;

select cron.schedule(
  'store-conversion-events-dispatch',
  '* * * * *',
  $job$select store.dispatch_conversion_events()$job$
);
