-- =============================================================================
-- ORIGEM DO PEDIDO PARA MARKETPLACE
--
-- A fundação (20260816000001) decidiu que o pedido de canal aterrissa em
-- `store.orders`, e não em `public.orders`, porque só lá existem itens,
-- endereço, rastreio e fluxo de arte. Ao tentar gravar o primeiro pedido, duas
-- coisa impede a origem correta: `orders_source_check` não conhece venda por
-- canal. A numeração de todos os documentos já foi centralizada na migração
-- 20260816000002; este arquivo não cria outra sequência nem outro formato.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- ORIGEM DO PEDIDO
--
-- O check atual aceita 'loja', 'painel', 'vendedor', 'revendedor', 'orcamento'
-- e 'whatsapp'. Faltam a venda que veio de um canal externo e o balcão físico.
--
-- Entra UM valor — 'marketplace' — e não um por provedor. Qual canal foi está em
-- `channel_orders.channel_id`, com o id do pedido no provedor junto. Um valor por
-- provedor obrigaria uma migração a cada canal novo, que é exatamente o que o
-- desenho de adaptadores existe para evitar.
-- ─────────────────────────────────────────────────────────────────────────────
alter table store.orders drop constraint if exists orders_source_check;

alter table store.orders add constraint orders_source_check
  check (source in (
    'loja', 'painel', 'vendedor', 'revendedor', 'orcamento', 'whatsapp', 'marketplace', 'balcao'
  ));
