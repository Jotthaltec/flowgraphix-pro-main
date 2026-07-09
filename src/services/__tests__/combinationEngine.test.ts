/**
 * Testes do Motor de Combinações de Fornecedores (arquitetura de PRODUTO COMERCIAL).
 *
 * Valida:
 * - buildCombinationHash inclui a quantidade e é determinístico
 * - getCompatibleValues filtra a cascata sobre os produtos comerciais
 * - getAvailableQuantities lista uma quantidade por produto comercial
 * - resolveCommercialProduct retorna o produto EXATO (opções + quantidade) e
 *   nunca aproxima
 * - getCompatibleExtras filtra por compatibilidade e quantidade
 * - calculateLeadTime aplica regras configuráveis
 * - calculateQuoteItem decompõe todas as parcelas e usa o preço oficial
 * - Modo espelhar = custo fornecedor sem margem
 */

import { describe, it, expect } from 'vitest';

import {
  buildCombinationHash,
  buildOptionSetKey,
  getCompatibleValues,
  getAvailableQuantities,
  resolveCommercialProduct,
  getCompatibleExtras,
  calculateLeadTime,
  calculateQuoteItem,
  type FamilyCombinationData,
  type RawPromotion,
} from '../combinationEngine';

import type {
  SupplierProductFamily,
  SupplierOptionGroup,
  SupplierOptionValue,
  SupplierCommercialProduct,
  SupplierCommercialProductOption,
  SupplierExtra,
  SupplierExtraCompatibility,
  SupplierExtraPrice,
} from '@/types/combinationTypes';

// ---------------------------------------------------------------------------
// Fixtures — Cartão de Visita em Couché (espelha FuturaIM)
// ---------------------------------------------------------------------------

const family: SupplierProductFamily = {
  id: 'fam-1', company_id: 'co-1', supplier_id: 'sup-1', catalog_product_id: null,
  external_id: '4627', name: 'Cartão de Visita em Couché com Verniz Localizado',
  slug: 'cartao-visita-couche', category: 'Cartões', source_url: null, image_url: null, description: null,
  lead_time_rule: 'max_extra', pricing_strategy: 'MATRIX', is_active: true, version: 1,
  last_synced_at: null, created_at: '2026-07-05T00:00:00Z', updated_at: '2026-07-05T00:00:00Z',
};

const groups: SupplierOptionGroup[] = [
  { id: 'g-mat', company_id: 'co-1', family_id: 'fam-1', name: 'Material', normalized_name: 'material', code: 'MATERIAL', order_index: 0, is_required: true, created_at: '', updated_at: '' },
  { id: 'g-fmt', company_id: 'co-1', family_id: 'fam-1', name: 'Formato', normalized_name: 'formato', code: 'FORMATO', order_index: 1, is_required: true, created_at: '', updated_at: '' },
  { id: 'g-imp', company_id: 'co-1', family_id: 'fam-1', name: 'Impressão', normalized_name: 'impressao', code: 'IMPRESSAO', order_index: 2, is_required: true, created_at: '', updated_at: '' },
];

const values: SupplierOptionValue[] = [
  { id: 'v-c300', company_id: 'co-1', group_id: 'g-mat', name: 'Couché 300g', normalized_name: 'couche_300g', code: 'COUCHE_300G', external_id: null, order_index: 0, is_active: true, created_at: '' },
  { id: 'v-c250', company_id: 'co-1', group_id: 'g-mat', name: 'Couché 250g', normalized_name: 'couche_250g', code: 'COUCHE_250G', external_id: null, order_index: 1, is_active: true, created_at: '' },
  { id: 'v-88x48', company_id: 'co-1', group_id: 'g-fmt', name: '88x48mm', normalized_name: '88x48mm', code: '88X48', external_id: null, order_index: 0, is_active: true, created_at: '' },
  { id: 'v-90x50', company_id: 'co-1', group_id: 'g-fmt', name: '90x50mm', normalized_name: '90x50mm', code: '90X50', external_id: null, order_index: 1, is_active: true, created_at: '' },
  { id: 'v-4x0', company_id: 'co-1', group_id: 'g-imp', name: '4x0', normalized_name: '4x0', code: '4X0', external_id: null, order_index: 0, is_active: true, created_at: '' },
  { id: 'v-4x4', company_id: 'co-1', group_id: 'g-imp', name: '4x4', normalized_name: '4x4', code: '4X4', external_id: null, order_index: 1, is_active: true, created_at: '' },
];

