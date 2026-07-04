import { describe, it, expect } from "vitest";
import {
  buildPurchaseChecklist,
  checklistTotal,
  formatDeliveryText,
  type ChecklistItem,
} from "@/lib/purchase-assist";

const items: ChecklistItem[] = [
  { product_name: "Cartão de Visita Couché", source_url: "https://futuraim.com.br/produto/cartao?id=4627", supplier_sku: "4627", quantity: 1000, unit_cost: 0.089 },
  { product_name: "Banner Personalizado", source_url: "https://futuraim.com.br/produto/banner?id=22502", supplier_sku: "22502", quantity: 2, unit_cost: 45 },
];

describe("checklistTotal", () => {
  it("soma quantidade × custo unitário de cada item", () => {
    expect(checklistTotal(items)).toBeCloseTo(1000 * 0.089 + 2 * 45, 2);
  });
  it("é zero para lista vazia", () => {
    expect(checklistTotal([])).toBe(0);
  });
});

describe("formatDeliveryText", () => {
  it("formata retirada com o ponto de retirada", () => {
    expect(formatDeliveryText({ receiving_mode: "pickup", pickup_point: "Balcão Centro" }))
      .toBe("Retirada: Balcão Centro");
  });

  it("monta o endereço de entrega em linhas", () => {
    const txt = formatDeliveryText({
      receiving_mode: "delivery",
      recipient: "Gráfica X",
      address: "Rua A",
      number: "100",
      complement: "Sala 2",
      neighborhood: "Centro",
      city: "São Paulo",
      state: "SP",
      zip: "01000-000",
      phone: "1199999",
    });
    expect(txt).toContain("Gráfica X");
    expect(txt).toContain("Rua A, 100 — Sala 2");
    expect(txt).toContain("Centro · São Paulo · SP");
    expect(txt).toContain("CEP 01000-000");
  });

  it("tolera destino ausente", () => {
    expect(formatDeliveryText(null)).toBe("Destino não informado.");
  });
});

describe("buildPurchaseChecklist", () => {
  const text = buildPurchaseChecklist({
    poNumber: "PC-000001",
    supplierName: "FuturaIM",
    supplierUrl: "https://futuraim.com.br",
    account: { login_username: "grafica@x.com", registration_cnpj: "00.000.000/0001-00", has_password: true },
    delivery: { receiving_mode: "pickup", pickup_point: "Balcão Centro" },
    items,
  });

  it("inclui cabeçalho, conta, destino e todos os itens com link", () => {
    expect(text).toContain("PEDIDO DE COMPRA PC-000001");
    expect(text).toContain("Fornecedor: FuturaIM");
    expect(text).toContain("Login: grafica@x.com");
    expect(text).toContain("Senha: (salva");
    expect(text).toContain("Retirada: Balcão Centro");
    expect(text).toContain("Cartão de Visita Couché");
    expect(text).toContain("https://futuraim.com.br/produto/banner?id=22502");
    expect(text).toContain("SKU 4627");
  });

  it("mostra o total estimado somando os itens", () => {
    expect(text).toContain("TOTAL ESTIMADO:");
    // 1000×0,089 + 2×45 = 179,00
    expect(text).toContain("179");
  });

  it("nunca vaza a senha em texto plano (write-only por design)", () => {
    expect(text.toLowerCase()).not.toContain("password");
  });
});
