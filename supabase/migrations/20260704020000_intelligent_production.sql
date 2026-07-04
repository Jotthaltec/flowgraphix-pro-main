-- ==========================================
-- ETAPA 3: BANCO DE DADOS - Módulo Inteligente de OP
-- ==========================================

-- 1. MOTOR UNIVERSAL DE PRODUTOS

CREATE TABLE public.technical_attribute_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.technical_attributes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    group_id UUID REFERENCES public.technical_attribute_groups(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    type TEXT NOT NULL, -- text, number, select, multiselect, boolean, file, color, dimension
    is_required BOOLEAN DEFAULT false,
    validation_rules JSONB DEFAULT '{}'::jsonb,
    default_value TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (company_id, code)
);

CREATE TABLE public.technical_attribute_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attribute_id UUID NOT NULL REFERENCES public.technical_attributes(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    value TEXT NOT NULL,
    color_code TEXT,
    order_index INTEGER DEFAULT 0
);

CREATE TABLE public.product_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Vincular product existente a um modelo técnico (opcional)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS model_id UUID REFERENCES public.product_models(id) ON DELETE SET NULL;

CREATE TABLE public.product_model_attributes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID NOT NULL REFERENCES public.product_models(id) ON DELETE CASCADE,
    attribute_id UUID NOT NULL REFERENCES public.technical_attributes(id) ON DELETE CASCADE,
    order_index INTEGER DEFAULT 0,
    conditional_rules JSONB DEFAULT '[]'::jsonb,
    UNIQUE (model_id, attribute_id)
);


-- 2. GESTÃO DE PRODUÇÃO (OP e Itens)

CREATE TABLE public.production_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL, -- Origem comercial
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    order_number TEXT NOT NULL, -- Gerado sequencialmente (ex: OP-2026-0001)
    status TEXT NOT NULL DEFAULT 'rascunho', -- rascunho, aprovado, em_producao, concluido, etc
    priority TEXT DEFAULT 'normal', -- baixa, normal, alta, urgente
    expected_delivery DATE,
    notes TEXT,
    version INTEGER DEFAULT 1,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (company_id, order_number)
);

CREATE TABLE public.production_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    production_order_id UUID NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_model_id UUID REFERENCES public.product_models(id) ON DELETE SET NULL,
    quantity NUMERIC DEFAULT 1 NOT NULL,
    status TEXT NOT NULL DEFAULT 'aguardando',
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.production_item_attributes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    production_order_item_id UUID NOT NULL REFERENCES public.production_order_items(id) ON DELETE CASCADE,
    attribute_id UUID NOT NULL REFERENCES public.technical_attributes(id) ON DELETE CASCADE,
    value TEXT, -- Pode guardar ID da option ou string literal
    version INTEGER DEFAULT 1,
    UNIQUE (production_order_item_id, attribute_id, version)
);


-- 3. FLUXOS, MÁQUINAS E RECURSOS

CREATE TABLE public.production_machines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT,
    capacity NUMERIC,
    cost_per_hour NUMERIC DEFAULT 0,
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE public.production_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    production_order_item_id UUID NOT NULL REFERENCES public.production_order_items(id) ON DELETE CASCADE,
    step_name TEXT NOT NULL, -- Arte, Pre_Impressao, Impressao, Acabamento, Expedicao
    status TEXT NOT NULL DEFAULT 'pendente', -- pendente, em_andamento, pausado, concluido
    machine_id UUID REFERENCES public.production_machines(id) ON DELETE SET NULL,
    operator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    estimated_time_minutes INTEGER,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.production_checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    model_id UUID REFERENCES public.product_models(id) ON DELETE CASCADE,
    step_name TEXT NOT NULL, -- Associa este checklist a qual etapa produtiva padrão
    question TEXT NOT NULL,
    is_required BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE public.production_checklist_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    step_id UUID NOT NULL REFERENCES public.production_steps(id) ON DELETE CASCADE,
    checklist_id UUID NOT NULL REFERENCES public.production_checklists(id) ON DELETE CASCADE,
    is_checked BOOLEAN DEFAULT false,
    notes TEXT,
    answered_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    answered_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (step_id, checklist_id)
);


-- 4. MATERIAIS E REFAÇÃO

