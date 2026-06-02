# Auditoria do Projeto PrintFlow CRM V1

## 1. Estrutura do Projeto
- **Framework Principal:** TanStack Start (React 19 + Vite)
- **Roteamento:** `@tanstack/react-router`
- **Estilização:** Tailwind CSS + Radix UI (shadcn/ui)
- **Gerenciamento de Estado/Cache:** React Query (`@tanstack/react-query`)
- **Autenticação Atual:** Dependências do Supabase instaladas (`@supabase/supabase-js`), cliente configurado via Vite env vars, mas a interface carece de lógica multi-tenant funcional real.

## 2. Páginas e Rotas Existentes
- `/login`: Tela de login já estruturada.
- `/signup`: Tela de criação de conta.
- `/forgot-password`, `/reset-password`: Fluxos de recuperação de senha.
- `/_app/dashboard`: Painel principal com gráficos (Recharts) e cards estáticos.
- `/_app/clientes`: Listagem em tabela.
- `/_app/orcamentos`, `/_app/pedidos`, `/_app/producao`, `/_app/financeiro`, `/_app/custos`, `/_app/contratos`, `/_app/arquivos`, `/_app/leads`, `/_app/relatorios`, `/_app/configuracoes`: Telas preparadas visualmente mas com dados falsos e sem persistência.

## 3. Dados Mockados (Fake Data)
Identificados e listados para substituição por chamadas no Supabase:
- **Dashboard (`src/routes/_app/dashboard.tsx`):** Arrays estáticos como `sales`, `products`, `statusData`, `cards`, `activities`.
- **Clientes (`src/routes/_app/clientes.tsx`):** Array `clients`.
- **Orçamentos (`src/routes/_app/orcamentos.tsx`):** Array `data` (com número de orçamento, cliente e status variados).
- **Pedidos (`src/routes/_app/pedidos.tsx`):** Array `data` listando status financeiro e de produção em badges.

## 4. Botões sem Ação (Para implementar)
- Ações no cabeçalho das páginas (ex: "Novo cliente", "Novo pedido").
- Menus de contexto (3 pontinhos nas tabelas) para editar, apagar ou visualizar detalhes.
- Inputs de Busca e Selects de Filtros que não estão vinculados a um estado ou API.
- Ações de Kanban (arrastar cards) em Produção.

## 5. Plano de Conexão com Supabase
1. **Ambiente e Banco:** Criar migrações SQL contendo a nova estrutura do banco com suporte multi-empresa (tabelas `companies`, `profiles`, e relativas ao domínio) com proteção RLS ativada (`company_id`).
2. **Autenticação:** Finalizar fluxos conectando Login, Signup (criando empresa e perfil simultaneamente) e sessões protegidas.
3. **CRUDs:** Utilizar o cliente Supabase gerado em `/src/integrations/supabase/client.ts` com React Query para remover todos os arrays falsos das rotas.
4. **Arquivos:** Habilitar Storage (bucket `printflow-files`) para contratos e arquivos dos clientes.
5. **Automações e Edge Functions:** Prever integração futura com Google Places via Edge Function, garantindo segurança na API Key do mapa.
