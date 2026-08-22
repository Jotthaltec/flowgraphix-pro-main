/**
 * CANAL MANUAL — o adaptador que não fala com ninguém.
 *
 * Serve a dois propósitos concretos:
 *
 * 1. Faz o módulo inteiro (fila, vínculo anúncio↔produto, entrada de pedido,
 *    log) ser testável de ponta a ponta ANTES de existir credencial de qualquer
 *    marketplace — inclusive em ambiente de desenvolvimento, onde nenhum webhook
 *    do Mercado Livre chega.
 * 2. Cobre o caso real de vender por um canal sem API (WhatsApp, feira, indicação):
 *    cola-se o pedido e ele entra na produção pelo mesmo caminho dos outros.
 *
 * O id externo que ele gera é prefixado `MANUAL-` de propósito. A versão
 * anterior deste módulo fabricava códigos no formato `MLB########` para simular
 * publicação no Mercado Livre — o que produzia um registro indistinguível de um
 * anúncio real que nunca existiu. Nada aqui pode se passar por outro canal.
 */

import {
  ChannelNaoSuportado,
  type ChannelAdapter,
  type ChannelAttribute,
  type ChannelCategory,
  type ChannelCtx,
  type ChannelEvent,
  type ChannelOrder,
  type ChannelOrderItem,
  type ListingInput,
  type Tracking,
} from "./types";

/** Erro de validação de um pedido colado à mão. */
export class PedidoManualInvalido extends Error {
  readonly problemas: string[];

  constructor(problemas: string[]) {
    super(`Pedido inválido: ${problemas.join("; ")}`);
    this.name = "PedidoManualInvalido";
    this.problemas = problemas;
  }
}

function gerarIdManual(): string {
  const aleatorio = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `MANUAL-${Date.now().toString(36).toUpperCase()}-${aleatorio}`;
}

function texto(valor: unknown): string | undefined {
  if (typeof valor !== "string") return undefined;
  const limpo = valor.trim();
  return limpo === "" ? undefined : limpo;
}

