/**
 * Operações do Motor de Combinações — CLIENT-SIDE (client autenticado do browser).
 *
 * Este projeto NÃO usa service-role key: todo acesso ao banco passa pelo client
 * publishable + sessão do usuário, com RLS via user_owns_company. Por isso as
 * operações de combinação rodam client-side (mesmo padrão de importer-persistence),
 * e não via server functions (que exigiriam uma chave de servidor inexistente).
 */

import { supabase } from '@/integrations/supabase/client';
import { importCombinationsFromProduct } from '@/services/combinationImporter';
import type { FamilyCombinationData, RawPromotion } from '@/services/combinationEngine';

const db = supabase as any;

// ---------------------------------------------------------------------------
// Gerar produtos comerciais a partir de um produto do catálogo (Etapa 4)
// ---------------------------------------------------------------------------
export async function generateCommercialProducts(params: {
  product_id: string;
  company_id: string;
  supplier_id?: string | null;
  executed_by?: string | null;
}) {
  // 1. Produto
  const { data: product, error: prodErr } = await db
    .from('products')
    .select('*')
    .eq('id', params.product_id)
    .eq('company_id', params.company_id)
    .single();
  if (prodErr || !product) throw new Error(`Produto não encontrado: ${prodErr?.message ?? params.product_id}`);

  const supplierId = params.supplier_id || product.supplier_id;
  if (!supplierId) {
    throw new Error('Produto sem fornecedor vinculado. Só é possível gerar combinações de produtos de fornecedor.');
  }

  // 2. Variantes, tiragens e extras
  const { data: variants } = await db
    .from('product_variants')
    .select('*')
    .eq('product_id', params.product_id)
    .eq('company_id', params.company_id);

  if (!variants || variants.length === 0) {
    throw new Error('Produto sem variantes. Reimporte o produto pelo importador antes de gerar as combinações.');
  }

  const variantIds = variants.map((v: any) => v.id);
  const { data: tiers } = await db
    .from('product_price_tiers')
    .select('*')
    .eq('company_id', params.company_id)
    .in('variant_id', variantIds);

  const { data: extras } = await db
    .from('product_extras')
    .select('*')
    .eq('product_id', params.product_id)
    .eq('company_id', params.company_id);

  // 3. Converter para produtos comerciais
  const result = await importCombinationsFromProduct(db, {
    product,
    variants,
    priceTiers: tiers || [],
    extras: extras || [],
    supplierId,
    companyId: params.company_id,
    executedBy: params.executed_by ?? null,
  });

  // 4. Vincular família ao produto canônico
  if (result.family_id && result.errors.length === 0) {
    await db
      .from('supplier_product_families')
      .update({ catalog_product_id: params.product_id, last_synced_at: new Date().toISOString() })
      .eq('id', result.family_id);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Carregar dados completos da família para a cascata do orçamento
// ---------------------------------------------------------------------------
export async function getFamilyCombinationDataClient(
  familyId: string,
  companyId: string,
): Promise<FamilyCombinationData & { promotions: RawPromotion[] }> {
  const { data: family, error } = await db
    .from('supplier_product_families')
    .select('*')
    .eq('id', familyId)
    .eq('company_id', companyId)
    .single();
  if (error || !family) throw new Error(`Família não encontrada: ${error?.message ?? familyId}`);

  const { data: groups } = await db
    .from('supplier_option_groups')
    .select('*')
    .eq('family_id', familyId)
    .eq('company_id', companyId)
    .order('order_index');
  const groupIds = (groups || []).map((g: any) => g.id);

  const [valuesRes, productsRes, promosRes] = await Promise.all([
    groupIds.length
      ? db.from('supplier_option_values').select('*').eq('company_id', companyId).in('group_id', groupIds).eq('is_active', true).order('order_index')
      : Promise.resolve({ data: [] }),
    db.from('supplier_commercial_products').select('*').eq('family_id', familyId).eq('company_id', companyId),
    db.from('supplier_promotions').select('*').eq('company_id', companyId).eq('family_id', familyId).eq('status', 'active'),
  ]);

  const productIds = (productsRes.data || []).map((p: any) => p.id);
  const productOptionsRes = productIds.length
    ? await db.from('supplier_commercial_product_options').select('*').in('commercial_product_id', productIds)
    : { data: [] };

  return {
    family,
    groups: groups || [],
    values: valuesRes.data || [],
    products: productsRes.data || [],
    productOptions: productOptionsRes.data || [],
    promotions: (promosRes.data || []) as RawPromotion[],
  };
}

// ---------------------------------------------------------------------------
// Matriz da família (interface administrativa — §12/§13)
// ---------------------------------------------------------------------------
export async function getFamilyMatrixClient(familyId: string, companyId: string) {
  const { data: products, error } = await db
    .from('supplier_commercial_products')
    .select('*')
    .eq('family_id', familyId)
    .eq('company_id', companyId)
    .order('quantity');
  if (error) throw new Error(`Erro ao carregar matriz: ${error.message}`);

  const list = products || [];
  return {
    products: list,
    total: list.length,
    active: list.filter((p: any) => p.availability === 'available').length,
    unavailable: list.filter((p: any) => p.availability !== 'available').length,
    distinct_quantities: ([...new Set(list.map((p: any) => p.quantity))] as number[]).sort((a, b) => a - b),
    validation: {
      missing_external_id: list.filter((p: any) => !p.external_product_id).length,
      missing_price: list.filter((p: any) => p.list_price == null && p.promotional_price == null && p.availability === 'available').length,
    },
  };
}
