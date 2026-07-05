/**
 * Motor de Cálculo de Orçamento — Lógica de decomposição financeira.
 *
 * Calcula o orçamento completo mantendo cada parcela visível e auditável:
 *
 *   custoFornecedor = produto + extras + serviços + frete - descontos
 *   preçoVenda = custoFornecedor + operacionais + serviços internos
 *                + impostos + margem segurança + lucro
 *
 * Nunca mistura frete/cupom ao preço-base do produto.
 * Cada parcela é rastreável e auditável.
 */

import type {
  QuoteItemCalculation,
  FreightQuote,
  SelectedExtra,
  SelectedService,
} from '@/types/combinationTypes';

// ---------------------------------------------------------------------------
// Tipos do calculador
// ---------------------------------------------------------------------------

/** Configuração financeira da empresa para cálculos. */
export interface CompanyFinancialConfig {
  default_tax_percent: number;
  default_safety_margin_percent: number;
  default_profit_margin_percent: number;
  default_internal_operations_cost: number;
  default_internal_services_cost: number;
}

/** Item do orçamento com todas as parcelas decompostas. */
export interface QuoteItemFinancialSummary {
  item_name: string;
  quantity: number;
  // Custo do fornecedor
  supplier_product_cost: number;
  supplier_extras_cost: number;
  supplier_services_cost: number;
  supplier_freight_cost: number;
  total_supplier_cost: number;
  // Custos internos
  internal_operations_cost: number;
  internal_services_cost: number;
  // Acréscimos
  tax_amount: number;
  safety_margin_amount: number;
  profit_amount: number;
  // Resultado
  final_sale_price: number;
  margin_percent: number;
  unit_price_display: number;
  // Detalhes
  selected_extras: SelectedExtra[];
  selected_services: SelectedService[];
  // Prazo
  total_lead_time_days: number;
  // Descontos/cupons (separados do preço-base)
  discount_amount: number;
  coupon_code: string | null;
  coupon_discount: number;
  coupon_validated: boolean;
}

/** Resumo financeiro do orçamento completo. */
export interface QuoteFinancialSummary {
  items: QuoteItemFinancialSummary[];
  // Totais
  subtotal_supplier_cost: number;
  subtotal_internal_cost: number;
  subtotal_tax: number;
  subtotal_margin: number;
  subtotal_profit: number;
  subtotal_sale_price: number;
  // Frete (separado)
  total_freight: number;
  // Descontos globais
  global_discount: number;
  coupon_discount: number;
  coupon_code: string | null;
  coupon_validated: boolean;
  // Final
  final_total: number;
  total_margin_percent: number;
  total_profit: number;
}

// ---------------------------------------------------------------------------
// Calculador de orçamento
// ---------------------------------------------------------------------------

/**
 * Calcula o resumo financeiro completo do orçamento.
 *
 * Mantém cada parcela separada e auditável.
 * Frete e cupons nunca são misturados ao preço-base.
 */
