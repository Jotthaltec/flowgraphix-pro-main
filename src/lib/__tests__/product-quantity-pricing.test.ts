import { describe, expect, it } from "vitest";
import { readQuantityPricingRows, writeQuantityPricingRows } from "@/lib/product-quantity-pricing";

describe("tabela canônica de tiragens", () => {
  it("prioriza os campos explícitos de custo e venda", () => {
    const [row] = readQuantityPricingRows([
      {
        quantity: 100,
        price: 80,
        unitPrice: 0.8,
        sellPrice: 150,
        unitSellPrice: 1.5,
      },
    ]);
    expect(row.unitCost).toBe(0.8);
    expect(row.unitPrice).toBe(1.5);
  });

  it("recupera o formato legado do editor sem tratar venda unitária como total", () => {
    const [row] = readQuantityPricingRows([
      {
        quantity: 100,
        price: 0.8,
        unitPrice: 1.5,
        sellPrice: 1.5,
        total: 150,
      },
    ]);
    expect(row.unitPrice).toBe(1.5);
  });

  it("grava custo e venda unitários e totais sem ambiguidade", () => {
    const [saved] = writeQuantityPricingRows([
      {
        quantity: 250,
        unitCost: 0.42,
        unitPrice: 0.75,
        deadline: "4 dias",
        active: true,
      },
    ]);
    expect(saved).toMatchObject({
      quantity: 250,
      unitCost: 0.42,
      costTotal: 105,
      unitSellPrice: 0.75,
      sellTotal: 187.5,
      price: 105,
      sellPrice: 187.5,
    });
  });
});
