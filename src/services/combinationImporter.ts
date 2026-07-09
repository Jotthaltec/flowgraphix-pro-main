/**
 * Importador de Produtos Comerciais de Fornecedores.
 *
 * Converte os dados estruturados do importador existente (product_variants,
 * product_price_tiers, product_extras) na nova arquitetura de PRODUTO COMERCIAL:
 * cada combinação COMPLETA (opções + QUANTIDADE) vira um registro independente
 * em supplier_commercial_products, com seu próprio external_product_id.
 *
 * Na FuturaIM cada tiragem (quantidade) tem seu próprio ID externo — por isso
 * cada product_price_tier gera UM produto comercial (§2, §3).
 *
 * Não sobrescreve o histórico:
 * - cria uma nova versão quando o preço/estado muda e registra em
 *   supplier_product_price_history (§8);
 * - IDs que somem em uma nova sincronização são marcados 'removed' (§10),
 *   nunca apagados.
 *
 * Fluxo:
 * 1. Cria/atualiza a família (página amigável, sem preço)
 * 2. Detecta eixos de variação → option_groups + option_values (árvore)
 * 3. Para cada variante × tiragem → 1 produto comercial + junção de opções
 * 4. Detecta mudança de preço → histórico; IDs ausentes → 'removed'
 * 5. Importa extras e serviços
 */

import { buildCombinationHash } from './combinationEngine';

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
  executedBy?: string | null;
}

interface ImportResult {
  family_id: string;
  commercial_products_created: number;
  commercial_products_updated: number;
  commercial_products_removed: number;
  price_changes: number;
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
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_')
    .trim();
}

/** Gera código a partir de nome normalizado. */
function codeFromName(name: string): string {
  return normalize(name).toUpperCase().replace(/-/g, '_');
}

function num(value: any): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// Detecção de eixos de variação
// ---------------------------------------------------------------------------

const AXIS_ORDER: Record<string, number> = {
  modelo: 0, model: 0,
  material: 1, papel: 1,
  formato: 2, format: 2, tamanho: 2,
  impressao: 3, impression: 3, cor: 3, color: 3,
  enobrecimento: 4,
  acabamento: 5, finishing: 5,
};

function getAxisOrder(name: string): number {
  const normalized = normalize(name);
  for (const [key, order] of Object.entries(AXIS_ORDER)) {
    if (normalized.includes(key)) return order;
  }
  return 99;
}

/** Campos fixos da variante mapeados para eixos (name, value). */
function variantAxisFields(variant: any): Array<[string, string | null]> {
  return [
    ['Modelo', variant.model],
    ['Material', variant.material],
    ['Formato', variant.format_original],
    ['Impressão', variant.print_color],
    ['Enobrecimento', variant.enoblement],
    ['Acabamento', variant.finishing],
  ];
}

/** Extrai eixos de variação a partir das variações JSONB + campos das variantes. */
function detectAxes(
  product: any,
  variants: any[],
): Array<{ name: string; normalizedName: string; code: string; order: number; values: Array<{ name: string; normalizedName: string; externalId: string | null }> }> {
  const axes = new Map<
    string,
    {
      name: string; normalizedName: string; code: string; order: number;
      values: Map<string, { name: string; normalizedName: string; externalId: string | null }>;
    }
  >();

  function ensureAxis(name: string) {
    const axisNorm = normalize(name);
    if (!axes.has(axisNorm)) {
      axes.set(axisNorm, {
        name, normalizedName: axisNorm, code: codeFromName(name), order: getAxisOrder(name), values: new Map(),
      });
    }
    return axes.get(axisNorm)!;
  }

  // 1. Das variations JSONB do produto
  const variations: any[] = Array.isArray(product.variations) ? product.variations : [];
  for (const v of variations) {
    if (!v?.name) continue;
    const axis = ensureAxis(v.name);
    const options: any[] = Array.isArray(v.values) ? v.values : Array.isArray(v.options) ? v.options : [];
    for (const opt of options) {
      const optName = typeof opt === 'string' ? opt : opt?.value || opt?.name || String(opt);
      const optNorm = normalize(optName);
      const externalId = typeof opt === 'object' ? opt?.external_id || null : null;
      if (!axis.values.has(optNorm)) axis.values.set(optNorm, { name: optName, normalizedName: optNorm, externalId });
    }
  }

  // 2. Dos campos fixos das variantes
  for (const variant of variants) {
    for (const [fieldName, value] of variantAxisFields(variant)) {
      if (!value) continue;
      const axis = ensureAxis(fieldName);
      const valNorm = normalize(value);
      if (!axis.values.has(valNorm)) axis.values.set(valNorm, { name: value, normalizedName: valNorm, externalId: null });
    }
  }

  return [...axes.values()]
    .sort((a, b) => a.order - b.order)
    .map(a => ({ ...a, values: [...a.values.values()] }));
}