function numero(valor: unknown): number | undefined {
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;
  if (typeof valor === "string") {
    // Aceita tanto "1234.56" quanto "1.234,56" — quem cola vem de planilha.
    const normalizado = valor.trim().replace(/\./g, "").replace(",", ".");
    const n = Number(normalizado);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/**
 * Interpreta um pedido colado à mão no modelo canônico.
 *
 * Valida em vez de completar: campo faltando vira erro com o caminho exato, não
 * um valor inventado. Um pedido que entra errado na produção custa mais caro que
 * um pedido que não entra.
 */
export function parseManualOrder(entrada: unknown): ChannelOrder {
  const problemas: string[] = [];

  if (entrada === null || typeof entrada !== "object" || Array.isArray(entrada)) {
    throw new PedidoManualInvalido(["o conteúdo precisa ser um objeto JSON"]);
  }
  const raiz = entrada as Record<string, unknown>;

  const externalOrderId = texto(raiz.externalOrderId) ?? texto(raiz.numero) ?? gerarIdManual();

  const compradorBruto = (raiz.comprador ?? {}) as Record<string, unknown>;
  const nomeCompleto = texto(compradorBruto.nomeCompleto) ?? texto(compradorBruto.nome);
  if (!nomeCompleto) problemas.push("comprador.nomeCompleto é obrigatório");

  const itensBrutos = Array.isArray(raiz.itens) ? raiz.itens : [];
  if (itensBrutos.length === 0) problemas.push("itens precisa ter ao menos um item");

  const itens: ChannelOrderItem[] = [];
  itensBrutos.forEach((bruto, i) => {
    if (bruto === null || typeof bruto !== "object") {
      problemas.push(`itens[${i}] precisa ser um objeto`);
      return;
    }
    const item = bruto as Record<string, unknown>;
    const externalListingId = texto(item.externalListingId) ?? texto(item.anuncio);
    const titulo = texto(item.titulo) ?? texto(item.nome);
    const quantidade = numero(item.quantidade);
    const precoUnitario = numero(item.precoUnitario) ?? numero(item.preco);

    if (!externalListingId && !texto(item.sku)) {
      problemas.push(`itens[${i}] precisa de externalListingId ou sku para achar o produto`);
    }
    if (!titulo) problemas.push(`itens[${i}].titulo é obrigatório`);
    if (quantidade === undefined || quantidade <= 0) {
      problemas.push(`itens[${i}].quantidade precisa ser um número maior que zero`);
    }
    if (precoUnitario === undefined || precoUnitario < 0) {
      problemas.push(`itens[${i}].precoUnitario precisa ser um número não negativo`);
    }

    if (titulo && quantidade !== undefined && precoUnitario !== undefined) {
      itens.push({
        externalListingId: externalListingId ?? "",
        externalVariationId: texto(item.externalVariationId),
        sku: texto(item.sku),
        titulo,
        quantidade,
        precoUnitario,
        opcoes:
          item.opcoes && typeof item.opcoes === "object" && !Array.isArray(item.opcoes)
            ? (item.opcoes as Record<string, string>)
            : undefined,
      });
    }
  });

  if (problemas.length > 0) throw new PedidoManualInvalido(problemas);

  const entregaBruta = (raiz.entrega ?? {}) as Record<string, unknown>;
  const custoEntrega = numero(entregaBruta.custo) ?? 0;

  const subtotal =
    numero(raiz.subtotal) ?? itens.reduce((s, i) => s + i.precoUnitario * i.quantidade, 0);
  const desconto = numero(raiz.desconto) ?? 0;
  const total = numero(raiz.total) ?? subtotal - desconto + custoEntrega;

  const pagamento = texto(raiz.statusPagamento) ?? "pendente";
  const statusPagamento: ChannelOrder["statusPagamento"] =
    pagamento === "pago" || pagamento === "cancelado" || pagamento === "estornado"
      ? pagamento
      : "pendente";

  return {
    externalOrderId,
    criadoEm: texto(raiz.criadoEm) ?? new Date().toISOString(),
    statusExterno: texto(raiz.statusExterno) ?? "manual",
    statusPagamento,
    comprador: {
      nomeCompleto: nomeCompleto as string,
      email: texto(compradorBruto.email),
      telefone: texto(compradorBruto.telefone) ?? texto(compradorBruto.whatsapp),
      documento: texto(compradorBruto.documento) ?? texto(compradorBruto.cpf),
    },
    itens,
    entrega: {
      metodo: texto(entregaBruta.metodo),
      custo: custoEntrega,
      destinatario: texto(entregaBruta.destinatario),
      cep: texto(entregaBruta.cep),
      logradouro: texto(entregaBruta.logradouro),
      numero: texto(entregaBruta.numero),
      complemento: texto(entregaBruta.complemento),
      bairro: texto(entregaBruta.bairro),
      cidade: texto(entregaBruta.cidade),
      uf: texto(entregaBruta.uf)?.toUpperCase(),
      prazoEstimado: texto(entregaBruta.prazoEstimado) ?? null,
    },
    subtotal,
    desconto,
    total,
    observacoes: texto(raiz.observacoes),
  };
}

const naoSuportado = (operacao: string) => {
  throw new ChannelNaoSuportado("manual", operacao);
};

export const manualAdapter: ChannelAdapter = {
  provider: "manual",
  label: "Canal manual",
  usaOAuth: false,

  authorizeUrl: () => naoSuportado("authorizeUrl"),
  exchangeCode: () => naoSuportado("exchangeCode"),
  refresh: () => naoSuportado("refresh"),

  // Categoria e atributo são conceitos do provedor. No manual não há provedor,
  // então a tela cai no campo livre em vez de num seletor vazio.
  async categories(): Promise<ChannelCategory[]> {
    return [];
  },
  async requiredAttributes(): Promise<ChannelAttribute[]> {
    return [];
  },

  // Publicar num canal manual é só passar a existir: o "anúncio" é o registro
  // local. Devolve id próprio para o restante do fluxo funcionar igual.
  async pushListing(_ctx: ChannelCtx, _listing: ListingInput) {
    return { externalId: gerarIdManual() };
  },
  async updateListing() {
    /* nada a enviar — o registro local já é a verdade */
  },
  async setPrice() {
    /* idem */
  },
  async setStock() {
    /* idem */
  },
  async endListing() {
    /* idem */
  },

  /**
   * Aceita um POST com o pedido no corpo. É o que permite exercitar o caminho
   * completo de entrada de pedido sem depender de marketplace nenhum.
   */
  async parseNotification(request: Request): Promise<ChannelEvent[]> {
    let corpo: unknown;
    try {
      corpo = await request.json();
    } catch {
      throw new PedidoManualInvalido(["corpo da requisição não é JSON válido"]);
    }
    const pedido = parseManualOrder(corpo);
    return [
      {
        tipo: "pedido",
        externalId: pedido.externalOrderId,
        ocorridoEm: new Date(pedido.criadoEm),
        raw: pedido,
      },
    ];
  },

  // Não há de onde buscar: o pedido manual chega inteiro na notificação e é
  // carregado do `raw` do evento pelo worker.
  fetchOrder: () => naoSuportado("fetchOrder"),

  async listOrdersSince(): Promise<ChannelOrder[]> {
    return [];
  },

  async pushShipment(_ctx: ChannelCtx, _externalOrderId: string, _tracking: Tracking) {
    /* não há para onde enviar o rastreio */
  },
};
