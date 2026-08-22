import { describe, expect, it } from 'vitest';
import { buildOptionModifier } from '@/lib/site-product-option-pricing';

describe('buildOptionModifier', () => {
  it('usa o delta real do preço quando a opção encarece o produto', () => {
    expect(buildOptionModifier({ basePrice: 22.48, optionPrice: 24.99 })).toEqual({
      modifierType: 'fixo',
      modifierValue: 2.51,
    });
  });

  it('preserva ajuste nulo quando a opção não muda o preço base', () => {
    expect(buildOptionModifier({ basePrice: 22.48, optionPrice: 22.48 })).toEqual({
      modifierType: 'fixo',
      modifierValue: 0,
    });
  });

  it('aplica delta negativo para opções mais baratas', () => {
    expect(buildOptionModifier({ basePrice: 22.48, optionPrice: 19.9 })).toEqual({
      modifierType: 'fixo',
      modifierValue: -2.58,
    });
  });
});