// Helper para criar um produto comercial completo
function makeProduct(over: Partial<SupplierCommercialProduct>): SupplierCommercialProduct {
  return {
    id: 'x', company_id: 'co-1', supplier_id: 'sup-1', family_id: 'fam-1',
    external_product_id: null, external_sku: null, complete_name: null,
    quantity: 500, quantity_unit: 'un',
    model: null, type: null, size: null, material: null, grammage: null, format: null,
    width: null, height: null, print_color: null, enhancement: null, finishing: null,
    production_days: 3, availability: 'available', list_price: null, promotional_price: null,
    currency: 'BRL', combination_hash: '', source_url: null, raw_source_data: {}, version: 1,
    last_synced_at: null, created_at: '', updated_at: '',
    ...over,
  };
}

// Config A (Couché 300g + 88x48 + 4x0) em 3 quantidades → 3 produtos comerciais
const optsA = ['v-c300', 'v-88x48', 'v-4x0'];
const optsB = ['v-c300', 'v-88x48', 'v-4x4'];
const optsC = ['v-c250', 'v-90x50', 'v-4x0'];

const products: SupplierCommercialProduct[] = [
  makeProduct({ id: 'cp-1a', external_product_id: '4601', quantity: 100, list_price: 35.99, combination_hash: buildCombinationHash(optsA, 100), production_days: 3 }),
  makeProduct({ id: 'cp-1b', external_product_id: '4611', quantity: 500, list_price: 78.99, combination_hash: buildCombinationHash(optsA, 500), production_days: 3 }),
  makeProduct({ id: 'cp-1c', external_product_id: '4621', quantity: 1000, list_price: 119.99, combination_hash: buildCombinationHash(optsA, 1000), production_days: 3 }),
  makeProduct({ id: 'cp-2a', external_product_id: '4602', quantity: 500, list_price: 99.99, combination_hash: buildCombinationHash(optsB, 500), production_days: 3 }),
  makeProduct({ id: 'cp-3a', external_product_id: '4603', quantity: 500, list_price: 89.99, combination_hash: buildCombinationHash(optsC, 500), production_days: 5 }),
];

const productOptions: SupplierCommercialProductOption[] = [
  ...optsA.flatMap(ov => ['cp-1a', 'cp-1b', 'cp-1c'].map(pid => ({ id: `${pid}-${ov}`, commercial_product_id: pid, option_value_id: ov }))),
  ...optsB.map(ov => ({ id: `cp-2a-${ov}`, commercial_product_id: 'cp-2a', option_value_id: ov })),
  ...optsC.map(ov => ({ id: `cp-3a-${ov}`, commercial_product_id: 'cp-3a', option_value_id: ov })),
];

const familyData: FamilyCombinationData = { family, groups, values, products, productOptions };

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

describe('buildCombinationHash / buildOptionSetKey', () => {
  it('hash é determinístico e independe da ordem das opções', () => {
    expect(buildCombinationHash(['v-c300', 'v-88x48', 'v-4x0'], 500))
      .toBe(buildCombinationHash(['v-4x0', 'v-c300', 'v-88x48'], 500));
  });

  it('hash inclui a quantidade na identidade (quantidades diferentes → hashes diferentes)', () => {
    expect(buildCombinationHash(optsA, 100)).not.toBe(buildCombinationHash(optsA, 500));
  });

  it('option set key ignora quantidade e ordem', () => {
    expect(buildOptionSetKey(['v-4x0', 'v-c300'])).toBe(buildOptionSetKey(['v-c300', 'v-4x0']));
  });
});

