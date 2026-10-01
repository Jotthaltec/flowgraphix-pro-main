/**
 * Tipos das tabelas do módulo de canais.
 *
 * Declarados à mão de propósito: `src/integrations/supabase/types.ts` é gerado
 * a partir do banco e só conhece estas tabelas depois que a migração
 * `20260816000000` roda e os tipos são regerados. Amarrar o módulo inteiro ao
 * arquivo gerado significaria não conseguir escrever nem testar nada até lá.
 *
 * Estes tipos são o CONTRATO que o código espera do banco. Quando o gerado
 * chegar, ele valida este contrato — não o substitui.
 */

export type CanalProvider = "manual" | "mercado_livre" | "shopee";

export type CanalStatus = "desconectado" | "conectado" | "expirado" | "erro";

export type TipoJob =
  | "publicar_anuncio"
  | "atualizar_anuncio"
  | "encerrar_anuncio"
  | "sincronizar_preco"
  | "sincronizar_estoque"
  | "importar_pedido"
  | "atualizar_status_pedido"
  | "enviar_rastreio"
  | "renovar_token";

export type StatusJob = "pendente" | "processando" | "ok" | "erro" | "descartado";

export interface LinhaCanal {
  id: string;
  company_id: string;
  provider: CanalProvider;
  apelido: string;
  external_account_id: string | null;
  status: CanalStatus;
  config: Record<string, unknown>;
  connected_at: string | null;
  last_sync_at: string | null;
  error_message: string | null;
}

export interface LinhaSegredo {
  channel_id: string;
  access_token_enc: string | null;
  refresh_token_enc: string | null;
  expires_at: string | null;
  scope: string | null;
}

export interface LinhaAnuncio {
  id: string;
  company_id: string;
  channel_id: string;
  product_id: string | null;
  variant_id: string | null;
  external_id: string | null;
  external_variation_id: string | null;
  sku: string | null;
  title: string;
  description: string | null;
  price: number;
  category_externa: string | null;
  atributos: Record<string, unknown>;
  stock_mode: "virtual" | "fixo" | "off";
  virtual_qty: number;
  status: "rascunho" | "publicando" | "ativo" | "pausado" | "encerrado" | "erro";
  last_pushed_at: string | null;
  last_error: string | null;
}

export interface LinhaJob {
  id: string;
  company_id: string;
  channel_id: string;
  tipo: TipoJob;
  ref_id: string | null;
  payload: Record<string, unknown>;
  status: StatusJob;
  tentativas: number;
  proxima_tentativa: string;
  erro: string | null;
}
