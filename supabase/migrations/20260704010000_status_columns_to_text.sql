-- ============================================================================
-- Corrige incoerência CRÍTICA de status.
--
-- No banco ao vivo, as colunas de status foram criadas como enums Title Case
-- ("Aprovado", "Pedido criado"...), mas TODO o código da aplicação e as
-- migrations originais usam text minúsculo ("aprovado", "pedido_criado"). Com
-- isso, todo INSERT/UPDATE de status falhava em runtime com
-- "invalid input value for enum ...", quebrando os fluxos centrais (criar/
-- aprovar/converter orçamento, kanban de produção, contratos, leads).
--
-- Esta migration converte as 4 colunas para text (convenção do código),
-- normaliza os valores existentes e ajusta os defaults. Idempotente/segura:
-- só age se a coluna ainda for de um tipo diferente de text.
-- ============================================================================

do $$
begin
  -- quotes.status ------------------------------------------------------------
  if (select data_type from information_schema.columns
        where table_schema='public' and table_name='quotes' and column_name='status') <> 'text' then
    alter table public.quotes alter column status drop default;
    alter table public.quotes alter column status type text using status::text;
  end if;
  update public.quotes set status = case status
    when 'Rascunho' then 'rascunho'
    when 'Enviado' then 'enviado'
    when 'Aguardando cliente' then 'aguardando_cliente'
    when 'Aprovado' then 'aprovado'
    when 'Recusado' then 'recusado'
    when 'Vencido' then 'vencido'
    when 'Convertido em pedido' then 'convertido_pedido'
    else status end
   where status ~ '[A-Z ]';
  alter table public.quotes alter column status set default 'rascunho';

  -- contracts.status ---------------------------------------------------------
  if (select data_type from information_schema.columns
        where table_schema='public' and table_name='contracts' and column_name='status') <> 'text' then
    alter table public.contracts alter column status drop default;
    alter table public.contracts alter column status type text using status::text;
  end if;
  update public.contracts set status = case status
    when 'Rascunho' then 'rascunho'
    when 'Enviado' then 'enviado'
    when 'Aguardando assinatura' then 'aguardando_assinatura'
    when 'Assinado' then 'assinado'
    when 'Cancelado' then 'cancelado'
    when 'Finalizado' then 'finalizado'
    else status end
   where status ~ '[A-Z ]';
  alter table public.contracts alter column status set default 'rascunho';

  -- leads.status -------------------------------------------------------------
  if (select data_type from information_schema.columns
        where table_schema='public' and table_name='leads' and column_name='status') <> 'text' then
    alter table public.leads alter column status drop default;
    alter table public.leads alter column status type text using status::text;
  end if;
  update public.leads set status = case status
    when 'Novo' then 'novo'
    when 'Contatado' then 'contatado'
    when 'Interessado' then 'interessado'
    when 'Orcamento enviado' then 'orcamento_enviado'
    when 'Fechado' then 'fechado'
    when 'Perdido' then 'perdido'
    else status end
   where status ~ '[A-Z ]';
  alter table public.leads alter column status set default 'novo';

  -- orders.production_status -------------------------------------------------
  if (select data_type from information_schema.columns
        where table_schema='public' and table_name='orders' and column_name='production_status') <> 'text' then
    alter table public.orders alter column production_status drop default;
    alter table public.orders alter column production_status type text using production_status::text;
  end if;
  update public.orders set production_status = case production_status
    when 'Pedido criado' then 'pedido_criado'
    when 'Arte pendente' then 'arte_pendente'
    when 'Arte em criacao' then 'arte_em_criacao'
    when 'Arte enviada' then 'arte_enviada'
    when 'Arte aprovada' then 'arte_aprovada'
    when 'Em producao' then 'em_producao'
    when 'Acabamento' then 'em_acabamento'
    when 'Pronto' then 'pronto'
    when 'Entregue' then 'entregue'
    when 'Cancelado' then 'cancelado'
    else production_status end
   where production_status ~ '[A-Z ]';
  alter table public.orders alter column production_status set default 'pedido_criado';
end $$;

-- Remove os enum types agora órfãos (tolerante a falha se algo ainda referenciar).
do $$
begin
  drop type if exists public.quote_status;
  drop type if exists public.contract_status;
  drop type if exists public.lead_status;
  drop type if exists public.production_status;
exception when others then null;
end $$;
