/**
 * Server Functions — Motor de Combinações e Precificação.
 *
 * Todas as operações de banco para o motor de combinações são executadas
 * server-side via createServerFn (TanStack Start), nunca no frontend.
 *
 * Funções:
 * - getProductFamilies: Lista famílias do fornecedor
 * - getFamilyCombinationData: Carrega tudo de uma família para cascata
 * - getCombinationPriceServer: Preço oficial de uma combinação
 * - getCompatibleExtrasServer: Extras com preço para combinação/qtd
 * - getServicesForSupplier: Serviços disponíveis
 * - savePriceSnapshot: Salva snapshot imutável
 * - revalidateQuoteItem: Revalidação antes do pedido
 * - importCombinationsFromProduct: Migra variantes → combinações
 * - runCalculationTests: Executa testes de paridade
 */

import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import { importCombinationsFromProduct } from '@/services/combinationImporter';

// Supabase server-side client (chaves não expostas ao frontend)
function getServerSupabase() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  return createClient(url, key);
}

// ---------------------------------------------------------------------------
// 1. Listar famílias de produto de um fornecedor
// ---------------------------------------------------------------------------
export const getProductFamilies = createServerFn({ method: 'GET' })
  .inputValidator((input: { supplier_id: string; company_id: string }) => input)
  .handler(async ({ data }) => {
    const sb = getServerSupabase();
    const { data: families, error } = await sb
      .from('supplier_product_families')
      .select('*')
      .eq('company_id', data.company_id)
      .eq('supplier_id', data.supplier_id)
      .eq('is_active', true)
      .order('name');

    if (error) throw new Error(`Erro ao buscar famílias: ${error.message}`);
    return families || [];
  });

// ---------------------------------------------------------------------------
// 2. Carregar dados completos da família para filtragem em cascata
//    Produtos comerciais = 1 por combinação completa (incl. quantidade).
// ---------------------------------------------------------------------------
export const getFamilyCombinationData = createServerFn({ method: 'GET' })
  .inputValidator((input: { family_id: string; company_id: string }) => input)
  .handler(async ({ data }) => {
    const sb = getServerSupabase();

    const familyRes = await sb
      .from('supplier_product_families')
      .select('*')
      .eq('id', data.family_id)
      .eq('company_id', data.company_id)
      .single();

    if (familyRes.error) throw new Error(`Família não encontrada: ${familyRes.error.message}`);

    // IDs dos grupos desta família
    const groupsRes = await sb
      .from('supplier_option_groups')
      .select('*')
      .eq('family_id', data.family_id)
      .eq('company_id', data.company_id)
      .order('order_index');
    const groupIds = (groupsRes.data || []).map((g: any) => g.id);

    const [valuesRes, productsRes] = await Promise.all([
      groupIds.length
        ? sb
            .from('supplier_option_values')
            .select('*')
            .eq('company_id', data.company_id)
            .in('group_id', groupIds)
            .eq('is_active', true)
            .order('order_index')
        : Promise.resolve({ data: [] as any[] }),
      sb
        .from('supplier_commercial_products')
        .select('*')
        .eq('family_id', data.family_id)
        .eq('company_id', data.company_id),
    ]);

    const productIds = (productsRes.data || []).map((p: any) => p.id);
    const productOptionsRes = productIds.length
      ? await sb
          .from('supplier_commercial_product_options')
          .select('*')
          .in('commercial_product_id', productIds)
      : { data: [] as any[] };

    return {
      family: familyRes.data,
      groups: groupsRes.data || [],
      values: valuesRes.data || [],
      products: productsRes.data || [],
      productOptions: productOptionsRes.data || [],
    };
  });

