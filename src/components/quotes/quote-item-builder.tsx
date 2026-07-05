import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Package, Search, ChevronDown, X, Truck, Plus, Trash2, Settings2, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/status-badge";
import { SupplierCombinationWrapper } from "./supplier-combination-wrapper";
import { useAuth } from "@/hooks/use-auth";
import { Textarea } from "@/components/ui/textarea";

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const db = supabase as any;

/** Faixa de preço por quantidade (tiragem real do fornecedor — seção 7). */
export interface QuoteTier {
  quantity: number;
  unitCost: number; // custo unitário do fornecedor nesta faixa
  unitPrice: number; // preço de venda unitário (custo × margem)
  totalCost: number; // custo TOTAL exato da tiragem (preço FuturaIM é por total)
  totalPrice: number; // preço de venda TOTAL da tiragem
  external_id?: string | null;
}

export interface QuoteItemData {
  id: string; // temp client id
  product_id: string | null;
  product_name: string;
  product_image: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  quantity: number;
  unit_cost: number;
  unit_price: number;
  attributes: Record<string, any>; // { attr_code: value }
  attribute_price_impacts: Record<string, number>; // { attr_code: price_impact }
  notes: string;
  // Origem / configuração importada
  is_supplier?: boolean;
  margin_percent_target?: number; // margem alvo p/ recalcular preço a partir do custo
  tiers?: QuoteTier[]; // faixas por quantidade (produto importado)
  // Custo unitário REAL da combinação escolhida (varredura). Quando definido,
  // substitui a tiragem-âncora — o preço da FuturaIM é por combinação. `label`
  // indica qual opção o determinou (transparência).
  override_unit_cost?: number | null;
  override_label?: string | null;
  production_deadline?: string | null;
  source_url?: string | null;
  // Snapshot da configuração no momento (seção 19) — persistido em item_attributes
  selection_snapshot?: Record<string, { value: string; external_id?: string | null; unit_cost?: number | null }>;
  // Calculated
  total_cost: number;
  total_price: number;
  margin_percent: number;
  // New Combination Engine
  has_combination_engine?: boolean;
  family_id?: string;
  calc_snapshot?: any;
}

interface QuoteItemBuilderProps {
  items: QuoteItemData[];
  onItemsChange: (items: QuoteItemData[]) => void;
}

function generateId() {
  return 'qi_' + Math.random().toString(36).substring(2, 11);
}

/** Lê as faixas de preço reais do produto importado (seção 7). Não fabrica nada. */
function readTiers(product: any): QuoteTier[] {
  const raw = Array.isArray(product?.quantity_prices)
    ? product.quantity_prices
    : Array.isArray(product?.quantity_price_table)
      ? product.quantity_price_table
      : [];
  const margin = Number(product?.margin_percent ?? product?.target_margin) || 0;
  const factor = 1 + margin / 100;
  const tiers: QuoteTier[] = raw
    .map((t: any) => {
      const quantity = Number(t.quantity) || 0;
      const totalCost = Number(t.price ?? (t.unit_price ? t.unit_price * quantity : 0)) || 0;
      const unitCost = Number(t.unitPrice ?? t.unit_price ?? (quantity ? totalCost / quantity : 0)) || 0;
      const totalPrice = Number(t.sellPrice ?? (totalCost ? totalCost * factor : 0)) || 0;
      const unitSell = Number(t.unitSellPrice ?? (quantity ? totalPrice / quantity : 0)) || 0;
      return { quantity, unitCost, unitPrice: unitSell, totalCost, totalPrice, external_id: t.external_id ?? null };
    })
    .filter((t: QuoteTier) => t.quantity > 0)
    .sort((a: QuoteTier, b: QuoteTier) => a.quantity - b.quantity);
  return tiers;
}

