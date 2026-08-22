/**
 * CANAIS DE VENDA — contrato dos adaptadores.
 *
 * Um `ChannelAdapter` é o que torna o módulo genérico em vez de preso ao
 * Mercado Livre: cada marketplace implementa a mesma interface e conversa em
 * cima dos modelos canônicos daqui (`ChannelOrder`, `ListingInput`). Adicionar a
 * Shopee é escrever um adaptador — nenhuma tabela e nenhuma tela mudam.
 *
 * Diferença proposital em relação aos adaptadores de FORNECEDOR
 * (`src/services/adapters/types.ts`): aqueles são puros porque recebem HTML já
 * baixado. Estes precisam falar com a API do provedor, então fazem I/O de rede —
 * mas continuam sem tocar em Supabase. Quem persiste é quem chamou. Essa
 * fronteira é o que permite testar um adaptador com `fetch` dublado, sem banco.
 *
 * Todo adaptador roda SOMENTE no servidor: recebe `accessToken` no contexto, e
 * token não pode chegar ao navegador.
 */

/** Provedores suportados. Espelha o check de `sales_channels.provider`. */
export type ChannelProvider = "manual" | "mercado_livre" | "shopee";

/** Tokens devolvidos pelo fluxo OAuth do provedor. */
export interface ChannelTokens {
  accessToken: string;
  refreshToken?: string;
  /** Instante absoluto de expiração — não "segundos restantes", que envelhece. */
  expiresAt?: Date;
  scope?: string;
  /** Id da conta no provedor (user_id do ML, shop_id da Shopee). */
  externalAccountId?: string;
}

/**
 * Contexto de uma chamada ao provedor. Montado pelo worker/server function a
 * partir de `sales_channels` + `channel_secrets` já decifrado.
 */
export interface ChannelCtx {
  channelId: string;
  companyId: string;
  accessToken: string;
  externalAccountId?: string;
  /** `sales_channels.config` — markup, prazo extra, preferências do canal. */
  config: Record<string, unknown>;
  /** Injetável para teste; cai no `fetch` global quando ausente. */
  fetchImpl?: typeof fetch;
}

/** Categoria do provedor (árvore própria de cada marketplace). */
export interface ChannelCategory {
  id: string;
  nome: string;
  caminho?: string;
}

/**
 * Atributo exigido pelo provedor para publicar numa categoria. É o que mais
 * reprova anúncio no Mercado Livre, então o adaptador precisa saber declarar.
 */
export interface ChannelAttribute {
  id: string;
  nome: string;
  obrigatorio: boolean;
  tipo: "texto" | "numero" | "lista" | "booleano";
  /** Valores aceitos quando `tipo === "lista"`. */
  opcoes?: Array<{ id: string; nome: string }>;
  unidade?: string;
}

/** O que se envia ao provedor para criar ou atualizar um anúncio. */
export interface ListingInput {
  /** `channel_listings.external_id` — ausente na primeira publicação. */
  externalId?: string;
  titulo: string;
  descricao: string;
  preco: number;
  quantidade: number;
  categoriaExterna: string;
  atributos: Record<string, string | number | boolean>;
  imagens: string[];
  sku?: string;
}

/** Evento extraído de uma notificação do provedor. */
export interface ChannelEvent {
  tipo: "pedido" | "pergunta" | "anuncio" | "envio" | "desconhecido";
  /** Id do recurso no provedor (pedido, anúncio...). */
  externalId: string;
  ocorridoEm?: Date;
  raw?: unknown;
}

export interface ChannelOrderItem {
  /** Anúncio de origem — é por ele que se acha o produto em `channel_listings`. */
  externalListingId: string;
  externalVariationId?: string;
  sku?: string;
  titulo: string;
  quantidade: number;
  precoUnitario: number;
  /** Variações escolhidas pelo comprador (cor, tamanho, tiragem). */
  opcoes?: Record<string, string>;
}

export interface ChannelBuyer {
  nomeCompleto: string;
  email?: string;
  telefone?: string;
  documento?: string;
}