// ---------------------------------------------------------------------------
// 2b. Matriz completa da família (interface administrativa — §12/§13)
// ---------------------------------------------------------------------------
export const getFamilyMatrix = createServerFn({ method: 'GET' })
  .inputValidator((input: { family_id: string; company_id: string }) => input)
  .handler(async ({ data }) => {
    const sb = getServerSupabase();
    const { data: products, error } = await sb
      .from('supplier_commercial_products')
      .select('*')
      .eq('family_id', data.family_id)
      .eq('company_id', data.company_id)
      .order('quantity');
    if (error) throw new Error(`Erro ao carregar matriz: ${error.message}`);

    const list = products || [];
    const active = list.filter((p: any) => p.availability === 'available');
    // §13 validação: alerta para produtos sem external_product_id / sem preço
    const missingExternalId = list.filter((p: any) => !p.external_product_id).length;
    const missingPrice = list.filter(
      (p: any) => p.list_price == null && p.promotional_price == null && p.availability === 'available',
    ).length;

    return {
      products: list,
      total: list.length,
      active: active.length,
      unavailable: list.filter((p: any) => p.availability !== 'available').length,
      distinct_quantities: [...new Set(list.map((p: any) => p.quantity))].sort((a: number, b: number) => a - b),
      distinct_materials: [...new Set(list.map((p: any) => p.material).filter(Boolean))],
      distinct_formats: [...new Set(list.map((p: any) => p.format).filter(Boolean))],
      distinct_prints: [...new Set(list.map((p: any) => p.print_color).filter(Boolean))],
      validation: { missing_external_id: missingExternalId, missing_price: missingPrice },
    };
  });

// ---------------------------------------------------------------------------
// 3. Extras compatíveis com preço
// ---------------------------------------------------------------------------
export const getCompatibleExtrasServer = createServerFn({ method: 'GET' })
  .inputValidator(
    (input: { family_id: string; commercial_product_id: string; quantity: number; company_id: string }) =>
      input,
  )
  .handler(async ({ data }) => {
    const sb = getServerSupabase();

    const [extrasRes, compatRes, pricesRes] = await Promise.all([
      sb
        .from('supplier_extras')
        .select('*')
        .eq('family_id', data.family_id)
        .eq('company_id', data.company_id)
        .eq('is_active', true),
      sb
        .from('supplier_extra_compatibility')
        .select('*')
        .eq('company_id', data.company_id)
        .eq('is_active', true),
      sb
        .from('supplier_extra_prices')
        .select('*')
        .eq('company_id', data.company_id)
        .eq('quantity', data.quantity)
        .eq('available', true),
    ]);

    return {
      extras: extrasRes.data || [],
      compatibility: compatRes.data || [],
      prices: pricesRes.data || [],
    };
  });

// ---------------------------------------------------------------------------
// 4. Serviços do fornecedor
// ---------------------------------------------------------------------------
export const getServicesForSupplier = createServerFn({ method: 'GET' })
  .inputValidator((input: { supplier_id: string; company_id: string; family_id?: string }) => input)
  .handler(async ({ data }) => {
    const sb = getServerSupabase();

    const { data: services, error } = await sb
      .from('supplier_services')
      .select('*')
      .eq('supplier_id', data.supplier_id)
      .eq('company_id', data.company_id)
      .eq('is_active', true);

    if (error) throw new Error(`Erro ao buscar serviços: ${error.message}`);

    // Preços dos serviços
    const serviceIds = (services || []).map((s: any) => s.id);
    let prices: any[] = [];
    if (serviceIds.length > 0) {
      const pricesQuery = sb
        .from('supplier_service_prices')
        .select('*')
        .eq('company_id', data.company_id)
        .in('service_id', serviceIds);

      if (data.family_id) {
        // Priorizar preços específicos da família, depois genéricos
      }

      const { data: pricesData } = await pricesQuery;
      prices = pricesData || [];
    }

    return { services: services || [], prices };
  });

