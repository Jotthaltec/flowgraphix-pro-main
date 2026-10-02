import { describe, expect, it } from "vitest";
import { buildPriceTable, mergeDeadline } from "../supplierPricing";

const prev = [
  { quantity: 50, price: 40, sellPrice: 50.98, promoSellPrice: null },
  { quantity: 100, price: 38.99, sellPrice: 58.48, promoSellPrice: null },
];
const now = new Date("2026-10-03T09:00:00Z");

describe("buildPriceTable", () => {
  it('custo caiu: vira promoção com o mesmo % e o preço normal vira o "de"', () => {
    // 40,00 → 30,00 = 25% de queda.
    const r = buildPriceTable(prev, [{ quantity: 50, total_price: 30, unit_price: 0.6 }], 50, now);
    const t = r.table[0];
    expect(t.sellPrice).toBe(50.98);
    expect(t.promoSellPrice).toBe(38.24); // 50,98 × 0,75
    expect(t.promoDiscountPercent).toBe(25);
    expect(t.listPrice).toBe(40);
    expect(t.promoSince).toBe(now.toISOString());
    expect(r.promoStarted).toEqual([50]);
  });

  it("custo subiu: mantém o preço de venda, sem promoção", () => {
    const r = buildPriceTable(
      prev,
      [{ quantity: 100, total_price: 42, unit_price: 0.42 }],
      50,
      now,
    );
    expect(r.table[0].sellPrice).toBe(58.48);
    expect(r.table[0].promoSellPrice).toBeNull();
    expect(r.table[0].price).toBe(42);
    expect(r.costChanged).toEqual([100]);
    expect(r.promoStarted).toEqual([]);
  });

  it("custo igual: nada muda", () => {
    const r = buildPriceTable(prev, [{ quantity: 50, total_price: 40, unit_price: 0.8 }], 50, now);
    expect(r.table[0].promoSellPrice).toBeNull();
    expect(r.costChanged).toEqual([]);
  });

  it("promoção continua enquanto o custo segue abaixo do normal, mantendo o início", () => {
    const d1 = buildPriceTable(prev, [{ quantity: 50, total_price: 30, unit_price: 0.6 }], 50, now);
    const later = new Date("2026-10-10T09:00:00Z");
    const d2 = buildPriceTable(
      d1.table,
      [{ quantity: 50, total_price: 32, unit_price: 0.64 }],
      50,
      later,
    );
    expect(d2.table[0].listPrice).toBe(40); // referência continua sendo o normal
    expect(d2.table[0].promoSellPrice).toBe(40.78); // 50,98 × 0,8
    expect(d2.table[0].promoSince).toBe(now.toISOString());
    expect(d2.promoStarted).toEqual([]);
  });

  it("custo volta ao normal: fim da promoção e preço normal de volta", () => {
    const emPromo = buildPriceTable(
      prev,
      [{ quantity: 50, total_price: 30, unit_price: 0.6 }],
      50,
      now,
    );
    const r = buildPriceTable(
      emPromo.table,
      [{ quantity: 50, total_price: 40, unit_price: 0.8 }],
      50,
      now,
    );
    expect(r.table[0].sellPrice).toBe(50.98);
    expect(r.table[0].promoSellPrice).toBeNull();
    expect(r.table[0].listPrice).toBeNull();
    expect(r.table[0].promoSince).toBeNull();
    expect(r.promoEnded).toEqual([50]);
  });

  it("promoção com mais de 30 dias gera alerta", () => {
    const d1 = buildPriceTable(prev, [{ quantity: 50, total_price: 30, unit_price: 0.6 }], 50, now);
    const later = new Date("2026-11-05T09:00:00Z");
    const r = buildPriceTable(
      d1.table,
      [{ quantity: 50, total_price: 30, unit_price: 0.6 }],
      50,
      later,
    );
    expect(r.alerts.find((a) => a.kind === "promocao_longa")?.days).toBe(33);
  });

  it("faixa nova não vira promoção (sem custo normal de referência)", () => {
    const r = buildPriceTable([], [{ quantity: 500, total_price: 80, unit_price: 0.16 }], 50, now);
    expect(r.table[0].sellPrice).toBe(120);
    expect(r.table[0].promoSellPrice).toBeNull();
  });

  it("alerta quando o custo sobe acima do preço de venda, sem mexer no preço", () => {
    const r = buildPriceTable(prev, [{ quantity: 50, total_price: 55, unit_price: 1.1 }], 50, now);
    expect(r.table[0].sellPrice).toBe(50.98);
    expect(r.alerts).toEqual([{ quantity: 50, kind: "prejuizo", marginPercent: -7.89 }]);
  });

  it("promoção que sumiu junto com a faixa também é encerrada", () => {
    const emPromo = buildPriceTable(
      prev,
      [{ quantity: 50, total_price: 30, unit_price: 0.6 }],
      50,
      now,
    );
    const r = buildPriceTable(
      emPromo.table,
      [{ quantity: 100, total_price: 38.99, unit_price: 0.39 }],
      50,
      now,
    );
    expect(r.promoEnded).toEqual([50]);
  });

  it("tabela antiga sem custo (só sellPrice) não inventa promoção", () => {
    const r = buildPriceTable(
      [{ quantity: 50, sellPrice: 50.98 }],
      [{ quantity: 50, total_price: 30, unit_price: 0.6 }],
      50,
      now,
    );
    expect(r.table[0].promoSellPrice).toBeNull();
    expect(r.table[0].sellPrice).toBe(50.98);
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
