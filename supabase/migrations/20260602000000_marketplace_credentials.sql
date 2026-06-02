-- Tabela para armazenar credenciais de marketplace por empresa
CREATE TABLE IF NOT EXISTS marketplace_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,                -- 'mercado_livre', 'shopee', 'nuvemshop', 'woocommerce'
  credential_key TEXT NOT NULL DEFAULT '',-- Chave/token principal (API key, access_token)
  credential_secret TEXT DEFAULT '',     -- Secret/refresh_token quando aplicável
  extra_config JSONB DEFAULT '{}',       -- Ex: { "store_url": "https://..." } para WooCommerce
  status TEXT NOT NULL DEFAULT 'pending',-- 'connected', 'pending', 'expired', 'error'
  last_verified_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, platform)           -- Uma credencial por plataforma por empresa
);

-- Ativar Row Level Security
ALTER TABLE marketplace_credentials ENABLE ROW LEVEL SECURITY;

-- Políticas RLS: usando user_owns_company() como padrão do projeto
CREATE POLICY "owner comp select" ON marketplace_credentials FOR SELECT USING (user_owns_company(company_id));
CREATE POLICY "owner comp insert" ON marketplace_credentials FOR INSERT WITH CHECK (user_owns_company(company_id));
CREATE POLICY "owner comp update" ON marketplace_credentials FOR UPDATE USING (user_owns_company(company_id));
CREATE POLICY "owner comp delete" ON marketplace_credentials FOR DELETE USING (user_owns_company(company_id));

-- Trigger para atualizar updated_at automaticamente
CREATE TRIGGER trg_marketplace_credentials_updated
  BEFORE UPDATE ON marketplace_credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
