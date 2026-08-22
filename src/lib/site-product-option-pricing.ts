export type BuildOptionModifierInput = {
  basePrice: number;
  optionPrice?: number | null;
};

export function buildOptionModifier({ basePrice, optionPrice }: BuildOptionModifierInput) {
  const base = Number.isFinite(basePrice) ? Number(basePrice) : 0;
  const option = Number.isFinite(Number(optionPrice)) ? Number(optionPrice) : null;

  if (option == null || base <= 0) {
    return { modifierType: 'fixo', modifierValue: 0 };
  }

  const delta = Number((option - base).toFixed(4));
  return { modifierType: 'fixo', modifierValue: delta };
}
