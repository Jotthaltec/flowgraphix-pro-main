/**
 * Gravação do produto importado no GRAFO ESTRUTURADO (seção 25):
 * product_variants → product_price_tiers, product_attributes →
 * product_attribute_values, product_images, product_templates, product_extras,
 * product_categories / product_segments / product_category_mappings.
 *
 * É idempotente: ao reimportar o mesmo produto, os filhos são removidos e
 * regravados (re-sync), evitando duplicação. É tolerante a falha — cada seção é
 * isolada e acumula avisos sem derrubar o salvamento principal em `products`.
 *
 * As tabelas novas ainda não estão no types.ts gerado, por isso o acesso usa um
 * handle sem tipagem estrita.
 */

import { supabase } from "@/integrations/supabase/client";
import type { ImportedProduct } from "@/types/importedProduct";
import {
  buildAttributeRows,
  buildExtraRows,
  buildImageRows,
  buildPriceTierRows,
  buildTemplateRows,
  buildVariantRow,
} from "@/services/structuredMappers";

const db = supabase as any;

export interface StructuredResult {
  ok: boolean;
  warnings: string[];
  counts: { variants: number; tiers: number; attributes: number; images: number; templates: number; extras: number };
}

/** Busca o id de uma linha por igualdade; cria se não existir. Retorna o id ou null. */
async function ensureRow(table: string, match: Record<string, any>, insert: Record<string, any>): Promise<string | null> {
  try {
    let q = db.from(table).select("id");
    for (const [k, v] of Object.entries(match)) q = v === null ? q.is(k, null) : q.eq(k, v);
    const { data: found } = await q.maybeSingle();
    if (found?.id) return found.id;
    const { data: created, error } = await db
      .from(table)
      .insert({ ...match, ...insert })
      .select("id")
      .single();
    if (error) return null;
    return created?.id ?? null;
  } catch {
    return null;
  }
}

export async function persistStructured(
  productId: string,
  product: ImportedProduct,
  companyId: string,
): Promise<StructuredResult> {
  const warnings: string[] = [];
  const counts = { variants: 0, tiers: 0, attributes: 0, images: 0, templates: 0, extras: 0 };
  const guard = async (label: string, fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e: any) {
      warnings.push(`${label}: ${e?.message || e}`);
    }
  };

  // 1) Re-sync: remove filhos existentes (cascatas cuidam de tiers/values).
  await guard("limpeza", async () => {
    await Promise.all([
      db.from("product_variants").delete().eq("product_id", productId),
      db.from("product_attributes").delete().eq("product_id", productId),
      db.from("product_images").delete().eq("product_id", productId),
      db.from("product_templates").delete().eq("product_id", productId),
      db.from("product_extras").delete().eq("product_id", productId),
      db.from("product_category_mappings").delete().eq("product_id", productId),
    ]);
  });

  // 2) Variantes + faixas de preço
  await guard("variantes", async () => {
    for (const variant of product.variants) {
      const vrow = buildVariantRow(variant);
      const { data: inserted, error } = await db
        .from("product_variants")
        .insert({ company_id: companyId, product_id: productId, ...vrow })
        .select("id")
        .single();
      if (error || !inserted) {
        warnings.push(`variante "${variant.title}" não gravada: ${error?.message || "erro"}`);
        continue;
      }
      counts.variants++;
      const tiers = buildPriceTierRows(variant);
      if (tiers.length) {
        const { error: tErr } = await db
          .from("product_price_tiers")
          .insert(tiers.map((t) => ({ company_id: companyId, variant_id: inserted.id, ...t })));
        if (tErr) warnings.push(`tiragens da variante "${variant.title}": ${tErr.message}`);
        else counts.tiers += tiers.length;
      }
    }
  });

  // 3) Atributos + valores
  await guard("atributos", async () => {
    for (const attr of buildAttributeRows(product)) {
      const { data: a, error } = await db
        .from("product_attributes")
        .insert({ company_id: companyId, product_id: productId, name: attr.name, normalized_name: attr.normalized_name })
        .select("id")
        .single();
      if (error || !a) continue;
      counts.attributes++;
      if (attr.values.length) {
        await db.from("product_attribute_values").insert(
          attr.values.map((v) => ({
            company_id: companyId,
            attribute_id: a.id,
            value: v.value,
            normalized_value: v.normalized_value,
            external_id: v.external_id,
          })),
        );
      }
    }
  });

  // 4) Imagens
  await guard("imagens", async () => {
    const rows = buildImageRows(product);
    if (!rows.length) return;
    const { error } = await db
      .from("product_images")
      .insert(rows.map((r) => ({ company_id: companyId, product_id: productId, ...r })));
    if (!error) counts.images = rows.length;
  });

  // 5) Gabaritos
  await guard("gabaritos", async () => {
    const rows = buildTemplateRows(product);
    if (!rows.length) return;
    const { error } = await db
      .from("product_templates")
      .insert(rows.map((r) => ({ company_id: companyId, product_id: productId, ...r })));
    if (!error) counts.templates = rows.length;
  });

  // 6) Extras / serviços adicionais
  await guard("extras", async () => {
    const rows = buildExtraRows(product);
    if (!rows.length) return;
    const { error } = await db
      .from("product_extras")
      .insert(rows.map((r) => ({ company_id: companyId, product_id: productId, ...r })));
    if (!error) counts.extras = rows.length;
  });

  // 7) Categoria / subcategoria / segmentos + mapeamento (seções 21–24)
  await guard("classificação", async () => {
    const cls = product.classification;
    const catId = await ensureRow(
      "product_categories",
      { company_id: companyId, name: cls.category, parent_id: null },
      { slug: null },
    );
    const subId = catId
      ? await ensureRow(
          "product_categories",
          { company_id: companyId, name: cls.subcategory, parent_id: catId },
          { slug: null },
        )
      : null;

    const segIds: string[] = [];
    for (const seg of cls.segments) {
      const id = await ensureRow("product_segments", { company_id: companyId, name: seg }, { slug: null });
      if (id) segIds.push(id);
    }

    const baseMapping = {
      company_id: companyId,
      product_id: productId,
      category_id: subId || catId,
      confidence: cls.confidence,
      reason: cls.reason,
    };
    if (segIds.length) {
      await db.from("product_category_mappings").insert(segIds.map((segment_id) => ({ ...baseMapping, segment_id })));
    } else {
      await db.from("product_category_mappings").insert({ ...baseMapping, segment_id: null });
    }
  });

  return { ok: warnings.length === 0, warnings, counts };
}
