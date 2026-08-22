-- =============================================================================
-- CANAIS DE VENDA — FUNDAÇÃO
--
-- Este é o esqueleto do módulo de marketplaces: conectar uma conta de canal,
-- vincular anúncio ↔ produto, receber pedido e registrar tudo o que aconteceu.
-- Nenhum provedor específico entra aqui — Mercado Livre e Shopee são adaptadores
-- em cima destas tabelas, não colunas dentro delas. É o mesmo desenho do motor
-- de fornecedores (`supplier_mapping_profiles.adapter_key`), pelo mesmo motivo:
-- o segundo canal não pode custar uma migração de schema.
--
-- Três decisões que valem explicação, porque não são óbvias no SQL:
--
-- 1. SEGREDO FORA DO ALCANCE DO NAVEGADOR. `marketplace_credentials` (a tabela
--    que este arquivo aposenta) tinha policy de SELECT para o dono da empresa, e
--    o front lia a tabela com o client anônimo. Com token de mentira isso não
--    custava nada; com um access_token real do Mercado Livre, qualquer sessão
--    comprometida entrega a conta do marketplace. `channel_secrets` inverte a
--    regra: revoga o GRANT de `anon`/`authenticated` E liga RLS sem nenhuma
--    policy permissiva. As duas coisas juntas de propósito — GRANT sozinho é
--    frágil a um `alter default privileges` futuro, e RLS sozinho depende de o
--    `service_role` ser o único com bypassrls. O front nunca lê esta tabela; ele
--    lê a view `channel_status`.
--
-- 2. O PEDIDO NÃO MORA AQUI. `public.orders` é magra (sem tabela de itens, sem
--    endereço, sem rastreio) — o pedido de marketplace perderia informação nela.
--    Ele é gravado em `store.orders`/`store.order_items`, que já têm `source`,
--    `shipping_address`, `tracking_code` e `art_flow`, e sobe sozinho para o CRM
--    pelos triggers `tr_sync_customer_to_client` e `tr_sync_order_to_crm`
--    (20260801000001). `channel_orders` guarda só a ponte com o id externo.
--
-- 3. A FILA É TABELA, NÃO EXTENSÃO. Não há `pg_cron` nem `pg_net` neste projeto,
--    e webhook de marketplace precisa responder rápido — o Mercado Livre reenvia
--    a notificação se a resposta demorar, e processar dentro do webhook duplica
--    pedido. Então o webhook só enfileira; quem processa é o worker HTTP
--    (`/api/canais/worker`), chamado pelo cron da Vercel e logo após cada
--    notificação.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- CANAL CONECTADO
--
-- Uma linha por conta de canal. `external_account_id` é o id da conta no
-- provedor (user_id do ML, shop_id da Shopee) e entra na unicidade porque a
-- mesma empresa pode operar duas lojas no mesmo marketplace. Ele nasce nulo — só
-- se conhece a conta depois do OAuth —, e `nulls not distinct` impede que dois
-- canais fiquem pendurados no mesmo provedor esperando conexão.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.sales_channels (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies(id) on delete cascade,
  provider            text not null check (provider in ('manual', 'mercado_livre', 'shopee')),
  apelido             text not null default '',
  external_account_id text,
  status              text not null default 'desconectado'
                        check (status in ('desconectado', 'conectado', 'expirado', 'erro')),
  -- Preferências por canal: markup, modo de estoque padrão, prazo extra,
  -- pausar publicação. Fica em jsonb porque cada provedor tem os seus.
  config              jsonb not null default '{}'::jsonb,
  connected_at        timestamptz,
  last_sync_at        timestamptz,
  error_message       text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique nulls not distinct (company_id, provider, external_account_id)
);

comment on table public.sales_channels is
  'Contas de marketplace conectadas. O token não fica aqui — ver channel_secrets.';


-- ─────────────────────────────────────────────────────────────────────────────
-- SEGREDO DO CANAL
--
-- Tabela separada de `sales_channels` justamente para poder ter permissão
-- diferente: o front precisa listar canais, e nunca precisa ler token. Os
-- tokens chegam cifrados da aplicação (AES-256-GCM, chave em CHANNELS_ENC_KEY),
-- então nem um dump do banco entrega a conta do marketplace.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.channel_secrets (
  channel_id         uuid primary key references public.sales_channels(id) on delete cascade,
  access_token_enc   text,
  refresh_token_enc  text,
  expires_at         timestamptz,
  scope              text,
  updated_at         timestamptz not null default now()
);

