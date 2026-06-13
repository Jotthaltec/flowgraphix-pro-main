-- Editor Avançado de Produtos & Serviços
-- Armazena toda a configuração avançada do editor (preços extras, marketplace por
-- plataforma, produção, regras comerciais, histórico, etc.) em uma única coluna JSONB
-- para não exigir dezenas de colunas. Os campos "core" continuam em colunas reais.
alter table public.products add column if not exists editor_meta jsonb default '{}'::jsonb;

-- Relaxa as restrições de tipo e origem para suportar os novos tipos/origens do editor.
alter table public.products drop constraint if exists products_type_check;
alter table public.products add constraint products_type_check
  check (type in ('product', 'service', 'kit', 'art', 'finishing'));

alter table public.products drop constraint if exists products_origin_check;
alter table public.products add constraint products_origin_check
  check (origin in ('manual', 'supplier_import', 'marketplace', 'production'));
