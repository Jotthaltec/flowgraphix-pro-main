-- =============================================================================
-- NUMERAÇÃO DE DOCUMENTOS DA LOJA
--
-- A migração 20260801000000 criou quatro sequências — order_number_seq,
-- quote_number_seq, ticket_number_seq, production_number_seq — e as colunas
-- `number` NOT NULL que deveriam consumi-las. O que nunca foi escrito é o elo
-- entre as duas coisas: não há default, não há trigger, e o app também não
-- envia o campo (src/lib/actions/orders.ts monta o insert sem `number`).
--
-- O resultado é que TODA venda é recusada pelo banco:
--
--   null value in column "number" of relation "orders" violates not-null
--
-- Isso vale para as quatro tabelas, ou seja: checkout do site, venda de balcão,
-- conversão de orçamento, formulário público de orçamento, abertura de chamado
-- pelo cliente e geração de ordem de produção. Nenhuma dessas operações grava
-- hoje. É o bloqueio de origem — os demais defeitos do sistema só aparecem
-- depois que este sai da frente.
--
-- Formato: PREFIXO-AA-NNNNN, com a sequência começando em 1000, o que produz
-- NP-26-01000, NP-26-01001... É o formato que a tela de rastreio já anuncia ao
-- cliente em src/app/(loja)/rastreio/page.tsx.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Uma função para as quatro tabelas
--
-- O prefixo e a sequência chegam por argumento do trigger em vez de virarem
-- quatro funções quase idênticas: a regra de formação do número é uma só, e
-- mudá-la (o dia em que o ano virar quatro dígitos, por exemplo) deve ser uma
-- edição em um lugar.
--
-- A função é `security definer` apenas para consumir as sequências sem expô-las
-- a `anon`/`authenticated`. Como é uma trigger function, não é uma RPC pública;
-- `search_path` vazio e nomes de sequência recebidos como `regclass` limitam a
-- superfície privilegiada ao preenchimento de `new.number`.
-- -----------------------------------------------------------------------------

create or replace function store.set_document_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Número informado explicitamente manda. É o que permite importar histórico
  -- e reprocessar um pedido antigo sem furar a sequência corrente.
  if new.number is not null and btrim(new.number) <> '' then
    return new;
  end if;

  new.number := tg_argv[0]
             || '-' || to_char(now(), 'YY')
             || '-' || lpad(nextval(tg_argv[1]::regclass)::text, 5, '0');

  return new;
end;
$$;

comment on function store.set_document_number() is
  'Preenche a coluna number no padrão PREFIXO-AA-NNNNN. Recebe prefixo e sequência por tg_argv, e respeita um número informado pelo chamador.';

revoke all on function store.set_document_number() from public, anon, authenticated;

-- Remove o gerador concorrente que existiu no rascunho do módulo de canais.
-- Manter dois BEFORE INSERT geraria dois formatos e consumiria duas sequências.
drop trigger if exists tr_generate_order_number on store.orders;
drop function if exists store.generate_order_number();
drop sequence if exists store.seq_order_number;

-- O grant histórico era amplo demais: quem insere um documento não precisa
-- poder avançar ou inspecionar as sequências diretamente.
revoke all on sequence
  store.order_number_seq,
  store.quote_number_seq,
  store.ticket_number_seq,
  store.production_number_seq
from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Os quatro gatilhos
-- -----------------------------------------------------------------------------

drop trigger if exists orders_set_number on store.orders;
create trigger orders_set_number
  before insert on store.orders
  for each row execute function store.set_document_number('NP', 'store.order_number_seq');

drop trigger if exists quotes_set_number on store.quotes;
create trigger quotes_set_number
  before insert on store.quotes
  for each row execute function store.set_document_number('ORC', 'store.quote_number_seq');

drop trigger if exists tickets_set_number on store.tickets;
create trigger tickets_set_number
  before insert on store.tickets
  for each row execute function store.set_document_number('CH', 'store.ticket_number_seq');

drop trigger if exists production_orders_set_number on store.production_orders;
create trigger production_orders_set_number
  before insert on store.production_orders
  for each row execute function store.set_document_number('OP', 'store.production_number_seq');