describe('getCompatibleValues', () => {
  it('sem seleção, mostra ambos os materiais', () => {
    const results = getCompatibleValues(familyData, new Map());
    const mat = results.find(r => r.group.id === 'g-mat')!;
    expect(mat.values.length).toBe(2);
    expect(mat.is_locked).toBe(false);
  });

  it('após Couché 300g, Formato mostra apenas 88x48', () => {
    const results = getCompatibleValues(familyData, new Map([['g-mat', 'v-c300']]));
    const fmt = results.find(r => r.group.id === 'g-fmt')!;
    expect(fmt.values.map(v => v.id)).toEqual(['v-88x48']);
  });

  it('após Couché 250g, Formato mostra apenas 90x50', () => {
    const results = getCompatibleValues(familyData, new Map([['g-mat', 'v-c250']]));
    const fmt = results.find(r => r.group.id === 'g-fmt')!;
    expect(fmt.values.map(v => v.id)).toEqual(['v-90x50']);
  });

  it('grupo selecionado aparece como locked', () => {
    const results = getCompatibleValues(familyData, new Map([['g-mat', 'v-c300']]));
    const mat = results.find(r => r.group.id === 'g-mat')!;
    expect(mat.is_locked).toBe(true);
    expect(mat.selected_value_id).toBe('v-c300');
  });

  it('ignora grupo "morto" (sem nenhum valor usado por produto comercial)', () => {
    // Grupo "Cor" importado do configurador, mas nenhum produto tem valor de cor
    const withDeadGroup: FamilyCombinationData = {
      ...familyData,
      groups: [
        ...groups,
        { id: 'g-cor', company_id: 'co-1', family_id: 'fam-1', name: 'Cor', normalized_name: 'cor', code: 'COR', order_index: 3, is_required: true, created_at: '', updated_at: '' },
      ],
      values: [
        ...values,
        { id: 'v-azul', company_id: 'co-1', group_id: 'g-cor', name: 'Azul', normalized_name: 'azul', code: 'AZUL', external_id: null, order_index: 0, is_active: true, created_at: '' },
      ],
    };
    const results = getCompatibleValues(withDeadGroup, new Map());
    // O grupo "Cor" não deve travar a cascata — não aparece nos resultados
    expect(results.find(r => r.group.id === 'g-cor')).toBeUndefined();
    expect(results.map(r => r.group.id)).toEqual(['g-mat', 'g-fmt', 'g-imp']);
  });
});

describe('getAvailableQuantities', () => {
  it('lista uma quantidade por produto comercial da config selecionada', () => {
    const sel = new Map([['g-mat', 'v-c300'], ['g-fmt', 'v-88x48'], ['g-imp', 'v-4x0']]);
    const qs = getAvailableQuantities(familyData, sel);
    expect(qs.map(q => q.quantity)).toEqual([100, 500, 1000]);
    expect(qs.map(q => q.external_product_id)).toEqual(['4601', '4611', '4621']);
  });

  it('preço total é o oficial, não unitário × quantidade', () => {
    const sel = new Map([['g-mat', 'v-c300'], ['g-fmt', 'v-88x48'], ['g-imp', 'v-4x0']]);
    const qs = getAvailableQuantities(familyData, sel);
    const q500 = qs.find(q => q.quantity === 500)!;
    expect(q500.total_price).toBe(78.99);
    expect(q500.commercial_product_id).toBe('cp-1b');
  });

  it('não mistura configs diferentes (250g → só 500un existe)', () => {
    const sel = new Map([['g-mat', 'v-c250'], ['g-fmt', 'v-90x50'], ['g-imp', 'v-4x0']]);
    const qs = getAvailableQuantities(familyData, sel);
    expect(qs.map(q => q.quantity)).toEqual([500]);
  });
});

describe('resolveCommercialProduct', () => {
  it('resolve o produto comercial EXATO por opções + quantidade', () => {
    const sel = new Map([['g-mat', 'v-c300'], ['g-fmt', 'v-88x48'], ['g-imp', 'v-4x0']]);
    const r = resolveCommercialProduct(familyData, sel, 500);
    expect(r.found).toBe(true);
    expect(r.product!.external_product_id).toBe('4611');
    expect(r.product!.quantity).toBe(500);
  });

  it('quantidade diferente resolve outro produto (ID externo próprio)', () => {
    const sel = new Map([['g-mat', 'v-c300'], ['g-fmt', 'v-88x48'], ['g-imp', 'v-4x0']]);
    expect(resolveCommercialProduct(familyData, sel, 100).product!.external_product_id).toBe('4601');
    expect(resolveCommercialProduct(familyData, sel, 1000).product!.external_product_id).toBe('4621');
  });

  it('não encontra combinação inexistente (250g + 88x48 + 4x4)', () => {
    const sel = new Map([['g-mat', 'v-c250'], ['g-fmt', 'v-88x48'], ['g-imp', 'v-4x4']]);
    const r = resolveCommercialProduct(familyData, sel, 500);
    expect(r.found).toBe(false);
    expect(r.product).toBeNull();
    expect(r.error_message).toContain('não encontrado');
  });

  it('não aproxima quantidade inexistente (config A não tem 250un)', () => {
    const sel = new Map([['g-mat', 'v-c300'], ['g-fmt', 'v-88x48'], ['g-imp', 'v-4x0']]);
    const r = resolveCommercialProduct(familyData, sel, 250);
    expect(r.found).toBe(false);
    expect(r.product).toBeNull();
  });

  it('mensagem clara para seleção/quantidade vazia', () => {
    expect(resolveCommercialProduct(familyData, new Map(), 500).error_message).toContain('Nenhuma opção');
    const sel = new Map([['g-mat', 'v-c300'], ['g-fmt', 'v-88x48'], ['g-imp', 'v-4x0']]);
    expect(resolveCommercialProduct(familyData, sel, 0).error_message).toContain('quantidade');
  });

  it('aplica promoção ativa ao produto resolvido', () => {
    const sel = new Map([['g-mat', 'v-c300'], ['g-fmt', 'v-88x48'], ['g-imp', 'v-4x0']]);
    const promotions: RawPromotion[] = [
      { commercial_product_id: 'cp-1b', quantity: 500, normal_price: 78.99, promo_price: 59.99, discount_percent: 24, campaign: 'Black', origin: 'site', starts_at: null, ends_at: null, status: 'active' },
    ];
    const r = resolveCommercialProduct(familyData, sel, 500, promotions);
    expect(r.active_promotion!.promotional_price).toBe(59.99);
  });
});

