/**
 * Dialog de Revalidação de Orçamento.
 *
 * Antes de converter o orçamento em pedido, compara os valores
 * cotados com os preços atuais do fornecedor.
 *
 * Mostra: valor anterior × atual, diferença em R$ e %, impacto na margem.
 * Permite: manter preço, recalcular, trocar fornecedor, solicitar aprovação.
 */

import { useState } from 'react';
import {
  AlertTriangle, ArrowRight, Check, RefreshCw, Repeat, Shield,
  TrendingUp, TrendingDown, Minus, XCircle,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/status-badge';

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface RevalidationItemResult {
  item_name: string;
  old_price: number;
  new_price: number | null;
  price_diff: number | null;
  price_diff_percent: number | null;
  is_available: boolean | null;
  old_lead_time: number | null;
  new_lead_time: number | null;
  has_changes: boolean;
  old_margin: number | null;
  new_margin: number | null;
}

export interface RevalidationDialogProps {
  open: boolean;
  onClose: () => void;
  results: RevalidationItemResult[];
  quoteName: string;
  onKeepPrices: () => void;
  onRecalculate: () => void;
  onRequestApproval: () => void;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function QuoteRevalidationDialog({
  open,
  onClose,
  results,
  quoteName,
  onKeepPrices,
  onRecalculate,
  onRequestApproval,
}: RevalidationDialogProps) {
  const hasAnyChange = results.some(r => r.has_changes);
  const unavailableItems = results.filter(r => r.is_available === false);
  const changedItems = results.filter(r => r.has_changes && r.is_available !== false);
  const unchangedItems = results.filter(r => !r.has_changes);

  const totalOldPrice = results.reduce((s, r) => s + r.old_price, 0);
  const totalNewPrice = results.reduce((s, r) => s + (r.new_price ?? r.old_price), 0);
  const totalDiff = totalNewPrice - totalOldPrice;
  const totalDiffPercent = totalOldPrice > 0 ? (totalDiff / totalOldPrice) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {hasAnyChange ? (
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            ) : (
              <Check className="h-5 w-5 text-emerald-500" />
            )}
            Revalidação do Orçamento
          </DialogTitle>
          <DialogDescription>
            {hasAnyChange
              ? `Foram detectadas alterações nos preços do fornecedor para "${quoteName}".`
              : `Todos os preços de "${quoteName}" estão confirmados e atualizados.`}
          </DialogDescription>
        </DialogHeader>

        {/* Resumo geral */}
        {hasAnyChange && (
          <div className="grid grid-cols-3 gap-4 p-4 bg-secondary/30 rounded-lg">
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Cotado</p>
              <p className="font-bold text-lg">{fmt.format(totalOldPrice)}</p>
            </div>
            <div className="text-center flex flex-col items-center justify-center">
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <p className={`text-sm font-bold ${totalDiff > 0 ? 'text-red-500' : totalDiff < 0 ? 'text-emerald-600' : ''}`}>
                {totalDiff > 0 ? '+' : ''}{fmt.format(totalDiff)}
                <span className="text-xs ml-1">({totalDiffPercent > 0 ? '+' : ''}{totalDiffPercent.toFixed(1)}%)</span>
              </p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Atual</p>
              <p className="font-bold text-lg">{fmt.format(totalNewPrice)}</p>
            </div>
          </div>
        )}

        {/* Itens indisponíveis */}
        {unavailableItems.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-red-600 flex items-center gap-1.5">
              <XCircle className="h-4 w-4" />
              Itens Indisponíveis ({unavailableItems.length})
            </h4>
            {unavailableItems.map((item, i) => (
              <div key={i} className="p-2.5 rounded-md bg-red-50 border border-red-200 text-sm">
                <p className="font-medium text-red-700">{item.item_name}</p>
                <p className="text-xs text-red-600 mt-0.5">
                  Este produto/combinação não está mais disponível no fornecedor.
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Itens com alteração */}
        {changedItems.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-amber-600 flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" />
              Preços Alterados ({changedItems.length})
            </h4>
            {changedItems.map((item, i) => (
              <div key={i} className="p-2.5 rounded-md bg-amber-50 border border-amber-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{item.item_name}</span>
                  {item.price_diff != null && (
                    <span className={`text-xs font-bold flex items-center gap-0.5 ${
                      item.price_diff > 0 ? 'text-red-600' : 'text-emerald-600'
                    }`}>
                      {item.price_diff > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {item.price_diff > 0 ? '+' : ''}{fmt.format(item.price_diff)}
                      ({item.price_diff_percent != null ? `${item.price_diff_percent > 0 ? '+' : ''}${item.price_diff_percent.toFixed(1)}%` : ''})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                  <span>Cotado: {fmt.format(item.old_price)}</span>
                  <ArrowRight className="h-3 w-3" />
                  <span className="font-semibold text-foreground">
                    Atual: {item.new_price != null ? fmt.format(item.new_price) : 'Indisponível'}
                  </span>
                </div>
                {item.old_margin != null && item.new_margin != null && (
                  <div className="mt-1 text-[10px]">
                    <span className="text-muted-foreground">Margem: </span>
                    <span>{item.old_margin.toFixed(1)}%</span>
                    <ArrowRight className="h-2.5 w-2.5 inline mx-1" />
                    <span className={item.new_margin < item.old_margin ? 'text-red-500 font-bold' : 'text-emerald-600 font-bold'}>
                      {item.new_margin.toFixed(1)}%
                    </span>
                  </div>
                )}
                {item.old_lead_time != null && item.new_lead_time != null && item.old_lead_time !== item.new_lead_time && (
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    Prazo: {item.old_lead_time}d → {item.new_lead_time}d
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Itens sem alteração */}
        {unchangedItems.length > 0 && (
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-emerald-600 flex items-center gap-1.5">
              <Check className="h-4 w-4" />
              Sem Alterações ({unchangedItems.length})
            </h4>
            <div className="text-xs text-muted-foreground">
              {unchangedItems.map(item => item.item_name).join(', ')}
            </div>
          </div>
        )}

        {/* Ações */}
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {hasAnyChange ? (
            <>
              <Button variant="outline" onClick={onKeepPrices} className="gap-1.5">
                <Shield className="h-4 w-4" />
                Manter preço cotado
              </Button>
              <Button variant="outline" onClick={onRecalculate} className="gap-1.5">
                <RefreshCw className="h-4 w-4" />
                Recalcular orçamento
              </Button>
              <Button onClick={onRequestApproval} className="gap-1.5">
                <AlertTriangle className="h-4 w-4" />
                Solicitar aprovação
              </Button>
            </>
          ) : (
            <Button onClick={onClose} className="gap-1.5">
              <Check className="h-4 w-4" />
              Confirmar e prosseguir
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
