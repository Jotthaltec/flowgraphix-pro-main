/**
 * Comparação de tabelas de preço por tiragem (seção 27).
 *
 * Função pura (sem DB/rede), testável: compara o CUSTO atual do fornecedor
 * (guardado no produto) com o custo recém-coletado, identificando faixas
 * alteradas, novas e removidas, além de indisponibilidade.
 *
 * Importante: compara apenas o CUSTO do fornecedor. O preço de venda da gráfica
 * é tratado em separado e nunca é alterado automaticamente.
 */

export interface CurrentTier {
  quantity: number;
  cost: number; // custo total do fornecedor (campo `price` no quantity_price_table)
}

export interface FreshTier {
  quantity: number;
  total_price: number; // custo total recém-coletado
}

export type TierChangeKind = "same" | "changed" | "new" | "removed";

export interface TierDiff {
  quantity: number;
  oldCost: number | null;
  newCost: number | null;
  deltaAbs: number | null;
  deltaPct: number | null;
  kind: TierChangeKind;
}

export type ComparisonStatus = "unchanged" | "changed" | "unavailable";

export interface PriceComparison {
  status: ComparisonStatus;
  unavailable: boolean;
  tiers: TierDiff[];
  changedCount: number;
  newCount: number;
  removedCount: number;
}

const EPS = 0.005;

export function comparePriceTiers(
  currentTiers: CurrentTier[],
  freshTiers: FreshTier[],
  unavailable = false,
): PriceComparison {
  const curByQty = new Map(currentTiers.map((t) => [t.quantity, t.cost]));
  const freshByQty = new Map(freshTiers.map((t) => [t.quantity, t.total_price]));
  const quantities = [...new Set([...curByQty.keys(), ...freshByQty.keys()])].sort((a, b) => a - b);

  const tiers: TierDiff[] = [];
  let changedCount = 0;
  let newCount = 0;
  let removedCount = 0;

  for (const q of quantities) {
    const oldCost = curByQty.has(q) ? curByQty.get(q)! : null;
    const newCost = freshByQty.has(q) ? freshByQty.get(q)! : null;

    let kind: TierChangeKind;
    if (oldCost == null && newCost != null) {
      kind = "new";
      newCount++;
    } else if (oldCost != null && newCost == null) {
      kind = "removed";
      removedCount++;
    } else if (oldCost != null && newCost != null && Math.abs(newCost - oldCost) > EPS) {
      kind = "changed";
      changedCount++;
    } else {
      kind = "same";
    }

    const deltaAbs = oldCost != null && newCost != null ? parseFloat((newCost - oldCost).toFixed(2)) : null;
    const deltaPct =
      oldCost != null && newCost != null && oldCost > 0
        ? parseFloat((((newCost - oldCost) / oldCost) * 100).toFixed(2))
        : null;

    tiers.push({ quantity: q, oldCost, newCost, deltaAbs, deltaPct, kind });
  }

  const status: ComparisonStatus = unavailable
    ? "unavailable"
    : changedCount + newCount + removedCount > 0
      ? "changed"
      : "unchanged";

  return { status, unavailable, tiers, changedCount, newCount, removedCount };
}
