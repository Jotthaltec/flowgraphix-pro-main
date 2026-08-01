-- =============================================================================
-- LIMPEZA DA INTEGRAÇÃO ANTIGA NO CRM
-- =============================================================================

DROP TRIGGER IF EXISTS clients_nexus_sync ON public.clients;
DROP TRIGGER IF EXISTS leads_nexus_sync ON public.leads;
DROP TRIGGER IF EXISTS quotes_nexus_sync ON public.quotes;
DROP TRIGGER IF EXISTS orders_nexus_sync ON public.orders;

DROP FUNCTION IF EXISTS public.enqueue_nexus_event;
DROP FUNCTION IF EXISTS public.purge_nexus_outbox;
DROP TABLE IF EXISTS public.nexus_outbox;
