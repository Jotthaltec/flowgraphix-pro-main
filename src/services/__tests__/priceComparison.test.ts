import { describe, it, expect } from "vitest";
import { comparePriceTiers } from "@/services/priceComparison";

describe("comparePriceTiers (seção 27)", () => {
  it("detecta faixa alterada com delta correto", () => {
    const c = comparePriceTiers([{ quantity: 100, cost: 88.99 }], [{ quantity: 100, total_price: 99.99 }]);
    expect(c.status).toBe("changed");
    expect(c.changedCount).toBe(1);
    const t = c.tiers.find((x) => x.quantity === 100)!;
    expect(t.kind).toBe("changed");
    expect(t.deltaAbs).toBe(11);
    expect(t.deltaPct).toBeCloseTo(12.36, 1);
  });

  it("identifica faixa nova e removida", () => {
    const c = comparePriceTiers(
      [{ quantity: 100, cost: 50 }, { quantity: 500, cost: 200 }],
      [{ quantity: 100, total_price: 50 }, { quantity: 1000, total_price: 350 }],
    );
    expect(c.newCount).toBe(1);
    expect(c.removedCount).toBe(1);
    expect(c.tiers.find((t) => t.quantity === 1000)!.kind).toBe("new");
    expect(c.tiers.find((t) => t.quantity === 500)!.kind).toBe("removed");
  });

  it("sem mudanças => unchanged", () => {
    const c = comparePriceTiers([{ quantity: 100, cost: 50 }], [{ quantity: 100, total_price: 50 }]);
    expect(c.status).toBe("unchanged");
    expect(c.changedCount + c.newCount + c.removedCount).toBe(0);
  });

  it("indisponível tem precedência no status", () => {
    const c = comparePriceTiers([{ quantity: 100, cost: 50 }], [{ quantity: 100, total_price: 60 }], true);
    expect(c.status).toBe("unavailable");
    expect(c.unavailable).toBe(true);
  });

  it("ignora diferenças de centavos abaixo do epsilon", () => {
    const c = comparePriceTiers([{ quantity: 100, cost: 50.0 }], [{ quantity: 100, total_price: 50.004 }]);
    expect(c.status).toBe("unchanged");
  });
});
