/**
 * Seletor em Cascata de Combinações do Fornecedor.
 *
 * Componente que implementa a árvore de dependência:
 * fornecedor → família → modelo → material → formato → impressão →
 * enobrecimento → acabamento → quantidade → extras → serviços
 *
 * Após cada escolha, filtra opções compatíveis.
 * Não exibe opções que não levem a combinação válida.
 * Não permite montar combinações inexistentes.
 *
 * Exibe painel decomposto: custo fornecedor / extras / frete / margem / venda / lucro.
 * Badge de status: ✅ Confirmado | ⚠️ Desatualizado | ❌ Não confirmado
 * Modo "Espelhar fornecedor" (toggle).
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Package, ChevronRight, Check, AlertTriangle, XCircle,
  Truck, Settings2, Calculator, Eye, RotateCcw, Clock,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { StatusBadge } from '@/components/status-badge';

import {
  getCompatibleValues,
  getAvailableQuantities,
  resolveCommercialProduct,
  getCompatibleExtras,
  calculateQuoteItem,
  type FamilyCombinationData,
  type RawPromotion,
} from '@/services/combinationEngine';

import type {
  QuoteItemCalculation,
  PriceStatus,
  SelectedExtra,
  SelectedService,
} from '@/types/combinationTypes';

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SupplierCombinationSelectorProps {
  /** Dados da família carregados pelo parent (via getFamilyCombinationData). */
  familyData: FamilyCombinationData & {
    extras?: any[];
    extraCompatibility?: any[];
    extraPrices?: any[];
    services?: any[];
    servicePrices?: any[];
    promotions?: RawPromotion[];
  };
  /** Callback quando o cálculo muda (cada seleção recalcula). */
  onCalculationChange: (calc: QuoteItemCalculation | null) => void;
  /** Callback quando a seleção em cascata muda. */
  onSelectionChange?: (selection: Record<string, { group_name: string; value_name: string; value_id: string; external_id: string | null }>) => void;
  /** Margem de lucro desejada (%). */
  profitMarginPercent?: number;
  /** Imposto (%). */
  taxPercent?: number;
  /** Margem de segurança (%). */
  safetyMarginPercent?: number;
  /** Custo de frete. */
  freightCost?: number;
  /** Custos operacionais internos. */
  internalOperationsCost?: number;
  /** Custos de serviços internos. */
  internalServicesCost?: number;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function SupplierCombinationSelector({
  familyData,
  onCalculationChange,
  onSelectionChange,
  profitMarginPercent = 30,
  taxPercent = 0,
  safetyMarginPercent = 0,
  freightCost = 0,
  internalOperationsCost = 0,
  internalServicesCost = 0,
}: SupplierCombinationSelectorProps) {
  // Estado da seleção em cascata (group_id → option_value_id)
  const [selection, setSelection] = useState<Map<string, string>>(new Map());
  // Quantidade selecionada
  const [selectedQuantity, setSelectedQuantity] = useState<number>(0);
  // Extras selecionados (extra_id[])
  const [selectedExtraIds, setSelectedExtraIds] = useState<Set<string>>(new Set());
  // Serviços selecionados (service_id[])
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set());
  // Modo espelhar fornecedor
  const [mirrorMode, setMirrorMode] = useState(false);

  const { family } = familyData;

  // Filtrar opções compatíveis em cascata
  const cascadeResults = useMemo(
    () => getCompatibleValues(familyData, selection),
    [familyData, selection],
  );

  // Todas as opções obrigatórias escolhidas?
  const allOptionsSelected = useMemo(
    () => cascadeResults.every(r => r.selected_value_id != null || !r.group.is_required),
    [cascadeResults],
  );

  // Quantidades disponíveis (cada uma é um produto comercial próprio)
  const availableQuantities = useMemo(() => {
    if (!allOptionsSelected) return [];
    return getAvailableQuantities(familyData, selection, familyData.promotions);
  }, [allOptionsSelected, familyData, selection]);

  // Resolver o produto comercial EXATO (opções + quantidade)
  const productResult = useMemo(
    () => resolveCommercialProduct(familyData, selection, selectedQuantity, familyData.promotions),
    [familyData, selection, selectedQuantity],
  );

  // Extras compatíveis com o produto comercial
  const availableExtras = useMemo(() => {
    if (!productResult.found || !productResult.product) return [];
    if (!familyData.extras?.length) return [];
    const optionIds = new Set(selection.values());
    return getCompatibleExtras(
      productResult.product.id,
      selectedQuantity,
      familyData.extras,
      familyData.extraCompatibility || [],
      familyData.extraPrices || [],
      optionIds,
    );
  }, [productResult, selectedQuantity, familyData, selection]);

  // Auto-selecionar primeira quantidade quando as opções ficam completas
  useEffect(() => {
    if (allOptionsSelected && selectedQuantity === 0 && availableQuantities.length > 0) {
      setSelectedQuantity(availableQuantities[0].quantity);
    }
  }, [allOptionsSelected, selectedQuantity, availableQuantities]);

  // Calcular item quando o produto comercial é resolvido
  const calculation = useMemo((): QuoteItemCalculation | null => {
    if (!productResult.found || !productResult.product) return null;

    const selectedExtras: SelectedExtra[] = availableExtras
      .filter(e => selectedExtraIds.has(e.extra.id))
      .map(e => ({
        extra_id: e.extra.id,
        name: e.extra.name,
        price: e.price,
        additional_days: e.additional_days,
      }));

    const selectedServices: SelectedService[] = (familyData.services || [])
      .filter((s: any) => selectedServiceIds.has(s.id))
      .map((s: any) => {
        const sp = (familyData.servicePrices || []).find((p: any) => p.service_id === s.id);
        return { service_id: s.id, name: s.name, price: sp?.price || 0 };
      });

    return calculateQuoteItem(
      {
        commercial_product_id: productResult.product.id,
        quantity: selectedQuantity,
        selected_extra_ids: [...selectedExtraIds],
        selected_service_ids: [...selectedServiceIds],
        freight_cost: freightCost,
        internal_operations_cost: internalOperationsCost,
        internal_services_cost: internalServicesCost,
        tax_percent: taxPercent,
        safety_margin_percent: safetyMarginPercent,
        profit_margin_percent: profitMarginPercent,
        mirror_supplier_mode: mirrorMode,
      },
      productResult.product,
      productResult.active_promotion,
      selectedExtras,
      selectedServices,
      family.lead_time_rule,
    );
  }, [
    productResult, selectedExtraIds, selectedServiceIds,
    mirrorMode, freightCost, profitMarginPercent, taxPercent,
    safetyMarginPercent, internalOperationsCost, internalServicesCost,
    availableExtras, familyData, selectedQuantity, family.lead_time_rule,
  ]);

  // Callbacks em refs — evita loop de render quando o parent passa funções
  // inline (nova identidade a cada render). Os efeitos abaixo disparam apenas
  // quando o VALOR (cálculo/seleção) muda, não quando a função muda.
  const onCalcRef = useRef(onCalculationChange);
  const onSelRef = useRef(onSelectionChange);
  useEffect(() => { onCalcRef.current = onCalculationChange; });
  useEffect(() => { onSelRef.current = onSelectionChange; });

  // Notificar parent quando o cálculo muda
  useEffect(() => {
    onCalcRef.current(calculation);
  }, [calculation]);

  // Notificar parent quando a seleção em cascata muda
  useEffect(() => {
    if (!onSelRef.current) return;
    const snap: Record<string, any> = {};
    for (const [groupId, valueId] of selection.entries()) {
      const group = familyData.groups.find(g => g.id === groupId);
      const value = familyData.values.find(v => v.id === valueId);
      if (group && value) {
        snap[group.code] = {
          group_name: group.name,
          value_name: value.name,
          value_id: value.id,
          external_id: value.external_id,
        };
      }
    }
    onSelRef.current(snap);
  }, [selection, familyData]);

  // Handlers
  const handleOptionSelect = useCallback((groupId: string, valueId: string) => {
    setSelection(prev => {
      const next = new Map(prev);
      next.set(groupId, valueId);
      // Limpar grupos posteriores (a árvore muda) para nunca montar combinação inválida
      const sortedGroups = [...familyData.groups].sort((a, b) => a.order_index - b.order_index);
      const idx = sortedGroups.findIndex(g => g.id === groupId);
      for (let i = idx + 1; i < sortedGroups.length; i++) next.delete(sortedGroups[i].id);
      return next;
    });
    // Reset extras e quantidade ao mudar a combinação
    setSelectedExtraIds(new Set());
    setSelectedQuantity(0);
  }, [familyData.groups]);

  const handleClearSelection = useCallback((groupId: string) => {
    setSelection(prev => {
      const next = new Map(prev);
      // Limpar este grupo e todos os posteriores
      const sortedGroups = [...familyData.groups].sort((a, b) => a.order_index - b.order_index);
      const idx = sortedGroups.findIndex(g => g.id === groupId);
      for (let i = idx; i < sortedGroups.length; i++) {
        next.delete(sortedGroups[i].id);
      }
      return next;
    });
    setSelectedExtraIds(new Set());
    setSelectedQuantity(0);
  }, [familyData.groups]);

  const toggleExtra = useCallback((extraId: string) => {
    setSelectedExtraIds(prev => {
      const next = new Set(prev);
      if (next.has(extraId)) next.delete(extraId);
      else next.add(extraId);
      return next;
    });
  }, []);

  const toggleService = useCallback((serviceId: string) => {
    setSelectedServiceIds(prev => {
      const next = new Set(prev);
      if (next.has(serviceId)) next.delete(serviceId);
      else next.add(serviceId);
      return next;
    });
  }, []);

  // Auto-selecionar grupos de valor único (ex.: DTF tem 1 opção por eixo → resolve
  // sozinho). Seleciona um grupo por vez; o efeito re-roda após cada seleção.
  useEffect(() => {
    const next = cascadeResults.find(r => !r.selected_value_id && r.values.length === 1);
    if (next) {
      setSelection(prev => {
        if (prev.get(next.group.id)) return prev;
        const m = new Map(prev);
        m.set(next.group.id, next.values[0].id);
        return m;
      });
    }
  }, [cascadeResults]);

  // Status do preço
  const priceStatus: PriceStatus = calculation
    ? calculation.price_status
    : 'unconfirmed';

  const statusConfig = {
    confirmed: { icon: Check, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Confirmado' },
    unconfirmed: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', label: 'Não confirmado' },
    outdated: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', label: 'Desatualizado' },
    revalidated: { icon: RotateCcw, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Revalidado' },
  };
  const status = statusConfig[priceStatus];
  const StatusIcon = status.icon;

  return (
    <div className="space-y-4">
      {/* Cabeçalho da família */}
      <div className="flex items-center gap-3 pb-2 border-b">
        {family.image_url && (
          <img src={family.image_url} alt="" className="h-10 w-10 rounded object-cover border" />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{family.name}</p>
          {family.external_id && (
            <span className="text-[10px] text-muted-foreground">Cód: {family.external_id}</span>
          )}
        </div>
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${status.bg} ${status.color}`}>
          <StatusIcon className="h-3.5 w-3.5" />
          {status.label}
        </div>
      </div>

      {/* Seleção em cascata */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1">
          <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Configuração do Produto
          </span>
        </div>

        {cascadeResults.map((result, idx) => {
          const isComplete = result.selected_value_id != null;
          const isNextToSelect = !isComplete && idx === [...selection.values()].length;

          return (
            <div key={result.group.id} className="grid gap-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                {isComplete ? (
                  <Check className="h-3 w-3 text-emerald-500" />
                ) : isNextToSelect ? (
                  <ChevronRight className="h-3 w-3 text-primary animate-pulse" />
                ) : (
                  <span className="h-3 w-3 rounded-full border border-muted-foreground/30 inline-block" />
                )}
                {result.group.name}
                {result.group.is_required && <span className="text-destructive">*</span>}
              </Label>

              {result.values.length > 0 ? (
                <div className="flex items-center gap-2">
                  <Select
                    value={result.selected_value_id || ''}
                    onValueChange={(val) => handleOptionSelect(result.group.id, val)}
                    disabled={!isNextToSelect && !isComplete}
                  >
                    <SelectTrigger className={`h-9 ${isNextToSelect ? 'ring-1 ring-primary' : ''}`}>
                      <SelectValue placeholder={`Selecione ${result.group.name.toLowerCase()}...`} />
                    </SelectTrigger>
                    <SelectContent>
                      {result.values.map(v => (
                        <SelectItem key={v.id} value={v.id}>
                          <div className="flex items-center gap-2">
                            <span>{v.name}</span>
                            {v.external_id && (
                              <span className="text-[9px] text-muted-foreground">({v.external_id})</span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isComplete && (
                    <button
                      onClick={() => handleClearSelection(result.group.id)}
                      className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                      title="Limpar seleção"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  Selecione as opções anteriores primeiro
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Quantidade — cada quantidade é um produto comercial próprio */}
      {allOptionsSelected && availableQuantities.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs font-medium flex items-center gap-1.5">
            <Package className="h-3 w-3 text-sky-600" />
            Quantidade
          </Label>
          <div className="flex flex-wrap gap-1.5">
            {availableQuantities.map(q => (
              <button
                key={q.quantity}
                onClick={() => setSelectedQuantity(q.quantity)}
                className={`text-[11px] px-2.5 py-1.5 rounded-md border transition-colors ${
                  selectedQuantity === q.quantity
                    ? 'bg-sky-600 text-white border-sky-600 font-semibold'
                    : q.available
                      ? 'bg-background hover:border-sky-400'
                      : 'bg-muted text-muted-foreground line-through'
                }`}
                disabled={!q.available}
              >
                <div className="flex flex-col items-center">
                  <span>{q.quantity} un</span>
                  <span className="font-bold">{fmt.format(q.total_price)}</span>
                  {q.is_promotional && q.normal_price && (
                    <span className="text-[9px] line-through opacity-70">
                      {fmt.format(q.normal_price)}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Extras compatíveis */}
      {availableExtras.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs font-medium">Acabamentos Extras</Label>
          <div className="space-y-1">
            {availableExtras.map(ae => (
              <label
                key={ae.extra.id}
                className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
                  selectedExtraIds.has(ae.extra.id)
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-secondary/50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedExtraIds.has(ae.extra.id)}
                  onChange={() => toggleExtra(ae.extra.id)}
                  className="h-3.5 w-3.5 rounded"
                />
                <span className="flex-1 text-xs">{ae.extra.name}</span>
                <span className="text-xs font-semibold text-amber-600">
                  +{fmt.format(ae.price)}
                </span>
                {ae.additional_days > 0 && (
                  <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                    <Clock className="h-2.5 w-2.5" />+{ae.additional_days}d
                  </span>
                )}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Serviços */}
      {familyData.services && familyData.services.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs font-medium">Serviços Complementares</Label>
          <div className="space-y-1">
            {familyData.services.map((svc: any) => {
              const sp = (familyData.servicePrices || []).find(
                (p: any) => p.service_id === svc.id,
              );
              return (
                <label
                  key={svc.id}
                  className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
                    selectedServiceIds.has(svc.id)
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-secondary/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedServiceIds.has(svc.id)}
                    onChange={() => toggleService(svc.id)}
                    className="h-3.5 w-3.5 rounded"
                  />
                  <span className="flex-1 text-xs">{svc.name}</span>
                  {sp && (
                    <span className="text-xs font-semibold text-sky-600">
                      {fmt.format(sp.price)}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Modo espelhar fornecedor */}
      <div className="flex items-center justify-between p-2 rounded-md bg-secondary/30 border">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-muted-foreground" />
          <Label className="text-xs">Espelhar preço do fornecedor</Label>
        </div>
        <Switch checked={mirrorMode} onCheckedChange={setMirrorMode} />
      </div>

      {/* Painel de decomposição financeira */}
      {calculation && (
        <Card className="p-3 bg-gradient-to-br from-secondary/30 to-secondary/50 space-y-3">
          <div className="flex items-center gap-2 pb-1 border-b border-border/50">
            <Calculator className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Decomposição do Preço
            </span>
          </div>

          {/* Custo do fornecedor */}
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase">Custo Fornecedor</p>
            <div className="grid grid-cols-2 gap-1 text-xs">
              <span>Produto ({calculation.quantity}un)</span>
              <span className="text-right font-semibold">{fmt.format(calculation.supplier_product_cost)}</span>
              {calculation.supplier_extras_cost > 0 && (
                <>
                  <span>Extras</span>
                  <span className="text-right font-semibold">{fmt.format(calculation.supplier_extras_cost)}</span>
                </>
              )}
              {calculation.supplier_services_cost > 0 && (
                <>
                  <span>Serviços</span>
                  <span className="text-right font-semibold">{fmt.format(calculation.supplier_services_cost)}</span>
                </>
              )}
              {calculation.supplier_freight_cost > 0 && (
                <>
                  <span>Frete</span>
                  <span className="text-right font-semibold">{fmt.format(calculation.supplier_freight_cost)}</span>
                </>
              )}
              <span className="font-bold border-t pt-1">Total Fornecedor</span>
              <span className="text-right font-bold border-t pt-1">{fmt.format(calculation.total_supplier_cost)}</span>
            </div>
          </div>

          {/* Custos internos e margens (somente quando não espelhando) */}
          {!mirrorMode && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase">Composição do Preço de Venda</p>
              <div className="grid grid-cols-2 gap-1 text-xs">
                {calculation.internal_operations_cost > 0 && (
                  <>
                    <span>Operacional interno</span>
                    <span className="text-right">{fmt.format(calculation.internal_operations_cost)}</span>
                  </>
                )}
                {calculation.internal_services_cost > 0 && (
                  <>
                    <span>Serviços internos</span>
                    <span className="text-right">{fmt.format(calculation.internal_services_cost)}</span>
                  </>
                )}
                {calculation.tax_amount > 0 && (
                  <>
                    <span>Impostos</span>
                    <span className="text-right">{fmt.format(calculation.tax_amount)}</span>
                  </>
                )}
                {calculation.safety_margin_amount > 0 && (
                  <>
                    <span>Margem segurança</span>
                    <span className="text-right">{fmt.format(calculation.safety_margin_amount)}</span>
                  </>
                )}
                <span>Lucro</span>
                <span className="text-right font-semibold text-emerald-600">{fmt.format(calculation.profit_amount)}</span>
              </div>
            </div>
          )}

          {/* Resultado final */}
          <div className="pt-2 border-t space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase">
                {mirrorMode ? 'Custo FuturaIM' : 'Preço de Venda'}
              </span>
              <span className="text-lg font-black text-primary">
                {fmt.format(calculation.final_sale_price)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Unitário: {fmt.format(calculation.unit_price_display)}
              </span>
              <span className={`font-bold ${
                calculation.margin_percent >= 30 ? 'text-emerald-600' :
                calculation.margin_percent >= 15 ? 'text-amber-600' : 'text-red-500'
              }`}>
                Margem: {calculation.margin_percent.toFixed(1)}%
              </span>
            </div>
            {/* Prazo */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>
                Prazo: {calculation.total_lead_time_days} dias úteis
                {calculation.extras_lead_time_days > 0 && (
                  <span className="text-[10px]">
                    {' '}(base {calculation.base_lead_time_days} + extras {calculation.extras_lead_time_days})
                  </span>
                )}
              </span>
            </div>
            {/* Código externo */}
            {calculation.external_product_id && (
              <div className="text-[10px] text-muted-foreground">
                ID produto fornecedor: {calculation.external_product_id} · Hash: {calculation.combination_hash.substring(0, 20)}...
              </div>
            )}
          </div>

          {/* Modo espelhar: linha extra com preço de venda da gráfica */}
          {mirrorMode && (
            <div className="pt-2 border-t border-dashed space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase">Sua gráfica (com margem)</p>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <p className="text-[9px] text-muted-foreground">Custo</p>
                  <p className="font-bold">{fmt.format(calculation.total_supplier_cost)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-muted-foreground">Venda sugerida</p>
                  <p className="font-bold text-primary">
                    {fmt.format(calculation.total_supplier_cost * (1 + profitMarginPercent / 100))}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] text-muted-foreground">Lucro est.</p>
                  <p className="font-bold text-emerald-600">
                    {fmt.format(calculation.total_supplier_cost * (profitMarginPercent / 100))}
                  </p>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Mensagem quando o produto comercial não é encontrado (§7) */}
      {allOptionsSelected && selectedQuantity > 0 && !productResult.found && productResult.error_message && (
        <div className="p-3 rounded-md bg-red-50 border border-red-200 flex items-start gap-2">
          <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-700">Produto não confirmado</p>
            <p className="text-xs text-red-600 mt-0.5">{productResult.error_message}</p>
          </div>
        </div>
      )}

      {/* Última sincronização */}
      {family.last_synced_at && (
        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
          <RotateCcw className="h-2.5 w-2.5" />
          Última sincronização: {new Date(family.last_synced_at).toLocaleString('pt-BR')}
        </div>
      )}
    </div>
  );
}
