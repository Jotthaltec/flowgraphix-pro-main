-- ============================================================================
-- Fase 5 — Compra assistida (checkout guiado + registro da compra).
-- Ao concluir a compra no site do fornecedor, o operador registra de volta no
-- pedido de compra: número do pedido no fornecedor, custo realmente pago,
-- data da compra, previsão de entrega e rastreio. O painel de compra em si usa
-- dados já existentes (source_url dos itens + supplier_accounts_safe).
-- ============================================================================

alter table public.purchase_orders
  add column if not exists supplier_order_number text,   -- nº do pedido no site do fornecedor
  add column if not exists actual_cost           numeric, -- custo realmente pago (pode diferir do estimado)
  add column if not exists purchased_at          timestamptz,
  add column if not exists expected_delivery     date,
  add column if not exists tracking_code         text,
  add column if not exists purchase_notes        text;
