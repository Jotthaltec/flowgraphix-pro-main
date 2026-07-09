/**
 * Motor de Combinações de Fornecedores — Lógica pura (arquitetura de PRODUTO COMERCIAL).
 *
 * Cada combinação COMPLETA (opções + QUANTIDADE) é um produto comercial
 * independente com seu próprio external_product_id, preço, promoção e prazo.
 * A quantidade faz parte da identidade — não é um modificador de preço.
 *
 * Responsável por:
 * - Gerar hash determinístico da combinação (combination_hash)
 * - Filtrar opções compatíveis em cascata (árvore de dependência)
 * - Listar as quantidades disponíveis (cada uma é um produto comercial)
 * - Resolver o produto comercial EXATO (nunca aproximado)
 * - Listar extras compatíveis com preço correto
 * - Calcular prazos com regra configurável
 * - Calcular a decomposição completa do item de orçamento
 *
 * REGRAS DE SEGURANÇA (§7):
 * - Nunca inventa preços quando não há produto comercial correspondente
 * - Nunca usa preço de produto semelhante, de outra quantidade ou de outro formato
 * - Nunca aplica média/multiplicação proporcional
 * - O preço do produto comercial (list/promo) é a fonte oficial
 * - O preço unitário é calculado APENAS para exibição
 */

import type {
  SupplierProductFamily,
  SupplierOptionGroup,
  SupplierOptionValue,
  SupplierCommercialProduct,
  SupplierCommercialProductOption,
  SupplierExtra,
  SupplierExtraCompatibility,
  SupplierExtraPrice,
  LeadTimeRule,
  PriceStatus,
  CascadeSelection,
  CascadeFilterResult,
  CommercialProductLookupResult,
  QuantityOption,
  ActivePromotion,
  AvailableExtra,
  SelectedExtra,
  SelectedService,
  QuoteItemCalculation,
  QuoteItemCalculationParams,
} from '@/types/combinationTypes';

// ---------------------------------------------------------------------------
// Normalização e hash determinístico da combinação
// ---------------------------------------------------------------------------

/** Normaliza texto para o hash (minúsculo, sem acentos, tokens estáveis). */
export function normalizeForHash(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_')
    .trim();
}

/**
 * Gera um combination_hash determinístico a partir dos IDs das opções
 * selecionadas MAIS a quantidade — que faz parte da identidade do produto (§11).
 *
 * Ordena os IDs (estável, independente da ordem de seleção) e concatena com a
 * quantidade. Serve para detectar duplicações e identificar troca de ID externo;
 * NÃO substitui o external_product_id (§11).
 */
export function buildCombinationHash(optionValueIds: string[], quantity: number): string {
  const sorted = [...optionValueIds].sort();
  return `q${quantity}|${sorted.join('|')}`;
}

/**
 * Gera uma chave apenas das opções (sem quantidade). Usada para agrupar as
 * quantidades disponíveis de uma mesma configuração de opções.
 */
export function buildOptionSetKey(optionValueIds: string[]): string {
  return [...optionValueIds].sort().join('|');
}

// ---------------------------------------------------------------------------
// Dados da família carregados para filtragem local
// ---------------------------------------------------------------------------

/**
 * Dados completos de uma família carregados para o seletor.
 * O frontend carrega tudo uma vez e resolve no cliente.
 */
export interface FamilyCombinationData {
  family: SupplierProductFamily;
  groups: SupplierOptionGroup[];
  values: SupplierOptionValue[];
  /** Produtos comerciais (1 por combinação completa, incl. quantidade). */
  products: SupplierCommercialProduct[];
  /** Junção produto comercial ↔ opções. */
  productOptions: SupplierCommercialProductOption[];
}

/** Promoção crua vinda do banco (supplier_promotions). */
export interface RawPromotion {
  commercial_product_id: string | null;
  quantity: number | null;
  normal_price: number | null;
  promo_price: number | null;
  discount_percent: number | null;
  campaign: string | null;
  origin: string | null;
  starts_at: string | null;
  ends_at: string | null;
  status: string;
}

// ---------------------------------------------------------------------------
// Índices auxiliares
// ---------------------------------------------------------------------------

