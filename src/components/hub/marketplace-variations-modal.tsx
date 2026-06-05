import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import {
  ShoppingCart, Loader2, Sparkles, Plus, Trash2,
  Check, Eye, RefreshCcw, ChevronDown, ChevronUp, Package
} from "lucide-react";
import { toast } from "sonner";
import {
  buildVariationCombos,
  generateMarketplaceCopy,
  type ProductVariationCombo
} from "@/lib/marketplace-copy-generator";

interface MarketplaceVariationsModalProps {
  open: boolean;
  onClose: () => void;
  product: any;
  onNavigateToDrafts: () => void;
}

const PLATFORMS = [
  { key: "mercado_livre", label: "Mercado Livre", color: "text-yellow-500", bg: "bg-yellow-500/10 border-yellow-500/20" },
  { key: "shopee", label: "Shopee", color: "text-orange-500", bg: "bg-orange-500/10 border-orange-500/20" },
  { key: "nuvemshop", label: "Nuvemshop", color: "text-blue-500", bg: "bg-blue-500/10 border-blue-500/20" },
  { key: "woocommerce", label: "WooCommerce", color: "text-purple-500", bg: "bg-purple-500/10 border-purple-500/20" },
];

/** Decodifica variações salvas no produto (JSON do banco) */
function getProductVariations(product: any): Record<string, string[]> {
  const variations: Record<string, string[]> = {};
  const rawVariations = Array.isArray(product?.variations) ? product.variations : [];
  for (const v of rawVariations) {
    if (v.name && Array.isArray(v.values) && v.values.length > 0) {
      variations[v.name] = v.values;
    }
  }
  return variations;
}

/** Pega as tiragens do produto */
function getProductQuantityPrices(product: any): Array<{ quantity: number; price: number; sellPrice?: number; unitPrice?: number }> {
  const raw = Array.isArray(product?.quantity_prices) ? product.quantity_prices : [];
  return raw.filter((qp: any) => qp.quantity > 0 && qp.price > 0);
}

