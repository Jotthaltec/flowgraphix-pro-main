-- Etapa 5: Ativar Row Level Security (RLS)

alter table companies enable row level security;
alter table profiles enable row level security;
alter table clients enable row level security;
alter table leads enable row level security;
alter table products enable row level security;
alter table quotes enable row level security;
alter table contracts enable row level security;
alter table orders enable row level security;
alter table payments enable row level security;
alter table production_tasks enable row level security;
alter table files enable row level security;
alter table activity_logs enable row level security;
alter table message_templates enable row level security;

-- Helper function para RLS
create or replace function get_user_company_id()
returns uuid
language sql
security definer
as $$
  select company_id from profiles where id = auth.uid()
$$;

-- Políticas Genéricas para Tabelas Multi-Tenant (exceto companies e profiles que precisam de regras especiais)
-- Exemplo: Um usuário autenticado pode acessar linhas onde company_id bate com seu perfil.

CREATE POLICY "Users can view their company" ON companies
  FOR SELECT USING (id = get_user_company_id());

CREATE POLICY "Users can update their company" ON companies
  FOR UPDATE USING (id = get_user_company_id());

CREATE POLICY "Users can view profiles of their company" ON profiles
  FOR SELECT USING (company_id = get_user_company_id());

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- Política Helper para geração de script (Aplicar para todas do domínio)
DO $$
DECLARE
    t_name text;
BEGIN
    FOR t_name IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name NOT IN ('companies', 'profiles')
    LOOP
        EXECUTE format('CREATE POLICY "Users can access data from their company" ON %I FOR ALL USING (company_id = get_user_company_id());', t_name);
    END LOOP;
END $$;
