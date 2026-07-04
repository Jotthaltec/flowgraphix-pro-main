-- ============================================================================
-- Fase 2 — Perfis de Fornecedor (Cadastro Automático)
-- Tabela supplier_accounts: dados de cadastro da gráfica em cada fornecedor
-- + credenciais de login cifradas (nunca expostas ao front via SELECT normal).
-- ============================================================================

-- Habilitar extensão pgcrypto para criptografia simétrica
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── Tabela principal ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.supplier_accounts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  supplier_id           UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,

  -- Dados de cadastro da gráfica neste fornecedor
  registration_name     TEXT,                        -- nome fantasia / razão social usado no cadastro
  registration_cnpj     TEXT,                        -- CNPJ usado no cadastro
  registration_email    TEXT,                        -- e-mail de contato para o fornecedor
  registration_phone    TEXT,                        -- telefone para o fornecedor

  -- Credenciais de acesso ao site do fornecedor (write-only pelo front)
  login_username        TEXT,                        -- usuário/login no site do fornecedor
  login_password_enc    TEXT,                        -- SENHA CIFRADA — nunca lida pelo front

  -- Endereço de entrega preferido para este fornecedor
  -- (null = usar o padrão da empresa)
  delivery_override     BOOLEAN DEFAULT FALSE,       -- TRUE = usa endereço abaixo; FALSE = usa da empresa
  delivery_recipient    TEXT,
  delivery_zip          TEXT,
  delivery_address      TEXT,
  delivery_number       TEXT,
  delivery_complement   TEXT,
  delivery_neighborhood TEXT,
  delivery_city         TEXT,
  delivery_state        TEXT,
  delivery_phone        TEXT,

  -- Modo de recebimento específico para este fornecedor
  -- NULL = herda o padrão de companies.default_receiving_mode
  receiving_mode        TEXT CHECK (receiving_mode IN ('delivery', 'pickup')),
  preferred_pickup_point TEXT,

  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Uma conta por empresa × fornecedor
  UNIQUE (company_id, supplier_id)
);

-- ─── Índices ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_supplier_accounts_company
  ON public.supplier_accounts (company_id);

CREATE INDEX IF NOT EXISTS idx_supplier_accounts_supplier
  ON public.supplier_accounts (supplier_id);

-- ─── Trigger updated_at ─────────────────────────────────────────────────────
CREATE TRIGGER trg_supplier_accounts_updated
  BEFORE UPDATE ON public.supplier_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── Row Level Security ──────────────────────────────────────────────────────
ALTER TABLE public.supplier_accounts ENABLE ROW LEVEL SECURITY;

-- Cada empresa acessa apenas suas próprias contas
DROP POLICY IF EXISTS "sa owner select" ON public.supplier_accounts;
CREATE POLICY "sa owner select"
  ON public.supplier_accounts FOR SELECT
  USING (user_owns_company(company_id));

DROP POLICY IF EXISTS "sa owner insert" ON public.supplier_accounts;
CREATE POLICY "sa owner insert"
  ON public.supplier_accounts FOR INSERT
  WITH CHECK (user_owns_company(company_id));

DROP POLICY IF EXISTS "sa owner update" ON public.supplier_accounts;
CREATE POLICY "sa owner update"
  ON public.supplier_accounts FOR UPDATE
  USING (user_owns_company(company_id));

DROP POLICY IF EXISTS "sa owner delete" ON public.supplier_accounts;
CREATE POLICY "sa owner delete"
  ON public.supplier_accounts FOR DELETE
  USING (user_owns_company(company_id));

-- ─── View segura (sem login_password_enc) ────────────────────────────────────
-- O front sempre consulta esta view — a senha NUNCA é retornada
CREATE OR REPLACE VIEW public.supplier_accounts_safe AS
  SELECT
    id,
    company_id,
    supplier_id,
    registration_name,
    registration_cnpj,
    registration_email,
    registration_phone,
    login_username,
    -- login_password_enc OMITIDO INTENCIONALMENTE
    CASE WHEN login_password_enc IS NOT NULL
         THEN TRUE ELSE FALSE
    END AS has_password,
    delivery_override,
    delivery_recipient,
    delivery_zip,
    delivery_address,
    delivery_number,
    delivery_complement,
    delivery_neighborhood,
    delivery_city,
    delivery_state,
    delivery_phone,
    receiving_mode,
    preferred_pickup_point,
    notes,
    created_at,
    updated_at
  FROM public.supplier_accounts;