export function calculateQuoteSummary(
  items: QuoteItemFinancialSummary[],
  globalDiscount: number = 0,
  coupon?: { code: string; discount: number; validated: boolean },
): QuoteFinancialSummary {
  const subtotalSupplierCost = items.reduce((s, i) => s + i.total_supplier_cost, 0);
  const subtotalInternalCost = items.reduce(
    (s, i) => s + i.internal_operations_cost + i.internal_services_cost,
    0,
  );
  const subtotalTax = items.reduce((s, i) => s + i.tax_amount, 0);
  const subtotalMargin = items.reduce((s, i) => s + i.safety_margin_amount, 0);
  const subtotalProfit = items.reduce((s, i) => s + i.profit_amount, 0);
  const subtotalSalePrice = items.reduce((s, i) => s + i.final_sale_price, 0);
  const totalFreight = items.reduce((s, i) => s + i.supplier_freight_cost, 0);

  const couponDiscount = coupon?.validated ? coupon.discount : 0;
  const finalTotal = Math.max(0, subtotalSalePrice - globalDiscount - couponDiscount);
  const totalCost = subtotalSupplierCost + subtotalInternalCost;
  const totalProfit = finalTotal - totalCost;
  const totalMarginPercent = finalTotal > 0 ? (totalProfit / finalTotal) * 100 : 0;

  return {
    items,
    subtotal_supplier_cost: round2(subtotalSupplierCost),
    subtotal_internal_cost: round2(subtotalInternalCost),
    subtotal_tax: round2(subtotalTax),
    subtotal_margin: round2(subtotalMargin),
    subtotal_profit: round2(subtotalProfit),
    subtotal_sale_price: round2(subtotalSalePrice),
    total_freight: round2(totalFreight),
    global_discount: round2(globalDiscount),
    coupon_discount: round2(couponDiscount),
    coupon_code: coupon?.code ?? null,
    coupon_validated: coupon?.validated ?? false,
    final_total: round2(finalTotal),
    total_margin_percent: Math.round(totalMarginPercent * 10) / 10,
    total_profit: round2(totalProfit),
  };
}

/**
 * Converte um QuoteItemCalculation do motor de combinações em
 * QuoteItemFinancialSummary para o calculador de orçamento.
 */
export function calculationToFinancialItem(
  calc: QuoteItemCalculation,
  itemName: string,
  discount: number = 0,
  coupon?: { code: string; discount: number; validated: boolean },
): QuoteItemFinancialSummary {
  return {
    item_name: itemName,
    quantity: calc.quantity,
    supplier_product_cost: calc.supplier_product_cost,
    supplier_extras_cost: calc.supplier_extras_cost,
    supplier_services_cost: calc.supplier_services_cost,
    supplier_freight_cost: calc.supplier_freight_cost,
    total_supplier_cost: calc.total_supplier_cost,
    internal_operations_cost: calc.internal_operations_cost,
    internal_services_cost: calc.internal_services_cost,
    tax_amount: calc.tax_amount,
    safety_margin_amount: calc.safety_margin_amount,
    profit_amount: calc.profit_amount,
    final_sale_price: calc.final_sale_price,
    margin_percent: calc.margin_percent,
    unit_price_display: calc.unit_price_display,
    selected_extras: calc.selected_extras,
    selected_services: calc.selected_services,
    total_lead_time_days: calc.total_lead_time_days,
    discount_amount: discount,
    coupon_code: coupon?.code ?? null,
    coupon_discount: coupon?.validated ? coupon.discount : 0,
    coupon_validated: coupon?.validated ?? false,
  };
}

/**
 * Recalcula o preço de venda a partir do custo com nova margem.
 *
 * Útil quando o usuário ajusta a margem desejada.
 */
export function recalculateSalePriceFromMargin(
  totalSupplierCost: number,
  internalCosts: number,
  taxPercent: number,
  desiredMarginPercent: number,
): { sale_price: number; tax: number; profit: number } {
  const baseCost = totalSupplierCost + internalCosts;
  // preço = baseCost / (1 - margem/100)
  // margem = (preço - custoTotal) / preço * 100
  if (desiredMarginPercent >= 100) {
    return { sale_price: baseCost * 10, tax: 0, profit: baseCost * 9 };
  }
  const salePrice = baseCost / (1 - desiredMarginPercent / 100);
  const tax = round2(salePrice * (taxPercent / 100));
  const profit = round2(salePrice - baseCost - tax);
  return { sale_price: round2(salePrice), tax, profit };
}

/**
 * Calcula a margem resultante dado custo e preço de venda.
 */
export function calculateMarginPercent(
  totalCost: number,
  salePrice: number,
): number {
  if (salePrice <= 0) return 0;
  return Math.round(((salePrice - totalCost) / salePrice) * 1000) / 10;
}

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
