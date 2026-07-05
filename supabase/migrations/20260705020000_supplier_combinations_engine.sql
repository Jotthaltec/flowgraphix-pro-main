-- ============================================================================
-- MOTOR DE COMBINAÇÕES E PRECIFICAÇÃO DE FORNECEDORES
-- 
-- Cria a estrutura de dados para reproduzir o comportamento do configurador
-- da FuturaIM: combinações específicas de produto (material+formato+impressão
-- +enobrecimento+acabamento+quantidade) identificadas por código externo,
-- com preço oficial por combinação, extras variáveis, prazo, promoção,
-- snapshot imutável e testes de paridade.
--
-- Multi-tenant (company_id + RLS via user_owns_company). Idempotente.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. supplier_product_families — Produto principal do fornecedor
-- Ex.: "Cartão de Visita em Couché com Verniz Localizado"
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.supplier_product_families (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  supplier_id     UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  -- Vínculo opcional ao produto canônico do catálogo interno
  catalog_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  -- Identificação
  external_id     TEXT,                            -- id no site do fornecedor
  name            TEXT NOT NULL,                   -- nome completo do produto
  slug            TEXT,
  source_url      TEXT,                            -- URL original da página
  image_url       TEXT,
  description     TEXT,
  -- Configuração de cálculo
  lead_time_rule  TEXT NOT NULL DEFAULT 'max_extra' 
    CHECK (lead_time_rule IN ('max_extra','sum_extras','replace','custom')),
  pricing_strategy TEXT NOT NULL DEFAULT 'MATRIX'
    CHECK (pricing_strategy IN ('MATRIX','FORMULA','LIVE_RESOLVER')),
  -- Metadados
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  version         INTEGER NOT NULL DEFAULT 1,
  last_synced_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 2. supplier_option_groups — Eixos de configuração (na ordem do fornecedor)
-- Ex.: modelo → material → formato → impressão → enobrecimento → acabamento
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.supplier_option_groups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  family_id       UUID NOT NULL REFERENCES public.supplier_product_families(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,                   -- ex.: "Material"
  normalized_name TEXT NOT NULL,                   -- ex.: "material"
  code            TEXT NOT NULL,                   -- ex.: "MATERIAL"
  order_index     INTEGER NOT NULL DEFAULT 0,      -- ordem de seleção em cascata
  is_required     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 3. supplier_option_values — Valores de cada eixo
-- Ex.: Couché 300g, 88x48mm, 4x0, Verniz Localizado Frente
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.supplier_option_values (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  group_id        UUID NOT NULL REFERENCES public.supplier_option_groups(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,                   -- texto exibido
  normalized_name TEXT NOT NULL,                   -- versão normalizada para matching
  code            TEXT,                            -- código interno normalizado
  external_id     TEXT,                            -- id externo do fornecedor
  order_index     INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 4. supplier_combinations — Combinações válidas do fornecedor
-- Cada registro = 1 configuração comercializável com código externo
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.supplier_combinations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  family_id       UUID NOT NULL REFERENCES public.supplier_product_families(id) ON DELETE CASCADE,
  -- Identificação
  external_code   TEXT,                            -- código do fornecedor (ex.: 4601)
  combination_key TEXT NOT NULL,                   -- chave determinística (hash dos IDs das opções)
  source_url      TEXT,                            -- URL específica desta combinação
  -- Estado
  available       BOOLEAN NOT NULL DEFAULT TRUE,
  base_lead_time_days INTEGER,                     -- prazo base em dias úteis
  version         INTEGER NOT NULL DEFAULT 1,
  last_synced_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 5. supplier_combination_option_values — Junção N:N combinação ↔ opções
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.supplier_combination_option_values (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  combination_id  UUID NOT NULL REFERENCES public.supplier_combinations(id) ON DELETE CASCADE,
  option_value_id UUID NOT NULL REFERENCES public.supplier_option_values(id) ON DELETE CASCADE,
  UNIQUE (combination_id, option_value_id)
);

-- ---------------------------------------------------------------------------
-- 6. supplier_combination_prices — Preço por combinação + quantidade
-- O total importado do fornecedor é a fonte oficial.
-- unit_price_display é calculado apenas para apresentação.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.supplier_combination_prices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  combination_id  UUID NOT NULL REFERENCES public.supplier_combinations(id) ON DELETE CASCADE,
  -- Preços oficiais
  quantity        INTEGER NOT NULL,
  total_price     NUMERIC NOT NULL,                -- preço total oficial (fonte)
  normal_price    NUMERIC,                         -- preço normal (sem promoção)
  promotional_price NUMERIC,                       -- preço promocional quando ativo
  unit_price_display NUMERIC,                      -- total_price / quantity (exibição)
  currency        TEXT NOT NULL DEFAULT 'BRL',
  -- Estado
  available       BOOLEAN NOT NULL DEFAULT TRUE,
  version         INTEGER NOT NULL DEFAULT 1,
  collected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 7. supplier_extras — Acabamentos extras disponíveis
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.supplier_extras (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  family_id       UUID NOT NULL REFERENCES public.supplier_product_families(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  code            TEXT,
  extra_type      TEXT NOT NULL DEFAULT 'finishing'
    CHECK (extra_type IN ('finishing','cutting','lamination','coating','folding','binding','other')),
  description     TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 8. supplier_extra_compatibility — Regras de compatibilidade
-- NULL em combination_id = compatível com TODAS as combinações da família.
-- Filtros opcionais por material/formato/impressão.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.supplier_extra_compatibility (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  extra_id        UUID NOT NULL REFERENCES public.supplier_extras(id) ON DELETE CASCADE,
  combination_id  UUID REFERENCES public.supplier_combinations(id) ON DELETE CASCADE,
  -- Filtros opcionais (JSONB arrays de option_value_ids)
  material_filter JSONB,                           -- se não null, só compatível com estes materiais
  format_filter   JSONB,
  print_filter    JSONB,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 9. supplier_extra_prices — Preço do extra por compatibilidade + quantidade
-- Ex.: Corte Personalizado para 500un = R$ 15, para 5000un = R$ 35
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.supplier_extra_prices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  extra_id        UUID NOT NULL REFERENCES public.supplier_extras(id) ON DELETE CASCADE,
  compatibility_id UUID REFERENCES public.supplier_extra_compatibility(id) ON DELETE CASCADE,
  quantity        INTEGER NOT NULL,
  price           NUMERIC NOT NULL,
  additional_days INTEGER NOT NULL DEFAULT 0,
  available       BOOLEAN NOT NULL DEFAULT TRUE,
  collected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 10. supplier_services — Serviços complementares
-- Ex.: Criação de Arte, Revisão de Arquivo, Conferência
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.supplier_services (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  supplier_id     UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  code            TEXT,
  description     TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 11. supplier_service_prices — Preço do serviço por produto/combinação
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.supplier_service_prices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  service_id      UUID NOT NULL REFERENCES public.supplier_services(id) ON DELETE CASCADE,
  family_id       UUID REFERENCES public.supplier_product_families(id) ON DELETE CASCADE,
  combination_id  UUID REFERENCES public.supplier_combinations(id) ON DELETE CASCADE,
  price           NUMERIC NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'BRL',
  collected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 12. supplier_custom_size_rules — Regras de tamanho personalizado
-- Estratégias: MATRIX, FORMULA, LIVE_RESOLVER
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.supplier_custom_size_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  family_id       UUID NOT NULL REFERENCES public.supplier_product_families(id) ON DELETE CASCADE,
  -- Limites
  min_width       NUMERIC,
  max_width       NUMERIC,
  min_height      NUMERIC,
  max_height      NUMERIC,
  min_area        NUMERIC,
  -- Preço
  min_price       NUMERIC,
  -- Arredondamento
  rounding_width  NUMERIC,                         -- arredonda largura para múltiplo de
  rounding_height NUMERIC,
  rounding_area   NUMERIC,
  -- Unidade e regra
  unit            TEXT DEFAULT 'm2',               -- m2, cm2, linear_m, un
  pricing_strategy TEXT NOT NULL DEFAULT 'LIVE_RESOLVER'
    CHECK (pricing_strategy IN ('MATRIX','FORMULA','LIVE_RESOLVER')),
  formula         TEXT,                            -- fórmula quando strategy=FORMULA
  price_ranges    JSONB DEFAULT '[]'::JSONB,       -- faixas quando strategy=MATRIX
  -- Config adicional
  bobbin_width    NUMERIC,                         -- largura de bobina (perda de material)
  fixed_production_cost NUMERIC,                   -- custo fixo de produção
  needs_live_query BOOLEAN NOT NULL DEFAULT FALSE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 13. supplier_price_snapshots — Cópia imutável ao salvar orçamento
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.supplier_price_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  quote_item_id   UUID,                            -- vinculado após salvar o quote_item
  -- Dados congelados
  supplier_id     UUID NOT NULL,
  supplier_name   TEXT,
  family_id       UUID,
  family_name     TEXT,
  external_code   TEXT,
  combination_key TEXT,
  -- Opções selecionadas (snapshot completo)
  selected_options JSONB NOT NULL DEFAULT '[]'::JSONB,
  -- Preços congelados
  quantity        INTEGER NOT NULL,
  total_price     NUMERIC NOT NULL,
  normal_price    NUMERIC,
  promotional_price NUMERIC,
  unit_price_display NUMERIC,
  -- Extras congelados
  extras          JSONB NOT NULL DEFAULT '[]'::JSONB,
  extras_total    NUMERIC NOT NULL DEFAULT 0,
  -- Serviços congelados
  services        JSONB NOT NULL DEFAULT '[]'::JSONB,
  services_total  NUMERIC NOT NULL DEFAULT 0,
  -- Prazo
  base_lead_time_days INTEGER,
  extras_lead_time_days INTEGER,
  total_lead_time_days INTEGER,
  -- Frete
  freight_cost    NUMERIC,
  freight_method  TEXT,
  freight_zip     TEXT,
  freight_days    INTEGER,
  -- Cálculo decomposto
  supplier_product_cost NUMERIC NOT NULL,
  supplier_extras_cost NUMERIC NOT NULL DEFAULT 0,
  supplier_services_cost NUMERIC NOT NULL DEFAULT 0,
  supplier_freight_cost NUMERIC NOT NULL DEFAULT 0,
  total_supplier_cost NUMERIC NOT NULL,
  internal_operations_cost NUMERIC NOT NULL DEFAULT 0,
  internal_services_cost NUMERIC NOT NULL DEFAULT 0,
  tax_amount      NUMERIC NOT NULL DEFAULT 0,
  safety_margin_amount NUMERIC NOT NULL DEFAULT 0,
  profit_amount   NUMERIC NOT NULL DEFAULT 0,
  final_sale_price NUMERIC NOT NULL,
  margin_percent  NUMERIC,
  -- Promoção
  promo_campaign  TEXT,
  promo_origin    TEXT,
  promo_start     TIMESTAMPTZ,
  promo_end       TIMESTAMPTZ,
  -- Rastreabilidade
  source_url      TEXT,
  collected_at    TIMESTAMPTZ,
  snapshot_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 14. supplier_promotions — Expandir com vínculo por combinação
-- (Já existe; adicionamos colunas para vínculo refinado)
-- ---------------------------------------------------------------------------
ALTER TABLE public.supplier_promotions ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES public.supplier_product_families(id) ON DELETE CASCADE;
ALTER TABLE public.supplier_promotions ADD COLUMN IF NOT EXISTS combination_id UUID REFERENCES public.supplier_combinations(id) ON DELETE CASCADE;
ALTER TABLE public.supplier_promotions ADD COLUMN IF NOT EXISTS quantity INTEGER;
ALTER TABLE public.supplier_promotions ADD COLUMN IF NOT EXISTS campaign TEXT;
ALTER TABLE public.supplier_promotions ADD COLUMN IF NOT EXISTS origin TEXT;

-- ---------------------------------------------------------------------------
-- 15. supplier_calculation_tests — Casos de teste para paridade
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.supplier_calculation_tests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  family_id       UUID NOT NULL REFERENCES public.supplier_product_families(id) ON DELETE CASCADE,
  -- Configuração do teste
  name            TEXT,
  url             TEXT,
  external_code   TEXT,
  options         JSONB NOT NULL DEFAULT '{}'::JSONB,
  quantity        INTEGER NOT NULL,
  -- Valores esperados
  expected_price  NUMERIC NOT NULL,
  expected_extras JSONB DEFAULT '[]'::JSONB,
  expected_lead_time INTEGER,
  -- Estado
  last_result     TEXT DEFAULT 'pending'
    CHECK (last_result IN ('pending','passed','failed','error')),
  last_calculated_price NUMERIC,
  last_diff_amount NUMERIC,
  last_diff_percent NUMERIC,
  validated_at    TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 16. supplier_calculation_logs — Log de execução dos testes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.supplier_calculation_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  test_id         UUID NOT NULL REFERENCES public.supplier_calculation_tests(id) ON DELETE CASCADE,
  -- Resultado
  calculated_price NUMERIC,
  expected_price  NUMERIC,
  passed          BOOLEAN NOT NULL,
  diff_amount     NUMERIC,
  diff_percent    NUMERIC,
  -- Detalhes
  details         JSONB DEFAULT '{}'::JSONB,
  error_message   TEXT,
  -- Ação tomada
  action_taken    TEXT DEFAULT 'none'
    CHECK (action_taken IN ('none','auto_updated','flagged_review','blocked')),
  executed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  executed_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 17. Alterações em quote_items — Decomposição de custos
-- ---------------------------------------------------------------------------
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS combination_id UUID REFERENCES public.supplier_combinations(id) ON DELETE SET NULL;
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS combination_key TEXT;
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS external_code TEXT;

-- Decomposição do custo
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS supplier_product_cost NUMERIC DEFAULT 0;
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS supplier_extras_cost NUMERIC DEFAULT 0;
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS supplier_services_cost NUMERIC DEFAULT 0;
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS supplier_freight_cost NUMERIC DEFAULT 0;
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS internal_services_cost NUMERIC DEFAULT 0;
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS internal_operations_cost NUMERIC DEFAULT 0;
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS tax_amount NUMERIC DEFAULT 0;
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS safety_margin_amount NUMERIC DEFAULT 0;
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS profit_amount NUMERIC DEFAULT 0;

-- Modo e status
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS mirror_supplier_mode BOOLEAN DEFAULT FALSE;
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS price_status TEXT DEFAULT 'confirmed'
  CHECK (price_status IS NULL OR price_status IN ('confirmed','unconfirmed','outdated','revalidated'));
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS snapshot_id UUID REFERENCES public.supplier_price_snapshots(id) ON DELETE SET NULL;

-- Extras e serviços selecionados (JSONB arrays com id + nome + preço)
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS selected_extras JSONB DEFAULT '[]'::JSONB;
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS selected_services JSONB DEFAULT '[]'::JSONB;

-- ---------------------------------------------------------------------------
-- 18. Alterações em quotes — Revalidação
-- ---------------------------------------------------------------------------
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS revalidation_status TEXT DEFAULT 'not_required'
  CHECK (revalidation_status IS NULL OR revalidation_status IN ('not_required','pending','revalidated','changed','approved_override'));
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS revalidated_at TIMESTAMPTZ;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS revalidated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- ÍNDICES
-- ---------------------------------------------------------------------------

-- Famílias
CREATE INDEX IF NOT EXISTS idx_spf_supplier ON public.supplier_product_families (company_id, supplier_id);
CREATE INDEX IF NOT EXISTS idx_spf_external ON public.supplier_product_families (company_id, external_id);
CREATE INDEX IF NOT EXISTS idx_spf_catalog ON public.supplier_product_families (catalog_product_id);

-- Grupos de opções
CREATE INDEX IF NOT EXISTS idx_sog_family ON public.supplier_option_groups (family_id, order_index);

-- Valores de opções
CREATE INDEX IF NOT EXISTS idx_sov_group ON public.supplier_option_values (group_id, order_index);
CREATE INDEX IF NOT EXISTS idx_sov_external ON public.supplier_option_values (company_id, external_id);

-- Combinações
CREATE UNIQUE INDEX IF NOT EXISTS uq_sc_key ON public.supplier_combinations (company_id, family_id, combination_key);
CREATE INDEX IF NOT EXISTS idx_sc_external ON public.supplier_combinations (company_id, external_code);
CREATE INDEX IF NOT EXISTS idx_sc_family ON public.supplier_combinations (family_id, available);

-- Junção combinação ↔ opções (já tem UNIQUE acima)
CREATE INDEX IF NOT EXISTS idx_scov_combination ON public.supplier_combination_option_values (combination_id);
CREATE INDEX IF NOT EXISTS idx_scov_option ON public.supplier_combination_option_values (option_value_id);

-- Preços por combinação
CREATE INDEX IF NOT EXISTS idx_scp_combination ON public.supplier_combination_prices (combination_id, quantity);
CREATE UNIQUE INDEX IF NOT EXISTS uq_scp_combo_qty ON public.supplier_combination_prices (combination_id, quantity, version);

-- Extras
CREATE INDEX IF NOT EXISTS idx_se_family ON public.supplier_extras (family_id);
CREATE INDEX IF NOT EXISTS idx_sec_extra ON public.supplier_extra_compatibility (extra_id);
CREATE INDEX IF NOT EXISTS idx_sec_combination ON public.supplier_extra_compatibility (combination_id);
CREATE INDEX IF NOT EXISTS idx_sep_extra ON public.supplier_extra_prices (extra_id, quantity);

-- Serviços
CREATE INDEX IF NOT EXISTS idx_ss_supplier ON public.supplier_services (company_id, supplier_id);
CREATE INDEX IF NOT EXISTS idx_ssp_service ON public.supplier_service_prices (service_id);

-- Snapshots
CREATE INDEX IF NOT EXISTS idx_sps_quote_item ON public.supplier_price_snapshots (quote_item_id);
CREATE INDEX IF NOT EXISTS idx_sps_company ON public.supplier_price_snapshots (company_id, snapshot_at DESC);

-- Testes
CREATE INDEX IF NOT EXISTS idx_sct_family ON public.supplier_calculation_tests (family_id);
CREATE INDEX IF NOT EXISTS idx_scl_test ON public.supplier_calculation_logs (test_id, executed_at DESC);

-- Quote items (novas colunas)
CREATE INDEX IF NOT EXISTS idx_qi_combination ON public.quote_items (combination_id);
CREATE INDEX IF NOT EXISTS idx_qi_snapshot ON public.quote_items (snapshot_id);
CREATE INDEX IF NOT EXISTS idx_qi_price_status ON public.quote_items (price_status);

-- Promoções (novas colunas)
CREATE INDEX IF NOT EXISTS idx_sp_family ON public.supplier_promotions (family_id);
CREATE INDEX IF NOT EXISTS idx_sp_combination ON public.supplier_promotions (combination_id);

-- ---------------------------------------------------------------------------
-- RLS — Todas as novas tabelas via user_owns_company(company_id)
-- ---------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'supplier_product_families',
    'supplier_option_groups',
    'supplier_option_values',
    'supplier_combinations',
    'supplier_combination_prices',
    'supplier_extras',
    'supplier_extra_compatibility',
    'supplier_extra_prices',
    'supplier_services',
    'supplier_service_prices',
    'supplier_custom_size_rules',
    'supplier_price_snapshots',
    'supplier_calculation_tests',
    'supplier_calculation_logs'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS "owner company all" ON public.%I;', t);
    EXECUTE format(
      'CREATE POLICY "owner company all" ON public.%I FOR ALL USING (user_owns_company(company_id)) WITH CHECK (user_owns_company(company_id));',
      t
    );
  END LOOP;
END $$;

-- supplier_combination_option_values não tem company_id;
-- RLS via combinação → supplier_combinations.company_id
ALTER TABLE public.supplier_combination_option_values ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "via combination owner" ON public.supplier_combination_option_values;
CREATE POLICY "via combination owner" ON public.supplier_combination_option_values
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.supplier_combinations sc
      WHERE sc.id = supplier_combination_option_values.combination_id
        AND user_owns_company(sc.company_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.supplier_combinations sc
      WHERE sc.id = supplier_combination_option_values.combination_id
        AND user_owns_company(sc.company_id)
    )
  );
