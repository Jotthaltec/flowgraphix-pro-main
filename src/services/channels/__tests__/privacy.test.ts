import { describe, it, expect } from "vitest";
import { podarPayload, VALOR_REDIGIDO } from "@/services/channels";

describe("podarPayload", () => {
  it("redige dado pessoal em qualquer profundidade", () => {
    const podado = podarPayload({
      id: 200000123,
      buyer: {
        nickname: "MARIA123",
        email: "maria@exemplo.com",
        phone: { area_code: "81", number: "999998888" },
        billing_info: { doc_number: "12345678901" },
      },
      shipping: { receiver_address: { city: { name: "Recife" }, zip_code: "50000-000" } },
    }) as Record<string, any>;

    expect(podado.id).toBe(200000123);
    // Apelido não é dado sensível e ajuda a identificar o pedido no canal.
    expect(podado.buyer.nickname).toBe("MARIA123");
    expect(podado.buyer.email).toBe(VALOR_REDIGIDO);
    expect(podado.buyer.phone).toBe(VALOR_REDIGIDO);
    expect(podado.buyer.billing_info).toBe(VALOR_REDIGIDO);
    // Endereço de entrega é operacional: sem ele não se despacha.
    expect(podado.shipping.receiver_address.city.name).toBe("Recife");
  });

  it("não confunde palavra curta com trecho de outra palavra", () => {
    // "ip" dentro de "shipping" e "description" já apagou endereço de entrega
    // numa versão anterior desta função — o caso fica travado por teste.
    const podado = podarPayload({
      shipping: { description: "Envio expresso", cost: 25 },
      client_ip: "200.1.2.3",
      ipAddress: "10.0.0.1",
    }) as Record<string, any>;

    expect(podado.shipping.description).toBe("Envio expresso");
    expect(podado.shipping.cost).toBe(25);
    expect(podado.client_ip).toBe(VALOR_REDIGIDO);
    expect(podado.ipAddress).toBe(VALOR_REDIGIDO);
  });

  it("pega variação de grafia da mesma chave", () => {
    const podado = podarPayload({
      doc_number: "1",
      docNumber: "2",
      "DOC-NUMBER": "3",
      taxId: "4",
    }) as Record<string, unknown>;

    for (const valor of Object.values(podado)) {
      expect(valor).toBe(VALOR_REDIGIDO);
    }
  });

  it("redige dentro de arrays", () => {
    const podado = podarPayload({
      payments: [{ id: 1, payer: { email: "x@y.com" } }],
    }) as Record<string, any>;

    expect(podado.payments[0].id).toBe(1);
    expect(podado.payments[0].payer).toBe(VALOR_REDIGIDO);
  });

  it("trunca payload grande em vez de guardar megabytes", () => {
    const grande = { itens: Array.from({ length: 20000 }, (_, i) => ({ i, nome: `item ${i}` })) };
    const podado = podarPayload(grande) as Record<string, unknown>;

    expect(podado.aviso).toMatch(/truncado/);
    expect(typeof podado.inicio).toBe("string");
  });

  it("sobrevive a payload com ciclo", () => {
    const ciclico: Record<string, unknown> = { nome: "pedido" };
    ciclico.eu = ciclico;

    // A guarda de profundidade corta o ciclo; nada de estouro de pilha.
    expect(() => podarPayload(ciclico)).not.toThrow();
  });

  it("devolve null para ausência", () => {
    expect(podarPayload(null)).toBeNull();
    expect(podarPayload(undefined)).toBeNull();
  });

  it("não mexe em valores simples", () => {
    expect(podarPayload({ total: 199.9, pago: true, status: "paid" })).toEqual({
      total: 199.9,
      pago: true,
      status: "paid",
    });
  });
});
