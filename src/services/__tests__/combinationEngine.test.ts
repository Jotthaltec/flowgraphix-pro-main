/**
 * Testes do Motor de Combinações de Fornecedores.
 *
 * Valida:
 * - buildCombinationKey gera chaves determinísticas e idempotentes
 * - getCompatibleValues filtra corretamente após seleções
 * - findCombination retorna null para combinações inexistentes
 * - getCombinationPrice retorna preço total oficial (não unitário × qtd)
 * - getCompatibleExtras filtra por compatibilidade e quantidade
 * - calculateLeadTime aplica regras configuráveis
 * - calculateQuoteItem decompõe todas as parcelas
 * - Modo espelhar = custo fornecedor sem margem
 */

import { describe, it, expect } from 'vitest';

import {
  buildCombinationKey,
  getCompatibleValues,
  findCombination,
  getCombinationPrice,
  getCompatibleExtras,
  calculateLeadTime,
  calculateQuoteItem,
  type FamilyCombinationData,
} from '../combinationEngine';

import type {
  SupplierProductFamily,
  SupplierOptionGroup,
  SupplierOptionValue,
  SupplierCombination,
  SupplierCombinationOptionValue,
  SupplierCombinationPrice,
  SupplierExtra,
  SupplierExtraCompatibility,
  SupplierExtraPrice,
} from '@/types/combinationTypes';

// ---------------------------------------------------------------------------
// Fixtures — Cartão de Visita em Couché (espelha FuturaIM)
// ---------------------------------------------------------------------------

const family: SupplierProductFamily = {
  id: 'fam-1',
  company_id: 'co-1',
  supplier_id: 'sup-1',
  catalog_product_id: null,
  external_id: '4627',
  name: 'Cartão de Visita em Couché Fosco com Laminação Fosca e Verniz Localizado',
  slug: 'cartao-visita-couche',
  source_url: 'https://www.futuraim.com.br/produto/cartao-de-visita?id=4627',
  image_url: null,
  description: null,
  lead_time_rule: 'max_extra',
  pricing_strategy: 'MATRIX',
  is_active: true,
  version: 1,
  last_synced_at: null,
  created_at: '2026-07-05T00:00:00Z',
  updated_at: '2026-07-05T00:00:00Z',
};

const groups: SupplierOptionGroup[] = [
  { id: 'g-mat', company_id: 'co-1', family_id: 'fam-1', name: 'Material', normalized_name: 'material', code: 'MATERIAL', order_index: 0, is_required: true, created_at: '', updated_at: '' },
  { id: 'g-fmt', company_id: 'co-1', family_id: 'fam-1', name: 'Formato', normalized_name: 'formato', code: 'FORMATO', order_index: 1, is_required: true, created_at: '', updated_at: '' },
  { id: 'g-imp', company_id: 'co-1', family_id: 'fam-1', name: 'Impressão', normalized_name: 'impressao', code: 'IMPRESSAO', order_index: 2, is_required: true, created_at: '', updated_at: '' },
];

const values: SupplierOptionValue[] = [
  // Materiais
  { id: 'v-c300', company_id: 'co-1', group_id: 'g-mat', name: 'Couché 300g', normalized_name: 'couche_300g', code: 'COUCHE_300G', external_id: null, order_index: 0, is_active: true, created_at: '' },
  { id: 'v-c250', company_id: 'co-1', group_id: 'g-mat', name: 'Couché 250g', normalized_name: 'couche_250g', code: 'COUCHE_250G', external_id: null, order_index: 1, is_active: true, created_at: '' },
  // Formatos
  { id: 'v-88x48', company_id: 'co-1', group_id: 'g-fmt', name: '88x48mm', normalized_name: '88x48mm', code: '88X48', external_id: null, order_index: 0, is_active: true, created_at: '' },
  { id: 'v-90x50', company_id: 'co-1', group_id: 'g-fmt', name: '90x50mm', normalized_name: '90x50mm', code: '90X50', external_id: null, order_index: 1, is_active: true, created_at: '' },
  // Impressão
  { id: 'v-4x0', company_id: 'co-1', group_id: 'g-imp', name: '4x0', normalized_name: '4x0', code: '4X0', external_id: null, order_index: 0, is_active: true, created_at: '' },
  { id: 'v-4x4', company_id: 'co-1', group_id: 'g-imp', name: '4x4', normalized_name: '4x4', code: '4X4', external_id: null, order_index: 1, is_active: true, created_at: '' },
];