comment on table public.channel_secrets is
  'Tokens OAuth cifrados. Inacessível a anon/authenticated — só server functions com service_role.';


-- ─────────────────────────────────────────────────────────────────────────────
-- ANÚNCIO ↔ PRODUTO
--
-- O coração do módulo: sem este vínculo, um pedido que chega do canal não sabe
-- que produto produzir. `external_id` é o código do anúncio no provedor (MLB...)
-- e nasce nulo enquanto o anúncio é rascunho local.
--
-- `stock_mode` existe porque gráfica não tem estoque de produto: `store.stock_items`
-- é insumo (bobina, tinta, chapa), não unidade vendável, e a produção é sob
-- demanda. Fingir um motor de estoque aqui seria inventar um dado que não
-- existe. Então: `virtual` mantém uma quantidade de fachada reposta pelo worker,
-- `fixo` publica um número e não mexe mais, `off` não sincroniza estoque.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.channel_listings (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references public.companies(id) on delete cascade,
  channel_id            uuid not null references public.sales_channels(id) on delete cascade,
  product_id            uuid references public.products(id) on delete set null,
  variant_id            uuid references public.product_variants(id) on delete set null,
  external_id           text,
  external_variation_id text,
  sku                   text,
  title                 text not null default '',
  description           text,
  price                 numeric(12, 2) not null default 0,
  category_externa      text,
  -- Atributos obrigatórios do provedor já preenchidos (marca, modelo, GTIN...).
  -- É o que mais reprova anúncio no Mercado Livre, então guardamos o que foi
  -- enviado para poder reenviar sem remontar.
  atributos             jsonb not null default '{}'::jsonb,
  stock_mode            text not null default 'virtual'
                          check (stock_mode in ('virtual', 'fixo', 'off')),
  virtual_qty           integer not null default 10 check (virtual_qty >= 0),
  status                text not null default 'rascunho'
                          check (status in ('rascunho', 'publicando', 'ativo', 'pausado', 'encerrado', 'erro')),
  last_pushed_at        timestamptz,
  last_error            text,
  -- Última resposta do provedor, para auditoria de "por que o anúncio está assim".
  payload               jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (channel_id, external_id)
);

comment on table public.channel_listings is
  'Vínculo anúncio do marketplace ↔ produto do CRM. É por aqui que um pedido descobre o que produzir.';

create index if not exists idx_channel_listings_canal   on public.channel_listings (channel_id, status);
create index if not exists idx_channel_listings_produto on public.channel_listings (product_id);
create index if not exists idx_channel_listings_sku     on public.channel_listings (company_id, sku);


-- ─────────────────────────────────────────────────────────────────────────────
-- PEDIDO DO CANAL
--
-- Ponte, não cópia. O pedido de verdade vive em `store.orders`; aqui ficam o id
-- externo (que garante idempotência quando o canal reenvia a notificação) e o
-- payload cru.
--
-- ATENÇÃO ao `raw`: Mercado Livre e Shopee restringem o que se pode guardar do
-- comprador. Podar o payload antes de gravar — só o necessário para entregar.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.channel_orders (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies(id) on delete cascade,
  channel_id        uuid not null references public.sales_channels(id) on delete cascade,
  external_order_id text not null,
  store_order_id    uuid references store.orders(id) on delete set null,
  status_externo    text,
  total             numeric(12, 2),
  raw               jsonb,
  recebido_em       timestamptz not null default now(),
  ultimo_evento_em  timestamptz,
  erro              text,
  unique (channel_id, external_order_id)
);

comment on table public.channel_orders is
  'Ponte entre o pedido no marketplace e store.orders. A unicidade (canal, id externo) é o que impede pedido duplicado.';

