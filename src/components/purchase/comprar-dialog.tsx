/**
 * Fase 5 — Compra assistida.
 *
 * Painel que reúne, a partir de um pedido de compra (PC), tudo que o operador
 * precisa para comprar no site do fornecedor — conta, destino e itens com link
 * direto — e registra o resultado da compra de volta no PC (número no
 * fornecedor, custo pago, previsão de entrega, rastreio). A senha do fornecedor
 * é write-only por design: mostramos o login e um indicador "senha salva", nunca
 * a senha em texto plano.
 */

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/status-badge";
import {
  ExternalLink, Copy, Check, KeyRound, Truck, Store, ShoppingCart, Loader2, ClipboardList,
} from "lucide-react";
import { toast } from "sonner";
import {
  buildPurchaseChecklist, formatDeliveryText, type ChecklistItem,
} from "@/lib/purchase-assist";

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export interface BuyablePO {
  id: string;
  po_number: string;
  status: string;
  supplier_id: string | null;
  total_cost: number;
  receiving_mode: string | null;
  delivery_snapshot: Record<string, any> | null;
  suppliers: { name: string; website_url: string | null } | null;
  purchase_order_items: {
    id: string;
    product_name: string;
    source_url: string | null;
    supplier_sku: string | null;
    quantity: number;
    unit_cost: number;
    total_cost: number;
  }[];
  supplier_order_number?: string | null;
  actual_cost?: number | null;
  purchased_at?: string | null;
  expected_delivery?: string | null;
  tracking_code?: string | null;
  purchase_notes?: string | null;
}

interface AccountSafe {
  login_username: string | null;
  has_password: boolean | null;
  registration_cnpj: string | null;
  registration_email: string | null;
  registration_phone: string | null;
}

function CopyButton({ value, label }: { value?: string | null; label?: string }) {
  const [done, setDone] = useState(false);
  if (!value) return null;
  return (
    <Button
      size="icon"
      variant="ghost"
      className="h-6 w-6 shrink-0"
      title={label ? `Copiar ${label}` : "Copiar"}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        } catch {
          toast.error("Não foi possível copiar.");
        }
      }}
    >
      {done ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-1.5 text-sm">
      <span className="text-muted-foreground w-20 shrink-0">{label}</span>
      <span className="font-medium truncate">{value}</span>
      <CopyButton value={value} label={label} />
    </div>
  );
}

const today = () => new Date().toISOString().split("T")[0];