// ---------------------------------------------------------------------------
// Importador principal
// ---------------------------------------------------------------------------

export async function importCombinationsFromProduct(
  supabase: any,
  source: ImportSource,
): Promise<ImportResult> {
  const { product, variants, priceTiers, extras, supplierId, companyId, executedBy } = source;
  const warnings: string[] = [];
  const errors: string[] = [];
  let created = 0, updated = 0, removed = 0, priceChanges = 0, extrasCreated = 0, servicesCreated = 0;

  // 1. Família (página amigável, sem preço)
  const familyPayload = {
    company_id: companyId,
    supplier_id: supplierId,
    catalog_product_id: product.id,
    external_id: product.supplier_sku || product.external_id || null,
    name: product.name,
    slug: product.name ? normalize(product.name).replace(/_/g, '-') : null,
    category: product.category || null,
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
    .eq('company_id', companyId).eq('supplier_id', supplierId).eq('catalog_product_id', product.id)
    .maybeSingle();

  let familyId: string;
  if (existingFamily) {
    familyId = existingFamily.id;
    await supabase.from('supplier_product_families')
      .update({ ...familyPayload, version: (existingFamily.version || 1) + 1, last_synced_at: new Date().toISOString() })
      .eq('id', familyId);
  } else {
    const { data: newFamily, error } = await supabase
      .from('supplier_product_families').insert([familyPayload]).select('id').single();
    if (error || !newFamily) {
      errors.push(`Erro ao criar família: ${error?.message}`);
      return { family_id: '', commercial_products_created: 0, commercial_products_updated: 0, commercial_products_removed: 0, price_changes: 0, extras_created: 0, services_created: 0, warnings, errors };
    }
    familyId = newFamily.id;
  }

  // 2. Eixos → option_groups + option_values
  const axes = detectAxes(product, variants);
  const valueIdMap = new Map<string, string>(); // `groupNorm|valueNorm` → value_id

  for (let i = 0; i < axes.length; i++) {
    const axis = axes[i];
    const { data: existingGroup } = await supabase
      .from('supplier_option_groups').select('id')
      .eq('family_id', familyId).eq('normalized_name', axis.normalizedName).eq('company_id', companyId).maybeSingle();

    let groupId: string;
    if (existingGroup) {
      groupId = existingGroup.id;
      await supabase.from('supplier_option_groups').update({ order_index: i, name: axis.name, code: axis.code }).eq('id', groupId);
    } else {
      const { data: newGroup, error } = await supabase.from('supplier_option_groups')
        .insert([{ company_id: companyId, family_id: familyId, name: axis.name, normalized_name: axis.normalizedName, code: axis.code, order_index: i }])
        .select('id').single();
      if (error || !newGroup) { warnings.push(`Erro ao criar grupo ${axis.name}: ${error?.message}`); continue; }
      groupId = newGroup.id;
    }

    for (let j = 0; j < axis.values.length; j++) {
      const val = axis.values[j];
      const mapKey = `${axis.normalizedName}|${val.normalizedName}`;
      const { data: existingVal } = await supabase.from('supplier_option_values').select('id')
        .eq('group_id', groupId).eq('normalized_name', val.normalizedName).eq('company_id', companyId).maybeSingle();
      if (existingVal) { valueIdMap.set(mapKey, existingVal.id); continue; }
      const { data: newVal, error } = await supabase.from('supplier_option_values')
        .insert([{ company_id: companyId, group_id: groupId, name: val.name, normalized_name: val.normalizedName, code: codeFromName(val.name), external_id: val.externalId, order_index: j }])
        .select('id').single();
      if (error || !newVal) { warnings.push(`Erro ao criar valor ${val.name}: ${error?.message}`); continue; }
      valueIdMap.set(mapKey, newVal.id);
    }
  }

  // Helper: option_value_ids de uma variante
  function variantOptionValueIds(variant: any): string[] {
    const ids: string[] = [];
    for (const [fieldName, value] of variantAxisFields(variant)) {
      if (!value) continue;
      const id = valueIdMap.get(`${normalize(fieldName)}|${normalize(value)}`);
      if (id) ids.push(id);
    }
    return ids;
  }

  // 3. Produtos comerciais (1 por variante × tiragem)
  const seenExternalIds = new Set<string>();

  for (const variant of variants) {
    const optionValueIds = variantOptionValueIds(variant);
    if (optionValueIds.length === 0) {
      warnings.push(`Variante ${variant.external_id || variant.id} sem opções mapeáveis.`);
      continue;
    }

    const variantTiers = priceTiers.filter((t: any) => t.variant_id === variant.id);
    if (variantTiers.length === 0) {
      warnings.push(`Variante ${variant.external_id || variant.id} sem tiragens/preços.`);
      continue;
    }

    for (const tier of variantTiers) {
      const quantity = Number(tier.quantity) || 0;
      if (quantity <= 0) continue;

      const externalProductId = tier.external_id || (variant.external_id ? `${variant.external_id}-${quantity}` : null);
      const totalPrice = num(tier.total_price);
      const oldPrice = num(tier.old_price);
      // list_price = preço normal; promotional_price = preço promocional efetivo
      const listPrice = oldPrice != null && oldPrice > 0 ? oldPrice : totalPrice;
      let promoPrice = num(tier.promotional_price);
      if (promoPrice == null && oldPrice != null && totalPrice != null && totalPrice < oldPrice) {
        promoPrice = totalPrice; // total abaixo do de-para indica promoção
      }
      const availability = tier.available !== false && variant.available !== false ? 'available' : 'unavailable';
      const combinationHash = buildCombinationHash(optionValueIds, quantity);
      const completeName = buildCompleteName(product, variant, quantity);

      const payload: Record<string, any> = {
        company_id: companyId,
        supplier_id: supplierId,
        family_id: familyId,
        external_product_id: externalProductId,
        external_sku: variant.sku || null,
        complete_name: completeName,
        quantity,
        quantity_unit: 'un',
        model: variant.model || null,
        type: product.type || null,
        size: variant.size || variant.format_original || null,
        material: variant.material || null,
        grammage: extractGrammage(variant.material) || null,
        format: variant.format_original || null,
        width: num(variant.width_mm),
        height: num(variant.height_mm),
        print_color: variant.print_color || null,
        enhancement: variant.enoblement || null,
        finishing: variant.finishing || null,
        production_days: num(variant.production_days),
        availability,
        list_price: listPrice,
        promotional_price: promoPrice,
        currency: tier.currency || 'BRL',
        combination_hash: combinationHash,
        source_url: variant.url || product.source_url || null,
        raw_source_data: { variant_id: variant.id, tier_id: tier.id, tier, variant_external_id: variant.external_id },
        last_synced_at: new Date().toISOString(),
      };

      if (externalProductId) seenExternalIds.add(externalProductId);

      // Buscar existente pela chave (supplier_id, external_product_id) ou pelo hash
      let existing: any = null;
      if (externalProductId) {
        const r = await supabase.from('supplier_commercial_products').select('id, version, list_price, promotional_price, availability, production_days, external_product_id')
          .eq('company_id', companyId).eq('supplier_id', supplierId).eq('external_product_id', externalProductId).maybeSingle();
        existing = r.data;
      }
      if (!existing) {
        const r = await supabase.from('supplier_commercial_products').select('id, version, list_price, promotional_price, availability, production_days, external_product_id')
          .eq('company_id', companyId).eq('family_id', familyId).eq('combination_hash', combinationHash).maybeSingle();
        existing = r.data;
      }

      if (existing) {
        // Histórico se preço/estado mudou (§8) — não altera outros IDs
        const priceChanged = num(existing.list_price) !== listPrice || num(existing.promotional_price) !== promoPrice;
        if (priceChanged || existing.availability !== availability) {
          await supabase.from('supplier_product_price_history').insert([{
            company_id: companyId, supplier_id: supplierId, commercial_product_id: existing.id,
            external_product_id: externalProductId || existing.external_product_id,
            old_price: existing.list_price, new_price: listPrice, promotional_price: promoPrice,
            availability, production_days: num(variant.production_days),
            change_percent: existing.list_price ? round2(((listPrice ?? 0) - existing.list_price) / existing.list_price * 100) : null,
            source: 'import', executed_by: executedBy || null,
          }]);
          if (priceChanged) priceChanges++;
        }
        await supabase.from('supplier_commercial_products')
          .update({ ...payload, version: (existing.version || 1) + 1 }).eq('id', existing.id);
        await syncProductOptions(supabase, existing.id, optionValueIds);
        updated++;
      } else {
        const { data: newProduct, error } = await supabase.from('supplier_commercial_products').insert([payload]).select('id').single();
        if (error || !newProduct) { warnings.push(`Erro ao criar produto comercial (${externalProductId}): ${error?.message}`); continue; }
        await syncProductOptions(supabase, newProduct.id, optionValueIds);
        await supabase.from('supplier_product_price_history').insert([{
          company_id: companyId, supplier_id: supplierId, commercial_product_id: newProduct.id,
          external_product_id: externalProductId, old_price: null, new_price: listPrice, promotional_price: promoPrice,
          availability, production_days: num(variant.production_days), source: 'import', executed_by: executedBy || null,
        }]);
        created++;
      }
    }
  }

  // 4. Produtos que sumiram nesta sincronização → 'removed' (§10, não apaga)
  if (seenExternalIds.size > 0) {
    const { data: familyProducts } = await supabase.from('supplier_commercial_products')
      .select('id, external_product_id, availability').eq('company_id', companyId).eq('family_id', familyId);
    for (const fp of familyProducts || []) {
      if (fp.availability === 'removed') continue;
      if (fp.external_product_id && !seenExternalIds.has(fp.external_product_id)) {
        await supabase.from('supplier_commercial_products').update({ availability: 'removed', last_synced_at: new Date().toISOString() }).eq('id', fp.id);
        await supabase.from('supplier_product_price_history').insert([{
          company_id: companyId, supplier_id: supplierId, commercial_product_id: fp.id,
          external_product_id: fp.external_product_id, availability: 'removed', source: 'sync', executed_by: executedBy || null,
        }]);
        removed++;
      }
    }
  }

  // 5. Extras (nível família; compatível com todos os produtos por padrão)
  for (const extra of extras) {
    const normalizedName = extra.normalized_name || normalize(extra.name);
    const { data: existingExtra } = await supabase.from('supplier_extras').select('id')
      .eq('family_id', familyId).eq('normalized_name', normalizedName).eq('company_id', companyId).maybeSingle();
    let extraId: string;
    if (existingExtra) {
      extraId = existingExtra.id;
    } else {
      const { data: newExtra, error } = await supabase.from('supplier_extras')
        .insert([{ company_id: companyId, family_id: familyId, name: extra.name, normalized_name: normalizedName, code: codeFromName(extra.name), extra_type: detectExtraType(extra.name) }])
        .select('id').single();
      if (error || !newExtra) { warnings.push(`Erro ao criar extra ${extra.name}: ${error?.message}`); continue; }
      extraId = newExtra.id; extrasCreated++;
    }
    if (extra.price != null && Number(extra.price) > 0) {
      const { data: existingPrice } = await supabase.from('supplier_extra_prices').select('id')
        .eq('extra_id', extraId).eq('quantity', 1).eq('company_id', companyId).is('compatibility_id', null).maybeSingle();
      if (!existingPrice) {
        await supabase.from('supplier_extra_prices').insert([{ company_id: companyId, extra_id: extraId, compatibility_id: null, quantity: 1, price: Number(extra.price), additional_days: extra.extra_days || 0, collected_at: new Date().toISOString() }]);
      }
    }
  }

  // 6. Serviços (dos extra_services do produto)
  const extraServices: any[] = Array.isArray(product.extra_services) ? product.extra_services : [];
  for (const svc of extraServices) {
    const svcName = svc.name || svc.label || '';
    if (!svcName) continue;
    const { data: existingSvc } = await supabase.from('supplier_services').select('id')
      .eq('supplier_id', supplierId).eq('name', svcName).eq('company_id', companyId).maybeSingle();
    let svcId: string;
    if (existingSvc) {
      svcId = existingSvc.id;
    } else {
      const { data: newSvc, error } = await supabase.from('supplier_services')
        .insert([{ company_id: companyId, supplier_id: supplierId, name: svcName, code: codeFromName(svcName), description: svc.description || null }])
        .select('id').single();
      if (error || !newSvc) { warnings.push(`Erro ao criar serviço ${svcName}: ${error?.message}`); continue; }
      svcId = newSvc.id; servicesCreated++;
    }
    if (svc.price != null && Number(svc.price) > 0) {
      const { data: existingPrice } = await supabase.from('supplier_service_prices').select('id')
        .eq('service_id', svcId).eq('family_id', familyId).eq('company_id', companyId).maybeSingle();
      if (!existingPrice) {
        await supabase.from('supplier_service_prices').insert([{ company_id: companyId, service_id: svcId, family_id: familyId, commercial_product_id: null, price: Number(svc.price), collected_at: new Date().toISOString() }]);
      }
    }
  }

  return {
    family_id: familyId,
    commercial_products_created: created,
    commercial_products_updated: updated,
    commercial_products_removed: removed,
    price_changes: priceChanges,
    extras_created: extrasCreated,
    services_created: servicesCreated,
    warnings,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Auxiliares
// ---------------------------------------------------------------------------

/** Sincroniza a junção produto comercial ↔ opções (substitui o conjunto). */
async function syncProductOptions(supabase: any, commercialProductId: string, optionValueIds: string[]) {
  await supabase.from('supplier_commercial_product_options').delete().eq('commercial_product_id', commercialProductId);
  if (optionValueIds.length === 0) return;
  const payload = optionValueIds.map(id => ({ commercial_product_id: commercialProductId, option_value_id: id }));
  await supabase.from('supplier_commercial_product_options').insert(payload);
}

/** Monta o nome completo do produto comercial. */
function buildCompleteName(product: any, variant: any, quantity: number): string {
  const parts = [product.name];
  const attrs = [variant.material, variant.format_original, variant.print_color, variant.enoblement, variant.finishing]
    .filter(Boolean);
  if (attrs.length) parts.push(attrs.join(', '));
  parts.push(`${quantity} un`);
  return parts.filter(Boolean).join(' — ');
}

/** Extrai gramatura de um texto de material (ex.: "Couché 300g" → "300g"). */
function extractGrammage(material: string | null | undefined): string | null {
  if (!material) return null;
  const m = material.match(/(\d+)\s*g/i);
  return m ? `${m[1]}g` : null;
}

function detectExtraType(name: string): string {
  const n = normalize(name);
  if (n.includes('corte') || n.includes('faca')) return 'cutting';
  if (n.includes('laminac')) return 'lamination';
  if (n.includes('verniz') || n.includes('uv')) return 'coating';
  if (n.includes('dobra') || n.includes('vinco')) return 'folding';
  if (n.includes('encadernac') || n.includes('grampo') || n.includes('espiral')) return 'binding';
  if (n.includes('acabamento') || n.includes('refile') || n.includes('canto') || n.includes('furo')) return 'finishing';
  return 'other';
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
