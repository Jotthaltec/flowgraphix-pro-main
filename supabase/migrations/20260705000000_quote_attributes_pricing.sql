-- ==========================================
-- MELHORIA DO SISTEMA DE ORÇAMENTOS
-- Suporte a variações/atributos no orçamento com impacto no preço
-- ==========================================

-- 1. Adicionar coluna de atributos escolhidos ao item do orçamento
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS item_attributes JSONB DEFAULT '{}'::jsonb;

-- 2. Adicionar impacto de preço nas opções dos atributos técnicos
-- Isso permite que cada opção (ex: "Papel Couchê 300g") tenha um custo associado do fornecedor
ALTER TABLE public.technical_attribute_options ADD COLUMN IF NOT EXISTS price_impact NUMERIC DEFAULT 0;
ALTER TABLE public.technical_attribute_options ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL;

-- 3. Adicionar campo de prazo e validade ao orçamento
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS valid_until DATE;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS delivery_days INTEGER;

-- 4. Índices para performance
CREATE INDEX IF NOT EXISTS idx_quote_items_quote ON public.quote_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_items_product ON public.quote_items(product_service_id);
CREATE INDEX IF NOT EXISTS idx_tech_attr_options_price ON public.technical_attribute_options(attribute_id, price_impact);
