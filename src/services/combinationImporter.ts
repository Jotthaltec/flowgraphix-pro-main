/**
 * Importador de Combinações de Fornecedores.
 *
 * Converte os dados estruturados do importador existente (product_variants,
 * product_price_tiers, variations JSONB) nas novas tabelas de combinações
 * do motor de precificação (supplier_product_families, supplier_option_groups,
 * supplier_option_values, supplier_combinations, etc.).
 *
 * Não sobrescreve o histórico — cria novas versões quando o preço muda.
 *
 * Fluxo:
 * 1. Lê o produto do catálogo + suas variantes/tiragens/extras existentes
 * 2. Cria ou atualiza a família do fornecedor
 * 3. Detecta eixos de variação → cria option_groups + option_values
 * 4. Para cada variante, cria uma combinação com combination_key
 * 5. Para cada tiragem, cria combination_price
 * 6. Para cada extra, cria supplier_extra + supplier_extra_price
 * 7. Para cada serviço, cria supplier_service + supplier_service_price
 */

import { buildCombinationKey } from './combinationEngine';

// ---------------------------------------------------------------------------
// Tipos internos
// ---------------------------------------------------------------------------

interface ImportSource {
  product: any;
  variants: any[];
  priceTiers: any[];
  extras: any[];
  supplierId: string;
  companyId: string;
}

interface ImportResult {
  family_id: string;
  combinations_created: number;
  prices_created: number;
  extras_created: number;
  services_created: number;
  warnings: string[];
  errors: string[];
}

// ---------------------------------------------------------------------------
// Normalização
// ---------------------------------------------------------------------------

/** Normaliza texto para matching (minúsculo, sem acentos, sem espaços extras). */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .trim();
}

/** Gera código a partir de nome normalizado. */
function codeFromName(name: string): string {
  return normalize(name).toUpperCase().replace(/-/g, '_');
}

// ---------------------------------------------------------------------------
// Detecção de eixos de variação
// ---------------------------------------------------------------------------

/** Mapeia nomes de eixo conhecidos para ordem padrão. */
const AXIS_ORDER: Record<string, number> = {
  modelo: 0,
  model: 0,
  material: 1,
  papel: 1,
  formato: 2,
  format: 2,
  tamanho: 2,
  impressao: 3,
  impression: 3,
  cor: 3,
  color: 3,
  enobrecimento: 4,
  acabamento: 5,
  finishing: 5,
  quantidade: 6,
  quantity: 6,
};

function getAxisOrder(name: string): number {
  const normalized = normalize(name);
  for (const [key, order] of Object.entries(AXIS_ORDER)) {
    if (normalized.includes(key)) return order;
  }
  return 99; // eixo desconhecido no final
}

/** Extrai eixos de variação a partir das variations JSONB do produto. */
function detectAxes(
  product: any,
  variants: any[],
): Array<{ name: string; normalizedName: string; code: string; order: number; values: Array<{ name: string; normalizedName: string; externalId: string | null }> }> {
  const axes: Map<
    string,
    {
      name: string;
      normalizedName: string;
      code: string;
      order: number;
      values: Map<string, { name: string; normalizedName: string; externalId: string | null }>;
    }
  > = new Map();

  // 1. Das variations JSONB do produto
  const variations: any[] = Array.isArray(product.variations) ? product.variations : [];
  for (const v of variations) {
    if (!v?.name) continue;
    const axisNorm = normalize(v.name);
    if (!axes.has(axisNorm)) {
      axes.set(axisNorm, {
        name: v.name,
        normalizedName: axisNorm,
        code: codeFromName(v.name),
        order: getAxisOrder(v.name),
        values: new Map(),
      });
    }
    const axis = axes.get(axisNorm)!;
    const options: any[] = Array.isArray(v.values) ? v.values : Array.isArray(v.options) ? v.options : [];
    for (const opt of options) {
      const optName = typeof opt === 'string' ? opt : opt?.value || opt?.name || String(opt);
      const optNorm = normalize(optName);
      const externalId = typeof opt === 'object' ? opt?.external_id || null : null;
      if (!axis.values.has(optNorm)) {
        axis.values.set(optNorm, { name: optName, normalizedName: optNorm, externalId });
      }
    }
  }

  // 2. Dos campos fixos das variantes (material, print_color, etc.)
  for (const variant of variants) {
    const fields: Array<[string, string, string | null]> = [
      ['Material', variant.material, null],
      ['Formato', variant.format_original, null],
      ['Impressão', variant.print_color, null],
      ['Enobrecimento', variant.enoblement, null],
      ['Acabamento', variant.finishing, null],
      ['Modelo', variant.model, null],
    ];
    for (const [fieldName, value, externalId] of fields) {
      if (!value) continue;
      const axisNorm = normalize(fieldName);
      if (!axes.has(axisNorm)) {
        axes.set(axisNorm, {
          name: fieldName,
          normalizedName: axisNorm,
          code: codeFromName(fieldName),
          order: getAxisOrder(fieldName),
          values: new Map(),
        });
      }
      const axis = axes.get(axisNorm)!;
      const valNorm = normalize(value);
      if (!axis.values.has(valNorm)) {
        axis.values.set(valNorm, { name: value, normalizedName: valNorm, externalId: externalId || null });
      }
    }
  }

  return [...axes.values()]
    .sort((a, b) => a.order - b.order)
    .map(a => ({
      ...a,
      values: [...a.values.values()],
    }));
}

