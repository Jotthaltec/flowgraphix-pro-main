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
// ---------------------------------------------------------------------------
export const getFamilyCombinationData = createServerFn({ method: 'GET' })
  .inputValidator((input: { family_id: string; company_id: string }) => input)
  .handler(async ({ data }) => {
    const sb = getServerSupabase();

    const [familyRes, groupsRes, valuesRes, combosRes, comboOptsRes, pricesRes] =
      await Promise.all([
        sb
          .from('supplier_product_families')
          .select('*')
          .eq('id', data.family_id)
          .eq('company_id', data.company_id)
          .single(),
        sb
          .from('supplier_option_groups')
          .select('*')
          .eq('family_id', data.family_id)
          .eq('company_id', data.company_id)
          .order('order_index'),
        sb
          .from('supplier_option_values')
          .select('*')
          .eq('company_id', data.company_id)
          .in(
            'group_id',
            // Subquery: IDs dos grupos desta família
            (
              await sb
                .from('supplier_option_groups')
                .select('id')
                .eq('family_id', data.family_id)
                .eq('company_id', data.company_id)
            ).data?.map((g: any) => g.id) || [],
          )
          .eq('is_active', true)
          .order('order_index'),
        sb
          .from('supplier_combinations')
          .select('*')
          .eq('family_id', data.family_id)
          .eq('company_id', data.company_id),
        sb
          .from('supplier_combination_option_values')
          .select('*')
          .in(
            'combination_id',
            (
              await sb
                .from('supplier_combinations')
                .select('id')
                .eq('family_id', data.family_id)
                .eq('company_id', data.company_id)
            ).data?.map((c: any) => c.id) || [],
          ),
        sb
          .from('supplier_combination_prices')
          .select('*')
          .eq('company_id', data.company_id)
          .in(
            'combination_id',
            (
              await sb
                .from('supplier_combinations')
                .select('id')
                .eq('family_id', data.family_id)
                .eq('company_id', data.company_id)
            ).data?.map((c: any) => c.id) || [],
          ),
      ]);

    if (familyRes.error) throw new Error(`Família não encontrada: ${familyRes.error.message}`);

    return {
      family: familyRes.data,
      groups: groupsRes.data || [],
      values: valuesRes.data || [],
      combinations: combosRes.data || [],
      combinationOptions: comboOptsRes.data || [],
      prices: pricesRes.data || [],
    };
  });

// ---------------------------------------------------------------------------
// 3. Extras compatíveis com preço
// ---------------------------------------------------------------------------
export const getCompatibleExtrasServer = createServerFn({ method: 'GET' })
  .inputValidator(
    (input: { family_id: string; combination_id: string; quantity: number; company_id: string }) =>
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
      combination_id: string;
      quantity: number;
      company_id: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const sb = getServerSupabase();

    // Buscar snapshot original
    const { data: snapshot } = await sb
      .from('supplier_price_snapshots')
      .select('*')
      .eq('quote_item_id', data.quote_item_id)
      .order('snapshot_at', { ascending: false })
      .limit(1)
      .single();

    // Buscar preço atual
    const { data: currentPrice } = await sb
      .from('supplier_combination_prices')
      .select('*')
      .eq('combination_id', data.combination_id)
      .eq('quantity', data.quantity)
      .eq('company_id', data.company_id)
      .eq('available', true)
      .single();

    // Buscar combinação atual
    const { data: currentCombo } = await sb
      .from('supplier_combinations')
      .select('*')
      .eq('id', data.combination_id)
      .single();

    if (!snapshot) {
      return {
        has_snapshot: false,
        revalidation: null,
        message: 'Nenhum snapshot encontrado para este item.',
      };
    }

    const result = {
      has_snapshot: true,
      old_price: snapshot.total_price,
      new_price: currentPrice?.total_price ?? null,
      price_diff:
        currentPrice != null ? currentPrice.total_price - snapshot.total_price : null,
      price_diff_percent:
        currentPrice != null && snapshot.total_price > 0
          ? Math.round(
              ((currentPrice.total_price - snapshot.total_price) / snapshot.total_price) * 1000,
            ) / 10
          : null,
      is_available: currentCombo?.available ?? null,
      old_lead_time: snapshot.total_lead_time_days,
      new_lead_time: currentCombo?.base_lead_time_days ?? null,
      has_changes:
        currentPrice == null ||
        currentPrice.total_price !== snapshot.total_price ||
        !currentCombo?.available,
    };

    return result;
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
        // Buscar combinação pelo external_code
        const { data: combo } = await sb
          .from('supplier_combinations')
          .select('id')
          .eq('family_id', data.family_id)
          .eq('external_code', test.external_code)
          .eq('company_id', data.company_id)
          .single();

        if (!combo) {
          results.push({
            test_id: test.id,
            name: test.name,
            passed: false,
            expected: test.expected_price,
            calculated: null,
            diff: null,
            diff_percent: null,
            error: `Combinação ${test.external_code} não encontrada.`,
          });
          continue;
        }

        // Buscar preço para a quantidade do teste
        const { data: price } = await sb
          .from('supplier_combination_prices')
          .select('total_price')
          .eq('combination_id', combo.id)
          .eq('quantity', test.quantity)
          .eq('available', true)
          .single();

        if (!price) {
          results.push({
            test_id: test.id,
            name: test.name,
            passed: false,
            expected: test.expected_price,
            calculated: null,
            diff: null,
            diff_percent: null,
            error: `Preço para quantidade ${test.quantity} não encontrado.`,
          });
          continue;
        }

        const diff = price.total_price - test.expected_price;
        const diffPercent =
          test.expected_price > 0
            ? Math.round((diff / test.expected_price) * 1000) / 10
            : null;
        const passed = Math.abs(diff) < 0.01; // tolerância de 1 centavo

        // Registrar log
        await sb.from('supplier_calculation_logs').insert([
          {
            company_id: data.company_id,
            test_id: test.id,
            calculated_price: price.total_price,
            expected_price: test.expected_price,
            passed,
            diff_amount: diff,
            diff_percent: diffPercent,
            action_taken: passed ? 'none' : 'flagged_review',
          },
        ]);

        // Atualizar teste
        await sb
          .from('supplier_calculation_tests')
          .update({
            last_result: passed ? 'passed' : 'failed',
            last_calculated_price: price.total_price,
            last_diff_amount: diff,
            last_diff_percent: diffPercent,
            validated_at: new Date().toISOString(),
          })
          .eq('id', test.id);

        results.push({
          test_id: test.id,
          name: test.name,
          passed,
          expected: test.expected_price,
          calculated: price.total_price,
          diff,
          diff_percent: diffPercent,
          error: null,
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
