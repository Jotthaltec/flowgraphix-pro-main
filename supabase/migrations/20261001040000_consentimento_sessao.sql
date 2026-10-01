-- =============================================================================
-- CONSENTIMENTO DEPOIS DA CHEGADA
--
-- O visitante chega pelo anúncio antes de responder ao aviso de cookies: o
-- proxy grava a sessão sem consentimento (correto). Sem esta função, aceitar
-- depois não mudava nada no servidor — a compra virava 'skipped' e _fbc/_fbp
-- criados pelo Pixel nunca chegavam à Conversions API.
--
-- Aceitar: marca a sessão, guarda user agent e _fbc/_fbp nos pontos de contato
-- da sessão e reabre eventos 'skipped' por falta de consentimento.
-- Recusar/revogar: apaga user agent, fbclid, fbc e fbp da sessão e segura
-- os eventos ainda não enviados.
-- =============================================================================

create or replace function store.record_marketing_consent(
  p_session_id uuid, p_ads_consent boolean, p_user_agent text default null,
  p_fbc text default null, p_fbp text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := public.crm_default_company();
  v_session_company uuid;
  v_fbc text := store.marketing_clean(p_fbc);
  v_fbp text := store.marketing_clean(p_fbp);
  v_link record;
begin
  if p_session_id is null or v_company is null then
    return false;
  end if;
  -- Só aceita os formatos documentados pela Meta (fb.<sub>.<ms>.<valor>).
  if v_fbc !~ '^fb\.[0-9]\.[0-9]{10,16}\.[A-Za-z0-9_-]{1,190}$' then v_fbc := null; end if;
  if v_fbp !~ '^fb\.[0-9]\.[0-9]{10,16}\.[0-9]{1,30}$' then v_fbp := null; end if;

  insert into store.marketing_sessions as s (id, company_id, ads_consent, client_user_agent)
  values (p_session_id, v_company, p_ads_consent, case when p_ads_consent then left(p_user_agent, 400) end)
  on conflict (id) do update set
    ads_consent = excluded.ads_consent,
    client_user_agent = case when excluded.ads_consent
                             then coalesce(excluded.client_user_agent, s.client_user_agent) end,
    last_seen_at = now()
  returning s.company_id into v_session_company;
  if v_session_company is distinct from v_company then
    raise exception 'Sessão pertence a outra empresa.' using errcode = '42501';
  end if;

  if p_ads_consent then
    -- Eventos segurados por revogação anterior voltam a poder sair.
    update store.conversion_events
       set skip_reason = 'sem_consentimento', updated_at = now()
     where session_id = p_session_id and status = 'skipped' and skip_reason = 'consentimento_revogado';
    update store.marketing_touchpoints
       set fbc = coalesce(fbc, v_fbc), fbp = coalesce(v_fbp, fbp)
     where session_id = p_session_id;
    -- Orçamento/pedido já ligado a esta sessão: o evento pode sair agora.
    for v_link in
      select subject_type, subject_id from store.marketing_session_links where session_id = p_session_id
    loop
      if v_link.subject_type = 'quote' then
        perform store.enqueue_lead_event(v_link.subject_id);
        perform store.enqueue_purchase_event(q.converted_order_id)
           from store.quotes q where q.id = v_link.subject_id and q.converted_order_id is not null;
      else
        perform store.enqueue_purchase_event(v_link.subject_id);
      end if;
    end loop;
  else
    update store.marketing_touchpoints
       set fbclid = null, fbc = null, fbp = null
     where session_id = p_session_id;
    -- O que ainda não saiu, não sai mais.
    update store.conversion_events
       set status = 'skipped', skip_reason = 'consentimento_revogado', payload = '{}'::jsonb, updated_at = now()
     where session_id = p_session_id and status in ('pending','in_progress');
  end if;
  return true;
end;
$$;
revoke all on function store.record_marketing_consent(uuid, boolean, text, text, text) from public, anon, authenticated;
grant execute on function store.record_marketing_consent(uuid, boolean, text, text, text) to service_role;