export function MarketplaceVariationsModal({
  open,
  onClose,
  product,
  onNavigateToDrafts
}: MarketplaceVariationsModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Margem atual do produto
  const margin = product?.margin_percent || product?.target_margin || 50;

  // Variações do produto (vindas do banco)
  const allProductVariations = useMemo(() => getProductVariations(product), [product]);
  const quantityPrices = useMemo(() => getProductQuantityPrices(product), [product]);

  // Seleção de tiragens a incluir
  const [selectedQties, setSelectedQties] = useState<number[]>(() =>
    getProductQuantityPrices(product).map(qp => qp.quantity)
  );

  // Seleção de variações (qual valor de cada grupo está selecionado)
  const [selectedVariations, setSelectedVariations] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    const vars = getProductVariations(product);
    for (const key of Object.keys(vars)) {
      initial[key] = vars[key]; // por padrão todas selecionadas
    }
    return initial;
  });

  // Campo para adicionar variação manual
  const [newVarGroupName, setNewVarGroupName] = useState("");
  const [newVarGroupValues, setNewVarGroupValues] = useState("");

  // Plataformas selecionadas
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["mercado_livre", "shopee", "nuvemshop", "woocommerce"]);

  // Preview expandido
  const [expandedCombo, setExpandedCombo] = useState<string | null>(null);
  const [previewPlatform, setPreviewPlatform] = useState("mercado_livre");

  // Combos gerados
  const combos: ProductVariationCombo[] = useMemo(() => {
    // Filtra só as tiragens selecionadas
    const filteredQties = quantityPrices.filter(qp => selectedQties.includes(qp.quantity));
    return buildVariationCombos(filteredQties, selectedVariations, margin);
  }, [selectedQties, selectedVariations, margin, quantityPrices]);

  // Combos selecionados para publicar (por padrão todos)
  const [selectedCombos, setSelectedCombos] = useState<Set<string>>(() => new Set());

  // Inicializa seleção de combos quando muda
  const allComboLabels = useMemo(() => new Set(combos.map(c => c.label)), [combos]);

  const toggleQty = (qty: number) => {
    setSelectedQties(prev =>
      prev.includes(qty) ? prev.filter(q => q !== qty) : [...prev, qty]
    );
  };

  const toggleVariationValue = (groupKey: string, value: string) => {
    setSelectedVariations(prev => {
      const current = prev[groupKey] || [];
      const updated = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [groupKey]: updated };
    });
  };

  const addVariationGroup = () => {
    if (!newVarGroupName.trim() || !newVarGroupValues.trim()) return;
    const values = newVarGroupValues.split(",").map(v => v.trim()).filter(v => v);
    setSelectedVariations(prev => ({
      ...prev,
      [newVarGroupName.trim()]: values
    }));
    setNewVarGroupName("");
    setNewVarGroupValues("");
    toast.success(`Variação "${newVarGroupName}" adicionada!`);
  };

  const removeVariationGroup = (groupKey: string) => {
    setSelectedVariations(prev => {
      const updated = { ...prev };
      delete updated[groupKey];
      return updated;
    });
  };

  const toggleCombo = (label: string) => {
    setSelectedCombos(prev => {
      const updated = new Set(prev);
      if (updated.has(label)) {
        updated.delete(label);
      } else {
        updated.add(label);
      }
      return updated;
    });
  };

  const toggleAllCombos = () => {
    if (selectedCombos.size === combos.length) {
      setSelectedCombos(new Set());
    } else {
      setSelectedCombos(new Set(combos.map(c => c.label)));
    }
  };

  const togglePlatform = (key: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]
    );
  };

  // Mutation para gerar os rascunhos
  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Usuário não autenticado.");
      if (!product) throw new Error("Produto não selecionado.");
      if (selectedPlatforms.length === 0) throw new Error("Selecione pelo menos uma plataforma.");

      const combosToPublish = combos.filter(c =>
        selectedCombos.size === 0 ? true : selectedCombos.has(c.label)
      );

      if (combosToPublish.length === 0) throw new Error("Nenhuma variação selecionada para publicar.");

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (!profile?.company_id) throw new Error("Empresa do usuário não identificada.");

      const insertedDrafts = [];

      for (const combo of combosToPublish) {
        for (const platform of selectedPlatforms) {
          const copy = generateMarketplaceCopy(
            platform,
            product.name || "",
            combo.price,
            margin,
            product.specifications || {},
            product.avg_production_time || "5 dias úteis",
            combo
          );

          // Tenta inserir com metadados de variação; se a coluna não existir, cai no fallback
          const draftPayload: any = {
            company_id: profile.company_id,
            product_id: product.id,
            marketplace: platform,
            title: copy.title,
            description: copy.description,
            price: copy.price,
            category: (product.specifications || {})["Categoria"] || "Produtos Personalizados",
            keywords: copy.keywords,
            status: "draft",
          };

          const { data, error } = await supabase
            .from("marketplace_drafts")
            .insert(draftPayload)
            .select()
            .single();

          if (error) throw error;
          insertedDrafts.push(data);
        }
      }

      return insertedDrafts;
    },
    onSuccess: (data) => {
      toast.success(`${data.length} rascunhos de marketplace criados com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["marketplace_drafts"] });
      onClose();
      onNavigateToDrafts();
    },
    onError: (err: any) => {
      toast.error(`Erro ao gerar rascunhos: ${err.message}`);
    }
  });

  // Mutation para importar as variações diretamente para Produtos & Serviços (CRM)
  const importToCatalogMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Usuário não autenticado.");
      if (!product) throw new Error("Produto não selecionado.");

      const combosToPublish = combos.filter(c =>
        selectedCombos.size === 0 ? true : selectedCombos.has(c.label)
      );

      if (combosToPublish.length === 0) throw new Error("Nenhuma variação selecionada para importar.");

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (!profile?.company_id) throw new Error("Empresa do usuário não identificada.");

      const insertedProducts = [];

      for (const combo of combosToPublish) {
        const payload: any = {
          company_id: profile.company_id,
          name: `${product.name} - ${combo.label}`,
          commercial_name: `${product.name} - ${combo.label}`,
          type: "product",
          origin: "supplier_import",
          supplier_id: product.supplier_id,
          supplier_name: product.supplier_name,
          supplier_sku: product.supplier_sku,
          internal_sku: `HUB-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          category: (product.specifications || {})["Categoria"] || product.category || "Geral",
          unit_measure: "Unidade",
          base_cost: combo.price,
          cost_price: combo.price,
          target_margin: margin,
          margin_percent: margin,
          suggested_price: combo.sellPrice,
          sale_price: combo.sellPrice,
          min_price: combo.sellPrice * 0.9,
          description: `Variação importada do Hub.\nOriginal: ${product.name}\nCombo: ${combo.label}`,
          imported_from_supplier: true,
          status: "Ativo"
        };

        const { data, error } = await supabase
          .from("products")
          .insert([payload])
          .select()
          .single();

        if (error) throw error;
        insertedProducts.push(data);
      }

      return insertedProducts;
    },
    onSuccess: (data) => {
      toast.success(`${data.length} produtos gerados no catálogo (Produtos & Serviços) com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["products"] });
      onClose();
    },
    onError: (err: any) => {
      toast.error(`Erro ao gerar produtos: ${err.message}`);
    }
  });

  if (!product) return null;

  const combosToPublish = combos.filter(c =>
    selectedCombos.size === 0 ? true : selectedCombos.has(c.label)
  );
  const totalDrafts = combosToPublish.length * selectedPlatforms.length;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ShoppingCart className="h-5 w-5 text-rose-500" />
            Gerar Anúncios de Marketplace com Variações
          </DialogTitle>
          <DialogDescription>
            Crie múltiplos anúncios por variação de produto: tiragem, cor, material, formato e mais.
            <span className="font-semibold text-foreground ml-1">"{product.name}"</span>
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-2">
          {/* PAINEL ESQUERDO: Configuração */}
          <div className="lg:col-span-1 space-y-4">

            {/* SELEÇÃO DE PLATAFORMAS */}
            <div className="border rounded-lg p-3 space-y-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Plataformas</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {PLATFORMS.map(p => (
                  <button
                    key={p.key}
                    onClick={() => togglePlatform(p.key)}
                    className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border font-semibold transition-all ${
                      selectedPlatforms.includes(p.key)
                        ? p.bg + " " + p.color
                        : "border-input text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {selectedPlatforms.includes(p.key) && <Check className="h-3 w-3" />}
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* TIRAGENS */}
            <div className="border rounded-lg p-3 space-y-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground">
                Tiragens ({selectedQties.length}/{quantityPrices.length} selecionadas)
              </Label>
              {quantityPrices.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  Nenhuma tabela de tiragens cadastrada neste produto.
                </p>
              ) : (
                <div className="space-y-1 max-h-[200px] overflow-y-auto pr-1">
                  {quantityPrices.map(qp => {
                    const isSelected = selectedQties.includes(qp.quantity);
                    const sellPrice = qp.sellPrice ?? parseFloat((qp.price * (1 + margin / 100)).toFixed(2));
                    return (
                      <button
                        key={qp.quantity}
                        onClick={() => toggleQty(qp.quantity)}
                        className={`w-full flex items-center justify-between text-xs px-2.5 py-2 rounded-md border transition-all ${
                          isSelected
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
                            : "border-input text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <div className={`h-3.5 w-3.5 rounded-sm border flex items-center justify-center ${isSelected ? "bg-emerald-500 border-emerald-500" : "border-muted-foreground"}`}>
                            {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
                          </div>
                          <span className="font-bold">{qp.quantity} unidades</span>
                        </div>
                        <div className="text-right">
                          <div className="text-emerald-600 font-bold">R$ {sellPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                          <div className="text-muted-foreground text-[10px]">custo: R$ {qp.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* VARIAÇÕES DO PRODUTO */}
            <div className="border rounded-lg p-3 space-y-3">
              <Label className="text-xs font-bold uppercase text-muted-foreground">
                Variações do Produto
              </Label>

              {/* Variações existentes do produto */}
              {Object.keys(selectedVariations).length === 0 && Object.keys(allProductVariations).length === 0 && (
                <p className="text-xs text-muted-foreground italic">
                  Nenhuma variação cadastrada. Adicione abaixo (Ex: Cor: 4x0, 4x4).
                </p>
              )}

              <div className="space-y-2">
                {Object.entries(selectedVariations).map(([groupKey, values]) => (
                  <div key={groupKey} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-primary">{groupKey}</span>
                      <button
                        onClick={() => removeVariationGroup(groupKey)}
                        className="h-4 w-4 text-destructive hover:text-destructive/80"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(allProductVariations[groupKey] || values).map(val => {
                        const isSelected = (selectedVariations[groupKey] || []).includes(val);
                        return (
                          <button
                            key={val}
                            onClick={() => toggleVariationValue(groupKey, val)}
                            className={`text-[10px] px-2 py-0.5 rounded-full border font-medium transition-all ${
                              isSelected
                                ? "border-primary/50 bg-primary/10 text-primary"
                                : "border-input text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            {isSelected && <span className="mr-0.5">✓</span>}
                            {val}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Adicionar nova variação */}
              <div className="border-t pt-2 space-y-1.5">
                <Label className="text-[10px] text-muted-foreground uppercase">Adicionar Variação Manual</Label>
                <Input
                  placeholder='Grupo (Ex: Impressão)'
                  value={newVarGroupName}
                  onChange={(e) => setNewVarGroupName(e.target.value)}
                  className="h-7 text-xs"
                />
                <Input
                  placeholder='Valores separados por vírgula (Ex: Frente, Frente e Verso)'
                  value={newVarGroupValues}
                  onChange={(e) => setNewVarGroupValues(e.target.value)}
                  className="h-7 text-xs"
                  onKeyDown={(e) => { if (e.key === "Enter") addVariationGroup(); }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addVariationGroup}
                  className="w-full h-7 text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" /> Adicionar Grupo de Variação
                </Button>
              </div>
            </div>
          </div>

          {/* PAINEL DIREITO: Combos Gerados + Preview */}
          <div className="lg:col-span-2 space-y-4">
            {/* Header do painel de combos */}
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-sm">
                  {combos.length} Anúncios Serão Gerados
                  <span className="text-muted-foreground font-normal ml-2 text-xs">
                    ({totalDrafts} rascunhos no total em {selectedPlatforms.length} plataforma{selectedPlatforms.length !== 1 ? "s" : ""})
                  </span>
                </h4>
                <p className="text-xs text-muted-foreground">
                  Selecione quais variações publicar. Por padrão, todos são publicados.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleAllCombos}
                className="text-xs"
              >
                {selectedCombos.size === combos.length && combos.length > 0 ? "Desmarcar Todos" : "Selecionar Todos"}
              </Button>
            </div>

            {/* Preview de plataforma */}
            <div className="flex gap-1.5">
              {PLATFORMS.filter(p => selectedPlatforms.includes(p.key)).map(p => (
                <button
                  key={p.key}
                  onClick={() => setPreviewPlatform(p.key)}
                  className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-all ${
                    previewPlatform === p.key ? p.bg + " " + p.color : "border-input text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {combos.length === 0 ? (
              <div className="border border-dashed rounded-lg p-12 text-center text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-sm font-semibold">Nenhuma combinação disponível</p>
                <p className="text-xs mt-1">Selecione pelo menos uma tiragem e/ou adicione variações ao produto.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[440px] overflow-y-auto pr-1">
                {combos.map(combo => {
                  const isSelected = selectedCombos.size === 0 || selectedCombos.has(combo.label);
                  const isExpanded = expandedCombo === combo.label;
                  const preview = generateMarketplaceCopy(
                    previewPlatform,
                    product.name || "",
                    combo.price,
                    margin,
                    product.specifications || {},
                    product.avg_production_time || "5 dias úteis",
                    combo
                  );

                  return (
                    <div
                      key={combo.label}
                      className={`border rounded-lg transition-all ${
                        isSelected
                          ? "border-primary/30 bg-primary/5"
                          : "border-input bg-muted/30 opacity-60"
                      }`}
                    >
                      {/* Cabeçalho do combo */}
                      <div className="flex items-center gap-2 p-2.5">
                        <button
                          onClick={() => toggleCombo(combo.label)}
                          className={`h-4 w-4 rounded-sm border flex-shrink-0 flex items-center justify-center ${
                            isSelected ? "bg-primary border-primary" : "border-muted-foreground"
                          }`}
                        >
                          {isSelected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                        </button>

                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate">{combo.label}</p>
                          <p className="text-[10px] text-muted-foreground">
                            Custo: R$ {combo.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            {" · "}
                            <span className="text-emerald-500 font-bold">
                              Venda: R$ {combo.sellPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </span>
                          </p>
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0">
                          {/* Chips de variação */}
                          <div className="flex gap-1 flex-wrap justify-end max-w-[200px]">
                            {combo.variations.map((v, i) => (
                              <span key={i} className="text-[9px] bg-card border rounded px-1.5 py-0.5 font-medium text-muted-foreground">
                                {v.key}: {v.value}
                              </span>
                            ))}
                          </div>
                          <button
                            onClick={() => setExpandedCombo(isExpanded ? null : combo.label)}
                            className="text-muted-foreground hover:text-foreground ml-1"
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Preview expansível */}
                      {isExpanded && (
                        <div className="border-t p-3 bg-card rounded-b-lg space-y-2">
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground uppercase">Título do Anúncio</Label>
                            <p className="text-xs font-semibold border rounded px-2.5 py-1.5 bg-muted">
                              {preview.title}
                            </p>
                            <p className="text-[10px] text-muted-foreground text-right">{preview.title.length} caracteres</p>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground uppercase">Preview da Descrição</Label>
                            <pre className="text-[10px] bg-muted rounded p-2 whitespace-pre-wrap font-sans max-h-[160px] overflow-y-auto text-foreground">
                              {typeof preview.description === "string" && preview.description.replace(/<[^>]+>/g, " ").substring(0, 500)}
                              {preview.description.length > 500 ? "..." : ""}
                            </pre>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {preview.keywords.map((kw, i) => (
                              <span key={i} className="text-[9px] bg-primary/10 text-primary rounded-full px-2 py-0.5 border border-primary/20">
                                #{kw}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="border-t pt-4 mt-2 flex flex-col sm:flex-row gap-3 sm:justify-between items-center">
          <div className="text-xs text-muted-foreground">
            {selectedCombos.size === 0
              ? `Todos os ${combos.length} anúncios serão publicados`
              : `${selectedCombos.size} de ${combos.length} anúncios selecionados`}
            {" · "}
            <span className="font-bold text-foreground">{totalDrafts} rascunhos no total</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={importToCatalogMutation.isPending || combos.length === 0}
              onClick={() => importToCatalogMutation.mutate()}
              className="border-primary text-primary hover:bg-primary/10 gap-2"
            >
              {importToCatalogMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Importando {combosToPublish.length} Itens...</>
              ) : (
                <><Package className="h-4 w-4" /> Importar p/ Produtos & Serviços</>
              )}
            </Button>
            <Button
              size="sm"
              disabled={generateMutation.isPending || combos.length === 0 || selectedPlatforms.length === 0}
              onClick={() => generateMutation.mutate()}
              className="bg-rose-500 hover:bg-rose-600 text-white gap-2"
            >
              {generateMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Gerando {totalDrafts} Rascunhos...</>
              ) : (
                <><Sparkles className="h-4 w-4" /> Gerar {totalDrafts} Rascunhos</>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
