/**
 * Motor de Combinações de Fornecedores — Lógica pura.
 *
 * Responsável por:
 * - Gerar chaves determinísticas de combinação (combination_key)
 * - Filtrar opções compatíveis em cascata (árvore de dependência)
 * - Localizar combinações exatas (nunca aproximadas)
 * - Recuperar preços oficiais por combinação+quantidade
 * - Listar extras compatíveis com preço correto
 * - Calcular prazos com regra configurável
 * - Calcular decomposição completa do item de orçamento
 *
 * REGRAS DE SEGURANÇA:
 * - Nunca inventa preços quando uma combinação não é encontrada
 * - Nunca usa o preço de uma combinação parecida
 * - O preço total importado do fornecedor é a fonte oficial
 * - O preço unitário é calculado APENAS para exibição
 */

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
  SupplierService,
  SupplierServicePrice,
  LeadTimeRule,
  PriceStatus,
  CascadeSelection,
  CascadeFilterResult,
  CombinationLookupResult,
  CombinationPriceResult,
  QuantityOption,
  ActivePromotion,
  AvailableExtra,
  SelectedExtra,
  SelectedService,
  QuoteItemCalculation,
  QuoteItemCalculationParams,
} from '@/types/combinationTypes';

// ---------------------------------------------------------------------------
// 1. Chave determinística de combinação
// ---------------------------------------------------------------------------

/**
 * Gera uma combination_key determinística a partir dos IDs das opções selecionadas.
 *
 * A chave é formada ordenando os IDs (UUIDs) em ordem alfabética e juntando
 * com pipe (|). Isso garante que a mesma seleção de opções sempre produz
 * a mesma chave, independente da ordem de seleção.
 *
 * Ex.: "a1b2|c3d4|e5f6" para 3 opções selecionadas.
 */
export function buildCombinationKey(optionValueIds: string[]): string {
  if (!optionValueIds.length) return '';
  const sorted = [...optionValueIds].sort();
  return sorted.join('|');
}

// ---------------------------------------------------------------------------
// 2. Filtragem em cascata (árvore de dependência)
// ---------------------------------------------------------------------------

/**
 * Dados completos de uma família carregados para filtragem local.
 * O frontend carrega tudo uma vez e filtra no cliente.
 */
export interface FamilyCombinationData {
  family: SupplierProductFamily;
  groups: SupplierOptionGroup[];
  values: SupplierOptionValue[];
  combinations: SupplierCombination[];
  combinationOptions: SupplierCombinationOptionValue[];
}

/**
 * Filtra as opções compatíveis após cada seleção em cascata.
 *
 * Para cada grupo (na ordem do fornecedor):
 * 1. Se ainda não foi selecionado, mostra apenas os valores que levam a
 *    pelo menos uma combinação válida considerando as seleções anteriores.
 * 2. Se já foi selecionado, marca como locked.
 *
 * Nunca exibe opções que não levem a uma combinação válida.
 */
