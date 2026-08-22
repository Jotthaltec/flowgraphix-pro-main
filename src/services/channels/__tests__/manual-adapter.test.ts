import { describe, it, expect } from "vitest";
import {
  getChannelAdapter,
  manualAdapter,
  parseManualOrder,
  PedidoManualInvalido,
  ChannelNaoSuportado,
} from "@/services/channels";

const PEDIDO_MINIMO = {
  comprador: { nomeCompleto: "Maria Souza" },
  itens: [{ sku: "CV-500", titulo: "Cartão de visita 500un", quantidade: 1, precoUnitario: 89.9 }],
};

describe("parseManualOrder", () => {
  it("aceita o pedido mínimo e calcula os totais", () => {
    const pedido = parseManualOrder(PEDIDO_MINIMO);

    expect(pedido.comprador.nomeCompleto).toBe("Maria Souza");
    expect(pedido.itens).toHaveLength(1);
    expect(pedido.subtotal).toBe(89.9);
    expect(pedido.total).toBe(89.9);
    expect(pedido.statusPagamento).toBe("pendente");
    expect(pedido.externalOrderId).toMatch(/^MANUAL-/);
  });

  it("soma frete e desconto no total quando não vem total explícito", () => {
    const pedido = parseManualOrder({
      ...PEDIDO_MINIMO,
      desconto: 10,
      entrega: { custo: 25.5, cidade: "Recife", uf: "pe" },
    });

    expect(pedido.total).toBeCloseTo(105.4, 2);
    expect(pedido.entrega.uf).toBe("PE");
  });

  it("respeita o total informado em vez de recalcular", () => {
    const pedido = parseManualOrder({ ...PEDIDO_MINIMO, total: 150 });
    expect(pedido.total).toBe(150);
  });

  it("entende preço em formato de planilha brasileira", () => {
    const pedido = parseManualOrder({
      ...PEDIDO_MINIMO,
      itens: [{ sku: "BN-1", titulo: "Banner", quantidade: 2, precoUnitario: "1.234,56" }],
    });
    expect(pedido.itens[0].precoUnitario).toBeCloseTo(1234.56, 2);
    expect(pedido.subtotal).toBeCloseTo(2469.12, 2);
  });

  it("reclama de comprador sem nome", () => {
    expect(() => parseManualOrder({ itens: PEDIDO_MINIMO.itens })).toThrow(PedidoManualInvalido);
  });

  it("reclama de pedido sem itens", () => {
    expect(() => parseManualOrder({ comprador: { nomeCompleto: "X" }, itens: [] })).toThrow(
      /ao menos um item/,
    );
  });

  it("exige sku ou anúncio para conseguir achar o produto", () => {
    let capturado: PedidoManualInvalido | undefined;
    try {
      parseManualOrder({
        comprador: { nomeCompleto: "X" },
        itens: [{ titulo: "Sem identificação", quantidade: 1, precoUnitario: 10 }],
      });
    } catch (erro) {
      capturado = erro as PedidoManualInvalido;
    }
    expect(capturado?.problemas).toContain(
      "itens[0] precisa de externalListingId ou sku para achar o produto",
    );
  });

  it("junta todos os problemas em vez de parar no primeiro", () => {
    let capturado: PedidoManualInvalido | undefined;
    try {
      parseManualOrder({ itens: [{ sku: "A", quantidade: 0, precoUnitario: -1 }] });
    } catch (erro) {
      capturado = erro as PedidoManualInvalido;
    }
    expect(capturado?.problemas.length).toBeGreaterThanOrEqual(3);
  });

  it("não aceita conteúdo que não seja objeto", () => {
    expect(() => parseManualOrder("[]")).toThrow(PedidoManualInvalido);
    expect(() => parseManualOrder([PEDIDO_MINIMO])).toThrow(PedidoManualInvalido);
  });
});

describe("manualAdapter", () => {
  it("está registrado e é resolvido pelo provider", () => {
    expect(getChannelAdapter("manual")).toBe(manualAdapter);
  });

  it("lança em provider desconhecido em vez de devolver nada", () => {
    expect(() => getChannelAdapter("olx")).toThrow(/Canal desconhecido/);
  });

  it("gera id externo que não se passa por outro marketplace", async () => {
    const { externalId } = await manualAdapter.pushListing({} as never, {} as never);
    expect(externalId).toMatch(/^MANUAL-/);
    expect(externalId).not.toMatch(/^MLB/);
  });

  it("recusa OAuth em vez de fingir que conectou", () => {
    expect(() => manualAdapter.authorizeUrl("estado", "https://exemplo")).toThrow(
      ChannelNaoSuportado,
    );
  });

  it("transforma um POST de pedido em evento", async () => {
    const request = new Request("https://exemplo/api/canais/webhook/manual", {
      method: "POST",
      body: JSON.stringify(PEDIDO_MINIMO),
      headers: { "content-type": "application/json" },
    });

    const eventos = await manualAdapter.parseNotification(request);

    expect(eventos).toHaveLength(1);
    expect(eventos[0].tipo).toBe("pedido");
    expect(eventos[0].externalId).toMatch(/^MANUAL-/);
  });

  it("rejeita corpo que não é JSON", async () => {
    const request = new Request("https://exemplo/api/canais/webhook/manual", {
      method: "POST",
      body: "isto não é json",
    });
    await expect(manualAdapter.parseNotification(request)).rejects.toThrow(PedidoManualInvalido);
  });
});
