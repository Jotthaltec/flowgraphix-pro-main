/**
 * Motor de Combinações e Precificação de Fornecedores — Tipos TypeScript.
 *
 * Modela: famílias de produto, grupos de opções, valores, combinações, preços
 * por combinação+quantidade, extras variáveis, serviços, promoções, tamanho
 * personalizado, snapshot imutável, testes de paridade e decomposição de custos.
 *
 * Nenhum preço é inventado. O total importado do fornecedor é a fonte oficial.
 * O preço unitário é calculado apenas para apresentação.
 */

// ---------------------------------------------------------------------------
// Enums / unions
// ---------------------------------------------------------------------------

/** Estratégia de cálculo de preço para a família de produto. */
export type PricingStrategy = 'MATRIX' | 'FORMULA' | 'LIVE_RESOLVER';

/** Regra de cálculo do prazo quando há extras selecionados. */
export type LeadTimeRule = 'max_extra' | 'sum_extras' | 'replace' | 'custom';

/** Status do preço de um item de orçamento. */
export type PriceStatus = 'confirmed' | 'unconfirmed' | 'outdated' | 'revalidated';

/** Status de revalidação do orçamento. */
export type RevalidationStatus = 'not_required' | 'pending' | 'revalidated' | 'changed' | 'approved_override';

/** Tipo de acabamento extra. */
export type ExtraType = 'finishing' | 'cutting' | 'lamination' | 'coating' | 'folding' | 'binding' | 'other';

/** Resultado de um teste de paridade. */
export type CalcTestResult = 'pending' | 'passed' | 'failed' | 'error';

/** Ação tomada após divergência em teste. */
export type CalcTestAction = 'none' | 'auto_updated' | 'flagged_review' | 'blocked';

/** Estratégia de preço para tamanho personalizado. */
export type CustomSizePricingStrategy = 'MATRIX' | 'FORMULA' | 'LIVE_RESOLVER';

// ---------------------------------------------------------------------------
// Entidades do banco
// ---------------------------------------------------------------------------