// Combinação real: Couché 300g + 88x48mm + 4x0 → código 4601
const combo1Key = buildCombinationKey(['v-c300', 'v-88x48', 'v-4x0']);

const combinations: SupplierCombination[] = [
  { id: 'comb-1', company_id: 'co-1', family_id: 'fam-1', external_code: '4601', combination_key: combo1Key, source_url: null, available: true, base_lead_time_days: 3, version: 1, last_synced_at: null, created_at: '', updated_at: '' },
  { id: 'comb-2', company_id: 'co-1', family_id: 'fam-1', external_code: '4602', combination_key: buildCombinationKey(['v-c300', 'v-88x48', 'v-4x4']), source_url: null, available: true, base_lead_time_days: 3, version: 1, last_synced_at: null, created_at: '', updated_at: '' },
  { id: 'comb-3', company_id: 'co-1', family_id: 'fam-1', external_code: '4603', combination_key: buildCombinationKey(['v-c250', 'v-90x50', 'v-4x0']), source_url: null, available: true, base_lead_time_days: 5, version: 1, last_synced_at: null, created_at: '', updated_at: '' },
];

const combinationOptions: SupplierCombinationOptionValue[] = [
  // comb-1: Couché 300g + 88x48 + 4x0
  { id: 'co-1a', combination_id: 'comb-1', option_value_id: 'v-c300' },
  { id: 'co-1b', combination_id: 'comb-1', option_value_id: 'v-88x48' },
  { id: 'co-1c', combination_id: 'comb-1', option_value_id: 'v-4x0' },
  // comb-2: Couché 300g + 88x48 + 4x4
  { id: 'co-2a', combination_id: 'comb-2', option_value_id: 'v-c300' },
  { id: 'co-2b', combination_id: 'comb-2', option_value_id: 'v-88x48' },
  { id: 'co-2c', combination_id: 'comb-2', option_value_id: 'v-4x4' },
  // comb-3: Couché 250g + 90x50 + 4x0
  { id: 'co-3a', combination_id: 'comb-3', option_value_id: 'v-c250' },
  { id: 'co-3b', combination_id: 'comb-3', option_value_id: 'v-90x50' },
  { id: 'co-3c', combination_id: 'comb-3', option_value_id: 'v-4x0' },
];

const prices: SupplierCombinationPrice[] = [
  // comb-1: Couché 300g + 88x48 + 4x0, preços por quantidade
  { id: 'p-1a', company_id: 'co-1', combination_id: 'comb-1', quantity: 100, total_price: 35.99, normal_price: 35.99, promotional_price: null, unit_price_display: 0.36, currency: 'BRL', available: true, version: 1, collected_at: '', created_at: '' },
  { id: 'p-1b', company_id: 'co-1', combination_id: 'comb-1', quantity: 500, total_price: 78.99, normal_price: 78.99, promotional_price: null, unit_price_display: 0.158, currency: 'BRL', available: true, version: 1, collected_at: '', created_at: '' },
  { id: 'p-1c', company_id: 'co-1', combination_id: 'comb-1', quantity: 1000, total_price: 119.99, normal_price: 119.99, promotional_price: null, unit_price_display: 0.12, currency: 'BRL', available: true, version: 1, collected_at: '', created_at: '' },
  // comb-2: 4x4 é mais caro
  { id: 'p-2a', company_id: 'co-1', combination_id: 'comb-2', quantity: 500, total_price: 99.99, normal_price: 99.99, promotional_price: null, unit_price_display: 0.20, currency: 'BRL', available: true, version: 1, collected_at: '', created_at: '' },
];

const familyData: FamilyCombinationData = {
  family,
  groups,
  values,
  combinations,
  combinationOptions,
};

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