create index if not exists idx_channel_orders_store on public.channel_orders (store_order_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- FILA DE SINCRONIZAÇÃO
--
-- `proxima_tentativa` é o que permite backoff sem cron por job: o worker pega
-- o que já venceu, e um erro empurra a linha para o futuro. `ref_id` aponta para
-- channel_listings ou channel_orders conforme o `tipo` — solto de propósito, uma
-- FK aqui obrigaria uma coluna por destino.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.channel_sync_queue (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies(id) on delete cascade,
  channel_id        uuid not null references public.sales_channels(id) on delete cascade,
  tipo              text not null check (tipo in (
                      'publicar_anuncio', 'atualizar_anuncio', 'encerrar_anuncio',
                      'sincronizar_preco', 'sincronizar_estoque',
                      'importar_pedido', 'atualizar_status_pedido', 'enviar_rastreio',
                      'renovar_token'
                    )),
  ref_id            uuid,
  payload           jsonb not null default '{}'::jsonb,
  status            text not null default 'pendente'
                      check (status in ('pendente', 'processando', 'ok', 'erro', 'descartado')),
  tentativas        integer not null default 0,
  proxima_tentativa timestamptz not null default now(),
  erro              text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.channel_sync_queue is
  'Fila de trabalho dos canais. O webhook só enfileira; quem processa é /api/canais/worker.';

-- Índice do caminho quente do worker: "o que está pendente e já venceu".
create index if not exists idx_channel_queue_pendente
  on public.channel_sync_queue (proxima_tentativa)
  where status = 'pendente';


-- ─────────────────────────────────────────────────────────────────────────────
-- RESERVA ATÔMICA DE TRABALHO
--
-- O worker pode rodar duas vezes ao mesmo tempo: o cron da Vercel dispara a cada
-- 5 min e cada webhook recebido chama o worker logo em seguida. Sem reserva
-- atômica, as duas execuções leem as mesmas linhas `pendente` e importam o mesmo
-- pedido duas vezes — a unicidade de `channel_orders` barraria o segundo, mas o
-- trabalho de rede já teria sido feito em dobro, e um `publicar_anuncio` não tem
-- barreira nenhuma: viraria anúncio duplicado no marketplace.
--
-- `for update skip locked` resolve: cada worker leva um lote diferente sem
-- esperar pelo outro. Isso não dá para escrever pelo supabase-js — precisa ser
-- uma função no banco.
--
-- A função também devolve à fila o que ficou preso em 'processando': se o worker
-- morreu no meio (timeout da função na Vercel, deploy), o job não pode ficar
-- órfão para sempre.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.channel_queue_reservar(
  p_limite            integer default 20,
  p_minutos_travado   integer default 10
)
returns setof public.channel_sync_queue
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Primeiro devolve os abandonados, para que entrem na disputa deste lote.
  update public.channel_sync_queue
     set status = 'pendente'
   where status = 'processando'
     and updated_at < now() - make_interval(mins => p_minutos_travado);

  return query
  update public.channel_sync_queue q
     set status     = 'processando',
         tentativas = q.tentativas + 1,
         updated_at = now()
   where q.id in (
     select id
       from public.channel_sync_queue
      where status = 'pendente'
        and proxima_tentativa <= now()
      order by proxima_tentativa
      limit p_limite
      for update skip locked
   )
  returning q.*;
end;
$$;

comment on function public.channel_queue_reservar is
  'Reserva um lote da fila de canais sem corrida entre execuções simultâneas do worker.';

-- Só o servidor drena a fila. O navegador não tem o que fazer com esta função —
-- e drenar a fila pelo cliente seria processar pedido com a sessão do usuário.
revoke all on function public.channel_queue_reservar(integer, integer) from public, anon, authenticated;
grant execute on function public.channel_queue_reservar(integer, integer) to service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- LOG DE SINCRONIZAÇÃO
--
-- Grava sucesso E falha. Sem o log de falha não há como responder "por que este
-- pedido não entrou" — que é a pergunta que o módulo mais vai receber. Mesmo
-- princípio do `supplier_import_logs` do motor de fornecedores.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.channel_sync_log (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  channel_id uuid references public.sales_channels(id) on delete set null,
  tipo       text not null,
  direcao    text not null check (direcao in ('entrada', 'saida')),
  ref_id     uuid,
  sucesso    boolean not null,
  erro       text,
  payload    jsonb,
  duracao_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_channel_log_recente on public.channel_sync_log (company_id, created_at desc);


-- ─────────────────────────────────────────────────────────────────────────────
-- STATUS SEM SEGREDO
--
-- É isto que a tela lê. `security_invoker` para que o RLS de `sales_channels`
-- continue valendo — sem ele a view rodaria com os privilégios de quem a criou e
-- mostraria os canais de todas as empresas. Nenhuma coluna de `channel_secrets`
-- aparece; só a informação derivada de que existe token e quando ele vence.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace view public.channel_status
with (security_invoker = true)
as
select
  c.id,
  c.company_id,
  c.provider,
  c.apelido,
  c.external_account_id,
  c.status,
  c.config,
  c.connected_at,
  c.last_sync_at,
  c.error_message,
  (s.access_token_enc is not null) as tem_token,
  s.expires_at                     as token_expira_em,
  (s.expires_at is not null and s.expires_at < now()) as token_vencido,
  (select count(*) from public.channel_listings l
    where l.channel_id = c.id and l.status = 'ativo')      as anuncios_ativos,
  (select count(*) from public.channel_sync_queue q
    where q.channel_id = c.id and q.status = 'pendente')   as fila_pendente,
  (select count(*) from public.channel_sync_queue q
    where q.channel_id = c.id and q.status = 'erro')       as fila_com_erro
from public.sales_channels c
left join public.channel_secrets s on s.channel_id = c.id;

comment on view public.channel_status is
  'Situação dos canais para a UI. Deriva de channel_secrets sem expor nenhum token.';


-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
--
-- `user_owns_company()` é o padrão do projeto (ver 20260602000000). Uma policy
-- por operação, como nas demais tabelas do CRM.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.sales_channels      enable row level security;
alter table public.channel_listings    enable row level security;
alter table public.channel_orders      enable row level security;
alter table public.channel_sync_queue  enable row level security;
alter table public.channel_sync_log    enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'sales_channels', 'channel_listings', 'channel_orders',
    'channel_sync_queue', 'channel_sync_log'
  ] loop
    execute format('drop policy if exists "owner comp select" on public.%I', t);
    execute format('drop policy if exists "owner comp insert" on public.%I', t);
    execute format('drop policy if exists "owner comp update" on public.%I', t);
    execute format('drop policy if exists "owner comp delete" on public.%I', t);

    execute format(
      'create policy "owner comp select" on public.%I for select using (public.user_owns_company(company_id))', t);
    execute format(
      'create policy "owner comp insert" on public.%I for insert with check (public.user_owns_company(company_id))', t);
    execute format(
      'create policy "owner comp update" on public.%I for update using (public.user_owns_company(company_id))', t);
    execute format(
      'create policy "owner comp delete" on public.%I for delete using (public.user_owns_company(company_id))', t);
  end loop;
end $$;

-- O segredo é o caso especial: RLS ligado e NENHUMA policy. Sem policy
-- permissiva, `anon` e `authenticated` não enxergam linha nenhuma; o
-- `service_role` passa por ter bypassrls. O revoke abaixo é a segunda tranca.
alter table public.channel_secrets enable row level security;

revoke all on public.channel_secrets from anon, authenticated;
grant  all on public.channel_secrets to   service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array[
    'sales_channels', 'channel_secrets', 'channel_listings', 'channel_sync_queue'
  ] loop
    execute format('drop trigger if exists trg_%s_updated on public.%I', t, t);
    execute format(
      'create trigger trg_%s_updated before update on public.%I
         for each row execute function public.update_updated_at_column()', t, t);
  end loop;
end $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- APOSENTADORIA DA CASCA ANTIGA
--
-- `marketplace_credentials` (20260602000000) guardava token em texto puro numa
-- tabela que o navegador lia — substituída por sales_channels + channel_secrets.
--
-- `marketplace_drafts` é pior: existe no banco de produção mas NÃO tem migração
-- nenhuma neste repositório. É drift — foi criada fora do fluxo, então um
-- `db push` num banco limpo produziria um schema diferente do de produção. O
-- conceito dela (título/copy/preço por anúncio) virou `channel_listings`.
--
-- As duas estão vazias em produção (0 linhas, conferido em 16/08/2026), então
-- não há dado a preservar. `if exists` mantém a migração idempotente para um
-- banco novo, onde `marketplace_drafts` nunca existiu.
-- ─────────────────────────────────────────────────────────────────────────────
drop table if exists public.marketplace_drafts;
drop table if exists public.marketplace_credentials;
