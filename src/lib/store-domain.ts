/* Cópia de Nexus-Printi/src/lib/domain.ts — NÃO editar aqui.
   O site é a referência do domínio da loja; atualize lá e rode
   `node scripts/sync-store-domain.mjs`. O teste store-domain.test.ts acusa divergência. */

/* ==========================================================================
   Modelo de domínio — enums, rótulos em português e agrupamentos.
   Os valores aqui espelham exatamente os tipos criados no Postgres.
   ========================================================================== */

export type Tone = "neutral" | "info" | "warning" | "success" | "danger" | "brand";

export type Role = "cliente" | "revendedor" | "vendedor" | "admin";

export const ROLES: Role[] = ["cliente", "revendedor", "vendedor", "admin"];

export const ROLE_LABEL: Record<Role, string> = {
  cliente: "Cliente",
  revendedor: "Revendedor",
  vendedor: "Vendedor",
  admin: "Administrador",
};

/* ------------------------------- Pedidos ------------------------------- */

export const ORDER_STATUSES = [
  "pedido_recebido",
  "aguardando_pagamento",
  "pagamento_analise",
  "pago",
  "aguardando_arquivos",
  "arte_analise",
  "arte_criacao",
  "aguardando_aprovacao",
  "alteracao_solicitada",
  "aprovado_producao",
  "em_producao",
  "acabamento",
  "controle_qualidade",
  "embalagem",
  "pronto_retirada",
  "enviado",
  "entregue",
  "concluido",
  "cancelado",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_META: Record<OrderStatus, { label: string; tone: Tone; group: string }> =
  {
    pedido_recebido: { label: "Pedido recebido", tone: "neutral", group: "Início" },
    aguardando_pagamento: { label: "Aguardando pagamento", tone: "warning", group: "Pagamento" },
    pagamento_analise: { label: "Pagamento em análise", tone: "warning", group: "Pagamento" },
    pago: { label: "Pago", tone: "success", group: "Pagamento" },
    aguardando_arquivos: { label: "Aguardando arquivos", tone: "warning", group: "Arte" },
    arte_analise: { label: "Arte em análise", tone: "info", group: "Arte" },
    arte_criacao: { label: "Arte em criação", tone: "info", group: "Arte" },
    aguardando_aprovacao: { label: "Aguardando aprovação", tone: "warning", group: "Arte" },
    alteracao_solicitada: { label: "Alteração solicitada", tone: "danger", group: "Arte" },
    aprovado_producao: { label: "Aprovado para produção", tone: "brand", group: "Produção" },
    em_producao: { label: "Em produção", tone: "info", group: "Produção" },
    acabamento: { label: "Acabamento", tone: "info", group: "Produção" },
    controle_qualidade: { label: "Controle de qualidade", tone: "info", group: "Produção" },
    embalagem: { label: "Embalagem", tone: "info", group: "Produção" },
    pronto_retirada: { label: "Pronto para retirada", tone: "brand", group: "Entrega" },
    enviado: { label: "Enviado", tone: "brand", group: "Entrega" },
    entregue: { label: "Entregue", tone: "success", group: "Entrega" },
    concluido: { label: "Concluído", tone: "success", group: "Entrega" },
    cancelado: { label: "Cancelado", tone: "danger", group: "Encerrado" },
  };

/** Status que representam um pedido ainda em andamento. */
export const OPEN_ORDER_STATUSES: OrderStatus[] = ORDER_STATUSES.filter(
  (s) => s !== "concluido" && s !== "cancelado" && s !== "entregue",
) as OrderStatus[];

export const ORDER_STATUS_FLOW: OrderStatus[] = [
  "pedido_recebido",
  "aguardando_pagamento",
  "pago",
  "aguardando_arquivos",
  "arte_analise",
  "aguardando_aprovacao",
  "aprovado_producao",
  "em_producao",
  "acabamento",
  "controle_qualidade",
  "embalagem",
  "enviado",
  "entregue",
  "concluido",
];

/** Percentual aproximado de avanço do pedido, usado nas barras de progresso. */
export function orderProgress(status: OrderStatus) {
  if (status === "cancelado") return 0;
  const index = ORDER_STATUS_FLOW.indexOf(status);
  if (index === -1) return 25;
  return Math.round(((index + 1) / ORDER_STATUS_FLOW.length) * 100);
}

/* ------------------------------- Produção ------------------------------- */

export const PRODUCTION_STAGES = [
  "fila_entrada",
  "conferencia",
  "pre_impressao",
  "impressao",
  "recorte",
  "acabamento",
  "montagem",
  "controle_qualidade",
  "embalagem",
  "finalizado",
] as const;

export type ProductionStage = (typeof PRODUCTION_STAGES)[number];

export const PRODUCTION_STAGE_LABEL: Record<ProductionStage, string> = {
  fila_entrada: "Fila de entrada",
  conferencia: "Conferência",
  pre_impressao: "Pré-impressão",
  impressao: "Impressão",
  recorte: "Recorte",
  acabamento: "Acabamento",
  montagem: "Montagem",
  controle_qualidade: "Controle de qualidade",
  embalagem: "Embalagem",
  finalizado: "Finalizado",
};

export const PRIORITIES = ["baixa", "normal", "alta", "urgente"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_META: Record<Priority, { label: string; tone: Tone }> = {
  baixa: { label: "Baixa", tone: "neutral" },
  normal: { label: "Normal", tone: "info" },
  alta: { label: "Alta", tone: "warning" },
  urgente: { label: "Urgente", tone: "danger" },
};

/* ------------------------------ Orçamentos ------------------------------ */

export const QUOTE_STATUSES = [
  "rascunho",
  "enviado",
  "visualizado",
  "em_negociacao",
  "aprovado",
  "recusado",
  "expirado",
  "convertido",
] as const;

export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QUOTE_STATUS_META: Record<QuoteStatus, { label: string; tone: Tone }> = {
  rascunho: { label: "Rascunho", tone: "neutral" },
  enviado: { label: "Enviado", tone: "info" },
  visualizado: { label: "Visualizado", tone: "info" },
  em_negociacao: { label: "Em negociação", tone: "warning" },
  aprovado: { label: "Aprovado", tone: "success" },
  recusado: { label: "Recusado", tone: "danger" },
  expirado: { label: "Expirado", tone: "neutral" },
  convertido: { label: "Convertido em pedido", tone: "brand" },
};

/* ------------------------------ Funil CRM ------------------------------ */

export const FUNNEL_STAGES = [
  "novo_lead",
  "primeiro_contato",
  "levantamento",
  "orcamento_enviado",
  "negociacao",
  "aguardando_pagamento",
  "venda_concluida",
  "perdido",
  "pos_venda",
] as const;

export type FunnelStage = (typeof FUNNEL_STAGES)[number];

export const FUNNEL_STAGE_META: Record<FunnelStage, { label: string; tone: Tone }> = {
  novo_lead: { label: "Novo lead", tone: "neutral" },
  primeiro_contato: { label: "Primeiro contato", tone: "info" },
  levantamento: { label: "Levantamento de necessidade", tone: "info" },
  orcamento_enviado: { label: "Orçamento enviado", tone: "brand" },
  negociacao: { label: "Negociação", tone: "warning" },
  aguardando_pagamento: { label: "Aguardando pagamento", tone: "warning" },
  venda_concluida: { label: "Venda concluída", tone: "success" },
  perdido: { label: "Perdido", tone: "danger" },
  pos_venda: { label: "Pós-venda", tone: "brand" },
};

export const LEAD_SOURCES = [
  "site",
  "whatsapp",
  "instagram",
  "indicacao",
  "google",
  "telefone",
  "presencial",
  "outro",
] as const;

export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_SOURCE_LABEL: Record<LeadSource, string> = {
  site: "Site",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  indicacao: "Indicação",
  google: "Google",
  telefone: "Telefone",
  presencial: "Presencial",
  outro: "Outro",
};

/* ------------------------------ Pagamentos ------------------------------ */

export const PAYMENT_METHODS = [
  "pix",
  "cartao_credito",
  "boleto",
  "link_pagamento",
  "credito_interno",
  "faturado",
  "combinado",
  "aprovado_manual",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_META: Record<
  PaymentMethod,
  { label: string; description: string; publicCheckout: boolean }
> = {
  pix: {
    label: "Pix",
    description: "Aprovação imediata. O código é gerado após a confirmação do pedido.",
    publicCheckout: true,
  },
  cartao_credito: {
    label: "Cartão de crédito",
    description: "Parcelamento conforme as condições configuradas pela loja.",
    publicCheckout: true,
  },
  boleto: {
    label: "Boleto bancário",
    description: "Compensação em até 3 dias úteis. A produção inicia após o pagamento.",
    publicCheckout: true,
  },
  link_pagamento: {
    label: "Link de pagamento",
    description: "A equipe envia um link seguro por WhatsApp ou e-mail.",
    publicCheckout: true,
  },
  credito_interno: {
    label: "Crédito interno",
    description: "Usa o saldo disponível na sua conta Nexus Printi.",
    publicCheckout: true,
  },
  faturado: {
    label: "Compra faturada",
    description: "Reserva o limite comercial aprovado e gera cobrança para o vencimento acordado.",
    publicCheckout: true,
  },
  combinado: {
    label: "Pagamento combinado",
    description: "Condição negociada diretamente com o vendedor responsável.",
    publicCheckout: true,
  },
  aprovado_manual: {
    label: "Aprovação manual",
    description: "Liberado manualmente pelo administrador (faturamento/contrato).",
    publicCheckout: false,
  },
};

export const PAYMENT_STATUSES = [
  "pendente",
  "processando",
  "pago",
  "recusado",
  "estornado",
  "cancelado",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_META: Record<PaymentStatus, { label: string; tone: Tone }> = {
  pendente: { label: "Pendente", tone: "warning" },
  processando: { label: "Processando", tone: "info" },
  pago: { label: "Pago", tone: "success" },
  recusado: { label: "Recusado", tone: "danger" },
  estornado: { label: "Estornado", tone: "neutral" },
  cancelado: { label: "Cancelado", tone: "danger" },
};

/* -------------------------------- Entrega -------------------------------- */

export const SHIPPING_METHODS = [
  "retirada",
  "motoboy",
  "transportadora",
  "correios",
  "melhor_envio",
  "entrega_propria",
  "frete_combinado",
  "digital",
] as const;

export type ShippingMethod = (typeof SHIPPING_METHODS)[number];

export const SHIPPING_METHOD_META: Record<
  ShippingMethod,
  { label: string; description: string; requiresAddress: boolean }
> = {
  retirada: {
    label: "Retirada no local",
    description: "Retire na Nexus Printi assim que o pedido ficar pronto.",
    requiresAddress: false,
  },
  motoboy: {
    label: "Motoboy",
    description: "Entrega rápida na região metropolitana.",
    requiresAddress: true,
  },
  transportadora: {
    label: "Transportadora",
    description: "Indicado para volumes grandes e pedidos pesados.",
    requiresAddress: true,
  },
  correios: {
    label: "Correios",
    description: "Envio para todo o Brasil com código de rastreio.",
    requiresAddress: true,
  },
  melhor_envio: {
    label: "Melhor Envio",
    description: "Cotação com múltiplas transportadoras.",
    requiresAddress: true,
  },
  entrega_propria: {
    label: "Entrega própria",
    description: "Nossa equipe entrega dentro da área de cobertura.",
    requiresAddress: true,
  },
  frete_combinado: {
    label: "Frete combinado",
    description: "Valor e prazo acertados com o vendedor responsável.",
    requiresAddress: true,
  },
  digital: {
    label: "Arquivo digital",
    description: "Produto entregue por download, sem envio físico.",
    requiresAddress: false,
  },
};

/* --------------------------------- Arte --------------------------------- */

export const ART_FLOWS = [
  "enviar_arte",
  "solicitar_criacao",
  "pedido_anterior",
  "enviar_referencia",
  "criar_depois",
  "contato_designer",
] as const;

export type ArtFlow = (typeof ART_FLOWS)[number];

export const ART_FLOW_META: Record<ArtFlow, { label: string; description: string }> = {
  enviar_arte: {
    label: "Enviar arte pronta",
    description: "Você já tem o arquivo finalizado no gabarito.",
  },
  solicitar_criacao: {
    label: "Solicitar criação de arte",
    description: "Nosso time cria a arte para você (pode haver custo adicional).",
  },
  pedido_anterior: {
    label: "Usar arte de pedido anterior",
    description: "Reaproveitamos um arquivo já aprovado na sua conta.",
  },
  enviar_referencia: {
    label: "Enviar referência",
    description: "Envie imagens ou links de inspiração para produzirmos a arte.",
  },
  criar_depois: {
    label: "Enviar depois da compra",
    description: "Finalize agora e envie o arquivo no painel quando estiver pronto.",
  },
  contato_designer: {
    label: "Falar com um designer",
    description: "Um designer entra em contato para entender o projeto.",
  },
};

export const ART_STATUSES = [
  "pendente",
  "em_analise",
  "aguardando_aprovacao",
  "aprovada",
  "reprovada",
  "alteracao_solicitada",
] as const;

export type ArtStatus = (typeof ART_STATUSES)[number];

export const ART_STATUS_META: Record<ArtStatus, { label: string; tone: Tone }> = {
  pendente: { label: "Pendente", tone: "neutral" },
  em_analise: { label: "Em análise", tone: "info" },
  aguardando_aprovacao: { label: "Aguardando sua aprovação", tone: "warning" },
  aprovada: { label: "Aprovada", tone: "success" },
  reprovada: { label: "Reprovada", tone: "danger" },
  alteracao_solicitada: { label: "Alteração solicitada", tone: "warning" },
};

/* ------------------------------- Chamados ------------------------------- */

export const TICKET_STATUSES = [
  "aberto",
  "em_atendimento",
  "aguardando_cliente",
  "resolvido",
  "fechado",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_STATUS_META: Record<TicketStatus, { label: string; tone: Tone }> = {
  aberto: { label: "Aberto", tone: "warning" },
  em_atendimento: { label: "Em atendimento", tone: "info" },
  aguardando_cliente: { label: "Aguardando você", tone: "warning" },
  resolvido: { label: "Resolvido", tone: "success" },
  fechado: { label: "Fechado", tone: "neutral" },
};

export const TICKET_CATEGORIES = [
  "duvida",
  "pedido",
  "arte",
  "financeiro",
  "entrega",
  "qualidade",
  "sugestao",
  "outro",
] as const;

export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const TICKET_CATEGORY_LABEL: Record<TicketCategory, string> = {
  duvida: "Dúvida",
  pedido: "Pedido",
  arte: "Arte",
  financeiro: "Financeiro",
  entrega: "Entrega",
  qualidade: "Qualidade",
  sugestao: "Sugestão",
  outro: "Outro",
};

/* -------------------------------- Estoque -------------------------------- */

export const STOCK_MOVEMENT_TYPES = [
  "entrada",
  "saida",
  "ajuste",
  "consumo_producao",
  "inventario",
] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

export const STOCK_MOVEMENT_LABEL: Record<StockMovementType, string> = {
  entrada: "Entrada",
  saida: "Saída",
  ajuste: "Ajuste",
  consumo_producao: "Consumo em produção",
  inventario: "Inventário",
};

export const STOCK_ITEM_KINDS = ["materia_prima", "produto_pronto", "embalagem", "insumo"] as const;
export type StockItemKind = (typeof STOCK_ITEM_KINDS)[number];

export const STOCK_ITEM_KIND_LABEL: Record<StockItemKind, string> = {
  materia_prima: "Matéria-prima",
  produto_pronto: "Produto pronto",
  embalagem: "Embalagem",
  insumo: "Insumo",
};

/* ------------------------------- Financeiro ------------------------------- */

export const FINANCE_ENTRY_TYPES = ["receber", "pagar"] as const;
export type FinanceEntryType = (typeof FINANCE_ENTRY_TYPES)[number];

export const FINANCE_ENTRY_STATUSES = ["aberto", "pago", "atrasado", "cancelado"] as const;
export type FinanceEntryStatus = (typeof FINANCE_ENTRY_STATUSES)[number];

export const FINANCE_ENTRY_STATUS_META: Record<FinanceEntryStatus, { label: string; tone: Tone }> =
  {
    aberto: { label: "Em aberto", tone: "warning" },
    pago: { label: "Pago", tone: "success" },
    atrasado: { label: "Atrasado", tone: "danger" },
    cancelado: { label: "Cancelado", tone: "neutral" },
  };

/* ------------------------------ Notificações ------------------------------ */

export const NOTIFICATION_EVENTS = [
  "cadastro_realizado",
  "orcamento_enviado",
  "orcamento_aprovado",
  "pagamento_recebido",
  "arquivo_solicitado",
  "arte_enviada",
  "arte_aguardando_aprovacao",
  "alteracao_solicitada",
  "pedido_em_producao",
  "pedido_pronto",
  "pedido_enviado",
  "pedido_entregue",
  "pedido_atrasado",
  "chamado_respondido",
  "credito_adicionado",
] as const;

export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

export const NOTIFICATION_EVENT_LABEL: Record<NotificationEvent, string> = {
  cadastro_realizado: "Cadastro realizado",
  orcamento_enviado: "Orçamento enviado",
  orcamento_aprovado: "Orçamento aprovado",
  pagamento_recebido: "Pagamento recebido",
  arquivo_solicitado: "Arquivo solicitado",
  arte_enviada: "Arte enviada",
  arte_aguardando_aprovacao: "Arte aguardando aprovação",
  alteracao_solicitada: "Alteração solicitada",
  pedido_em_producao: "Pedido em produção",
  pedido_pronto: "Pedido pronto",
  pedido_enviado: "Pedido enviado",
  pedido_entregue: "Pedido entregue",
  pedido_atrasado: "Pedido atrasado",
  chamado_respondido: "Chamado respondido",
  credito_adicionado: "Crédito adicionado",
};

/* ------------------------------- Descontos ------------------------------- */

export const DISCOUNT_TYPES = ["percentual", "valor_fixo"] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export const CUSTOMER_TYPES = ["pf", "pj"] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];

export const CUSTOMER_TYPE_LABEL: Record<CustomerType, string> = {
  pf: "Pessoa física",
  pj: "Pessoa jurídica",
};

/* ---------------------------- Fonte de dados ---------------------------- */

/** Entidades cobertas pelo módulo que decide se os dados vêm da loja, do Flow Printi (CRM) ou dos dois. */
export const DATA_SOURCE_ENTITIES = ["produtos", "clientes", "orcamentos", "pedidos"] as const;
export type DataSourceEntity = (typeof DATA_SOURCE_ENTITIES)[number];

export const DATA_SOURCE_MODES = ["site", "crm", "ambos"] as const;
export type DataSourceMode = (typeof DATA_SOURCE_MODES)[number];

export const DATA_SOURCE_ENTITY_LABEL: Record<DataSourceEntity, string> = {
  produtos: "Produtos",
  clientes: "Clientes",
  orcamentos: "Orçamentos",
  pedidos: "Pedidos",
};

export const DATA_SOURCE_MODE_META: Record<
  DataSourceMode,
  { label: string; description: string; tone: Tone }
> = {
  site: {
    label: "Só a loja",
    description:
      "Só o que for cadastrado no painel da loja aparece aqui. O Flow Printi não influencia esta lista.",
    tone: "neutral",
  },
  crm: {
    label: "Só o Flow Printi",
    description: "Os registros vêm do Flow Printi. A loja reproduz o que estiver cadastrado lá.",
    tone: "info",
  },
  ambos: {
    label: "Os dois lados",
    description:
      "Loja e Flow Printi criam livremente. Cada registro tem um dono que o edita; o outro lado só visualiza, com a opção de assumir a posse.",
    tone: "brand",
  },
};

/* --------------------------- Rótulos utilitários --------------------------- */

export function orderStatusLabel(status: string) {
  return ORDER_STATUS_META[status as OrderStatus]?.label ?? status;
}

export function orderStatusTone(status: string): Tone {
  return ORDER_STATUS_META[status as OrderStatus]?.tone ?? "neutral";
}

export function quoteStatusLabel(status: string) {
  return QUOTE_STATUS_META[status as QuoteStatus]?.label ?? status;
}

export function paymentMethodLabel(method: string) {
  return PAYMENT_METHOD_META[method as PaymentMethod]?.label ?? method;
}

export function shippingMethodLabel(method: string) {
  return SHIPPING_METHOD_META[method as ShippingMethod]?.label ?? method;
}