describe('buildCombinationKey', () => {
  it('gera chave determinística ordenando os IDs', () => {
    const key1 = buildCombinationKey(['v-c300', 'v-88x48', 'v-4x0']);
    const key2 = buildCombinationKey(['v-4x0', 'v-c300', 'v-88x48']);
    expect(key1).toBe(key2);
    expect(key1).toBe('v-4x0|v-88x48|v-c300');
  });

  it('chave vazia para array vazio', () => {
    expect(buildCombinationKey([])).toBe('');
  });

  it('chave idempotente (mesma entrada = mesma saída)', () => {
    const ids = ['v-c300', 'v-88x48', 'v-4x0'];
    expect(buildCombinationKey(ids)).toBe(buildCombinationKey(ids));
  });
});

describe('getCompatibleValues', () => {
  it('sem seleção, mostra todos os valores de cada grupo', () => {
    const results = getCompatibleValues(familyData, new Map());
    // Material: ambos materiais (Couché 300g e 250g estão em combinações)
    const matResult = results.find(r => r.group.id === 'g-mat');
    expect(matResult).toBeDefined();
    expect(matResult!.values.length).toBe(2);
    expect(matResult!.is_locked).toBe(false);
  });

  it('após selecionar Couché 300g, Formato mostra apenas 88x48 (comb-1 e comb-2)', () => {
    const sel = new Map([['g-mat', 'v-c300']]);
    const results = getCompatibleValues(familyData, sel);
    const fmtResult = results.find(r => r.group.id === 'g-fmt');
    expect(fmtResult).toBeDefined();
    // Só 88x48 está em combinações com Couché 300g
    expect(fmtResult!.values.length).toBe(1);
    expect(fmtResult!.values[0].id).toBe('v-88x48');
  });

  it('após selecionar Couché 250g, Formato mostra apenas 90x50 (comb-3)', () => {
    const sel = new Map([['g-mat', 'v-c250']]);
    const results = getCompatibleValues(familyData, sel);
    const fmtResult = results.find(r => r.group.id === 'g-fmt');
    expect(fmtResult!.values.length).toBe(1);
    expect(fmtResult!.values[0].id).toBe('v-90x50');
  });

  it('grupo selecionado aparece como locked', () => {
    const sel = new Map([['g-mat', 'v-c300']]);
    const results = getCompatibleValues(familyData, sel);
    const matResult = results.find(r => r.group.id === 'g-mat');
    expect(matResult!.is_locked).toBe(true);
    expect(matResult!.selected_value_id).toBe('v-c300');
  });
});

describe('findCombination', () => {
  it('encontra combinação exata para seleção completa', () => {
    const sel = new Map([['g-mat', 'v-c300'], ['g-fmt', 'v-88x48'], ['g-imp', 'v-4x0']]);
    const result = findCombination(familyData, sel);
    expect(result.found).toBe(true);
    expect(result.combination!.external_code).toBe('4601');
  });

  it('retorna null para combinação inexistente', () => {
    // Couché 250g + 88x48 + 4x4 → não existe
    const sel = new Map([['g-mat', 'v-c250'], ['g-fmt', 'v-88x48'], ['g-imp', 'v-4x4']]);
    const result = findCombination(familyData, sel);
    expect(result.found).toBe(false);
    expect(result.combination).toBeNull();
    expect(result.error_message).toContain('não confirmado');
  });

  it('retorna mensagem clara para seleção vazia', () => {
    const result = findCombination(familyData, new Map());
    expect(result.found).toBe(false);
    expect(result.error_message).toContain('Nenhuma opção');
  });
});

describe('getCombinationPrice', () => {
  it('retorna preço total oficial (não unitário × quantidade)', () => {
    const result = getCombinationPrice('comb-1', 500, prices);
    expect(result.found).toBe(true);
    expect(result.price!.total_price).toBe(78.99);
    // Confirma que NÃO é unitário × qtd (0.158 × 500 = 79.00 ≠ 78.99)
    expect(result.price!.total_price).not.toBe(0.158 * 500);
  });

  it('retorna lista de quantidades disponíveis', () => {
    const result = getCombinationPrice('comb-1', 500, prices);
    expect(result.available_quantities.length).toBe(3);
    expect(result.available_quantities[0].quantity).toBe(100);
    expect(result.available_quantities[1].quantity).toBe(500);
    expect(result.available_quantities[2].quantity).toBe(1000);
  });

  it('retorna found=false para quantidade inexistente', () => {
    const result = getCombinationPrice('comb-1', 250, prices);
    expect(result.found).toBe(false);
    expect(result.error_message).toContain('não disponível');
    // Mas mostra as quantidades válidas
    expect(result.available_quantities.length).toBe(3);
  });

  it('retorna vazio para combinação sem preços', () => {
    const result = getCombinationPrice('comb-3', 500, prices);
    expect(result.found).toBe(false);
    expect(result.available_quantities.length).toBe(0);
  });
});