CREATE TABLE public.production_materials_consumption (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    step_id UUID NOT NULL REFERENCES public.production_steps(id) ON DELETE CASCADE,
    material_name TEXT NOT NULL,
    estimated_qty NUMERIC DEFAULT 0,
    actual_qty NUMERIC DEFAULT 0,
    loss_qty NUMERIC DEFAULT 0,
    unit_cost NUMERIC DEFAULT 0,
    recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.production_reworks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    production_order_item_id UUID NOT NULL REFERENCES public.production_order_items(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    reported_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'pendente',
    created_at TIMESTAMPTZ DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

CREATE TABLE public.production_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    production_order_id UUID REFERENCES public.production_orders(id) ON DELETE CASCADE,
    production_order_item_id UUID REFERENCES public.production_order_items(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    old_status TEXT,
    new_status TEXT,
    notes TEXT,
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);


-- ==========================================
-- GERAÇÃO DE NUMERAÇÃO SEQUENCIAL
-- ==========================================
CREATE SEQUENCE IF NOT EXISTS seq_production_orders;

CREATE OR REPLACE FUNCTION generate_production_order_number()
RETURNS TRIGGER AS $$
DECLARE
    seq_val INT;
    year_val TEXT;
BEGIN
    IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
        year_val := to_char(CURRENT_DATE, 'YYYY');
        seq_val := nextval('seq_production_orders');
        NEW.order_number := 'OP-' || year_val || '-' || LPAD(seq_val::TEXT, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_production_order_number
BEFORE INSERT ON public.production_orders
FOR EACH ROW
EXECUTE FUNCTION generate_production_order_number();


-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

ALTER TABLE public.technical_attribute_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technical_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technical_attribute_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_model_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_item_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_checklist_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_materials_consumption ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_reworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_history ENABLE ROW LEVEL SECURITY;

-- Helper para evitar repetição massiva, baseia-se no auth_company() se o usuário envia isso no header, ou via tabela de profiles.
-- Como já existe profiles com company_id:
CREATE OR REPLACE FUNCTION get_auth_company_id() RETURNS UUID AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Exemplo RLS de company_id diretas:
CREATE POLICY "production_orders_isolation" ON public.production_orders
    FOR ALL
    USING (company_id = get_auth_company_id());

CREATE POLICY "technical_attribute_groups_isolation" ON public.technical_attribute_groups
    FOR ALL
    USING (company_id = get_auth_company_id());

CREATE POLICY "technical_attributes_isolation" ON public.technical_attributes
    FOR ALL
    USING (company_id = get_auth_company_id());

CREATE POLICY "product_models_isolation" ON public.product_models
    FOR ALL
    USING (company_id = get_auth_company_id());

CREATE POLICY "production_machines_isolation" ON public.production_machines
    FOR ALL
    USING (company_id = get_auth_company_id());

CREATE POLICY "production_checklists_isolation" ON public.production_checklists
    FOR ALL
    USING (company_id = get_auth_company_id());

-- Tabelas indiretas (via joins nas permissões para não quebrar cascade em leituras profundas ou RLS recursivos longos)
-- NOTA: Por performance no Supabase, muitas vezes tabelas filhas diretas checam o parent_id que checa o company_id.
-- Para produção item:
CREATE POLICY "production_order_items_isolation" ON public.production_order_items
    FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM public.production_orders po
        WHERE po.id = production_order_items.production_order_id
        AND po.company_id = get_auth_company_id()
      )
    );

CREATE POLICY "production_steps_isolation" ON public.production_steps
    FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM public.production_order_items poi
        JOIN public.production_orders po ON po.id = poi.production_order_id
        WHERE poi.id = production_steps.production_order_item_id
        AND po.company_id = get_auth_company_id()
      )
    );

CREATE POLICY "production_history_isolation" ON public.production_history
    FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM public.production_orders po
        WHERE po.id = production_history.production_order_id
        AND po.company_id = get_auth_company_id()
      )
    );

-- Para atributos filhos e model attributes que dependem de parents com RLS liberado:
CREATE POLICY "all_authenticated" ON public.technical_attribute_options FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "all_authenticated_model_attr" ON public.product_model_attributes FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "all_authenticated_item_attr" ON public.production_item_attributes FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "all_authenticated_chk_answ" ON public.production_checklist_answers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "all_authenticated_mat" ON public.production_materials_consumption FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "all_authenticated_rew" ON public.production_reworks FOR ALL USING (auth.role() = 'authenticated');

-- Indexes para performance
CREATE INDEX IF NOT EXISTS idx_tech_attr_comp ON public.technical_attributes(company_id);
CREATE INDEX IF NOT EXISTS idx_po_comp ON public.production_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_po_quote ON public.production_orders(quote_id);
CREATE INDEX IF NOT EXISTS idx_op_poi_po ON public.production_order_items(production_order_id);
CREATE INDEX IF NOT EXISTS idx_op_ps_poi ON public.production_steps(production_order_item_id);
CREATE INDEX IF NOT EXISTS idx_op_pia_poi ON public.production_item_attributes(production_order_item_id);
