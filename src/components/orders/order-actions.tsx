import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { ORDER_STATUSES, ORDER_STATUS_META } from "@/lib/store-domain";

/**
 * Ações da equipe sobre um pedido da loja — as mesmas do painel do site
 * (Nexus-Printi/src/components/panel/order-admin-actions.tsx), pelos mesmos
 * caminhos do banco:
 * - situação: store.update_order_status (observação vai para o histórico;
 *   "Aprovado para produção" cria as ordens de produção pelo gatilho);
 * - pagamento: store.crm_set_order_payment (financeiro e comissões pelos gatilhos);
 * - rastreio: store.orders.tracking_code + store.shipments;
 * - cancelamento: store.cancel_order (motivo, cobrança, crédito e estoque).
 */
export function OrderActions({
  order,
}: {
  order: {
    id: string;
    status: string;
    payment_status: string;
    shipping_method: string | null;
    shipping_cost: number;
    tracking_code: string | null;
  };
}) {
  const qc = useQueryClient();
  const [status, setStatus] = useState(order.status);
  const [note, setNote] = useState("");
  const [tracking, setTracking] = useState(order.tracking_code ?? "");
  const [carrier, setCarrier] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["order-detail", order.id] });
    void qc.invalidateQueries({ queryKey: ["orders"] });
  };

  const statusMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.schema("store").rpc("update_order_status", {
        p_order_id: order.id,
        p_status: status,
        p_note: note.trim() || undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Situação atualizada.");
      setNote("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const paymentMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.schema("store").rpc("crm_set_order_payment", {
        p_order_id: order.id,
        p_crm_status: "pago",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pagamento confirmado.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const shipmentMutation = useMutation({
    mutationFn: async () => {
      const store = supabase.schema("store");
      const code = tracking.trim() || null;
      const { error } = await store
        .from("orders")
        .update({ tracking_code: code })
        .eq("id", order.id);
      if (error) throw error;
      const payload = {
        order_id: order.id,
        method: order.shipping_method ?? "retirada",
        carrier: carrier.trim() || null,
        tracking_code: code,
        cost: order.shipping_cost,
      };
      const { data: existing } = await store
        .from("shipments")
        .select("id")
        .eq("order_id", order.id)
        .limit(1)
        .maybeSingle();
      const { error: shipError } = existing
        ? await store.from("shipments").update(payload).eq("id", existing.id)
        : await store.from("shipments").insert(payload);
      if (shipError) throw shipError;
    },
    onSuccess: () => {
      toast.success("Envio atualizado.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.schema("store").rpc("cancel_order", {
        p_order_id: order.id,
        p_reason: cancelReason.trim(),
      });
      if (error) throw error;
      return data as { already?: boolean; refund_pending?: boolean } | null;
    },
    onSuccess: (result) => {
      toast.success(
        result?.already
          ? "Este pedido já estava cancelado."
          : result?.refund_pending
            ? "Pedido cancelado. Ele já estava pago: registre a devolução do valor ao cliente."
            : "Pedido cancelado.",
      );
      setConfirmCancel(false);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelled = order.status === "cancelado";

  return (
    <section className="space-y-4 rounded-md border p-3">
      <h3 className="font-semibold">Ações</h3>

      {!cancelled ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Situação do pedido</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORDER_STATUSES.filter((s) => s !== "cancelado").map((s) => (
                  <SelectItem key={s} value={s}>
                    {ORDER_STATUS_META[s].group} · {ORDER_STATUS_META[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Observação (vai para o histórico)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <Button
              disabled={statusMutation.isPending || status === order.status}
              onClick={() => statusMutation.mutate()}
            >
              {statusMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Atualizar
            </Button>
          </div>
          {status === "aprovado_producao" && order.status !== "aprovado_producao" ? (
            <p className="text-xs text-muted-foreground">
              As ordens de produção são criadas automaticamente nesta etapa.
            </p>
          ) : null}
        </div>
      ) : null}

      {!cancelled && order.payment_status !== "pago" ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Pagamento recebido fora do site (Pix, dinheiro, transferência)?
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={paymentMutation.isPending}
            onClick={() => paymentMutation.mutate()}
          >
            {paymentMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar pagamento
          </Button>
        </div>
      ) : null}

      {!cancelled && order.shipping_method && order.shipping_method !== "retirada" ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Envio</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="Código de rastreio"
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
            />
            <Input
              placeholder="Transportadora (opcional)"
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
            />
            <Button
              variant="outline"
              disabled={shipmentMutation.isPending}
              onClick={() => shipmentMutation.mutate()}
            >
              Salvar envio
            </Button>
          </div>
        </div>
      ) : null}

      {!cancelled ? (
        <div className="space-y-2">
          {!confirmCancel ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => setConfirmCancel(true)}
            >
              Cancelar pedido…
            </Button>
          ) : (
            <>
              <Textarea
                placeholder="Motivo do cancelamento (obrigatório)"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={cancelMutation.isPending || !cancelReason.trim()}
                  onClick={() => cancelMutation.mutate()}
                >
                  {cancelMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirmar cancelamento
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmCancel(false)}>
                  Voltar
                </Button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
