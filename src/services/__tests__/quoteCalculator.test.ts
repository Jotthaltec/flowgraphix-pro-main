/**
 * Testes do Motor de Cálculo de Orçamento.
 *
 * Valida:
 * - Custo fornecedor = total oficial da combinação (não unitário × qtd)
 * - Extras somados corretamente por quantidade/compatibilidade
 * - Frete separado do preço-base
 * - Margem e lucro calculados sobre custo total
 * - calculateQuoteSummary acumula corretamente
 * - recalculateSalePriceFromMargin recalcula preço a partir do custo+margem
 * - calculateMarginPercent é consistente
 */

import { describe, it, expect } from 'vitest';

import {
  calculateQuoteSummary,
  calculationToFinancialItem,
  recalculateSalePriceFromMargin,
  calculateMarginPercent,
  type QuoteItemFinancialSummary,
} from '../quoteCalculator';

import type { QuoteItemCalculation } from '@/types/combinationTypes';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeCalc(overrides?: Partial<QuoteItemCalculation>): QuoteItemCalculation {
  return {
    combination_id: 'comb-1',
    combination_key: 'key-1',
    external_code: '4601',
    supplier_product_cost: 78.99,
    supplier_extras_cost: 15.00,
    supplier_services_cost: 16.99,
    supplier_freight_cost: 25.00,
    total_supplier_cost: 135.98,
    internal_operations_cost: 10,
    internal_services_cost: 5,
    tax_amount: 15.10,
    safety_margin_amount: 7.55,
    profit_amount: 45.29,
    final_sale_price: 218.92,
    margin_percent: 37.9,
    base_lead_time_days: 3,
    extras_lead_time_days: 2,
    total_lead_time_days: 5,
    price_status: 'confirmed',
    selected_extras: [{ extra_id: 'ext-1', name: 'Corte', price: 15.00, additional_days: 2 }],
    selected_services: [{ service_id: 'svc-1', name: 'Revisão', price: 16.99 }],
    quantity: 500,
    unit_price_display: 0.44,
    ...overrides,
  };
}

function makeFinancialItem(overrides?: Partial<QuoteItemFinancialSummary>): QuoteItemFinancialSummary {
  return {
    item_name: 'Cartão de Visita 500un',
    quantity: 500,
    supplier_product_cost: 78.99,
    supplier_extras_cost: 15.00,
    supplier_services_cost: 16.99,
    supplier_freight_cost: 25.00,
    total_supplier_cost: 135.98,
    internal_operations_cost: 10,
    internal_services_cost: 5,
    tax_amount: 15.10,
    safety_margin_amount: 7.55,
    profit_amount: 45.29,
    final_sale_price: 218.92,
    margin_percent: 37.9,
    unit_price_display: 0.44,
    selected_extras: [],
    selected_services: [],
    total_lead_time_days: 5,
    discount_amount: 0,
    coupon_code: null,
    coupon_discount: 0,
    coupon_validated: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

describe('calculationToFinancialItem', () => {
  it('converte cálculo em item financeiro preservando todas as parcelas', () => {
    const calc = makeCalc();
    const item = calculationToFinancialItem(calc, 'Cartão de Visita');
    expect(item.item_name).toBe('Cartão de Visita');
    expect(item.supplier_product_cost).toBe(78.99);
    expect(item.supplier_extras_cost).toBe(15.00);
    expect(item.total_supplier_cost).toBe(135.98);
    expect(item.tax_amount).toBe(15.10);
    expect(item.final_sale_price).toBe(218.92);
  });
});

describe('calculateQuoteSummary', () => {
  it('acumula totais de múltiplos itens', () => {
    const items = [
      makeFinancialItem({ final_sale_price: 200, total_supplier_cost: 100, supplier_freight_cost: 20 }),
      makeFinancialItem({ final_sale_price: 300, total_supplier_cost: 150, supplier_freight_cost: 30 }),
    ];
    const summary = calculateQuoteSummary(items);
    expect(summary.subtotal_sale_price).toBe(500);
    expect(summary.total_freight).toBe(50);
    expect(summary.final_total).toBe(500);
  });

  it('aplica desconto global', () => {
    const items = [makeFinancialItem({ final_sale_price: 200 })];
    const summary = calculateQuoteSummary(items, 30);
    expect(summary.global_discount).toBe(30);
    expect(summary.final_total).toBe(170);
  });

  it('aplica cupom validado', () => {
    const items = [makeFinancialItem({ final_sale_price: 200 })];
    const summary = calculateQuoteSummary(items, 0, { code: 'DESCONTO10', discount: 10, validated: true });
    expect(summary.coupon_discount).toBe(10);
    expect(summary.coupon_validated).toBe(true);
    expect(summary.final_total).toBe(190);
  });

  it('não aplica cupom não validado', () => {
    const items = [makeFinancialItem({ final_sale_price: 200 })];
    const summary = calculateQuoteSummary(items, 0, { code: 'INVALIDO', discount: 50, validated: false });
    expect(summary.coupon_discount).toBe(0);
    expect(summary.final_total).toBe(200);
  });

  it('total nunca fica negativo', () => {
    const items = [makeFinancialItem({ final_sale_price: 50 })];
    const summary = calculateQuoteSummary(items, 100);
    expect(summary.final_total).toBe(0);
  });

  it('calcula margem global corretamente', () => {
    const items = [
      makeFinancialItem({
        final_sale_price: 200,
        total_supplier_cost: 100,
        internal_operations_cost: 0,
        internal_services_cost: 0,
      }),
    ];
    const summary = calculateQuoteSummary(items);
    // Profit = 200 - 100 = 100, Margem = 100/200 = 50%
    expect(summary.total_profit).toBe(100);
    expect(summary.total_margin_percent).toBe(50);
  });
});

describe('recalculateSalePriceFromMargin', () => {
  it('recalcula preço a partir do custo com margem 30%', () => {
    const result = recalculateSalePriceFromMargin(100, 20, 0, 30);
    // preço = 120 / (1 - 0.30) = 120 / 0.70 ≈ 171.43
    expect(result.sale_price).toBeCloseTo(171.43, 1);
    expect(result.profit).toBeGreaterThan(0);
  });

  it('margem 0% retorna custo como preço', () => {
    const result = recalculateSalePriceFromMargin(100, 0, 0, 0);
    expect(result.sale_price).toBe(100);
  });
});

describe('calculateMarginPercent', () => {
  it('calcula margem corretamente', () => {
    expect(calculateMarginPercent(70, 100)).toBe(30);
  });

  it('margem 0% quando preço = custo', () => {
    expect(calculateMarginPercent(100, 100)).toBe(0);
  });

  it('margem 0% quando preço = 0', () => {
    expect(calculateMarginPercent(50, 0)).toBe(0);
  });

  it('margem negativa quando custo > preço', () => {
    expect(calculateMarginPercent(120, 100)).toBeLessThan(0);
  });
});