export function ComprarDialog({
  po,
  companyId,
  open,
  onOpenChange,
}: {
  po: BuyablePO | null;
  companyId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const queryClient = useQueryClient();

  const { data: account } = useQuery({
    queryKey: ["supplier_account_for_buy", companyId, po?.supplier_id],
    queryFn: async () => {
      if (!po?.supplier_id) return null;
      const { data } = await supabase
        .from("supplier_accounts_safe")
        .select("login_username, has_password, registration_cnpj, registration_email, registration_phone")
        .eq("company_id", companyId)
        .eq("supplier_id", po.supplier_id)
        .maybeSingle();
      return (data as AccountSafe) ?? null;
    },
    enabled: !!po?.supplier_id && open,
  });

  const [form, setForm] = useState({
    supplier_order_number: "",
    actual_cost: "",
    purchased_at: today(),
    expected_delivery: "",
    tracking_code: "",
    purchase_notes: "",
  });

  // Ao abrir/trocar de PC, pré-preenche o formulário com o que já houver.
  useEffect(() => {
    if (!po) return;
    setForm({
      supplier_order_number: po.supplier_order_number ?? "",
      actual_cost: po.actual_cost != null ? String(po.actual_cost) : String(po.total_cost ?? ""),
      purchased_at: po.purchased_at ? po.purchased_at.split("T")[0] : today(),
      expected_delivery: po.expected_delivery ?? "",
      tracking_code: po.tracking_code ?? "",
      purchase_notes: po.purchase_notes ?? "",
    });
  }, [po]);

  const registerMutation = useMutation({
    mutationFn: async () => {
      if (!po) return;
      const { error } = await supabase
        .from("purchase_orders")
        .update({
          status: "comprado",
          supplier_order_number: form.supplier_order_number || null,
          actual_cost: form.actual_cost === "" ? null : Number(form.actual_cost),
          purchased_at: form.purchased_at ? new Date(form.purchased_at).toISOString() : new Date().toISOString(),
          expected_delivery: form.expected_delivery || null,
          tracking_code: form.tracking_code || null,
          purchase_notes: form.purchase_notes || null,
        })
        .eq("id", po.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      toast.success("Compra registrada. Pedido de compra marcado como comprado.");
      onOpenChange(false);
    },
    onError: (err: any) => toast.error("Erro ao registrar: " + err.message),
  });

  if (!po) return null;

  const items: ChecklistItem[] = po.purchase_order_items.map((it) => ({
    product_name: it.product_name,
    source_url: it.source_url,
    supplier_sku: it.supplier_sku,
    quantity: it.quantity,
    unit_cost: it.unit_cost,
  }));

  const deliveryInput = { receiving_mode: po.receiving_mode, ...(po.delivery_snapshot || {}) };

  function copyChecklist() {
    const text = buildPurchaseChecklist({
      poNumber: po!.po_number,
      supplierName: po!.suppliers?.name,
      supplierUrl: po!.suppliers?.website_url,
      account: account ?? undefined,
      delivery: deliveryInput,
      items,
    });
    navigator.clipboard.writeText(text).then(
      () => toast.success("Checklist de compra copiado."),
      () => toast.error("Não foi possível copiar."),
    );
  }

  const alreadyBought = po.status === "comprado" || po.status === "recebido";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            <span className="font-mono">{po.po_number}</span>
            <span className="text-muted-foreground font-normal text-sm">· {po.suppliers?.name}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Ação principal */}
          <div className="flex flex-wrap gap-2">
            {po.suppliers?.website_url && (
              <Button asChild>
                <a href={po.suppliers.website_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-1.5" /> Abrir site do fornecedor
                </a>
              </Button>
            )}
            <Button variant="outline" onClick={copyChecklist}>
              <ClipboardList className="h-4 w-4 mr-1.5" /> Copiar checklist
            </Button>
          </div>

          {/* Conta */}
          <section className="rounded-lg border p-3">
            <p className="text-sm font-medium mb-2 flex items-center gap-1.5">
              <KeyRound className="h-4 w-4" /> Conta no fornecedor
            </p>
            {account ? (
              <div className="space-y-1">
                <Field label="Login" value={account.login_username} />
                <div className="flex items-center gap-1.5 text-sm">
                  <span className="text-muted-foreground w-20 shrink-0">Senha</span>
                  {account.has_password
                    ? <StatusBadge variant="success">salva no perfil</StatusBadge>
                    : <StatusBadge variant="muted">não cadastrada</StatusBadge>}
                </div>
                <Field label="CNPJ" value={account.registration_cnpj} />
                <Field label="E-mail" value={account.registration_email} />
                <Field label="Telefone" value={account.registration_phone} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum perfil de conta cadastrado para este fornecedor. Cadastre em Hub de Fornecedores → Perfis.
              </p>
            )}
          </section>

          {/* Destino */}
          <section className="rounded-lg border p-3">
            <p className="text-sm font-medium mb-2 flex items-center gap-1.5">
              {po.receiving_mode === "pickup" ? <Store className="h-4 w-4" /> : <Truck className="h-4 w-4" />}
              {po.receiving_mode === "pickup" ? "Retirada" : "Entrega"}
            </p>
            <div className="flex items-start gap-1.5">
              <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-sans flex-1">
                {formatDeliveryText(deliveryInput)}
              </pre>
              <CopyButton value={formatDeliveryText(deliveryInput)} label="destino" />
            </div>
          </section>

          {/* Itens */}
          <section>
            <p className="text-sm font-medium mb-2">Itens a comprar ({items.length})</p>
            <div className="space-y-2">
              {po.purchase_order_items.map((it) => (
                <div key={it.id} className="flex items-center gap-3 rounded-lg border p-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{it.product_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {it.quantity} un × {fmt.format(it.unit_cost)} = <span className="font-medium">{fmt.format(it.total_cost)}</span>
                      {it.supplier_sku ? ` · SKU ${it.supplier_sku}` : ""}
                    </p>
                  </div>
                  <CopyButton value={it.supplier_sku ?? undefined} label="SKU" />
                  {it.source_url && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={it.source_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Abrir
                      </a>
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t mt-3 pt-2">
              <span className="text-sm text-muted-foreground">Total estimado</span>
              <span className="font-semibold">{fmt.format(po.total_cost || 0)}</span>
            </div>
          </section>

          {/* Registrar compra */}
          <section className="rounded-lg border bg-muted/30 p-3">
            <p className="text-sm font-medium mb-3">
              {alreadyBought ? "Compra registrada" : "Registrar compra realizada"}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Nº do pedido no fornecedor</Label>
                <Input
                  value={form.supplier_order_number}
                  onChange={(e) => setForm({ ...form, supplier_order_number: e.target.value })}
                  placeholder="ex.: 1234567"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Custo pago (R$)</Label>
                <Input
                  type="number" min="0" step="0.01"
                  value={form.actual_cost}
                  onChange={(e) => setForm({ ...form, actual_cost: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Data da compra</Label>
                <Input type="date" value={form.purchased_at} onChange={(e) => setForm({ ...form, purchased_at: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Previsão de entrega</Label>
                <Input type="date" value={form.expected_delivery} onChange={(e) => setForm({ ...form, expected_delivery: e.target.value })} />
              </div>
              <div className="grid gap-1.5 col-span-2">
                <Label className="text-xs">Código de rastreio</Label>
                <Input value={form.tracking_code} onChange={(e) => setForm({ ...form, tracking_code: e.target.value })} placeholder="opcional" />
              </div>
              <div className="grid gap-1.5 col-span-2">
                <Label className="text-xs">Observações</Label>
                <Textarea rows={2} value={form.purchase_notes} onChange={(e) => setForm({ ...form, purchase_notes: e.target.value })} placeholder="opcional" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
              <Button onClick={() => registerMutation.mutate()} disabled={registerMutation.isPending}>
                {registerMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                {alreadyBought ? "Atualizar registro" : "Marcar como comprado"}
              </Button>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