-- ─── Função RPC: upsert de conta (recebe senha em texto plano, cifra no banco)
-- O front chama esta função; a senha nunca fica exposta na query normal
CREATE OR REPLACE FUNCTION public.upsert_supplier_account(
  p_company_id            UUID,
  p_supplier_id           UUID,
  p_registration_name     TEXT DEFAULT NULL,
  p_registration_cnpj     TEXT DEFAULT NULL,
  p_registration_email    TEXT DEFAULT NULL,
  p_registration_phone    TEXT DEFAULT NULL,
  p_login_username        TEXT DEFAULT NULL,
  p_login_password        TEXT DEFAULT NULL,   -- senha em texto plano (cifrada aqui)
  p_delivery_override     BOOLEAN DEFAULT FALSE,
  p_delivery_recipient    TEXT DEFAULT NULL,
  p_delivery_zip          TEXT DEFAULT NULL,
  p_delivery_address      TEXT DEFAULT NULL,
  p_delivery_number       TEXT DEFAULT NULL,
  p_delivery_complement   TEXT DEFAULT NULL,
  p_delivery_neighborhood TEXT DEFAULT NULL,
  p_delivery_city         TEXT DEFAULT NULL,
  p_delivery_state        TEXT DEFAULT NULL,
  p_delivery_phone        TEXT DEFAULT NULL,
  p_receiving_mode        TEXT DEFAULT NULL,
  p_preferred_pickup_point TEXT DEFAULT NULL,
  p_notes                 TEXT DEFAULT NULL
)
RETURNS SETOF public.supplier_accounts_safe
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_enc_password TEXT;
  v_existing     UUID;
  v_result       public.supplier_accounts%ROWTYPE;
  v_enc_key      TEXT;
BEGIN
  -- Verificar se o usuário é dono da empresa
  IF NOT user_owns_company(p_company_id) THEN
    RAISE EXCEPTION 'Acesso negado: empresa não pertence ao usuário.';
  END IF;

  -- Obter chave de criptografia das configurações (fallback fixo para dev)
  BEGIN
    v_enc_key := current_setting('app.settings.encryption_key');
  EXCEPTION WHEN OTHERS THEN
    v_enc_key := 'flowgraphix_default_key_dev';
  END;

  -- Cifrar a senha se fornecida
  IF p_login_password IS NOT NULL AND p_login_password <> '' THEN
    v_enc_password := encode(
      pgp_sym_encrypt(p_login_password, v_enc_key),
      'base64'
    );
  END IF;

  -- Verificar se já existe registro para esta empresa+fornecedor
  SELECT id INTO v_existing
    FROM public.supplier_accounts
   WHERE company_id = p_company_id
     AND supplier_id = p_supplier_id;

  IF v_existing IS NOT NULL THEN
    -- UPDATE — senha só atualizada se nova foi fornecida
    UPDATE public.supplier_accounts SET
      registration_name      = COALESCE(p_registration_name, registration_name),
      registration_cnpj      = COALESCE(p_registration_cnpj, registration_cnpj),
      registration_email     = COALESCE(p_registration_email, registration_email),
      registration_phone     = COALESCE(p_registration_phone, registration_phone),
      login_username         = COALESCE(p_login_username, login_username),
      login_password_enc     = COALESCE(v_enc_password, login_password_enc),
      delivery_override      = p_delivery_override,
      delivery_recipient     = p_delivery_recipient,
      delivery_zip           = p_delivery_zip,
      delivery_address       = p_delivery_address,
      delivery_number        = p_delivery_number,
      delivery_complement    = p_delivery_complement,
      delivery_neighborhood  = p_delivery_neighborhood,
      delivery_city          = p_delivery_city,
      delivery_state         = p_delivery_state,
      delivery_phone         = p_delivery_phone,
      receiving_mode         = p_receiving_mode,
      preferred_pickup_point = p_preferred_pickup_point,
      notes                  = p_notes,
      updated_at             = NOW()
    WHERE id = v_existing;
  ELSE
    -- INSERT
    INSERT INTO public.supplier_accounts (
      company_id, supplier_id,
      registration_name, registration_cnpj, registration_email, registration_phone,
      login_username, login_password_enc,
      delivery_override, delivery_recipient, delivery_zip, delivery_address,
      delivery_number, delivery_complement, delivery_neighborhood,
      delivery_city, delivery_state, delivery_phone,
      receiving_mode, preferred_pickup_point, notes
    ) VALUES (
      p_company_id, p_supplier_id,
      p_registration_name, p_registration_cnpj, p_registration_email, p_registration_phone,
      p_login_username, v_enc_password,
      p_delivery_override, p_delivery_recipient, p_delivery_zip, p_delivery_address,
      p_delivery_number, p_delivery_complement, p_delivery_neighborhood,
      p_delivery_city, p_delivery_state, p_delivery_phone,
      p_receiving_mode, p_preferred_pickup_point, p_notes
    );
  END IF;

  -- Retornar o registro seguro (sem senha)
  RETURN QUERY
    SELECT * FROM public.supplier_accounts_safe
     WHERE company_id = p_company_id
       AND supplier_id = p_supplier_id;
END;
$$;

-- Revogar execução pública e liberar apenas para usuários autenticados
REVOKE ALL ON FUNCTION public.upsert_supplier_account FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_supplier_account TO authenticated;