/** Mapa product_id → Set<option_value_id>. */
function buildProductOptionMap(
  productOptions: SupplierCommercialProductOption[],
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const po of productOptions) {
    if (!map.has(po.commercial_product_id)) {
      map.set(po.commercial_product_id, new Set());
    }
    map.get(po.commercial_product_id)!.add(po.option_value_id);
  }
  return map;
}

/** Produto comercial é vendável? */
function isProductSellable(p: SupplierCommercialProduct): boolean {
  return p.availability === 'available';
}

/**
 * Um produto é compatível com a seleção quando seu conjunto de opções contém
 * TODAS as opções já escolhidas.
 */
function productMatchesSelection(
  optSet: Set<string> | undefined,
  selectedOptionIds: Set<string>,
): boolean {
  if (!optSet) return false;
  for (const id of selectedOptionIds) {
    if (!optSet.has(id)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// 1. Filtragem em cascata (árvore de dependência)
// ---------------------------------------------------------------------------

/**
 * Filtra as opções compatíveis após cada seleção em cascata.
 *
 * Para cada grupo (na ordem do fornecedor): mostra apenas os valores que levam a
 * pelo menos um produto comercial vendável considerando as seleções anteriores.
 * Nunca exibe opções que não levem a um produto comercial real (§6, §7).
 */
export function getCompatibleValues(
  data: FamilyCombinationData,
  selection: CascadeSelection,
): CascadeFilterResult[] {
  const { groups, values, products, productOptions } = data;

  const selectedOptionIds = new Set(selection.values());
  const productOptionMap = buildProductOptionMap(productOptions);
  const valueToGroup = new Map(values.map(v => [v.id, v.group_id]));

  // Grupos "usados": só os que têm ao menos um valor referenciado por algum
  // produto comercial. Grupos órfãos (ex.: eixo importado do configurador mas
  // sem nenhuma combinação real) são ignorados para não travar a cascata.
  const usedGroupIds = new Set<string>();
  for (const po of productOptions) {
    const gid = valueToGroup.get(po.option_value_id);
    if (gid) usedGroupIds.add(gid);
  }

  const sortedGroups = [...groups]
    .filter(g => usedGroupIds.has(g.id))
    .sort((a, b) => a.order_index - b.order_index);

  // Produtos comerciais compatíveis com a seleção atual
  const compatibleProducts = products.filter(p => {
    if (!isProductSellable(p)) return false;
    return productMatchesSelection(productOptionMap.get(p.id), selectedOptionIds);
  });

  const results: CascadeFilterResult[] = [];

  for (const group of sortedGroups) {
    const selectedValueId = selection.get(group.id) || null;
    const groupValues = values.filter(v => v.group_id === group.id && v.is_active);

    if (selectedValueId) {
      const selectedValue = groupValues.find(v => v.id === selectedValueId);
      results.push({
        group,
        values: selectedValue ? [selectedValue] : [],
        selected_value_id: selectedValueId,
        is_locked: true,
      });
    } else {
      const compatibleValueIds = new Set<string>();
      for (const product of compatibleProducts) {
        const optSet = productOptionMap.get(product.id);
        if (!optSet) continue;
        for (const optId of optSet) {
          if (valueToGroup.get(optId) === group.id) compatibleValueIds.add(optId);
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
// 2. Quantidades disponíveis (cada quantidade é um produto comercial)
// ---------------------------------------------------------------------------

/**
 * Quando todos os grupos obrigatórios foram escolhidos, retorna as quantidades
 * disponíveis — cada uma correspondendo a um produto comercial próprio.
 *
 * Só considera produtos cujo conjunto de opções corresponde EXATAMENTE à
 * seleção (uma opção por grupo). Nunca mistura formatos/materiais diferentes.
 */
export function getAvailableQuantities(
  data: FamilyCombinationData,
  selection: CascadeSelection,
  promotions?: RawPromotion[],
): QuantityOption[] {
  const { products, productOptions } = data;
  const selectedOptionIds = new Set(selection.values());
  if (selectedOptionIds.size === 0) return [];

  const productOptionMap = buildProductOptionMap(productOptions);

  const matching = products.filter(p => {
    const optSet = productOptionMap.get(p.id);
    if (!optSet) return false;
    // Correspondência EXATA: mesmo tamanho e contém todas as opções da seleção
    if (optSet.size !== selectedOptionIds.size) return false;
    return productMatchesSelection(optSet, selectedOptionIds);
  });

  return matching
    .map(p => {
      const promo = findActivePromotion(p, promotions);
      const eff = resolveEffectivePrice(p, promo);
      const normal = eff.normal;
      const effective = eff.effective;
      const isPromo = eff.promo != null;
      return {
        quantity: p.quantity,
        commercial_product_id: p.id,
        external_product_id: p.external_product_id,
        total_price: effective,
        unit_price_display: p.quantity > 0 ? round2(effective / p.quantity) : 0,
        normal_price: normal,
        promotional_price: eff.promo,
        is_promotional: isPromo,
        // Sem preço confirmado (> 0) → não disponível para orçar (§18).
        available: isProductSellable(p) && eff.has_price,
      } satisfies QuantityOption;
    })
    .sort((a, b) => a.quantity - b.quantity);
}

// ---------------------------------------------------------------------------
// 3. Resolver o produto comercial EXATO
// ---------------------------------------------------------------------------

/**
 * Resolve o produto comercial EXATO para uma seleção completa de opções + quantidade.
 *
 * NUNCA retorna produto semelhante, de outra quantidade, outro formato, média
 * ou regra aproximada (§7). Se não houver correspondência exata, retorna
 * found=false com a mensagem padrão de revisão de mapeamento.
 */
export function resolveCommercialProduct(
  data: FamilyCombinationData,
  selection: CascadeSelection,
  quantity: number,
  promotions?: RawPromotion[],
): CommercialProductLookupResult {
  if (selection.size === 0) {
    return {
      found: false,
      product: null,
      active_promotion: null,
      error_message: 'Nenhuma opção selecionada.',
    };
  }
  if (!quantity || quantity <= 0) {
    return {
      found: false,
      product: null,
      active_promotion: null,
      error_message: 'Selecione uma quantidade válida.',
    };
  }

  const selectedOptionIds = new Set(selection.values());
  const productOptionMap = buildProductOptionMap(data.productOptions);

  const product = data.products.find(p => {
    if (!isProductSellable(p)) return false;
    if (p.quantity !== quantity) return false;
    const optSet = productOptionMap.get(p.id);
    if (!optSet || optSet.size !== selectedOptionIds.size) return false;
    return productMatchesSelection(optSet, selectedOptionIds);
  });

  if (!product) {
    return {
      found: false,
      product: null,
      active_promotion: null,
      error_message:
        'Produto correspondente não encontrado no fornecedor. Necessária atualização ou revisão do mapeamento.',
    };
  }

  return {
    found: true,
    product,
    active_promotion: findActivePromotion(product, promotions),
    error_message: null,
  };
}

/** Localiza uma promoção ativa aplicável a um produto comercial. */
function findActivePromotion(
  product: SupplierCommercialProduct,
  promotions?: RawPromotion[],
): ActivePromotion | null {
  if (!promotions?.length) return null;
  const now = new Date().toISOString();
  const promo = promotions.find(
    p =>
      p.status === 'active' &&
      (p.commercial_product_id === product.id || p.commercial_product_id === null) &&
      (p.quantity === product.quantity || p.quantity === null) &&
      (!p.starts_at || p.starts_at <= now) &&
      (!p.ends_at || p.ends_at >= now),
  );
  if (!promo || promo.promo_price == null) return null;
  return {
    normal_price: promo.normal_price ?? product.list_price ?? 0,
    promotional_price: promo.promo_price,
    discount_percent: promo.discount_percent ?? null,
    campaign: promo.campaign ?? null,
    origin: promo.origin ?? null,
    starts_at: promo.starts_at ?? null,
    ends_at: promo.ends_at ?? null,
  };
}

/**
 * Preço efetivo de um produto comercial, tratando preço ≤ 0 como INVÁLIDO.
 *
 * Regra de segurança (§18): nunca fabrica um preço. Um preço de 0 (comum quando
 * o fornecedor renderiza o valor por JavaScript e o HTML estático não o traz)
 * NÃO é considerado válido — nem como promoção, nem como preço normal. Nesse
 * caso has_price=false e a UI mostra "Preço não confirmado".
 */
export function resolveEffectivePrice(
  product: SupplierCommercialProduct,
  promotion: ActivePromotion | null,
): { effective: number; normal: number | null; promo: number | null; has_price: boolean } {
  const normalRaw = product.list_price;
  const normal = normalRaw != null && normalRaw > 0 ? normalRaw : null;
  const promoRaw = promotion?.promotional_price ?? product.promotional_price;
  // Promoção só vale se > 0 e realmente menor que o preço normal (ou sem normal).
  const promo =
    promoRaw != null && promoRaw > 0 && (normal == null || promoRaw < normal) ? promoRaw : null;
  const effective = promo ?? normal ?? 0;
  return { effective, normal, promo, has_price: effective > 0 };
}

/**
 * Preço oficial de um produto comercial (fonte). Usa o promocional quando ativo.
 * NÃO multiplica preço unitário × quantidade.
 */
export function getOfficialPrice(
  product: SupplierCommercialProduct,
  promotion: ActivePromotion | null,
): { total_price: number; normal_price: number | null; promotional_price: number | null } {
  const p = resolveEffectivePrice(product, promotion);
  return { total_price: p.effective, normal_price: p.normal, promotional_price: p.promo };
}

// ---------------------------------------------------------------------------
// 4. Extras compatíveis
// ---------------------------------------------------------------------------

/**
 * Lista os extras compatíveis com um produto comercial e quantidade, com o
 * preço correto. Extras sem preço para a quantidade exata não são retornados
 * (nunca inventa preço). Vínculo prioritário por commercial_product_id (§9).
 */
export function getCompatibleExtras(
  commercialProductId: string,
  quantity: number,
  extras: SupplierExtra[],
  compatibility: SupplierExtraCompatibility[],
  extraPrices: SupplierExtraPrice[],
  productOptionIds?: Set<string>,
): AvailableExtra[] {
  const result: AvailableExtra[] = [];

  for (const extra of extras) {
    if (!extra.is_active) continue;

    const rules = compatibility.filter(c => c.extra_id === extra.id && c.is_active);
    let isCompatible = rules.length === 0; // sem regras = compatível com toda a família

    if (!isCompatible) {
      for (const rule of rules) {
        if (rule.commercial_product_id) {
          if (rule.commercial_product_id === commercialProductId) {
            isCompatible = true;
            break;
          }
          continue;
        }
        // Regra por filtros de material/formato/impressão (option_value_ids)
        if (productOptionIds) {
          const matchMaterial =
            !rule.material_filter?.length || rule.material_filter.some(id => productOptionIds.has(id));
          const matchFormat =
            !rule.format_filter?.length || rule.format_filter.some(id => productOptionIds.has(id));
          const matchPrint =
            !rule.print_filter?.length || rule.print_filter.some(id => productOptionIds.has(id));
          if (matchMaterial && matchFormat && matchPrint) {
            isCompatible = true;
            break;
          }
        } else {
          isCompatible = true;
          break;
        }
      }
    }

    if (!isCompatible) continue;

    const compatRuleIds = new Set(rules.map(r => r.id));

    // Prioridade: preço com compatibility_id específico > preço genérico (null)
    let priceEntry = extraPrices.find(
      p =>
        p.extra_id === extra.id &&
        p.quantity === quantity &&
        p.available &&
        p.compatibility_id != null &&
        compatRuleIds.has(p.compatibility_id),
    );
    if (!priceEntry) {
      priceEntry = extraPrices.find(
        p =>
          p.extra_id === extra.id && p.quantity === quantity && p.available && p.compatibility_id == null,
      );
    }
    if (!priceEntry) continue; // sem preço p/ a quantidade exata → não retorna

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
// 5. Cálculo de prazo
// ---------------------------------------------------------------------------

/**
 * prazo = prazo base do produto comercial + acréscimo dos extras (conforme regra):
 * - max_extra: base + maior acréscimo
 * - sum_extras: base + soma dos acréscimos
 * - replace: maior entre base e acréscimo
 * - custom: base (manual)
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
  if (extraDays.length === 0) return { base: baseDays, extras: 0, total: baseDays };

  switch (rule) {
    case 'sum_extras': {
      const c = extraDays.reduce((s, d) => s + d, 0);
      return { base: baseDays, extras: c, total: baseDays + c };
    }
    case 'replace': {
      const maxExtra = Math.max(...extraDays);
      return { base: baseDays, extras: maxExtra, total: Math.max(baseDays, maxExtra) };
    }
    case 'max_extra':
    default: {
      const c = Math.max(...extraDays);
      return { base: baseDays, extras: c, total: baseDays + c };
    }
  }
}

// ---------------------------------------------------------------------------
// 6. Cálculo completo do item de orçamento
// ---------------------------------------------------------------------------

/**
 * Motor de cálculo completo do item de orçamento.
 *
 *   custoProdutoFornecedor = preço oficial do produto comercial
 *   custoExtrasFornecedor  = Σ extras selecionados e compatíveis
 *   custoServiçosFornecedor = Σ serviços contratados
 *   custoFornecedor = produto + extras + serviços + frete
 *   preçoVenda = custoFornecedor + operacionais + serviços internos
 *                + impostos + margem de segurança + lucro
 *
 * Cada parcela é visível e auditável.
 */
export function calculateQuoteItem(
  params: QuoteItemCalculationParams,
  product: SupplierCommercialProduct,
  promotion: ActivePromotion | null,
  selectedExtras: SelectedExtra[],
  selectedServices: SelectedService[],
  leadTimeRule: LeadTimeRule,
): QuoteItemCalculation {
  const official = getOfficialPrice(product, promotion);

  const supplierProductCost = official.total_price;
  const supplierExtrasCost = selectedExtras.reduce((s, e) => s + e.price, 0);
  const supplierServicesCost = selectedServices.reduce((s, e) => s + e.price, 0);
  const supplierFreightCost = params.freight_cost;

  const totalSupplierCost =
    supplierProductCost + supplierExtrasCost + supplierServicesCost + supplierFreightCost;

  const internalOperationsCost = params.internal_operations_cost;
  const internalServicesCost = params.internal_services_cost;
  const baseForMargins = totalSupplierCost + internalOperationsCost + internalServicesCost;

  const taxAmount = round2(baseForMargins * (params.tax_percent / 100));
  const safetyMarginAmount = round2(baseForMargins * (params.safety_margin_percent / 100));
  const profitAmount = round2(baseForMargins * (params.profit_margin_percent / 100));

  let finalSalePrice = params.mirror_supplier_mode
    ? totalSupplierCost // §14 modo espelhar: sem margem de venda
    : baseForMargins + taxAmount + safetyMarginAmount + profitAmount;
  finalSalePrice = round2(finalSalePrice);

  const marginPercent =
    finalSalePrice > 0
      ? round1(((finalSalePrice - totalSupplierCost) / finalSalePrice) * 100)
      : 0;

  const leadTime = calculateLeadTime(product.production_days ?? 0, selectedExtras, leadTimeRule);
  const unitPriceDisplay = params.quantity > 0 ? round2(finalSalePrice / params.quantity) : 0;
  // Sem preço oficial válido (> 0) → não confirmado, nunca "confirmado a R$ 0" (§18).
  const priceStatus: PriceStatus =
    isProductSellable(product) && official.total_price > 0 ? 'confirmed' : 'unconfirmed';

  return {
    commercial_product_id: product.id,
    combination_hash: product.combination_hash,
    external_product_id: product.external_product_id,
    supplier_product_cost: round2(supplierProductCost),
    supplier_extras_cost: round2(supplierExtrasCost),
    supplier_services_cost: round2(supplierServicesCost),
    supplier_freight_cost: round2(supplierFreightCost),
    total_supplier_cost: round2(totalSupplierCost),
    internal_operations_cost: round2(internalOperationsCost),
    internal_services_cost: round2(internalServicesCost),
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

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
