export interface QuantityPricingFormRow {
  quantity: number;
  unitCost: number;
  unitPrice: number;
  deadline: string;
  active: boolean;
}

type PricingRecord = Record<string, unknown>;

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function firstPositive(...values: unknown[]): number {
  for (const value of values) {
    const parsed = numberValue(value);
    if (parsed > 0) return parsed;
  }
  return 0;
}

/**
 * Lê formatos históricos sem confundir total com valor unitário.
 * O importador antigo gravava `price` como custo total; uma versão do editor
 * gravava `sellPrice` como unitário. Os campos canônicos sempre têm prioridade.
 */
export function readQuantityPricingRows(rows: unknown[]): QuantityPricingFormRow[] {
  return rows.map((raw) => {
    const row = (raw && typeof raw === "object" ? raw : {}) as PricingRecord;
    const quantity = Math.max(0, Math.floor(numberValue(row.quantity)));
    const legacySell = firstPositive(row.sellPrice, row.sell_price);
    const legacyEditorTotal = firstPositive(row.total);
    const legacySellIsUnit =
      quantity > 0 &&
      legacySell > 0 &&
      legacyEditorTotal > 0 &&
      Math.abs(legacyEditorTotal - legacySell * quantity) < 0.02;
    const legacyCostTotal = firstPositive(row.costTotal, row.cost_total, row.price);
    const unitCost = firstPositive(
      row.unitCost,
      row.unit_cost,
      legacySellIsUnit ? row.price : 0,
      quantity > 0 && legacyCostTotal > 0 ? legacyCostTotal / quantity : 0,
      legacySellIsUnit ? 0 : row.unitPrice,
      legacySellIsUnit ? 0 : row.unit_price,
    );

    const sellTotal = firstPositive(row.sellTotal, row.sell_total);
    const unitPrice = firstPositive(
      row.unitSellPrice,
      row.unit_sell_price,
      quantity > 0 && sellTotal > 0 ? sellTotal / quantity : 0,
      legacySellIsUnit ? legacySell : 0,
      quantity > 0 && legacySell > 0 ? legacySell / quantity : 0,
      row.saleUnitPrice,
      row.sale_unit_price,
    );

    return {
      quantity,
      unitCost,
      unitPrice,
      deadline: typeof row.deadline === "string" ? row.deadline : "",
      active: row.active !== false,
    };
  });
}

/** Grava contrato explícito e também os aliases legados ainda consumidos. */
export function writeQuantityPricingRows(rows: QuantityPricingFormRow[]) {
  return rows
    .filter((row) => row.quantity > 0)
    .map((row) => {
      const quantity = Math.floor(row.quantity);
      const unitCost = numberValue(row.unitCost);
      const unitSellPrice = numberValue(row.unitPrice);
      const costTotal = Number((unitCost * quantity).toFixed(2));
      const sellTotal = Number((unitSellPrice * quantity).toFixed(2));
      return {
        quantity,
        unitCost,
        costTotal,
        unitSellPrice,
        sellTotal,
        // Compatibilidade com importador/publicador antigos.
        price: costTotal,
        unitPrice: unitCost,
        sellPrice: sellTotal,
        total: sellTotal,
        deadline: row.deadline,
        active: row.active,
      };
    });
}