export function getCompatibleValues(
  data: FamilyCombinationData,
  selection: CascadeSelection,
): CascadeFilterResult[] {
  const { groups, values, combinations, combinationOptions } = data;

  // Ordenar grupos pela ordem do fornecedor
  const sortedGroups = [...groups].sort((a, b) => a.order_index - b.order_index);

  // IDs das opções já selecionadas
  const selectedOptionIds = new Set(selection.values());

  // Pré-computar: para cada combinação, o set de option_value_ids
  const combOptionMap = new Map<string, Set<string>>();
  for (const co of combinationOptions) {
    if (!combOptionMap.has(co.combination_id)) {
      combOptionMap.set(co.combination_id, new Set());
    }
    combOptionMap.get(co.combination_id)!.add(co.option_value_id);
  }

  // Pré-computar: para cada option_value_id, a que grupo pertence
  const valueToGroup = new Map<string, string>();
  for (const v of values) {
    valueToGroup.set(v.id, v.group_id);
  }

  // Filtrar combinações que são compatíveis com as seleções atuais
  // Uma combinação é compatível se contém TODAS as opções selecionadas
  const compatibleCombinations = combinations.filter(c => {
    if (!c.available) return false;
    const optSet = combOptionMap.get(c.id);
    if (!optSet) return false;
    for (const selectedId of selectedOptionIds) {
      if (!optSet.has(selectedId)) return false;
    }
    return true;
  });

  // Para cada grupo, determinar os valores compatíveis
  const results: CascadeFilterResult[] = [];

  for (const group of sortedGroups) {
    const selectedValueId = selection.get(group.id) || null;
    const groupValues = values.filter(v => v.group_id === group.id && v.is_active);

    if (selectedValueId) {
      // Grupo já selecionado — mostrar apenas o valor selecionado, locked
      const selectedValue = groupValues.find(v => v.id === selectedValueId);
      results.push({
        group,
        values: selectedValue ? [selectedValue] : [],
        selected_value_id: selectedValueId,
        is_locked: true,
      });
    } else {
      // Grupo não selecionado — filtrar valores que levam a combinações válidas
      const compatibleValueIds = new Set<string>();

      for (const combo of compatibleCombinations) {
        const optSet = combOptionMap.get(combo.id);
        if (!optSet) continue;
        for (const optId of optSet) {
          if (valueToGroup.get(optId) === group.id) {
            compatibleValueIds.add(optId);
          }
        }
      }

      const filteredValues = groupValues
        .filter(v => compatibleValueIds.has(v.id))
        .sort((a, b) => a.order_index - b.order_index);

      results.push({
        group,
        values: filteredValues,
        selected_value_id: null,
        is_locked: false,
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// 3. Localizar combinação exata
// ---------------------------------------------------------------------------

/**
 * Localiza a combinação EXATA para uma seleção completa de opções.
 *
 * Nunca retorna uma combinação parecida ou aproximada.
 * Se a combinação não existe, retorna found=false com mensagem clara.
 */
export function findCombination(
  data: FamilyCombinationData,
  selection: CascadeSelection,
): CombinationLookupResult {
  if (selection.size === 0) {
    return { found: false, combination: null, error_message: 'Nenhuma opção selecionada.' };
  }

  const selectedOptionIds = [...selection.values()];
  const searchKey = buildCombinationKey(selectedOptionIds);

  // Buscar pela combination_key determinística
  const combination = data.combinations.find(
    c => c.combination_key === searchKey && c.available,
  );

  if (combination) {
    return { found: true, combination, error_message: null };
  }

  // Busca alternativa: verificar se alguma combinação contém exatamente esses option values
  const { combinationOptions } = data;
  const combOptionMap = new Map<string, Set<string>>();
  for (const co of combinationOptions) {
    if (!combOptionMap.has(co.combination_id)) {
      combOptionMap.set(co.combination_id, new Set());
    }
    combOptionMap.get(co.combination_id)!.add(co.option_value_id);
  }

  const selectedSet = new Set(selectedOptionIds);
  const match = data.combinations.find(c => {
    if (!c.available) return false;
    const optSet = combOptionMap.get(c.id);
    if (!optSet || optSet.size !== selectedSet.size) return false;
    for (const id of selectedSet) {
      if (!optSet.has(id)) return false;
    }
    return true;
  });

  if (match) {
    return { found: true, combination: match, error_message: null };
  }

  return {
    found: false,
    combination: null,
    error_message: 'Preço não confirmado pelo fornecedor. Necessária consulta ou revisão.',
  };
}

// ---------------------------------------------------------------------------
// 4. Preço por combinação + quantidade
// ---------------------------------------------------------------------------

/**
 * Recupera o preço oficial de uma combinação para uma quantidade específica.
 *
 * O total importado do fornecedor é a fonte oficial.
 * NÃO multiplica preço unitário × quantidade.
 * O preço unitário é calculado APENAS para exibição.
 */
export function getCombinationPrice(
  combinationId: string,
  quantity: number,
  allPrices: SupplierCombinationPrice[],
  promotions?: Array<{
    combination_id: string | null;
    quantity: number | null;
    normal_price: number | null;
    promo_price: number | null;
    discount_percent: number | null;
    campaign: string | null;
    origin: string | null;
    starts_at: string | null;
    ends_at: string | null;
    status: string;
  }>,
): CombinationPriceResult {
  // Filtrar preços desta combinação
  const comboPrices = allPrices
    .filter(p => p.combination_id === combinationId && p.available)
    .sort((a, b) => a.quantity - b.quantity);

  if (comboPrices.length === 0) {
    return {
      found: false,
      price: null,
      available_quantities: [],
      active_promotion: null,
      error_message: 'Nenhum preço disponível para esta combinação.',
    };
  }

  // Buscar preço exato para a quantidade
  const exactPrice = comboPrices.find(p => p.quantity === quantity);

  if (!exactPrice) {
    // Montar lista de quantidades disponíveis para o seletor
    const available_quantities: QuantityOption[] = comboPrices.map(p => ({
      quantity: p.quantity,
      total_price: p.promotional_price ?? p.total_price,
      unit_price_display: p.unit_price_display ?? (p.quantity > 0 ? (p.promotional_price ?? p.total_price) / p.quantity : 0),
      normal_price: p.normal_price,
      promotional_price: p.promotional_price,
      is_promotional: p.promotional_price != null && p.promotional_price < (p.normal_price ?? p.total_price),
      available: p.available,
    }));

    return {
      found: false,
      price: null,
      available_quantities,
      active_promotion: null,
      error_message: `Quantidade ${quantity} não disponível. Selecione uma quantidade válida.`,
    };
  }

  // Verificar promoção ativa
  let active_promotion: ActivePromotion | null = null;
  if (promotions) {
    const now = new Date().toISOString();
    const promo = promotions.find(p =>
      p.status === 'active' &&
      (p.combination_id === combinationId || p.combination_id === null) &&
      (p.quantity === quantity || p.quantity === null) &&
      (!p.starts_at || p.starts_at <= now) &&
      (!p.ends_at || p.ends_at >= now),
    );
    if (promo && promo.promo_price != null) {
      active_promotion = {
        normal_price: promo.normal_price ?? exactPrice.total_price,
        promotional_price: promo.promo_price,
        discount_percent: promo.discount_percent ?? null,
        campaign: promo.campaign ?? null,
        origin: promo.origin ?? null,
        starts_at: promo.starts_at ?? null,
        ends_at: promo.ends_at ?? null,
      };
    }
  }

  // Usar preço promocional se disponível na própria tabela de preços
  const effectivePrice = exactPrice.promotional_price ?? exactPrice.total_price;

  // Montar quantidades disponíveis
  const available_quantities: QuantityOption[] = comboPrices.map(p => ({
    quantity: p.quantity,
    total_price: p.promotional_price ?? p.total_price,
    unit_price_display: p.unit_price_display ?? (p.quantity > 0 ? (p.promotional_price ?? p.total_price) / p.quantity : 0),
    normal_price: p.normal_price,
    promotional_price: p.promotional_price,
    is_promotional: p.promotional_price != null && p.promotional_price < (p.normal_price ?? p.total_price),
    available: p.available,
  }));

  return {
    found: true,
    price: { ...exactPrice, total_price: effectivePrice },
    available_quantities,
    active_promotion,
    error_message: null,
  };
}

// ---------------------------------------------------------------------------
// 5. Extras compatíveis
// ---------------------------------------------------------------------------

/**
 * Lista os extras compatíveis com uma combinação e quantidade,
 * com o preço correto para cada um.
 *
 * Extras sem preço para a quantidade exata não são retornados
 * (nunca inventa preço).
 */
export function getCompatibleExtras(
  combinationId: string,
  quantity: number,
  extras: SupplierExtra[],
  compatibility: SupplierExtraCompatibility[],
  extraPrices: SupplierExtraPrice[],
  combinationOptionIds?: Set<string>,
): AvailableExtra[] {
  const result: AvailableExtra[] = [];

  for (const extra of extras) {
    if (!extra.is_active) continue;

    // Verificar compatibilidade
    const rules = compatibility.filter(c => c.extra_id === extra.id && c.is_active);

    // Se não há regras, o extra é compatível com todas as combinações da família
    let isCompatible = rules.length === 0;

    if (!isCompatible) {
      for (const rule of rules) {
        // Regra com combination_id específico
        if (rule.combination_id) {
          if (rule.combination_id === combinationId) {
            isCompatible = true;
            break;
          }
          continue;
        }

        // Regra com filtros por material/formato/impressão
        if (combinationOptionIds) {
          let matchesMaterial = true;
          let matchesFormat = true;
          let matchesPrint = true;

          if (rule.material_filter && Array.isArray(rule.material_filter)) {
            matchesMaterial = rule.material_filter.some(id => combinationOptionIds.has(id));
          }
          if (rule.format_filter && Array.isArray(rule.format_filter)) {
            matchesFormat = rule.format_filter.some(id => combinationOptionIds.has(id));
          }
          if (rule.print_filter && Array.isArray(rule.print_filter)) {
            matchesPrint = rule.print_filter.some(id => combinationOptionIds.has(id));
          }

          if (matchesMaterial && matchesFormat && matchesPrint) {
            isCompatible = true;
            break;
          }
        } else {
          // Sem option IDs da combinação, regra sem combination_id = compatível
          if (!rule.combination_id) {
            isCompatible = true;
            break;
          }
        }
      }
    }

    if (!isCompatible) continue;

    // Buscar preço para a quantidade exata
    const compatRuleIds = new Set(
      rules.filter(r => r.is_active).map(r => r.id),
    );

    // Prioridade: preço com compatibility_id específico > preço genérico (null)
    let priceEntry: SupplierExtraPrice | undefined;

    // 1) Preço com regra de compatibilidade específica para esta quantidade
    priceEntry = extraPrices.find(
      p =>
        p.extra_id === extra.id &&
        p.quantity === quantity &&
        p.available &&
        p.compatibility_id != null &&
        compatRuleIds.has(p.compatibility_id),
    );

    // 2) Preço genérico para esta quantidade
    if (!priceEntry) {
      priceEntry = extraPrices.find(
        p =>
          p.extra_id === extra.id &&
          p.quantity === quantity &&
          p.available &&
          p.compatibility_id == null,
      );
    }

    // Se não há preço para esta quantidade, não retorna o extra
    if (!priceEntry) continue;

    result.push({
      extra,
      price: priceEntry.price,
      additional_days: priceEntry.additional_days,
      available: priceEntry.available,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// 6. Cálculo de prazo
// ---------------------------------------------------------------------------

/**
 * Calcula o prazo de produção total.
 *
 * prazo = prazo base da combinação + acréscimo dos extras (conforme regra)
 *
 * Regras disponíveis:
 * - max_extra: prazo base + maior acréscimo entre os extras selecionados
 * - sum_extras: prazo base + soma de todos os acréscimos
 * - replace: usa o maior prazo (base ou extra) — substitui
 * - custom: prazo base (sem cálculo automático — manual)
 */
export function calculateLeadTime(
  baseDays: number,
  selectedExtras: Array<{ additional_days: number }>,
  rule: LeadTimeRule,
): { base: number; extras: number; total: number } {
  if (!selectedExtras.length || rule === 'custom') {
    return { base: baseDays, extras: 0, total: baseDays };
  }

  const extraDays = selectedExtras.map(e => e.additional_days).filter(d => d > 0);

  if (extraDays.length === 0) {
    return { base: baseDays, extras: 0, total: baseDays };
  }

  let extrasContribution: number;

  switch (rule) {
    case 'sum_extras':
      extrasContribution = extraDays.reduce((sum, d) => sum + d, 0);
      return { base: baseDays, extras: extrasContribution, total: baseDays + extrasContribution };

    case 'replace': {
      const maxExtra = Math.max(...extraDays);
      const total = Math.max(baseDays, maxExtra);
      return { base: baseDays, extras: maxExtra, total };
    }

    case 'max_extra':
    default: {
      extrasContribution = Math.max(...extraDays);
      return { base: baseDays, extras: extrasContribution, total: baseDays + extrasContribution };
    }
  }
}

// ---------------------------------------------------------------------------
// 7. Cálculo completo do item de orçamento
// ---------------------------------------------------------------------------

/**
 * Motor de cálculo completo do item de orçamento.
 *
 * Decomposição:
 *   custoProdutoFornecedor = preço oficial da combinação
 *   custoExtrasFornecedor  = Σ extras selecionados e compatíveis
 *   custoServiçosFornecedor = Σ serviços contratados
 *   custoFornecedor = produto + extras + serviços + frete
 *
 *   preçoVenda = custoFornecedor + operacionais + serviços internos
 *                + impostos + margem de segurança + lucro
 *
 * Cada parcela é visível e auditável.
 */
export function calculateQuoteItem(
  params: QuoteItemCalculationParams,
  combination: SupplierCombination,
  price: SupplierCombinationPrice,
  selectedExtras: SelectedExtra[],
  selectedServices: SelectedService[],
  leadTimeRule: LeadTimeRule,
): QuoteItemCalculation {
  // 1. Custo do produto (fonte oficial do fornecedor)
  const supplierProductCost = price.total_price;

  // 2. Custo dos extras
  const supplierExtrasCost = selectedExtras.reduce((sum, e) => sum + e.price, 0);

  // 3. Custo dos serviços
  const supplierServicesCost = selectedServices.reduce((sum, s) => sum + s.price, 0);

  // 4. Frete
  const supplierFreightCost = params.freight_cost;

  // 5. Total do fornecedor
  const totalSupplierCost =
    supplierProductCost + supplierExtrasCost + supplierServicesCost + supplierFreightCost;

  // 6. Custos internos
  const internalOperationsCost = params.internal_operations_cost;
  const internalServicesCost = params.internal_services_cost;

  // 7. Base para cálculo de impostos e margens
  const baseForMargins = totalSupplierCost + internalOperationsCost + internalServicesCost;

  // 8. Impostos
  const taxAmount = roundCurrency(baseForMargins * (params.tax_percent / 100));

  // 9. Margem de segurança
  const safetyMarginAmount = roundCurrency(baseForMargins * (params.safety_margin_percent / 100));

  // 10. Lucro
  const profitAmount = roundCurrency(baseForMargins * (params.profit_margin_percent / 100));

  // 11. Preço final de venda
  let finalSalePrice: number;

  if (params.mirror_supplier_mode) {
    // Modo espelhar: preço = custo do fornecedor (sem margem de venda)
    finalSalePrice = totalSupplierCost;
  } else {
    finalSalePrice = baseForMargins + taxAmount + safetyMarginAmount + profitAmount;
  }

  finalSalePrice = roundCurrency(finalSalePrice);

  // 12. Margem
  const marginPercent =
    finalSalePrice > 0
      ? roundPercent(((finalSalePrice - totalSupplierCost) / finalSalePrice) * 100)
      : 0;

  // 13. Prazo
  const leadTime = calculateLeadTime(
    combination.base_lead_time_days ?? 0,
    selectedExtras,
    leadTimeRule,
  );

  // 14. Preço unitário (apenas exibição)
  const unitPriceDisplay =
    params.quantity > 0 ? roundCurrency(finalSalePrice / params.quantity) : 0;

  // 15. Status do preço
  const priceStatus: PriceStatus = price.available ? 'confirmed' : 'unconfirmed';

  return {
    combination_id: combination.id,
    combination_key: combination.combination_key,
    external_code: combination.external_code,
    supplier_product_cost: roundCurrency(supplierProductCost),
    supplier_extras_cost: roundCurrency(supplierExtrasCost),
    supplier_services_cost: roundCurrency(supplierServicesCost),
    supplier_freight_cost: roundCurrency(supplierFreightCost),
    total_supplier_cost: roundCurrency(totalSupplierCost),
    internal_operations_cost: roundCurrency(internalOperationsCost),
    internal_services_cost: roundCurrency(internalServicesCost),
    tax_amount: taxAmount,
    safety_margin_amount: safetyMarginAmount,
    profit_amount: profitAmount,
    final_sale_price: finalSalePrice,
    margin_percent: marginPercent,
    base_lead_time_days: leadTime.base,
    extras_lead_time_days: leadTime.extras,
    total_lead_time_days: leadTime.total,
    price_status: priceStatus,
    selected_extras: selectedExtras,
    selected_services: selectedServices,
    quantity: params.quantity,
    unit_price_display: unitPriceDisplay,
  };
}

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------

/** Arredonda para 2 casas decimais (moeda). */
function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Arredonda para 1 casa decimal (percentual). */
function roundPercent(value: number): number {
  return Math.round(value * 10) / 10;
}