/** Converte as tiragens de uma opção (combinação varrida) em QuoteTier[]. */
function tiersFromOption(optTiers: any[]): QuoteTier[] {
  if (!Array.isArray(optTiers)) return [];
  return optTiers
    .map((t) => {
      const quantity = Number(t.quantity) || 0;
      const totalCost = Number(t.price ?? (t.unitCost ? t.unitCost * quantity : 0)) || 0;
      const totalPrice = Number(t.sellPrice ?? (t.unitSell ? t.unitSell * quantity : 0)) || 0;
      return {
        quantity,
        unitCost: Number(t.unitCost ?? (quantity ? totalCost / quantity : 0)) || 0,
        unitPrice: Number(t.unitSell ?? (quantity ? totalPrice / quantity : 0)) || 0,
        totalCost,
        totalPrice,
        external_id: t.external_id ?? null,
      };
    })
    .filter((t) => t.quantity > 0)
    .sort((a, b) => a.quantity - b.quantity);
}

/**
 * Resolve a faixa aplicável para uma quantidade (seção 7): usa a faixa exata; na
 * ausência, a faixa imediatamente INFERIOR (melhor custo já garantido); se a
 * quantidade for menor que a menor faixa, usa a menor. Nunca arredonda a
 * quantidade — apenas escolhe qual faixa de preço aplicar.
 */
function resolveTier(tiers: QuoteTier[], qty: number): QuoteTier | null {
  if (!tiers.length) return null;
  const exact = tiers.find((t) => t.quantity === qty);
  if (exact) return exact;
  let lower: QuoteTier | null = null;
  for (const t of tiers) {
    if (t.quantity <= qty) lower = t;
    else break;
  }
  return lower || tiers[0];
}

