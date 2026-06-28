/**
 * Mapeadores PUROS do produto importado para as linhas das tabelas estruturadas
 * (product_variants, product_price_tiers, product_attributes/values,
 * product_images, product_templates, product_extras).
 *
 * São funções sem DB/rede — testáveis isoladamente. O writer
 * (`importer-structured-persistence.ts`) apenas adiciona ids/foreign keys e grava.
 */

import type { ImportedProduct, ImportedVariant } from "@/types/importedProduct";
import { normalizeKey } from "@/services/productNormalizer";

export interface VariantRow {
  external_id: string | null;
  sku: string | null;
  title: string | null;
  material: string | null;
  format_original: string | null;
  width_mm: number | null;
  height_mm: number | null;
  depth_mm: number | null;
  model: string | null;
  size: string | null;
  print_color: string | null;
  enoblement: string | null;
  finishing: string | null;
  production_days: number | null;
  available: boolean;
  raw_attributes: Record<string, string>;
}

export interface PriceTierRow {
  quantity: number;
  unit: string;
  total_price: number;
  unit_price: number | null;
  old_price: number | null;
  promotional_price: number | null;
  discount_percent: number | null;
  currency: string;
  available: boolean;
  external_id: string | null;
  collected_at: string;
}

export interface AttributeRow {
  name: string;
  normalized_name: string;
  values: Array<{ value: string; normalized_value: string; external_id: string | null }>;
}

export interface ImageRow {
  url: string;
  hires_url: string | null;
  alt: string | null;
  position: number;
  is_main: boolean;
}

export interface TemplateRow {
  type: string | null;
  name: string | null;
  url: string;
  format: string | null;
}

export interface ExtraRow {
  name: string;
  normalized_name: string | null;
  price: number;
  currency: string;
  extra_days: number | null;
  url: string | null;
}

export function buildVariantRow(variant: ImportedVariant): VariantRow {
  const d = variant.dimensions;
  return {
    external_id: variant.external_id ?? null,
    sku: variant.sku ?? null,
    title: variant.title ?? null,
    material: variant.material?.original_material ?? null,
    format_original: d?.original ?? null,
    width_mm: d?.width_mm ?? null,
    height_mm: d?.height_mm ?? null,
    depth_mm: d?.depth_mm ?? null,
    model: variant.raw_attributes?.["Modelo"] ?? null,
    size: d?.unit === "size_label" ? d.original : (variant.raw_attributes?.["Tamanho"] ?? null),
    print_color: variant.color?.original_color_code ?? null,
    enoblement: variant.enoblement?.length ? variant.enoblement.join(", ") : null,
    finishing: variant.finishing?.length ? variant.finishing.join(", ") : null,
    production_days: variant.production_days ?? null,
    available: variant.available,
    raw_attributes: variant.raw_attributes ?? {},
  };
}

export function buildPriceTierRows(variant: ImportedVariant): PriceTierRow[] {
  return (variant.price_tiers || []).map((t) => ({
    quantity: t.quantity,
    unit: t.unit || "unidade",
    total_price: t.total_price,
    unit_price: t.unit_price ?? null,
    old_price: t.old_price ?? null,
    promotional_price: t.promotional_price ?? null,
    discount_percent: t.discount_percent ?? null,
    currency: t.currency || "BRL",
    available: t.available ?? true,
    external_id: t.external_id ?? null,
    collected_at: t.collected_at,
  }));
}

/**
 * Funde especificações (valor selecionado) e eixos de variação (todas as
 * opções) em uma lista de atributos com valores deduplicados — evitando
 * atributos repetidos (ex.: "Material" aparece nas specs e como eixo).
 */
export function buildAttributeRows(product: ImportedProduct): AttributeRow[] {
  const map = new Map<string, AttributeRow>();

  const ensure = (name: string): AttributeRow => {
    const key = normalizeKey(name);
    if (!map.has(key)) map.set(key, { name, normalized_name: key, values: [] });
    return map.get(key)!;
  };
  const addValue = (attr: AttributeRow, value: string, external_id: string | null) => {
    const nv = normalizeKey(value);
    if (!value || attr.values.some((v) => v.normalized_value === nv)) return;
    attr.values.push({ value, normalized_value: nv, external_id });
  };

  for (const s of product.specifications) {
    addValue(ensure(s.name), s.value, null);
  }
  for (const axis of product.variant_axes) {
    const attr = ensure(axis.name);
    for (const opt of axis.options) addValue(attr, opt.value, opt.external_id ?? null);
  }

  return [...map.values()].filter((a) => a.values.length > 0);
}

export function buildImageRows(product: ImportedProduct): ImageRow[] {
  return product.images.map((i) => ({
    url: i.url,
    hires_url: i.hires_url ?? null,
    alt: i.alt ?? null,
    position: i.order,
    is_main: i.is_main,
  }));
}

export function buildTemplateRows(product: ImportedProduct): TemplateRow[] {
  return product.templates.map((t) => ({
    type: t.type ?? null,
    name: t.name ?? null,
    url: t.url,
    format: t.format ?? null,
  }));
}

export function buildExtraRows(product: ImportedProduct): ExtraRow[] {
  return product.extras.map((e) => ({
    name: e.name,
    normalized_name: e.normalized_name ?? null,
    price: e.price,
    currency: e.currency || "BRL",
    extra_days: e.extra_days ?? null,
    url: e.url ?? null,
  }));
}
