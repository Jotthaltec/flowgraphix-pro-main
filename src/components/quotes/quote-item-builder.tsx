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
import { Textarea } from "@/components/ui/textarea";

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const db = supabase as any;

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
  // Calculated
  total_cost: number;
  total_price: number;
  margin_percent: number;
}

interface QuoteItemBuilderProps {
  items: QuoteItemData[];
  onItemsChange: (items: QuoteItemData[]) => void;
}

function generateId() {
  return 'qi_' + Math.random().toString(36).substring(2, 11);
}

export function QuoteItemBuilder({ items, onItemsChange }: QuoteItemBuilderProps) {
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
          sale_price, suggested_price, margin_percent, unit_measure, image_url,
          main_image_url, description, technical_description, supplier_id,
          production_deadline, imported_from_supplier, model_id,
          editor_meta, variations
        `)
        .eq("status", "Ativo")
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
    const newItem: QuoteItemData = {
      id: generateId(),
      product_id: product?.id || null,
      product_name: product?.name || "",
      product_image: product?.image_url || product?.main_image_url || null,
      supplier_id: product?.supplier_id || null,
      supplier_name: product?.supplier_name || null,
      quantity: 1,
      unit_cost: product?.cost_price || product?.base_cost || 0,
      unit_price: product?.sale_price || product?.suggested_price || 0,
      attributes: {},
      attribute_price_impacts: {},
      notes: product?.technical_description || product?.description || "",
      total_cost: product?.cost_price || product?.base_cost || 0,
      total_price: product?.sale_price || product?.suggested_price || 0,
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
    const attrCostSum = Object.values(item.attribute_price_impacts).reduce((s, v) => s + (v || 0), 0);
    const effectiveCost = item.unit_cost + attrCostSum;
    item.total_cost = effectiveCost * item.quantity;
    item.total_price = item.unit_price * item.quantity;
    item.margin_percent = item.total_price > 0 ? ((item.total_price - item.total_cost) / item.total_price) * 100 : 0;
  }

  function handleAttributeChange(idx: number, attrCode: string, value: any, attrId?: string) {
    const item = items[idx];
    const newAttributes = { ...item.attributes, [attrCode]: value };
    const newImpacts = { ...item.attribute_price_impacts };

    // Buscar o preço do impacto da opção selecionada
    let newImpact = 0;
    const { options } = getProductAttributes(item.product_id);
    if (attrId && options) {
      const option = options.find((o: any) => o.attribute_id === attrId && o.value === value);
      newImpact = option?.price_impact || 0;
    }

    const oldImpact = newImpacts[attrCode] || 0;
    newImpacts[attrCode] = newImpact;

    // Ajusta o preço de venda pela diferença de impacto (delta)
    const delta = newImpact - oldImpact;
    const newUnitPrice = Math.max(0, item.unit_price + delta);

    updateItem(idx, { 
      attributes: newAttributes, 
      attribute_price_impacts: newImpacts,
      unit_price: newUnitPrice
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
                 const optName = typeof val === "object" && val !== null && 'value' in val ? val.value : String(val);
                 legacyVariations.push({ type: v.name, name: String(optName), cost: 0, price: 0 });
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
               // Base cost para calcular impacto
               const baseCost = Number(product.base_cost) || 0;
               const costValue = Number(row.cost);
               const impact = costValue > baseCost ? (costValue - baseCost) : 0;
               
               syntheticOpts.push({
                  id: `legacy-opt-${i}-${j}`,
                  attribute_id: attrId,
                  value: row.name,
                  label: row.name,
                  price_impact: impact,
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
              <Label className="text-xs">Custo Base (R$)</Label>
              <Input
                type="number" min="0" step="0.01"
                value={editingItem.unit_cost}
                onChange={(e) => updateItem(editingIdx, { unit_cost: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label className="text-xs">Preço de Venda (R$)</Label>
              <Input
                type="number" min="0" step="0.01"
                value={editingItem.unit_price}
                onChange={(e) => updateItem(editingIdx, { unit_price: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>

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
                                {opt.price_impact > 0 && (
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
            const attrCostSum = Object.values(editingItem.attribute_price_impacts).reduce((s, v) => s + (v || 0), 0);
            const effectiveCost = editingItem.unit_cost + attrCostSum;
            return (
              <div className="p-3 bg-secondary/50 rounded-md grid grid-cols-4 gap-2 text-center">
                <div>
                  <p className="text-[10px] text-muted-foreground">Custo Base</p>
                  <p className="font-bold text-xs">{fmt.format(editingItem.unit_cost)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">+ Materiais</p>
                  <p className="font-bold text-xs text-amber-600">{fmt.format(attrCostSum)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Custo Efetivo/un</p>
                  <p className="font-bold text-xs">{fmt.format(effectiveCost)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Total ({editingItem.quantity}x)</p>
                  <p className="font-bold text-xs text-primary">{fmt.format(editingItem.total_price)}</p>
                </div>
              </div>
            );
          })()}

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