/** Família de produto do fornecedor (produto principal). */
export interface SupplierProductFamily {
  id: string;
  company_id: string;
  supplier_id: string;
  catalog_product_id: string | null;
  external_id: string | null;
  name: string;
  slug: string | null;
  category: string | null;
  source_url: string | null;
  image_url: string | null;
  description: string | null;
  lead_time_rule: LeadTimeRule;
  pricing_strategy: PricingStrategy;
  is_active: boolean;
  version: number;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Grupo de opções / eixo de configuração na ordem do fornecedor. */
export interface SupplierOptionGroup {
  id: string;
  company_id: string;
  family_id: string;
  name: string;
  normalized_name: string;
  code: string;
  order_index: number;
  is_required: boolean;
  created_at: string;
  updated_at: string;
}

/** Valor de uma opção de configuração. */
export interface SupplierOptionValue {
  id: string;
  company_id: string;
  group_id: string;
  name: string;
  normalized_name: string;
  code: string | null;
  external_id: string | null;
  order_index: number;
  is_active: boolean;
  created_at: string;
}

/** Disponibilidade de um produto comercial. */
export type CommercialProductAvailability = 'available' | 'unavailable' | 'removed';

/**
 * PRODUTO COMERCIAL — 1 combinação COMPLETA e comercializável, INCLUINDO a
 * quantidade, com seu próprio external_product_id, preço, promoção e prazo.
 *
 * A quantidade faz parte da identidade: quando o fornecedor dá um ID diferente
 * por quantidade, cada quantidade é um produto comercial separado.
 * Chave única (por fornecedor): external_product_id.
 */
export interface SupplierCommercialProduct {
  id: string;
  company_id: string;
  supplier_id: string;
  family_id: string;
  // Identificação externa
  external_product_id: string | null;
  external_sku: string | null;
  complete_name: string | null;
  // Quantidade FAZ PARTE da identidade
  quantity: number;
  quantity_unit: string | null;
  // Atributos denormalizados da combinação (matriz / consulta direta)
  model: string | null;
  type: string | null;
  size: string | null;
  material: string | null;
  grammage: string | null;
  format: string | null;
  width: number | null;
  height: number | null;
  print_color: string | null;
  enhancement: string | null;
  finishing: string | null;
  // Comercial
  production_days: number | null;
  availability: CommercialProductAvailability;
  list_price: number | null;
  promotional_price: number | null;
  currency: string;
  // Chaves / rastreabilidade
  combination_hash: string;
  source_url: string | null;
  raw_source_data: Record<string, unknown>;
  version: number;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Junção produto comercial ↔ opção (reconstrói a árvore de variações). */
export interface SupplierCommercialProductOption {
  id: string;
  commercial_product_id: string;
  option_value_id: string;
}

/** Registro de histórico de preço por external_product_id. */
export interface SupplierProductPriceHistory {
  id: string;
  company_id: string;
  supplier_id: string;
  commercial_product_id: string | null;
  external_product_id: string | null;
  old_price: number | null;
  new_price: number | null;
  promotional_price: number | null;
  availability: string | null;
  production_days: number | null;
  change_percent: number | null;
  source: string | null;
  captured_at: string;
  executed_by: string | null;
  created_at: string;
}

/** Acabamento extra disponível. */
export interface SupplierExtra {
  id: string;
  company_id: string;
  family_id: string;
  name: string;
  normalized_name: string;
  code: string | null;
  extra_type: ExtraType;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Regra de compatibilidade de um extra. */
export interface SupplierExtraCompatibility {
  id: string;
  company_id: string;
  extra_id: string;
  commercial_product_id: string | null;
  material_filter: string[] | null;
  format_filter: string[] | null;
  print_filter: string[] | null;
  is_active: boolean;
  created_at: string;
}

/** Preço de um extra por compatibilidade + quantidade. */
export interface SupplierExtraPrice {
  id: string;
  company_id: string;
  extra_id: string;
  compatibility_id: string | null;
  quantity: number;
  price: number;
  additional_days: number;
  available: boolean;
  collected_at: string;
  created_at: string;
}

/** Serviço complementar do fornecedor. */
export interface SupplierService {
  id: string;
  company_id: string;
  supplier_id: string;
  name: string;
  code: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Preço de serviço por produto/combinação. */
export interface SupplierServicePrice {
  id: string;
  company_id: string;
  service_id: string;
  family_id: string | null;
  commercial_product_id: string | null;
  price: number;
  currency: string;
  collected_at: string;
  created_at: string;
}

/** Regras de tamanho personalizado. */
export interface SupplierCustomSizeRule {
  id: string;
  company_id: string;
  family_id: string;
  min_width: number | null;
  max_width: number | null;
  min_height: number | null;
  max_height: number | null;
  min_area: number | null;
  min_price: number | null;
  rounding_width: number | null;
  rounding_height: number | null;
  rounding_area: number | null;
  unit: string;
  pricing_strategy: CustomSizePricingStrategy;
  formula: string | null;
  price_ranges: PriceRange[];
  bobbin_width: number | null;
  fixed_production_cost: number | null;
  needs_live_query: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Faixa de preço (para MATRIX em tamanho personalizado). */
export interface PriceRange {
  min_area: number;
  max_area: number;
  price_per_unit: number;
}

/** Snapshot imutável do orçamento. */
export interface SupplierPriceSnapshot {
  id: string;
  company_id: string;
  quote_item_id: string | null;
  supplier_id: string;
  supplier_name: string | null;
  family_id: string | null;
  family_name: string | null;
  external_code: string | null;
  combination_hash: string | null;
  selected_options: SnapshotOption[];
  quantity: number;
  total_price: number;
  normal_price: number | null;
  promotional_price: number | null;
  unit_price_display: number | null;
  extras: SnapshotExtra[];
  extras_total: number;
  services: SnapshotService[];
  services_total: number;
  base_lead_time_days: number | null;
  extras_lead_time_days: number | null;
  total_lead_time_days: number | null;
  freight_cost: number | null;
  freight_method: string | null;
  freight_zip: string | null;
  freight_days: number | null;
  supplier_product_cost: number;
  supplier_extras_cost: number;
  supplier_services_cost: number;
  supplier_freight_cost: number;
  total_supplier_cost: number;
  internal_operations_cost: number;
  internal_services_cost: number;
  tax_amount: number;
  safety_margin_amount: number;
  profit_amount: number;
  final_sale_price: number;
  margin_percent: number | null;
  promo_campaign: string | null;
  promo_origin: string | null;
  promo_start: string | null;
  promo_end: string | null;
  source_url: string | null;
  collected_at: string | null;
  snapshot_at: string;
  created_by: string | null;
  created_at: string;
}

/** Opção congelada no snapshot. */
export interface SnapshotOption {
  group_name: string;
  group_code: string;
  value_name: string;
  value_id: string;
  external_id: string | null;
}

/** Extra congelado no snapshot. */
export interface SnapshotExtra {
  name: string;
  extra_id: string;
  price: number;
  additional_days: number;
}

/** Serviço congelado no snapshot. */
export interface SnapshotService {
  name: string;
  service_id: string;
  price: number;
}

// ---------------------------------------------------------------------------
// Tipos de operação do motor
// ---------------------------------------------------------------------------

/** Seleção atual do usuário na cascata (group_id → option_value_id). */
export type CascadeSelection = Map<string, string>;

/** Resultado de filtragem após seleção em cascata. */
export interface CascadeFilterResult {
  group: SupplierOptionGroup;
  values: SupplierOptionValue[];
  selected_value_id: string | null;
  is_locked: boolean;
}

/**
 * Resultado da resolução de um produto comercial exato.
 * NUNCA retorna produto aproximado, semelhante ou de outra quantidade.
 */
export interface CommercialProductLookupResult {
  found: boolean;
  product: SupplierCommercialProduct | null;
  /** Promoção ativa, se houver. */
  active_promotion: ActivePromotion | null;
  /** Quando found=false, mensagem de erro descritiva. */
  error_message: string | null;
}

/** Opção de quantidade — cada quantidade é um produto comercial próprio. */
export interface QuantityOption {
  quantity: number;
  /** ID do produto comercial que representa esta quantidade. */
  commercial_product_id: string;
  external_product_id: string | null;
  total_price: number;
  unit_price_display: number;
  normal_price: number | null;
  promotional_price: number | null;
  is_promotional: boolean;
  available: boolean;
}

/** Promoção ativa encontrada. */
export interface ActivePromotion {
  normal_price: number;
  promotional_price: number;
  discount_percent: number | null;
  campaign: string | null;
  origin: string | null;
  starts_at: string | null;
  ends_at: string | null;
}

/** Extra disponível com preço para a combinação/quantidade. */
export interface AvailableExtra {
  extra: SupplierExtra;
  price: number;
  additional_days: number;
  available: boolean;
}

/** Resultado completo do cálculo de um item de orçamento. */
export interface QuoteItemCalculation {
  // Identificação
  commercial_product_id: string;
  combination_hash: string;
  external_product_id: string | null;
  // Decomposição do custo do fornecedor
  supplier_product_cost: number;
  supplier_extras_cost: number;
  supplier_services_cost: number;
  supplier_freight_cost: number;
  total_supplier_cost: number;
  // Decomposição do preço de venda
  internal_operations_cost: number;
  internal_services_cost: number;
  tax_amount: number;
  safety_margin_amount: number;
  profit_amount: number;
  final_sale_price: number;
  // Margem
  margin_percent: number;
  // Prazo
  base_lead_time_days: number;
  extras_lead_time_days: number;
  total_lead_time_days: number;
  // Status
  price_status: PriceStatus;
  // Detalhes para auditoria
  selected_extras: SelectedExtra[];
  selected_services: SelectedService[];
  quantity: number;
  unit_price_display: number;
}

/** Extra selecionado pelo usuário. */
export interface SelectedExtra {
  extra_id: string;
  name: string;
  price: number;
  additional_days: number;
}

/** Serviço selecionado pelo usuário. */
export interface SelectedService {
  service_id: string;
  name: string;
  price: number;
}

/** Parâmetros de entrada para o cálculo do item. */
export interface QuoteItemCalculationParams {
  commercial_product_id: string;
  quantity: number;
  selected_extra_ids: string[];
  selected_service_ids: string[];
  freight_cost: number;
  // Custos internos da gráfica
  internal_operations_cost: number;
  internal_services_cost: number;
  tax_percent: number;
  safety_margin_percent: number;
  profit_margin_percent: number;
  // Modo
  mirror_supplier_mode: boolean;
}

/** Resultado de frete consultado. */
export interface FreightQuote {
  zip: string;
  method: string;
  days: number;
  cost: number;
  consulted_at: string;
  supplier_id: string;
  valid_until: string | null;
}

// ---------------------------------------------------------------------------
// Revalidação
// ---------------------------------------------------------------------------

/** Resultado da comparação de revalidação. */
export interface RevalidationResult {
  has_changes: boolean;
  items: RevalidationItemDiff[];
}

/** Diferença encontrada na revalidação de um item. */
export interface RevalidationItemDiff {
  quote_item_id: string;
  item_name: string;
  // Preço
  old_price: number;
  new_price: number | null;
  price_diff: number | null;
  price_diff_percent: number | null;
  // Disponibilidade
  was_available: boolean;
  is_available: boolean | null;
  // Promoção
  had_promotion: boolean;
  has_promotion: boolean | null;
  old_promo_price: number | null;
  new_promo_price: number | null;
  // Prazo
  old_lead_time: number | null;
  new_lead_time: number | null;
  // Extras
  extras_changed: boolean;
  extras_diff: ExtraDiff[];
  // Frete
  old_freight: number | null;
  new_freight: number | null;
  // Margem
  old_margin: number | null;
  new_margin: number | null;
  margin_impact: number | null;
  // Status
  status: 'unchanged' | 'price_changed' | 'unavailable' | 'promo_changed' | 'lead_time_changed' | 'extras_changed';
}

/** Diferença em um extra durante revalidação. */
export interface ExtraDiff {
  extra_name: string;
  old_price: number;
  new_price: number | null;
  status: 'unchanged' | 'price_changed' | 'removed' | 'new';
}

// ---------------------------------------------------------------------------
// Teste de paridade
// ---------------------------------------------------------------------------

/** Caso de teste de paridade. */
export interface CalculationTest {
  id: string;
  company_id: string;
  family_id: string;
  name: string | null;
  url: string | null;
  external_code: string | null;
  options: Record<string, string>;
  quantity: number;
  expected_price: number;
  expected_extras: ExpectedExtra[];
  expected_lead_time: number | null;
  last_result: CalcTestResult;
  last_calculated_price: number | null;
  last_diff_amount: number | null;
  last_diff_percent: number | null;
  validated_at: string | null;
  is_active: boolean;
}

/** Extra esperado em teste de paridade. */
export interface ExpectedExtra {
  name: string;
  price: number;
  additional_days: number;
}

/** Log de execução de teste. */
export interface CalculationLog {
  id: string;
  test_id: string;
  calculated_price: number | null;
  expected_price: number | null;
  passed: boolean;
  diff_amount: number | null;
  diff_percent: number | null;
  details: Record<string, any>;
  error_message: string | null;
  action_taken: CalcTestAction;
  executed_at: string;
  executed_by: string | null;
}