export function QuoteItemBuilder({ items, onItemsChange }: QuoteItemBuilderProps) {
  const { profile } = useAuth();
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [productFilterOrigin, setProductFilterOrigin] = useState("all");

  // Catálogo de produtos
  const { data: catalogProducts } = useQuery({
    queryKey: ["products_catalog_quote"],
    queryFn: async () => {
      const { data, error } = await (db)
        .from("products")
        .select(`
          id, name, commercial_name, type, origin, supplier_name,
          internal_sku, supplier_sku, category, cost_price, base_cost,
          sale_price, suggested_price, margin_percent, target_margin, unit_measure, image_url,
          main_image_url, description, technical_description, supplier_id,
          production_deadline, avg_production_time, source_url, minimum_quantity,
          imported_from_supplier, model_id, editor_meta, variations,
          quantity_prices, quantity_price_table, supplier_product_families(id)
        `)
        .or("status.eq.Ativo,status.is.null")
        .order("name");
      if (error) throw error;
      return (data || []) as any[];
    }
  });

  // Motor: atributos e opções (com preço)
  const { data: motorData } = useQuery({
    queryKey: ["motor_attributes_for_quote"],
    queryFn: async () => {
      const [groupsRes, attrsRes, optionsRes, modelsRes, modelAttrsRes] = await Promise.all([
        db.from("technical_attribute_groups").select("*").order("order_index"),
        db.from("technical_attributes").select("*").eq("is_active", true).order("created_at"),
        db.from("technical_attribute_options").select("*").order("order_index"),
        db.from("product_models").select("*"),
        db.from("product_model_attributes").select("*").order("order_index"),
      ]);
      return {
        groups: groupsRes.data || [],
        attributes: attrsRes.data || [],
        options: optionsRes.data || [],
        models: modelsRes.data || [],
        modelAttributes: modelAttrsRes.data || [],
      };
    }
  });

  const filteredProducts = useMemo(() => {
    return catalogProducts?.filter(p => {
      const search = productSearch.toLowerCase();
      const matchesSearch = !search ||
        p.name.toLowerCase().includes(search) ||
        (p.commercial_name && p.commercial_name.toLowerCase().includes(search)) ||
        (p.internal_sku && p.internal_sku.toLowerCase().includes(search));
      let matchesOrigin = true;
      if (productFilterOrigin === "manual") matchesOrigin = (p.origin === "manual" || !p.origin) && !p.imported_from_supplier;
      if (productFilterOrigin === "supplier") matchesOrigin = p.origin === "supplier_import" || p.imported_from_supplier === true;
      if (productFilterOrigin === "service") matchesOrigin = p.type === "service";
      return matchesSearch && matchesOrigin;
    }) || [];
  }, [catalogProducts, productSearch, productFilterOrigin]);

  function addItem(product?: any) {
    const isSupplier = !!(product && (product.imported_from_supplier === true || product.origin === "supplier_import"));
    const familyId = product?.supplier_product_families?.[0]?.id || null;
    const hasCombinationEngine = !!familyId;
    const tiers = product ? readTiers(product) : [];
    const marginTarget = Number(product?.margin_percent ?? product?.target_margin) || 0;
    // Produto importado com tiragens: começa na MENOR faixa (custo/preço reais dela).
    const firstTier = tiers[0] || null;
    const initialQty = firstTier ? firstTier.quantity : 1;
    const initialCost = firstTier ? firstTier.unitCost : product?.cost_price || product?.base_cost || 0;
    const initialPrice = firstTier ? firstTier.unitPrice : product?.sale_price || product?.suggested_price || 0;

    const newItem: QuoteItemData = {
      id: generateId(),
      product_id: product?.id || null,
      product_name: product?.name || "",
      product_image: product?.image_url || product?.main_image_url || null,
      supplier_id: product?.supplier_id || null,
      supplier_name: product?.supplier_name || null,
      quantity: initialQty,
      unit_cost: initialCost,
      unit_price: initialPrice,
      attributes: {},
      attribute_price_impacts: {},
      notes: product?.technical_description || product?.description || "",
      is_supplier: isSupplier,
      has_combination_engine: hasCombinationEngine,
      family_id: familyId,
      margin_percent_target: marginTarget,
      tiers: tiers.length ? tiers : undefined,
      production_deadline: product?.production_deadline || product?.avg_production_time || null,
      source_url: product?.source_url || null,
      selection_snapshot: {},
      total_cost: initialCost * initialQty,
      total_price: initialPrice * initialQty,
      margin_percent: 0,
    };
    recalcItem(newItem);
    const newItems = [...items, newItem];
    onItemsChange(newItems);
    setEditingIdx(newItems.length - 1);
    setShowProductPicker(false);
    setProductSearch("");
  }

  function removeItem(idx: number) {
    const newItems = items.filter((_, i) => i !== idx);
    onItemsChange(newItems);
    if (editingIdx === idx) setEditingIdx(null);
    else if (editingIdx !== null && editingIdx > idx) setEditingIdx(editingIdx - 1);
  }

  function updateItem(idx: number, partial: Partial<QuoteItemData>) {
    const newItems = [...items];
    newItems[idx] = { ...newItems[idx], ...partial };
    recalcItem(newItems[idx]);
    onItemsChange(newItems);
  }

  function recalcItem(item: QuoteItemData) {
    // Produto importado com tiragens: o custo/preço UNITÁRIO vêm da faixa real
    // aplicável à quantidade (seção 7) — sem somar impactos por eixo (o preço da
    // FuturaIM é por combinação, não aditivo).
    if (item.is_supplier) {
      // 1) Se a varredura definiu o custo real da combinação escolhida, ele manda
      //    (preço por combinação, não aditivo). Preço = custo × margem alvo.
      if (item.override_unit_cost != null) {
        const factor = 1 + (item.margin_percent_target || 0) / 100;
        item.unit_cost = item.override_unit_cost;
        item.unit_price = parseFloat((item.override_unit_cost * factor).toFixed(2));
        item.total_cost = item.unit_cost * item.quantity;
        item.total_price = item.unit_price * item.quantity;
      } else if (item.tiers && item.tiers.length) {
        // 2) Senão, usa a faixa por quantidade da configuração importada (seção 7).
        const tier = resolveTier(item.tiers, item.quantity);
        if (tier) {
          item.unit_cost = tier.unitCost;
          item.unit_price = tier.unitPrice;
          if (tier.quantity === item.quantity) {
            // Quantidade exata da tiragem: usa o TOTAL real (preço FuturaIM é por
            // total, não linear) — evita erro de arredondamento do custo unitário.
            item.total_cost = tier.totalCost;
            item.total_price = tier.totalPrice;
          } else {
            item.total_cost = item.unit_cost * item.quantity;
            item.total_price = item.unit_price * item.quantity;
          }
        } else {
          item.total_cost = item.unit_cost * item.quantity;
          item.total_price = item.unit_price * item.quantity;
        }
      } else {
        item.total_cost = item.unit_cost * item.quantity;
        item.total_price = item.unit_price * item.quantity;
      }
      item.margin_percent = item.total_price > 0 ? ((item.total_price - item.total_cost) / item.total_price) * 100 : 0;
      return;
    }
    // Motor/manual: mantém o modelo ADITIVO de impacto por atributo.
    const attrCostSum = Object.values(item.attribute_price_impacts).reduce((s, v) => s + (v || 0), 0);
    const effectiveCost = item.unit_cost + attrCostSum;
    item.total_cost = effectiveCost * item.quantity;
    item.total_price = item.unit_price * item.quantity;
    item.margin_percent = item.total_price > 0 ? ((item.total_price - item.total_cost) / item.total_price) * 100 : 0;
  }

  function handleAttributeChange(idx: number, attrCode: string, value: any, attrId?: string) {
    const item = items[idx];
    const newAttributes = { ...item.attributes, [attrCode]: value };
    const { attributes: attrDefs, options } = getProductAttributes(item.product_id);
    const option = attrId && options ? options.find((o: any) => o.attribute_id === attrId && o.value === value) : null;
    const attrDef = attrDefs?.find((a: any) => a.id === attrId);

    // Produto importado: o preço é POR COMBINAÇÃO (não aditivo). Guardamos a
    // seleção no snapshot (seção 19) e, quando a opção tem custo real (varredura),
    // ele passa a dirigir o custo unitário do item (substitui, não soma).
    if (item.is_supplier) {
      const snapshot = { ...(item.selection_snapshot || {}) };
      snapshot[attrCode] = {
        value: String(value),
        external_id: option?.external_id ?? null,
        unit_cost: option?.real_cost ?? null,
      };
      // Preferência 1: a opção traz a TABELA COMPLETA da combinação (varredura)
      // → troca a tabela de tiragens do item e usa preço por quantidade REAL
      // daquela combinação (espelha o site). Zera o override (a tabela manda).
      const optTiers = tiersFromOption(option?.tiers);
      if (optTiers.length) {
        updateItem(idx, {
          attributes: newAttributes,
          selection_snapshot: snapshot,
          tiers: optTiers,
          override_unit_cost: null,
          override_label: `${attrDef?.name || attrCode}: ${value}`,
        });
        return;
      }
      // Preferência 2: só o custo de referência (sem tabela) → override do custo.
      let overrideCost: number | null = null;
      let overrideLabel: string | null = null;
      if (option?.real_cost != null) {
        overrideCost = Number(option.real_cost);
        overrideLabel = `${attrDef?.name || attrCode}: ${value}`;
      } else if (item.override_unit_cost != null) {
        overrideCost = item.override_unit_cost;
        overrideLabel = item.override_label ?? null;
      }
      updateItem(idx, {
        attributes: newAttributes,
        selection_snapshot: snapshot,
        override_unit_cost: overrideCost,
        override_label: overrideLabel,
      });
      return;
    }

    // Motor/manual: modelo ADITIVO por impacto de atributo.
    const newImpacts = { ...item.attribute_price_impacts };
    const newImpact = option?.price_impact || 0;
    const oldImpact = newImpacts[attrCode] || 0;
    newImpacts[attrCode] = newImpact;
    const delta = newImpact - oldImpact;
    const newUnitPrice = Math.max(0, item.unit_price + delta);

    updateItem(idx, {
      attributes: newAttributes,
      attribute_price_impacts: newImpacts,
      unit_price: newUnitPrice,
    });
  }

  // Resolver atributos de um produto baseado no model_id ou variações manuais
  function getProductAttributes(productId: string | null, modelId?: string | null) {
    if (!motorData) return { attributes: [], options: [] };
    const product = catalogProducts?.find(p => p.id === productId);
    const mId = modelId || product?.model_id;

    if (mId) {
      const modelAttrIds = motorData.modelAttributes
        .filter((ma: any) => ma.model_id === mId)
        .sort((a: any, b: any) => a.order_index - b.order_index)
        .map((ma: any) => ma.attribute_id);
      return { 
        attributes: motorData.attributes.filter((a: any) => modelAttrIds.includes(a.id)),
        options: motorData.options
      };
    }

    // Fallback: Gerar atributos sintéticos a partir de variations antigas
    if (product) {
       const legacyVariations: any[] = [];
       // Variações do fornecedor
       if (Array.isArray(product.variations)) {
          product.variations.forEach((v: any) => {
            const arr = Array.isArray(v?.values) ? v.values : (Array.isArray(v?.options) ? v.options : null);
            if (v?.name && arr) {
               arr.forEach((val: any) => {
                 const isObj = typeof val === "object" && val !== null;
                 const optName = isObj && 'value' in val ? val.value : String(val);
                 // Custo/preço REAIS da combinação (varredura). Sem varredura ficam
                 // null e a opção é só descritiva (não altera o preço).
                 const cost = isObj && val.cost != null ? Number(val.cost) : null;
                 const price = isObj && val.sell != null ? Number(val.sell) : null;
                 const external_id = isObj ? (val.external_id ?? null) : null;
                 const tiers = isObj && Array.isArray(val.tiers) ? val.tiers : null;
                 legacyVariations.push({ type: v.name, name: String(optName), cost, price, external_id, tiers });
               });
            }
          });
       }
       // Variações manuais (editor_meta)
       if (product.editor_meta?.variation_rows && Array.isArray(product.editor_meta.variation_rows)) {
          legacyVariations.push(...product.editor_meta.variation_rows);
       }

       if (legacyVariations.length > 0) {
         const grouped = legacyVariations.reduce((acc: any, row: any) => {
           if (!acc[row.type]) acc[row.type] = [];
           acc[row.type].push(row);
           return acc;
         }, {});

         const syntheticAttrs: any[] = [];
         const syntheticOpts: any[] = [];
         
         Object.keys(grouped).forEach((type, i) => {
            const attrId = `legacy-attr-${i}`;
            syntheticAttrs.push({
               id: attrId,
               code: type.toLowerCase().replace(/\s+/g, '_'),
               name: type,
               type: "select",
               is_required: false,
            });
            grouped[type].forEach((row: any, j: number) => {
               // Base cost para calcular impacto (usado só no modelo aditivo/manual).
               const baseCost = Number(product.base_cost) || 0;
               const hasRealCost = row.cost != null && !Number.isNaN(Number(row.cost));
               const costValue = hasRealCost ? Number(row.cost) : 0;
               const impact = hasRealCost && costValue > baseCost ? costValue - baseCost : 0;

               syntheticOpts.push({
                  id: `legacy-opt-${i}-${j}`,
                  attribute_id: attrId,
                  value: row.name,
                  label: row.name,
                  price_impact: impact,
                  // Custo real da combinação (varredura) e id externo — dirigem o
                  // preço em produtos importados e alimentam o snapshot (seção 19).
                  real_cost: hasRealCost ? costValue : null,
                  external_id: row.external_id ?? null,
                  // Tabela de tiragens da combinação (varredura) p/ preço por qtd real.
                  tiers: Array.isArray(row.tiers) ? row.tiers : null,
               });
            });
         });
         return { attributes: syntheticAttrs, options: syntheticOpts };
       }
    }

    return { attributes: [], options: [] };
  }

  const editingItem = editingIdx !== null ? items[editingIdx] : null;
  const { attributes: editingAttrs, options: editingOptions } = editingItem ? getProductAttributes(editingItem.product_id) : { attributes: [], options: [] };

  return (
    <div className="space-y-4">
      {/* Lista de itens já adicionados */}
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item, idx) => {
            const attrCostSum = Object.values(item.attribute_price_impacts).reduce((s, v) => s + (v || 0), 0);
            return (
              <Card
                key={item.id}
                className={`p-3 cursor-pointer transition-all hover:shadow-md ${editingIdx === idx ? 'ring-2 ring-primary shadow-lg' : ''}`}
                onClick={() => setEditingIdx(editingIdx === idx ? null : idx)}
              >
                <div className="flex items-center gap-3">
                  {item.product_image ? (
                    <img src={item.product_image} alt="" className="h-10 w-10 rounded object-cover border shrink-0" />
                  ) : (
                    <div className="h-10 w-10 rounded bg-secondary flex items-center justify-center shrink-0">
                      <Package className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{item.product_name || "Item sem nome"}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                      <span>Qtd: {item.quantity}</span>
                      {Object.keys(item.attributes).length > 0 && (
                        <StatusBadge variant="accent">
                          <Settings2 className="h-2.5 w-2.5 mr-0.5" />
                          {Object.keys(item.attributes).length} variação(ões)
                        </StatusBadge>
                      )}
                      {attrCostSum > 0 && (
                        <span className="text-amber-600 font-medium">+{fmt.format(attrCostSum)}/un (materiais)</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-sm">{fmt.format(item.total_price)}</p>
                    <p className={`text-[10px] font-semibold ${item.margin_percent >= 30 ? "text-emerald-600" : item.margin_percent >= 15 ? "text-amber-600" : "text-red-500"}`}>
                      Margem: {item.margin_percent.toFixed(1)}%
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0 text-destructive/60 hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); removeItem(idx); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Editor do item selecionado (Expand/Collapse) */}
      {editingItem && editingIdx !== null && (
        <Card className="p-4 border-primary/30 bg-primary/[0.02] space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-primary" />
              Configurar: {editingItem.product_name}
            </h4>
            <Button size="sm" variant="ghost" onClick={() => setEditingIdx(null)} className="h-7 text-xs">
              <X className="h-3 w-3 mr-1" /> Fechar
            </Button>
          </div>

          {/* Se usar o motor de combinações */}
          {editingItem.has_combination_engine && editingItem.family_id ? (
            <div className="pt-2 border-t mt-2">
              <SupplierCombinationWrapper
                familyId={editingItem.family_id}
                companyId={profile?.company_id || ""}
                marginPercent={editingItem.margin_percent_target || 30}
                onCalculationChange={(calc) => {
                  if (!calc) return;
                  updateItem(editingIdx, {
                    unit_cost: calc.unit_price_display, // display na UI
                    unit_price: calc.final_sale_price / calc.quantity,
                    quantity: calc.quantity,
                    total_cost: calc.total_supplier_cost,
                    total_price: calc.final_sale_price,
                    margin_percent: calc.margin_percent,
                    calc_snapshot: calc
                  });
                }}
                onSelectionChange={(sel) => {
                  updateItem(editingIdx, { selection_snapshot: sel as any });
                }}
              />
            </div>
          ) : (
            <>
              {/* Faixas de quantidade reais do fornecedor (seção 7) */}
          {editingItem.is_supplier && editingItem.tiers && editingItem.tiers.length > 0 && (() => {
            const applied = resolveTier(editingItem.tiers, editingItem.quantity);
            return (
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5">
                  <Truck className="h-3 w-3 text-sky-600" /> Tiragens do fornecedor
                  {editingItem.override_unit_cost != null && (
                    <span className="text-[10px] text-amber-600">(preço vindo da combinação escolhida)</span>
                  )}
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {editingItem.tiers.map((t) => {
                    const isApplied = editingItem.override_unit_cost == null && applied?.quantity === t.quantity;
                    return (
                      <button
                        key={t.quantity}
                        onClick={() => updateItem(editingIdx, { quantity: t.quantity, override_unit_cost: null, override_label: null })}
                        className={`text-[11px] px-2 py-1 rounded-md border transition-colors ${isApplied ? "bg-sky-600 text-white border-sky-600 font-semibold" : "bg-background hover:border-sky-400"}`}
                        title={`${fmt.format(t.unitPrice)}/un`}
                      >
                        {t.quantity} un · {fmt.format(t.totalPrice)}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Linha: Quantidade + Custo + Preço */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Quantidade</Label>
              <Input
                type="number" min="1"
                value={editingItem.quantity}
                onChange={(e) => updateItem(editingIdx, { quantity: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div>
              <Label className="text-xs">Custo unit. (R$){editingItem.is_supplier && <span className="text-[9px] text-muted-foreground ml-1">fornecedor</span>}</Label>
              <Input
                type="number" min="0" step="0.01"
                value={editingItem.unit_cost}
                readOnly={editingItem.is_supplier}
                className={editingItem.is_supplier ? "bg-secondary/40" : ""}
                onChange={(e) => updateItem(editingIdx, { unit_cost: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label className="text-xs">Preço venda unit. (R$)</Label>
              <Input
                type="number" min="0" step="0.01"
                value={editingItem.unit_price}
                onChange={(e) => updateItem(editingIdx, { unit_price: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>

          {/* Transparência: origem do custo e prazo do fornecedor */}
          {editingItem.is_supplier && (
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              {editingItem.override_label && (
                <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                  Custo baseado em {editingItem.override_label} · {fmt.format(editingItem.unit_cost)}/un (ref. da combinação)
                </span>
              )}
              {editingItem.production_deadline && (
                <span className="text-muted-foreground">Prazo fornecedor: {editingItem.production_deadline}</span>
              )}
              {editingItem.source_url && (
                <a href={editingItem.source_url} target="_blank" rel="noreferrer" className="text-sky-600 hover:underline inline-flex items-center gap-0.5">
                  <Truck className="h-3 w-3" /> Ver no fornecedor
                </a>
              )}
            </div>
          )}

          {/* Atributos Dinâmicos do Motor Universal */}
          {editingAttrs.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-1 border-b">
                <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Variações e Materiais</span>
              </div>
              {editingAttrs.map((attr: any) => {
                const options = editingOptions.filter((o: any) => o.attribute_id === attr.id) || [];
                const currentValue = editingItem.attributes[attr.code] || "";
                const currentImpact = editingItem.attribute_price_impacts[attr.code] || 0;

                return (
                  <div key={attr.id} className="grid gap-1.5">
                    <Label className="text-xs font-medium flex items-center gap-1.5">
                      {attr.name}
                      {attr.is_required && <span className="text-destructive">*</span>}
                      {currentImpact > 0 && (
                        <span className="text-[10px] text-amber-600 font-semibold ml-auto">+{fmt.format(currentImpact)}/un</span>
                      )}
                    </Label>

                    {(attr.type === "select" || attr.type === "multiselect") && options.length > 0 ? (
                      <Select
                        value={currentValue}
                        onValueChange={(val) => handleAttributeChange(editingIdx, attr.code, val, attr.id)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder={`Selecione ${attr.name.toLowerCase()}...`} />
                        </SelectTrigger>
                        <SelectContent>
                          {options.map((opt: any) => (
                            <SelectItem key={opt.id} value={opt.value}>
                              <div className="flex items-center justify-between w-full gap-4">
                                <span>{opt.label}</span>
                                {editingItem.is_supplier
                                  ? opt.real_cost != null && (
                                      <span className="text-[10px] text-sky-600 font-semibold">
                                        {fmt.format(opt.real_cost)}/un
                                      </span>
                                    )
                                  : opt.price_impact > 0 && (
                                      <span className="text-[10px] text-amber-600 font-semibold">
                                        +{fmt.format(opt.price_impact)}
                                      </span>
                                    )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : attr.type === "boolean" ? (
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={currentValue === "true" || currentValue === true}
                          onCheckedChange={(v) => handleAttributeChange(editingIdx, attr.code, v ? "true" : "false", attr.id)}
                        />
                        <span className="text-xs text-muted-foreground">{currentValue === "true" ? "Sim" : "Não"}</span>
                      </div>
                    ) : attr.type === "number" || attr.type === "dimension" ? (
                      <Input
                        type="number"
                        step="0.01"
                        value={currentValue}
                        placeholder={attr.default_value || ""}
                        onChange={(e) => handleAttributeChange(editingIdx, attr.code, e.target.value, attr.id)}
                      />
                    ) : (
                      <Input
                        value={currentValue}
                        placeholder={attr.default_value || `Informe ${attr.name.toLowerCase()}...`}
                        onChange={(e) => handleAttributeChange(editingIdx, attr.code, e.target.value, attr.id)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-4 text-center rounded-md bg-secondary/30 border border-dashed border-border mt-4">
               <Settings2 className="h-6 w-6 text-muted-foreground mx-auto mb-2 opacity-50" />
               <p className="text-sm font-medium text-foreground">Nenhuma variação técnica vinculada</p>
               <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                 Este produto não possui atributos variáveis. Se desejar que opções (como material, acabamento ou cor) apareçam aqui, 
                 vincule este produto a um <span className="font-semibold text-primary">Modelo</span> no módulo de Produtos.
               </p>
            </div>
          )}

          {/* Resumo de custo do item */}
          {(() => {
            const attrCostSum = editingItem.is_supplier
              ? 0
              : Object.values(editingItem.attribute_price_impacts).reduce((s, v) => s + (v || 0), 0);
            const effectiveCost = editingItem.unit_cost + attrCostSum;
            const profit = editingItem.total_price - editingItem.total_cost;
            return (
              <div className="p-3 bg-secondary/50 rounded-md grid grid-cols-4 gap-2 text-center">
                <div>
                  <p className="text-[10px] text-muted-foreground">Custo/un</p>
                  <p className="font-bold text-xs">{fmt.format(effectiveCost)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Total ({editingItem.quantity}x)</p>
                  <p className="font-bold text-xs text-primary">{fmt.format(editingItem.total_price)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Lucro</p>
                  <p className={`font-bold text-xs ${profit >= 0 ? "text-emerald-600" : "text-red-500"}`}>{fmt.format(profit)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Margem</p>
                  <p className={`font-bold text-xs ${editingItem.margin_percent >= 30 ? "text-emerald-600" : editingItem.margin_percent >= 15 ? "text-amber-600" : "text-red-500"}`}>
                    {editingItem.margin_percent.toFixed(1)}%
                  </p>
                </div>
              </div>
            );
          })()}
            </>
          )}

          {/* Observações do item */}
          <div>
            <Label className="text-xs">Observações do Item</Label>
            <Textarea
              rows={2}
              value={editingItem.notes}
              onChange={(e) => updateItem(editingIdx, { notes: e.target.value })}
              placeholder="Detalhes adicionais..."
              className="text-xs"
            />
          </div>
        </Card>
      )}

      {/* Botão e Seletor de Produto para adicionar novo item */}
      {!showProductPicker ? (
        <Button
          variant="outline"
          className="w-full h-12 border-dashed border-2 hover:border-primary hover:bg-primary/5"
          onClick={() => setShowProductPicker(true)}
        >
          <Plus className="h-4 w-4 mr-2" /> Adicionar Produto ou Serviço
        </Button>
      ) : (
        <Card className="p-3 space-y-3 border-primary/30">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Selecionar Produto</h4>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => addItem()}>
                <Plus className="h-3 w-3 mr-1" /> Item manual
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowProductPicker(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Busca */}
          <div className="flex items-center gap-2 p-2 border rounded-md bg-background">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Buscar por nome ou SKU..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              autoFocus
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </div>

          {/* Filtros rápidos */}
          <div className="flex gap-1">
            {[
              { value: "all", label: "Todos" },
              { value: "manual", label: "Manual" },
              { value: "supplier", label: "Fornecedor" },
              { value: "service", label: "Serviço" },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setProductFilterOrigin(opt.value)}
                className={`text-[10px] px-2 py-1 rounded-full transition-colors ${productFilterOrigin === opt.value
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "bg-secondary hover:bg-primary/20"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Lista de produtos */}
          <div className="max-h-52 overflow-y-auto border rounded-md divide-y">
            {filteredProducts.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">Nenhum produto encontrado.</div>
            ) : (
              filteredProducts.map(p => {
                const imgSrc = p.image_url || p.main_image_url;
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 p-2.5 hover:bg-secondary/50 cursor-pointer transition-colors"
                    onClick={() => addItem(p)}
                  >
                    {imgSrc ? (
                      <img src={imgSrc} alt="" className="h-8 w-8 rounded object-cover border shrink-0" />
                    ) : (
                      <div className="h-8 w-8 rounded bg-secondary flex items-center justify-center shrink-0">
                        <Package className="h-3 w-3 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {p.supplier_name && (
                          <span className="text-[9px] text-sky-600 flex items-center gap-0.5">
                            <Truck className="h-2 w-2" /> {p.supplier_name}
                          </span>
                        )}
                        {p.model_id && (
                          <StatusBadge variant="accent">
                            <Settings2 className="h-2 w-2 mr-0.5" />Motor
                          </StatusBadge>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold">{fmt.format(p.sale_price || p.suggested_price || 0)}</p>
                      <p className="text-[9px] text-muted-foreground">Custo: {fmt.format(p.cost_price || p.base_cost || 0)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