describe('getCompatibleExtras', () => {
  const extras: SupplierExtra[] = [
    { id: 'ext-1', company_id: 'co-1', family_id: 'fam-1', name: 'Corte Personalizado', normalized_name: 'corte_personalizado', code: 'CORTE', extra_type: 'cutting', description: null, is_active: true, created_at: '', updated_at: '' },
    { id: 'ext-2', company_id: 'co-1', family_id: 'fam-1', name: 'Verniz UV', normalized_name: 'verniz_uv', code: 'VERNIZ_UV', extra_type: 'coating', description: null, is_active: true, created_at: '', updated_at: '' },
  ];

  const compatibility: SupplierExtraCompatibility[] = [];

  const extraPrices: SupplierExtraPrice[] = [
    { id: 'ep-1a', company_id: 'co-1', extra_id: 'ext-1', compatibility_id: null, quantity: 500, price: 15.00, additional_days: 2, available: true, collected_at: '', created_at: '' },
    { id: 'ep-1b', company_id: 'co-1', extra_id: 'ext-1', compatibility_id: null, quantity: 1000, price: 25.00, additional_days: 2, available: true, collected_at: '', created_at: '' },
    { id: 'ep-2a', company_id: 'co-1', extra_id: 'ext-2', compatibility_id: null, quantity: 500, price: 20.00, additional_days: 1, available: true, collected_at: '', created_at: '' },
  ];

  it('retorna extras com preço para a quantidade correta', () => {
    const result = getCompatibleExtras('comb-1', 500, extras, compatibility, extraPrices);
    expect(result.length).toBe(2);
    expect(result[0].extra.name).toBe('Corte Personalizado');
    expect(result[0].price).toBe(15.00);
    expect(result[1].extra.name).toBe('Verniz UV');
    expect(result[1].price).toBe(20.00);
  });

  it('preço diferente para outra quantidade', () => {
    const result = getCompatibleExtras('comb-1', 1000, extras, compatibility, extraPrices);
    // Corte tem preço para 1000, Verniz não
    expect(result.length).toBe(1);
    expect(result[0].price).toBe(25.00);
  });

  it('não retorna extra sem preço para a quantidade', () => {
    const result = getCompatibleExtras('comb-1', 250, extras, compatibility, extraPrices);
    expect(result.length).toBe(0); // nenhum preço para 250un
  });
});

describe('calculateLeadTime', () => {
  it('max_extra: base + maior acréscimo', () => {
    const result = calculateLeadTime(3, [{ additional_days: 2 }, { additional_days: 5 }], 'max_extra');
    expect(result.base).toBe(3);
    expect(result.extras).toBe(5);
    expect(result.total).toBe(8);
  });

  it('sum_extras: base + soma de todos', () => {
    const result = calculateLeadTime(3, [{ additional_days: 2 }, { additional_days: 5 }], 'sum_extras');
    expect(result.total).toBe(10);
  });

  it('replace: usa o maior (base ou extra)', () => {
    const result = calculateLeadTime(3, [{ additional_days: 5 }], 'replace');
    expect(result.total).toBe(5);
  });

  it('replace: base maior que extras', () => {
    const result = calculateLeadTime(10, [{ additional_days: 2 }], 'replace');
    expect(result.total).toBe(10);
  });

  it('custom: sem cálculo automático', () => {
    const result = calculateLeadTime(3, [{ additional_days: 99 }], 'custom');
    expect(result.total).toBe(3);
    expect(result.extras).toBe(0);
  });

  it('sem extras: retorna prazo base', () => {
    const result = calculateLeadTime(5, [], 'max_extra');
    expect(result.total).toBe(5);
  });
});

