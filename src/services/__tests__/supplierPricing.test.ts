import { describe, expect, it } from "vitest";
import { buildPriceTable, mergeDeadline } from "../supplierPricing";

const prev = [
  { quantity: 50, price: 33.99, sellPrice: 50.98, promoSellPrice: null },
  { quantity: 100, price: 38.99, sellPrice: 58.48, promoSellPrice: null },
];

describe("buildPriceTable", () => {
  it("mudança normal do fornecedor mantém o preço de venda", () => {
    const r = buildPriceTable(
      prev,
      [
        { quantity: 50, total_price: 36.0, unit_price: 0.72 },
        { quantity: 100, total_price: 30.0, unit_price: 0.3 },
      ],
      50,
    );
    expect(r.table.map((t) => t.sellPrice)).toEqual([50.98, 58.48]);
    expect(r.table.map((t) => t.price)).toEqual([36.0, 30.0]);
    expect(r.table.every((t) => t.promoSellPrice === null)).toBe(true);
    expect(r.costChanged).toEqual([50, 100]);
    expect(r.promoStarted).toEqual([]);
  });

  it("promoção do fornecedor vira promoção com o mesmo percentual", () => {
    // Fornecedor: de 40,00 por 30,00 (25% off).
    const r = buildPriceTable(
      prev,
      [{ quantity: 50, total_price: 30, unit_price: 0.6, old_price: 40 }],
      50,
    );
    const t = r.table[0];
    expect(t.sellPrice).toBe(50.98); // "de" na loja = nosso preço normal
    expect(t.promoSellPrice).toBe(38.24); // 50,98 × 0,75
    expect(t.promoDiscountPercent).toBe(25);
    expect(t.listPrice).toBe(40);
    expect(r.promoStarted).toEqual([50]);
  });

  it("fim da promoção volta ao preço normal", () => {
    const emPromo = buildPriceTable(
      prev,
      [{ quantity: 50, total_price: 30, unit_price: 0.6, old_price: 40 }],
      50,
    );
    const r = buildPriceTable(
      emPromo.table,
      [{ quantity: 50, total_price: 40, unit_price: 0.8 }],
      50,
    );
    expect(r.table[0].sellPrice).toBe(50.98);
    expect(r.table[0].promoSellPrice).toBeNull();
    expect(r.table[0].listPrice).toBeNull();
    expect(r.promoEnded).toEqual([50]);
  });

  it("faixa nova em promoção usa a margem sobre o custo normal", () => {
    const r = buildPriceTable(
      [],
      [{ quantity: 500, total_price: 80, unit_price: 0.16, old_price: 100 }],
      50,
    );
    expect(r.table[0].sellPrice).toBe(150);
    expect(r.table[0].promoSellPrice).toBe(120);
  });

  it("alerta quando o custo sobe e a margem cai, sem mexer no preço", () => {
    const r = buildPriceTable(prev, [{ quantity: 50, total_price: 55, unit_price: 1.1 }], 50);
    expect(r.table[0].sellPrice).toBe(50.98);
    expect(r.alerts).toEqual([{ quantity: 50, kind: "prejuizo", marginPercent: -7.89 }]);
  });

  it("promoção que sumiu junto com a faixa também é encerrada", () => {
    const emPromo = buildPriceTable(
      prev,
      [{ quantity: 50, total_price: 30, unit_price: 0.6, old_price: 40 }],
      50,
    );
    const r = buildPriceTable(
      emPromo.table,
      [{ quantity: 100, total_price: 38.99, unit_price: 0.39 }],
      50,
    );
    expect(r.promoEnded).toEqual([50]);
  });
});

describe("mergeDeadline", () => {
  it("preserva os nossos dias", () => {
    expect(
      mergeDeadline("Total: 6 dias (fornecedor 1 + nossos 5) + frete", "2 dias úteis + frete", 2),
    ).toBe("Total: 7 dias (fornecedor 2 + nossos 5) + frete");
  });
  it("sem produção interna, usa o texto do fornecedor", () => {
    expect(mergeDeadline("3 dias úteis", "4 dias úteis", 4)).toBe("4 dias úteis");
  });
});