export interface ChannelShipping {
  metodo?: string;
  custo: number;
  destinatario?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  /** ISO date; null quando o provedor não promete prazo. */
  prazoEstimado?: string | null;
}

/** Pedido no modelo canônico — é isto que vira `store.orders`. */
export interface ChannelOrder {
  externalOrderId: string;
  criadoEm: string;
  /** Status como o provedor escreve; a tradução é do chamador. */
  statusExterno: string;
  statusPagamento: "pendente" | "pago" | "cancelado" | "estornado";
  comprador: ChannelBuyer;
  itens: ChannelOrderItem[];
  entrega: ChannelShipping;
  subtotal: number;
  desconto: number;
  total: number;
  observacoes?: string;
  /** Payload cru. PODAR antes de gravar — ver `podarPayload` em `privacy.ts`. */
  raw?: unknown;
}

export interface Tracking {
  codigo: string;
  transportadora?: string;
  url?: string;
  enviadoEm?: Date;
}

/**
 * Contrato que todo canal implementa.
 *
 * Métodos que um provedor não suporta devem LANÇAR `ChannelNaoSuportado` em vez
 * de devolver vazio — silêncio aqui vira "o anúncio não subiu e ninguém soube".
 */
export interface ChannelAdapter {
  provider: ChannelProvider;
  label: string;
  /** false para o canal manual: não há OAuth a fazer. */
  usaOAuth: boolean;

  // ─── Autenticação ──────────────────────────────────────────────────────────
  authorizeUrl(state: string, redirectUri: string): string;
  exchangeCode(code: string, redirectUri: string, fetchImpl?: typeof fetch): Promise<ChannelTokens>;
  refresh(refreshToken: string, fetchImpl?: typeof fetch): Promise<ChannelTokens>;

  // ─── Catálogo e anúncios ───────────────────────────────────────────────────
  categories(ctx: ChannelCtx, termo: string): Promise<ChannelCategory[]>;
  requiredAttributes(ctx: ChannelCtx, categoriaId: string): Promise<ChannelAttribute[]>;
  pushListing(ctx: ChannelCtx, listing: ListingInput): Promise<{ externalId: string }>;
  updateListing(ctx: ChannelCtx, listing: ListingInput): Promise<void>;
  setPrice(ctx: ChannelCtx, externalId: string, preco: number): Promise<void>;
  setStock(ctx: ChannelCtx, externalId: string, quantidade: number): Promise<void>;
  endListing(ctx: ChannelCtx, externalId: string): Promise<void>;

  // ─── Pedidos ───────────────────────────────────────────────────────────────
  parseNotification(request: Request): Promise<ChannelEvent[]>;
  fetchOrder(ctx: ChannelCtx, externalOrderId: string): Promise<ChannelOrder>;
  listOrdersSince(ctx: ChannelCtx, desde: Date): Promise<ChannelOrder[]>;
  pushShipment(ctx: ChannelCtx, externalOrderId: string, tracking: Tracking): Promise<void>;
}

/**
 * Lançada quando o provedor não oferece a operação. Existe como classe própria
 * para o worker distinguir "não dá para fazer" (descartar o job) de "falhou"
 * (tentar de novo) — sem isso, um job impossível fica reciclando para sempre.
 */
export class ChannelNaoSuportado extends Error {
  constructor(provider: ChannelProvider, operacao: string) {
    super(`O canal ${provider} não suporta a operação "${operacao}".`);
    this.name = "ChannelNaoSuportado";
  }
}

/**
 * Erro de chamada ao provedor. `permanente` diz ao worker se vale tentar de
 * novo: 4xx de validação (anúncio reprovado, atributo faltando) não melhora com
 * retentativa; 429 e 5xx melhoram.
 */
export class ChannelErroApi extends Error {
  readonly status: number;
  readonly permanente: boolean;
  readonly detalhe?: unknown;

  constructor(mensagem: string, status: number, detalhe?: unknown) {
    super(mensagem);
    this.name = "ChannelErroApi";
    this.status = status;
    this.detalhe = detalhe;
    this.permanente = status >= 400 && status < 500 && status !== 408 && status !== 429;
  }
}