describe('calculateQuoteItem', () => {
  const combo = combinations[0]; // comb-1
  const price = prices[1]; // 500un → R$ 78.99

  it('decompõe todas as parcelas corretamente', () => {
    const calc = calculateQuoteItem(
      {
        combination_id: 'comb-1',
        quantity: 500,
        selected_extra_ids: [],
        selected_service_ids: [],
        freight_cost: 0,
        internal_operations_cost: 0,
        internal_services_cost: 0,
        tax_percent: 0,
        safety_margin_percent: 0,
        profit_margin_percent: 30,
        mirror_supplier_mode: false,
      },
      combo,
      price,
      [],
      [],
      'max_extra',
    );

    expect(calc.supplier_product_cost).toBe(78.99);
    expect(calc.supplier_extras_cost).toBe(0);
    expect(calc.total_supplier_cost).toBe(78.99);
    expect(calc.profit_amount).toBeGreaterThan(0);
    expect(calc.final_sale_price).toBeGreaterThan(78.99);
    expect(calc.combination_key).toBe(combo1Key);
    expect(calc.external_code).toBe('4601');
    expect(calc.price_status).toBe('confirmed');
  });

  it('modo espelhar: preço = custo fornecedor (sem margem)', () => {
    const calc = calculateQuoteItem(
      {
        combination_id: 'comb-1',
        quantity: 500,
        selected_extra_ids: [],
        selected_service_ids: [],
        freight_cost: 0,
        internal_operations_cost: 0,
        internal_services_cost: 0,
        tax_percent: 0,
        safety_margin_percent: 0,
        profit_margin_percent: 30,
        mirror_supplier_mode: true,
      },
      combo,
      price,
      [],
      [],
      'max_extra',
    );

    expect(calc.final_sale_price).toBe(78.99);
    expect(calc.margin_percent).toBe(0);
  });

  it('inclui extras e serviços no custo total', () => {
    const calc = calculateQuoteItem(
      {
        combination_id: 'comb-1',
        quantity: 500,
        selected_extra_ids: ['ext-1'],
        selected_service_ids: ['svc-1'],
        freight_cost: 25.00,
        internal_operations_cost: 10,
        internal_services_cost: 5,
        tax_percent: 10,
        safety_margin_percent: 5,
        profit_margin_percent: 30,
        mirror_supplier_mode: false,
      },
      combo,
      price,
      [{ extra_id: 'ext-1', name: 'Corte', price: 15.00, additional_days: 2 }],
      [{ service_id: 'svc-1', name: 'Revisão', price: 16.99 }],
      'max_extra',
    );

    expect(calc.supplier_product_cost).toBe(78.99);
    expect(calc.supplier_extras_cost).toBe(15.00);
    expect(calc.supplier_services_cost).toBe(16.99);
    expect(calc.supplier_freight_cost).toBe(25.00);
    expect(calc.total_supplier_cost).toBe(78.99 + 15 + 16.99 + 25);
    expect(calc.tax_amount).toBeGreaterThan(0);
    expect(calc.safety_margin_amount).toBeGreaterThan(0);
    expect(calc.profit_amount).toBeGreaterThan(0);
    expect(calc.final_sale_price).toBeGreaterThan(calc.total_supplier_cost);
    // Prazo: base 3 + extra 2 = 5
    expect(calc.base_lead_time_days).toBe(3);
    expect(calc.extras_lead_time_days).toBe(2);
    expect(calc.total_lead_time_days).toBe(5);
  });

  it('preço unitário display = total / quantidade', () => {
    const calc = calculateQuoteItem(
      {
        combination_id: 'comb-1',
        quantity: 500,
        selected_extra_ids: [],
        selected_service_ids: [],
        freight_cost: 0,
        internal_operations_cost: 0,
        internal_services_cost: 0,
        tax_percent: 0,
        safety_margin_percent: 0,
        profit_margin_percent: 30,
        mirror_supplier_mode: false,
      },
      combo,
      price,
      [],
      [],
      'max_extra',
    );

    const expectedUnit = Math.round((calc.final_sale_price / 500) * 100) / 100;
    expect(calc.unit_price_display).toBe(expectedUnit);
  });
});