// ---------------------------------------------------------------------------
// Importador principal
// ---------------------------------------------------------------------------

/**
 * Importa combinações de um produto existente para as novas tabelas.
 *
 * Usa o cliente Supabase passado como parâmetro (server-side).
 *
 * @returns Resultado da importação com contadores e avisos
 */
export async function importCombinationsFromProduct(
  supabase: any,
  source: ImportSource,
): Promise<ImportResult> {
  const { product, variants, priceTiers, extras, supplierId, companyId } = source;
  const warnings: string[] = [];
  const errors: string[] = [];
  let combinationsCreated = 0;
  let pricesCreated = 0;
  let extrasCreated = 0;
  let servicesCreated = 0;

  // 1. Criar ou atualizar a família
  const familyPayload = {
    company_id: companyId,
    supplier_id: supplierId,
    catalog_product_id: product.id,
    external_id: product.supplier_sku || product.external_id || null,
    name: product.name,
    slug: product.name ? normalize(product.name).replace(/_/g, '-') : null,
    source_url: product.source_url || null,
    image_url: product.image_url || product.main_image_url || null,
    description: product.description || null,
    lead_time_rule: 'max_extra',
    pricing_strategy: 'MATRIX',
    is_active: true,
  };

  const { data: existingFamily } = await supabase
    .from('supplier_product_families')
    .select('id, version')
    .eq('company_id', companyId)
    .eq('supplier_id', supplierId)
    .eq('catalog_product_id', product.id)
    .single();

  let familyId: string;
  if (existingFamily) {
    familyId = existingFamily.id;
    await supabase
      .from('supplier_product_families')
      .update({
        ...familyPayload,
        version: (existingFamily.version || 1) + 1,
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', familyId);
  } else {
    const { data: newFamily, error } = await supabase
      .from('supplier_product_families')
      .insert([familyPayload])
      .select('id')
      .single();
    if (error || !newFamily) {
      errors.push(`Erro ao criar família: ${error?.message}`);
      return { family_id: '', combinations_created: 0, prices_created: 0, extras_created: 0, services_created: 0, warnings, errors };
    }
    familyId = newFamily.id;
  }

  // 2. Detectar eixos e criar option_groups + option_values
  const axes = detectAxes(product, variants);
  const groupIdMap = new Map<string, string>(); // normalizedName → group_id
  const valueIdMap = new Map<string, string>(); // `groupNorm|valueNorm` → value_id

  for (let i = 0; i < axes.length; i++) {
    const axis = axes[i];

    // Verificar se grupo já existe
    const { data: existingGroup } = await supabase
      .from('supplier_option_groups')
      .select('id')
      .eq('family_id', familyId)
      .eq('normalized_name', axis.normalizedName)
      .eq('company_id', companyId)
      .single();

    let groupId: string;
    if (existingGroup) {
      groupId = existingGroup.id;
      await supabase
        .from('supplier_option_groups')
        .update({ order_index: i, name: axis.name, code: axis.code })
        .eq('id', groupId);
    } else {
      const { data: newGroup, error } = await supabase
        .from('supplier_option_groups')
        .insert([{
          company_id: companyId,
          family_id: familyId,
          name: axis.name,
          normalized_name: axis.normalizedName,
          code: axis.code,
          order_index: i,
        }])
        .select('id')
        .single();
      if (error || !newGroup) {
        warnings.push(`Erro ao criar grupo ${axis.name}: ${error?.message}`);
        continue;
      }
      groupId = newGroup.id;
    }
    groupIdMap.set(axis.normalizedName, groupId);

    // Criar valores
    for (let j = 0; j < axis.values.length; j++) {
      const val = axis.values[j];
      const mapKey = `${axis.normalizedName}|${val.normalizedName}`;

      const { data: existingVal } = await supabase
        .from('supplier_option_values')
        .select('id')
        .eq('group_id', groupId)
        .eq('normalized_name', val.normalizedName)
        .eq('company_id', companyId)
        .single();

      if (existingVal) {
        valueIdMap.set(mapKey, existingVal.id);
      } else {
        const { data: newVal, error } = await supabase
          .from('supplier_option_values')
          .insert([{
            company_id: companyId,
            group_id: groupId,
            name: val.name,
            normalized_name: val.normalizedName,
            code: codeFromName(val.name),
            external_id: val.externalId,
            order_index: j,
          }])
          .select('id')
          .single();
        if (error || !newVal) {
          warnings.push(`Erro ao criar valor ${val.name}: ${error?.message}`);
          continue;
        }
        valueIdMap.set(mapKey, newVal.id);
      }
    }
  }

  // 3. Criar combinações a partir das variantes
  for (const variant of variants) {
    // Mapear campos da variante para option_value_ids
    const optionValueIds: string[] = [];
    const fieldMapping: Array<[string, string | null]> = [
      ['material', variant.material],
      ['formato', variant.format_original],
      ['impressao', variant.print_color],
      ['enobrecimento', variant.enoblement],
      ['acabamento', variant.finishing],
      ['modelo', variant.model],
    ];

    for (const [fieldNorm, value] of fieldMapping) {
      if (!value) continue;
      const valNorm = normalize(value);
      const mapKey = `${fieldNorm}|${valNorm}`;
      const valId = valueIdMap.get(mapKey);
      if (valId) optionValueIds.push(valId);
    }

    if (optionValueIds.length === 0) {
      warnings.push(`Variante ${variant.external_id || variant.id} sem opções mapeáveis.`);
      continue;
    }

    const combKey = buildCombinationKey(optionValueIds);

    // Verificar se combinação já existe
    const { data: existingCombo } = await supabase
      .from('supplier_combinations')
      .select('id, version')
      .eq('family_id', familyId)
      .eq('combination_key', combKey)
      .eq('company_id', companyId)
      .single();

    let comboId: string;
    if (existingCombo) {
      comboId = existingCombo.id;
      await supabase
        .from('supplier_combinations')
        .update({
          external_code: variant.external_id || null,
          source_url: variant.url || null,
          available: variant.available !== false,
          base_lead_time_days: variant.production_days || null,
          version: (existingCombo.version || 1) + 1,
          last_synced_at: new Date().toISOString(),
        })
        .eq('id', comboId);
    } else {
      const { data: newCombo, error } = await supabase
        .from('supplier_combinations')
        .insert([{
          company_id: companyId,
          family_id: familyId,
          external_code: variant.external_id || null,
          combination_key: combKey,
          source_url: variant.url || null,
          available: variant.available !== false,
          base_lead_time_days: variant.production_days || null,
        }])
        .select('id')
        .single();
      if (error || !newCombo) {
        warnings.push(`Erro ao criar combinação: ${error?.message}`);
        continue;
      }
      comboId = newCombo.id;
      combinationsCreated++;

      // Criar junção combinação ↔ opções
      const junctionPayload = optionValueIds.map(ovId => ({
        combination_id: comboId,
        option_value_id: ovId,
      }));
      await supabase.from('supplier_combination_option_values').insert(junctionPayload);
    }

    // 4. Criar preços por quantidade
    const variantTiers = priceTiers.filter((t: any) => t.variant_id === variant.id);
    for (const tier of variantTiers) {
      const quantity = Number(tier.quantity) || 0;
      const totalPrice = Number(tier.total_price) || 0;
      if (quantity <= 0 || totalPrice <= 0) continue;

      // Verificar se já existe preço para esta combinação+quantidade
      const { data: existingPrice } = await supabase
        .from('supplier_combination_prices')
        .select('id')
        .eq('combination_id', comboId)
        .eq('quantity', quantity)
        .eq('company_id', companyId)
        .single();

      const pricePayload = {
        company_id: companyId,
        combination_id: comboId,
        quantity,
        total_price: totalPrice,
        normal_price: tier.old_price || totalPrice,
        promotional_price: tier.promotional_price || null,
        unit_price_display: quantity > 0 ? Math.round((totalPrice / quantity) * 100) / 100 : 0,
        available: tier.available !== false,
        collected_at: tier.collected_at || new Date().toISOString(),
      };

      if (existingPrice) {
        await supabase
          .from('supplier_combination_prices')
          .update(pricePayload)
          .eq('id', existingPrice.id);
      } else {
        await supabase
          .from('supplier_combination_prices')
          .insert([pricePayload]);
        pricesCreated++;
      }
    }
  }

  // 5. Importar extras
  for (const extra of extras) {
    const extraPayload = {
      company_id: companyId,
      family_id: familyId,
      name: extra.name,
      normalized_name: extra.normalized_name || normalize(extra.name),
      code: codeFromName(extra.name),
      extra_type: detectExtraType(extra.name),
    };

    const { data: existingExtra } = await supabase
      .from('supplier_extras')
      .select('id')
      .eq('family_id', familyId)
      .eq('normalized_name', extraPayload.normalized_name)
      .eq('company_id', companyId)
      .single();

    let extraId: string;
    if (existingExtra) {
      extraId = existingExtra.id;
    } else {
      const { data: newExtra, error } = await supabase
        .from('supplier_extras')
        .insert([extraPayload])
        .select('id')
        .single();
      if (error || !newExtra) {
        warnings.push(`Erro ao criar extra ${extra.name}: ${error?.message}`);
        continue;
      }
      extraId = newExtra.id;
      extrasCreated++;
    }

    // Preço do extra (genérico, sem compatibilidade específica)
    if (extra.price != null && Number(extra.price) > 0) {
      const { data: existingPrice } = await supabase
        .from('supplier_extra_prices')
        .select('id')
        .eq('extra_id', extraId)
        .eq('quantity', 1)
        .eq('company_id', companyId)
        .is('compatibility_id', null)
        .single();

      if (!existingPrice) {
        await supabase.from('supplier_extra_prices').insert([{
          company_id: companyId,
          extra_id: extraId,
          compatibility_id: null,
          quantity: 1,
          price: Number(extra.price),
          additional_days: extra.extra_days || 0,
          collected_at: new Date().toISOString(),
        }]);
      }
    }
  }

  // 6. Importar serviços (dos extra_services do produto)
  const extraServices: any[] = Array.isArray(product.extra_services) ? product.extra_services : [];
  for (const svc of extraServices) {
    const svcName = svc.name || svc.label || '';
    if (!svcName) continue;

    const { data: existingSvc } = await supabase
      .from('supplier_services')
      .select('id')
      .eq('supplier_id', supplierId)
      .eq('name', svcName)
      .eq('company_id', companyId)
      .single();

    let svcId: string;
    if (existingSvc) {
      svcId = existingSvc.id;
    } else {
      const { data: newSvc, error } = await supabase
        .from('supplier_services')
        .insert([{
          company_id: companyId,
          supplier_id: supplierId,
          name: svcName,
          code: codeFromName(svcName),
          description: svc.description || null,
        }])
        .select('id')
        .single();
      if (error || !newSvc) {
        warnings.push(`Erro ao criar serviço ${svcName}: ${error?.message}`);
        continue;
      }
      svcId = newSvc.id;
      servicesCreated++;
    }

    // Preço do serviço
    if (svc.price != null && Number(svc.price) > 0) {
      const { data: existingPrice } = await supabase
        .from('supplier_service_prices')
        .select('id')
        .eq('service_id', svcId)
        .eq('family_id', familyId)
        .eq('company_id', companyId)
        .single();

      if (!existingPrice) {
        await supabase.from('supplier_service_prices').insert([{
          company_id: companyId,
          service_id: svcId,
          family_id: familyId,
          combination_id: null,
          price: Number(svc.price),
          collected_at: new Date().toISOString(),
        }]);
      }
    }
  }

  return {
    family_id: familyId,
    combinations_created: combinationsCreated,
    prices_created: pricesCreated,
    extras_created: extrasCreated,
    services_created: servicesCreated,
    warnings,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Auxiliares
// ---------------------------------------------------------------------------

function detectExtraType(name: string): string {
  const n = normalize(name);
  if (n.includes('corte') || n.includes('faca')) return 'cutting';
  if (n.includes('laminac')) return 'lamination';
  if (n.includes('verniz') || n.includes('uv')) return 'coating';
  if (n.includes('dobra') || n.includes('vinco')) return 'folding';
  if (n.includes('encadernac') || n.includes('grampo') || n.includes('espiral')) return 'binding';
  if (
    n.includes('acabamento') ||
    n.includes('refile') ||
    n.includes('canto') ||
    n.includes('furo')
  )
    return 'finishing';
  return 'other';
}