describe('getCompatibleExtras', () => {
  const extras: SupplierExtra[] = [
    { id: 'ext-1', company_id: 'co-1', family_id: 'fam-1', name: 'Corte Personalizado', normalized_name: 'corte_personalizado', code: 'CORTE', extra_type: 'cutting', description: null, is_active: true, created_at: '', updated_at: '' },
    { id: 'ext-2', company_id: 'co-1', family_id: 'fam-1', name: 'Verniz UV', normalized_name: 'verniz_uv', code: 'VERNIZ_UV', extra_type: 'coating', description: null, is_active: true, created_at: '', updated_at: '' },
  ];
  const compatibility: SupplierExtraCompatibility[] = [];
  const extraPrices: SupplierExtraPrice[] = [
    { id: 'ep-1a', company_id: 'co-1', extra_id: 'ext-1', compatibility_id: null, quantity: 500, price: 15, additional_days: 2, available: true, collected_at: '', created_at: '' },
    { id: 'ep-1b', company_id: 'co-1', extra_id: 'ext-1', compatibility_id: null, quantity: 1000, price: 25, additional_days: 2, available: true, collected_at: '', created_at: '' },
    { id: 'ep-2a', company_id: 'co-1', extra_id: 'ext-2', compatibility_id: null, quantity: 500, price: 20, additional_days: 1, available: true, collected_at: '', created_at: '' },
  ];

  it('retorna extras com preço para a quantidade correta', () => {
    const r = getCompatibleExtras('cp-1b', 500, extras, compatibility, extraPrices);
    expect(r.map(e => e.price)).toEqual([15, 20]);
  });

  it('preço diferente para outra quantidade (§6)', () => {
    const r = getCompatibleExtras('cp-1c', 1000, extras, compatibility, extraPrices);
    expect(r.length).toBe(1);
    expect(r[0].price).toBe(25);
  });

  it('não retorna extra sem preço para a quantidade', () => {
    expect(getCompatibleExtras('cp-1a', 250, extras, compatibility, extraPrices).length).toBe(0);
  });

  it('regra por commercial_product_id restringe o extra', () => {
    const compat: SupplierExtraCompatibility[] = [
      { id: 'c1', company_id: 'co-1', extra_id: 'ext-1', commercial_product_id: 'cp-2a', material_filter: null, format_filter: null, print_filter: null, is_active: true, created_at: '' },
    ];
    const prices: SupplierExtraPrice[] = [
      { id: 'p1', company_id: 'co-1', extra_id: 'ext-1', compatibility_id: 'c1', quantity: 500, price: 12, additional_days: 1, available: true, collected_at: '', created_at: '' },
    ];
    expect(getCompatibleExtras('cp-1b', 500, [extras[0]], compat, prices).length).toBe(0);
    expect(getCompatibleExtras('cp-2a', 500, [extras[0]], compat, prices).length).toBe(1);
  });
});

describe('calculateLeadTime', () => {
  it('max_extra: base + maior acréscimo', () => {
    expect(calculateLeadTime(3, [{ additional_days: 2 }, { additional_days: 5 }], 'max_extra').total).toBe(8);
  });
  it('sum_extras: base + soma', () => {
    expect(calculateLeadTime(3, [{ additional_days: 2 }, { additional_days: 5 }], 'sum_extras').total).toBe(10);
  });
  it('replace: usa o maior', () => {
    expect(calculateLeadTime(3, [{ additional_days: 5 }], 'replace').total).toBe(5);
    expect(calculateLeadTime(10, [{ additional_days: 2 }], 'replace').total).toBe(10);
  });
  it('custom: sem cálculo automático', () => {
    expect(calculateLeadTime(3, [{ additional_days: 99 }], 'custom').total).toBe(3);
  });
  it('sem extras: retorna base', () => {
    expect(calculateLeadTime(5, [], 'max_extra').total).toBe(5);
  });
});