// ---------------------------------------------------------------------------
// 5. Salvar snapshot imutável
// ---------------------------------------------------------------------------
export const savePriceSnapshot = createServerFn({ method: 'POST' })
  .inputValidator((input: { snapshot: Record<string, any>; quote_item_id?: string }) => input)
  .handler(async ({ data }) => {
    const sb = getServerSupabase();

    const payload = {
      ...data.snapshot,
      quote_item_id: data.quote_item_id || null,
    };

    const { data: saved, error } = await sb
      .from('supplier_price_snapshots')
      .insert([payload])
      .select('id')
      .single();

    if (error) throw new Error(`Erro ao salvar snapshot: ${error.message}`);

    // Vincular ao quote_item se fornecido
    if (data.quote_item_id && saved) {
      await sb
        .from('quote_items')
        .update({ snapshot_id: saved.id })
        .eq('id', data.quote_item_id);
    }

    return { snapshot_id: saved?.id };
  });

// ---------------------------------------------------------------------------
// 6. Revalidar item do orçamento
// ---------------------------------------------------------------------------
export const revalidateQuoteItem = createServerFn({ method: 'POST' })
  .inputValidator(
    (input: {
      quote_item_id: string;
      commercial_product_id: string;
      company_id: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const sb = getServerSupabase();

    // Snapshot original (fonte imutável do que foi cotado)
    const { data: snapshot } = await sb
      .from('supplier_price_snapshots')
      .select('*')
      .eq('quote_item_id', data.quote_item_id)
      .order('snapshot_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!snapshot) {
      return { has_snapshot: false, revalidation: null, message: 'Nenhum snapshot encontrado para este item.' };
    }

    // Produto comercial atual (preço, promoção, prazo, disponibilidade)
    const { data: current } = await sb
      .from('supplier_commercial_products')
      .select('*')
      .eq('id', data.commercial_product_id)
      .maybeSingle();

    // Promoção ativa atual
    const { data: promos } = await sb
      .from('supplier_promotions')
      .select('*')
      .eq('company_id', data.company_id)
      .eq('commercial_product_id', data.commercial_product_id)
      .eq('status', 'active');
    const nowIso = new Date().toISOString();
    const activePromo = (promos || []).find(
      (p: any) => (!p.starts_at || p.starts_at <= nowIso) && (!p.ends_at || p.ends_at >= nowIso),
    );

    const isAvailable = current ? current.availability === 'available' : false;
    const newNormal = current?.list_price ?? null;
    const newPromo = activePromo?.promo_price ?? current?.promotional_price ?? null;
    const newPrice = current ? (newPromo ?? newNormal) : null;
    const newLeadTime = current?.production_days ?? null;

    const priceDiff = newPrice != null ? newPrice - snapshot.total_price : null;
    const priceDiffPercent =
      priceDiff != null && snapshot.total_price > 0
        ? Math.round((priceDiff / snapshot.total_price) * 1000) / 10
        : null;

    // Impacto na margem: custo muda mas preço de venda fica fixo
    let marginImpact: number | null = null;
    if (priceDiff != null && snapshot.final_sale_price > 0) {
      const newCost = snapshot.total_supplier_cost + priceDiff;
      const newMargin = ((snapshot.final_sale_price - newCost) / snapshot.final_sale_price) * 100;
      marginImpact = Math.round((newMargin - (snapshot.margin_percent ?? 0)) * 10) / 10;
    }

    const hadPromo = snapshot.promotional_price != null;
    const hasPromo = newPromo != null;

    return {
      has_snapshot: true,
      found: !!current,
      external_product_id: current?.external_product_id ?? snapshot.external_code ?? null,
      old_price: snapshot.total_price,
      new_price: newPrice,
      price_diff: priceDiff,
      price_diff_percent: priceDiffPercent,
      is_available: isAvailable,
      old_lead_time: snapshot.total_lead_time_days,
      new_lead_time: newLeadTime,
      had_promotion: hadPromo,
      has_promotion: hasPromo,
      old_promo_price: snapshot.promotional_price ?? null,
      new_promo_price: newPromo,
      old_freight: snapshot.freight_cost ?? null,
      old_margin: snapshot.margin_percent ?? null,
      margin_impact: marginImpact,
      has_changes:
        !current ||
        !isAvailable ||
        newPrice == null ||
        newPrice !== snapshot.total_price ||
        hadPromo !== hasPromo ||
        (newLeadTime != null && newLeadTime !== snapshot.total_lead_time_days),
    };
  });

// ---------------------------------------------------------------------------
// 7. Promoções ativas para uma família
// ---------------------------------------------------------------------------
export const getActivePromotions = createServerFn({ method: 'GET' })
  .inputValidator((input: { family_id: string; company_id: string }) => input)
  .handler(async ({ data }) => {
    const sb = getServerSupabase();

    const { data: promos, error } = await sb
      .from('supplier_promotions')
      .select('*')
      .eq('company_id', data.company_id)
      .eq('family_id', data.family_id)
      .eq('status', 'active');

    if (error) throw new Error(`Erro ao buscar promoções: ${error.message}`);
    return promos || [];
  });

// ---------------------------------------------------------------------------
// 8. Executar testes de paridade
// ---------------------------------------------------------------------------
export const runCalculationTests = createServerFn({ method: 'POST' })
  .inputValidator((input: { family_id: string; company_id: string }) => input)
  .handler(async ({ data }) => {
    const sb = getServerSupabase();

    // Buscar testes ativos
    const { data: tests, error } = await sb
      .from('supplier_calculation_tests')
      .select('*')
      .eq('family_id', data.family_id)
      .eq('company_id', data.company_id)
      .eq('is_active', true);

    if (error) throw new Error(`Erro ao buscar testes: ${error.message}`);
    if (!tests || tests.length === 0) return { total: 0, passed: 0, failed: 0, results: [] };

    const results: Array<{
      test_id: string;
      name: string | null;
      passed: boolean;
      expected: number;
      calculated: number | null;
      diff: number | null;
      diff_percent: number | null;
      error: string | null;
    }> = [];

    for (const test of tests) {
      try {
        // Buscar o produto comercial EXATO pelo external_product_id + quantidade
        const { data: product } = await sb
          .from('supplier_commercial_products')
          .select('id, list_price, promotional_price, production_days, availability, quantity')
          .eq('family_id', data.family_id)
          .eq('external_product_id', test.external_code)
          .eq('quantity', test.quantity)
          .eq('company_id', data.company_id)
          .maybeSingle();

        if (!product) {
          results.push({
            test_id: test.id, name: test.name, passed: false, expected: test.expected_price,
            calculated: null, diff: null, diff_percent: null,
            error: `Produto comercial ${test.external_code} (${test.quantity}un) não encontrado.`,
          });
          continue;
        }

        // Preço oficial: promocional quando ativo, senão preço de lista
        const officialPrice =
          product.promotional_price != null ? product.promotional_price : product.list_price;

        if (officialPrice == null || product.availability !== 'available') {
          results.push({
            test_id: test.id, name: test.name, passed: false, expected: test.expected_price,
            calculated: null, diff: null, diff_percent: null,
            error: product.availability !== 'available'
              ? `Produto ${test.external_code} indisponível.`
              : `Produto ${test.external_code} sem preço confirmado.`,
          });
          continue;
        }

        const priceMatch = Math.abs(officialPrice - test.expected_price) < 0.01;
        // §16: paridade também considera prazo esperado, quando informado
        const leadTimeMatch =
          test.expected_lead_time == null || product.production_days === test.expected_lead_time;
        const diff = officialPrice - test.expected_price;
        const diffPercent =
          test.expected_price > 0 ? Math.round((diff / test.expected_price) * 1000) / 10 : null;
        const passed = priceMatch && leadTimeMatch;

        await sb.from('supplier_calculation_logs').insert([
          {
            company_id: data.company_id,
            test_id: test.id,
            calculated_price: officialPrice,
            expected_price: test.expected_price,
            passed,
            diff_amount: diff,
            diff_percent: diffPercent,
            details: {
              price_match: priceMatch,
              lead_time_match: leadTimeMatch,
              expected_lead_time: test.expected_lead_time,
              actual_lead_time: product.production_days,
            },
            action_taken: passed ? 'none' : 'flagged_review',
          },
        ]);

        await sb
          .from('supplier_calculation_tests')
          .update({
            last_result: passed ? 'passed' : 'failed',
            last_calculated_price: officialPrice,
            last_diff_amount: diff,
            last_diff_percent: diffPercent,
            validated_at: new Date().toISOString(),
          })
          .eq('id', test.id);

        results.push({
          test_id: test.id, name: test.name, passed, expected: test.expected_price,
          calculated: officialPrice, diff, diff_percent: diffPercent,
          error: passed ? null : (!priceMatch ? 'Preço divergente.' : 'Prazo divergente.'),
        });
      } catch (err: any) {
        results.push({
          test_id: test.id,
          name: test.name,
          passed: false,
          expected: test.expected_price,
          calculated: null,
          diff: null,
          diff_percent: null,
          error: err.message,
        });
      }
    }

    return {
      total: results.length,
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length,
      results,
    };
  });

// ---------------------------------------------------------------------------
// 9. Importar combinações de um produto do catálogo (Etapa 4)
//
// Carrega o produto + variantes + tiragens + extras já persistidos pelo
// importador estruturado e converte para as tabelas do motor de combinações
// (famílias, grupos, valores, combinações, preços, extras, serviços).
//
// Idempotente: reexecutar apenas cria novas versões quando o dado muda,
// nunca sobrescreve o histórico. Requer que o produto tenha supplier_id.
// ---------------------------------------------------------------------------
export const importProductCombinations = createServerFn({ method: 'POST' })
  .inputValidator((input: { product_id: string; company_id: string; supplier_id?: string }) => input)
  .handler(async ({ data }) => {
    const sb = getServerSupabase();

    // 1. Carregar o produto
    const { data: product, error: prodErr } = await sb
      .from('products')
      .select('*')
      .eq('id', data.product_id)
      .eq('company_id', data.company_id)
      .single();

    if (prodErr || !product) {
      throw new Error(`Produto não encontrado: ${prodErr?.message ?? data.product_id}`);
    }

    const supplierId = data.supplier_id || product.supplier_id;
    if (!supplierId) {
      throw new Error(
        'Produto sem fornecedor vinculado. Só é possível gerar combinações de produtos importados de um fornecedor.',
      );
    }

    // 2. Carregar variantes, tiragens e extras
    const { data: variants } = await sb
      .from('product_variants')
      .select('*')
      .eq('product_id', data.product_id)
      .eq('company_id', data.company_id);

    const variantIds = (variants || []).map((v: any) => v.id);
    let priceTiers: any[] = [];
    if (variantIds.length > 0) {
      const { data: tiers } = await sb
        .from('product_price_tiers')
        .select('*')
        .eq('company_id', data.company_id)
        .in('variant_id', variantIds);
      priceTiers = tiers || [];
    }

    const { data: extras } = await sb
      .from('product_extras')
      .select('*')
      .eq('product_id', data.product_id)
      .eq('company_id', data.company_id);

    if (!variants || variants.length === 0) {
      throw new Error(
        'Produto sem variantes. Reimporte o produto pelo importador antes de gerar as combinações.',
      );
    }

    // 3. Converter para as tabelas do motor de combinações
    const result = await importCombinationsFromProduct(sb, {
      product,
      variants: variants || [],
      priceTiers,
      extras: extras || [],
      supplierId,
      companyId: data.company_id,
    });

    // 4. Vincular a família ao produto canônico (comparação multi-fornecedor)
    if (result.family_id && result.errors.length === 0) {
      await sb
        .from('supplier_product_families')
        .update({ catalog_product_id: data.product_id, last_synced_at: new Date().toISOString() })
        .eq('id', result.family_id);
    }

    return result;
  });
