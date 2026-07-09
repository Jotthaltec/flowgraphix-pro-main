/**
 * Snapshot Imutável de Orçamento.
 *
 * Ao salvar um orçamento, cria uma cópia imutável de:
 * fornecedor, produto, código externo, combinação, quantidade,
 * preços, extras, serviços, prazo, frete, margem, preço final.
 *
 * Atualizações futuras do fornecedor NÃO modificam orçamentos antigos.
 */

import type {
  SupplierPriceSnapshot,
  SnapshotOption,
  SnapshotExtra,
  SnapshotService,
  QuoteItemCalculation,
} from '@/types/combinationTypes';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

/** Dados necessários para construir o snapshot. */
export interface SnapshotBuildParams {
  company_id: string;
  created_by: string | null;
  // Fornecedor
  supplier_id: string;
  supplier_name: string | null;
  // Família/produto
  family_id: string | null;
  family_name: string | null;
  // Produto comercial
  external_code: string | null;         // external_product_id do produto comercial
  combination_hash: string | null;
  selected_options: SnapshotOption[];
  // Cálculo
  calculation: QuoteItemCalculation;
  // Preços oficiais congelados (§12)
  normal_price: number | null;
  promotional_price: number | null;
  // Promoção
  promo_campaign: string | null;
  promo_origin: string | null;
  promo_start: string | null;
  promo_end: string | null;
  // Frete detalhado
  freight_method: string | null;
  freight_zip: string | null;
  freight_days: number | null;
  // Rastreabilidade
  source_url: string | null;
  collected_at: string | null;
}

// ---------------------------------------------------------------------------
// Builder do snapshot
// ---------------------------------------------------------------------------

/**
 * Constrói o payload imutável do snapshot a partir dos dados do cálculo.
 *
 * Não salva no banco — apenas monta o objeto. A persistência é feita
 * pela server function.
 */
export function buildPriceSnapshot(
  params: SnapshotBuildParams,
): Omit<SupplierPriceSnapshot, 'id' | 'quote_item_id' | 'created_at'> {
  const calc = params.calculation;

  return {
    company_id: params.company_id,
    supplier_id: params.supplier_id,
    supplier_name: params.supplier_name,
    family_id: params.family_id,
    family_name: params.family_name,
    external_code: params.external_code,
    combination_hash: params.combination_hash,
    selected_options: params.selected_options,
    // Preços congelados (fonte oficial do fornecedor — §12)
    quantity: calc.quantity,
    total_price: calc.supplier_product_cost,
    normal_price: params.normal_price,
    promotional_price: params.promotional_price,
    unit_price_display: calc.unit_price_display,
    // Extras congelados
    extras: calc.selected_extras.map(e => ({
      name: e.name,
      extra_id: e.extra_id,
      price: e.price,
      additional_days: e.additional_days,
    })),
    extras_total: calc.supplier_extras_cost,
    // Serviços congelados
    services: calc.selected_services.map(s => ({
      name: s.name,
      service_id: s.service_id,
      price: s.price,
    })),
    services_total: calc.supplier_services_cost,
    // Prazo
    base_lead_time_days: calc.base_lead_time_days,
    extras_lead_time_days: calc.extras_lead_time_days,
    total_lead_time_days: calc.total_lead_time_days,
    // Frete
    freight_cost: calc.supplier_freight_cost,
    freight_method: params.freight_method,
    freight_zip: params.freight_zip,
    freight_days: params.freight_days,
    // Decomposição
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
    // Promoção
    promo_campaign: params.promo_campaign,
    promo_origin: params.promo_origin,
    promo_start: params.promo_start,
    promo_end: params.promo_end,
    // Rastreabilidade
    source_url: params.source_url,
    collected_at: params.collected_at,
    snapshot_at: new Date().toISOString(),
    created_by: params.created_by,
  };
}

/**
 * Compara um snapshot antigo com dados atuais para detectar mudanças.
 *
 * Usado na revalidação antes de converter orçamento em pedido.
 */
export function compareSnapshotWithCurrent(
  snapshot: SupplierPriceSnapshot,
  currentPrice: number | null,
  currentAvailable: boolean | null,
  currentLeadTime: number | null,
  currentExtras: Array<{ name: string; price: number }> | null,
): {
  price_changed: boolean;
  availability_changed: boolean;
  lead_time_changed: boolean;
  extras_changed: boolean;
  price_diff: number | null;
  price_diff_percent: number | null;
  margin_impact: number | null;
} {
  const priceChanged = currentPrice != null && currentPrice !== snapshot.total_price;
  const priceDiff = currentPrice != null ? currentPrice - snapshot.total_price : null;
  const priceDiffPercent =
    priceDiff != null && snapshot.total_price > 0
      ? Math.round((priceDiff / snapshot.total_price) * 1000) / 10
      : null;

  // Impacto na margem: se o custo mudou mas o preço de venda ficou fixo
  let marginImpact: number | null = null;
  if (priceDiff != null && snapshot.final_sale_price > 0) {
    const oldMargin = snapshot.margin_percent ?? 0;
    const newCost = snapshot.total_supplier_cost + priceDiff;
    const newMargin =
      snapshot.final_sale_price > 0
        ? ((snapshot.final_sale_price - newCost) / snapshot.final_sale_price) * 100
        : 0;
    marginImpact = Math.round((newMargin - oldMargin) * 10) / 10;
  }

  const availabilityChanged = currentAvailable != null && currentAvailable !== true;
  const leadTimeChanged =
    currentLeadTime != null &&
    snapshot.total_lead_time_days != null &&
    currentLeadTime !== snapshot.total_lead_time_days;

  let extrasChanged = false;
  if (currentExtras != null) {
    const snapshotExtraMap = new Map(snapshot.extras.map(e => [e.name, e.price]));
    for (const ce of currentExtras) {
      const snapPrice = snapshotExtraMap.get(ce.name);
      if (snapPrice == null || snapPrice !== ce.price) {
        extrasChanged = true;
        break;
      }
    }
    if (!extrasChanged && currentExtras.length !== snapshot.extras.length) {
      extrasChanged = true;
    }
  }

  return {
    price_changed: priceChanged,
    availability_changed: availabilityChanged,
    lead_time_changed: leadTimeChanged,
    extras_changed: extrasChanged,
    price_diff: priceDiff,
    price_diff_percent: priceDiffPercent,
    margin_impact: marginImpact,
  };
}