describe('calculateQuoteItem', () => {
  const product = products[1]; // cp-1b, 500un, R$ 78.99, prazo 3

  const baseParams = {
    commercial_product_id: 'cp-1b', quantity: 500,
    selected_extra_ids: [], selected_service_ids: [], freight_cost: 0,
    internal_operations_cost: 0, internal_services_cost: 0,
    tax_percent: 0, safety_margin_percent: 0, profit_margin_percent: 30,
    mirror_supplier_mode: false,
  };

  it('decompõe todas as parcelas e usa o preço oficial', () => {
    const calc = calculateQuoteItem(baseParams, product, null, [], [], 'max_extra');
    expect(calc.supplier_product_cost).toBe(78.99);
    expect(calc.total_supplier_cost).toBe(78.99);
    expect(calc.profit_amount).toBeGreaterThan(0);
    expect(calc.final_sale_price).toBeGreaterThan(78.99);
    expect(calc.combination_hash).toBe(product.combination_hash);
    expect(calc.external_product_id).toBe('4611');
    expect(calc.price_status).toBe('confirmed');
  });

  it('usa o preço promocional quando há promoção ativa', () => {
    const promo = { normal_price: 78.99, promotional_price: 59.99, discount_percent: 24, campaign: null, origin: null, starts_at: null, ends_at: null };
    const calc = calculateQuoteItem(baseParams, product, promo, [], [], 'max_extra');
    expect(calc.supplier_product_cost).toBe(59.99);
  });

  it('modo espelhar: preço = custo fornecedor (sem margem)', () => {
    const calc = calculateQuoteItem({ ...baseParams, mirror_supplier_mode: true }, product, null, [], [], 'max_extra');
    expect(calc.final_sale_price).toBe(78.99);
    expect(calc.margin_percent).toBe(0);
  });

  it('inclui extras, serviços, frete e calcula prazo', () => {
    const calc = calculateQuoteItem(
      { ...baseParams, freight_cost: 25, internal_operations_cost: 10, internal_services_cost: 5, tax_percent: 10, safety_margin_percent: 5 },
      product, null,
      [{ extra_id: 'ext-1', name: 'Corte', price: 15, additional_days: 2 }],
      [{ service_id: 'svc-1', name: 'Revisão', price: 16.99 }],
      'max_extra',
    );
    expect(calc.supplier_extras_cost).toBe(15);
    expect(calc.supplier_services_cost).toBe(16.99);
    expect(calc.supplier_freight_cost).toBe(25);
    expect(calc.total_supplier_cost).toBe(78.99 + 15 + 16.99 + 25);
    expect(calc.base_lead_time_days).toBe(3);
    expect(calc.extras_lead_time_days).toBe(2);
    expect(calc.total_lead_time_days).toBe(5);
  });

  it('preço unitário display = preço final / quantidade', () => {
    const calc = calculateQuoteItem(baseParams, product, null, [], [], 'max_extra');
    expect(calc.unit_price_display).toBe(Math.round((calc.final_sale_price / 500) * 100) / 100);
  });

  it('produto indisponível → price_status unconfirmed', () => {
    const unavailable = makeProduct({ ...product, availability: 'unavailable' });
    const calc = calculateQuoteItem(baseParams, unavailable, null, [], [], 'max_extra');
    expect(calc.price_status).toBe('unconfirmed');
  });

  it('promoção = 0 é ignorada; usa o preço normal (não fabrica R$ 0)', () => {
    // Cenário do "de/por" com "por" renderizado por JS (0 no HTML): list=1194.99, promo=0
    const jsRendered = makeProduct({ ...product, list_price: 1194.99, promotional_price: 0 });
    const calc = calculateQuoteItem(baseParams, jsRendered, null, [], [], 'max_extra');
    expect(calc.supplier_product_cost).toBe(1194.99);
    expect(calc.price_status).toBe('confirmed');
  });

  it('sem preço válido (list e promo 0) → não confirmado', () => {
    const noPrice = makeProduct({ ...product, list_price: 0, promotional_price: 0 });
    const calc = calculateQuoteItem(baseParams, noPrice, null, [], [], 'max_extra');
    expect(calc.supplier_product_cost).toBe(0);
    expect(calc.price_status).toBe('unconfirmed');
  });
});
