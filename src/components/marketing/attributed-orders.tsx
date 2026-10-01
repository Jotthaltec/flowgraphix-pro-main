import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, PencilLine } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { CHANNEL_LABELS } from "@/lib/marketing-attribution";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const when = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));

type Row = {
  order_id: string;
  order_number: string;
  attributed_at: string;
  channel: string;
  utm_source: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  meta_ad_id: string | null;
  revenue: number;
  status: string;
  reversal_reason: string | null;
  source: string;
};

function CorrectionDialog({ row, onClose }: { row: Row; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [choice, setChoice] = useState<string>("direct");
  const [reason, setReason] = useState("");

  const options = useQuery({
    queryKey: ["marketing-correction-options", row.order_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema("store")
        .rpc("marketing_correction_options", { p_order_id: row.order_id });
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.schema("store").rpc("correct_order_attribution", {
        p_order_id: row.order_id,
        // null = "direto / não rastreado"
        p_touchpoint_id: (choice === "direct" ? null : choice) as string,
        p_reason: reason.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Origem do pedido ${row.order_number} corrigida e registrada na auditoria.`);
      void queryClient.invalidateQueries({ queryKey: ["marketing-attributed-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["marketing-overview"] });
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      onClose();
    },
    onError: (error: { message?: string }) =>
      toast.error(error.message ?? "Não foi possível corrigir a origem."),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Corrigir origem do pedido {row.order_number}</DialogTitle>
          <DialogDescription>
            A correção vale para o modelo principal, fica na auditoria com o seu usuário e não é
            desfeita por recálculos automáticos.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nova origem</Label>
            {options.isLoading ? (
              <Loader2 className="animate-spin" />
            ) : options.error ? (
              <p className="text-sm text-destructive">
                {(options.error as { message?: string }).message ?? "Sem acesso às opções."}
              </p>
            ) : (
              <div className="space-y-2">
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="origem"
                    checked={choice === "direct"}
                    onChange={() => setChoice("direct")}
                  />
                  <span>Direto / não rastreado (ex.: indicação, balcão, WhatsApp sem link)</span>
                </label>
                {(options.data ?? []).map((o) => (
                  <label key={o.touchpoint_id} className="flex items-start gap-2 text-sm">
                    <input
                      type="radio"
                      name="origem"
                      checked={choice === o.touchpoint_id}
                      onChange={() => setChoice(o.touchpoint_id)}
                    />
                    <span>
                      {CHANNEL_LABELS[o.channel] ?? o.channel}
                      {o.utm_campaign ? ` · ${o.utm_campaign}` : ""}
                      {o.utm_content ? ` · ${o.utm_content}` : ""}
                      <span className="block text-xs text-muted-foreground">
                        {when(o.occurred_at)}
                        {o.meta_ad_id ? ` · anúncio ${o.meta_ad_id}` : ""}
                      </span>
                    </span>
                  </label>
                ))}
                {options.data?.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Este pedido não tem outras visitas rastreadas.
                  </p>
                ) : null}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="motivo-correcao">Motivo (obrigatório)</Label>
            <Textarea
              id="motivo-correcao"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: cliente confirmou que veio por indicação"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={reason.trim().length < 5 || save.isPending || Boolean(options.error)}
            onClick={() => save.mutate()}
          >
            {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Salvar correção
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AttributedOrders({ from, to }: { from: string; to: string }) {
  const [editing, setEditing] = useState<Row | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ["marketing-attributed-orders", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema("store")
        .rpc("marketing_attributed_orders", { p_from: from, p_to: to, p_limit: 200 });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  if (isLoading) return <Loader2 className="mx-auto my-10 animate-spin" />;
  if (error) {
    return (
      <Card className="p-6 text-sm text-destructive">Não foi possível carregar os pedidos.</Card>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Pedido</TableHead>
            <TableHead>Pago em</TableHead>
            <TableHead>Origem</TableHead>
            <TableHead className="hidden lg:table-cell">Anúncio</TableHead>
            <TableHead className="text-right">Receita</TableHead>
            <TableHead>Situação</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                Nenhum pedido pago no período.
              </TableCell>
            </TableRow>
          ) : (
            data?.map((r) => (
              <TableRow key={r.order_id}>
                <TableCell className="font-mono font-semibold">{r.order_number}</TableCell>
                <TableCell className="text-sm">{when(r.attributed_at)}</TableCell>
                <TableCell>
                  <div>
                    {CHANNEL_LABELS[r.channel] ?? r.channel}
                    {r.source === "manual" ? " (corrigida)" : ""}
                  </div>
                  {r.utm_campaign ? (
                    <div className="text-xs text-muted-foreground">
                      {r.utm_campaign}
                      {r.utm_content ? ` · ${r.utm_content}` : ""}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell className="hidden font-mono text-xs lg:table-cell">
                  {r.meta_ad_id ?? "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">{brl(r.revenue)}</TableCell>
                <TableCell>
                  {r.status === "reversed" ? (
                    <StatusBadge variant="destructive">
                      {r.reversal_reason === "estornado" ? "Estornado" : "Revertido"}
                    </StatusBadge>
                  ) : (
                    <StatusBadge variant="success">Pago</StatusBadge>
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Corrigir origem do pedido ${r.order_number}`}
                    onClick={() => setEditing(r)}
                  >
                    <PencilLine className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {editing ? <CorrectionDialog row={editing} onClose={() => setEditing(null)} /> : null}
    </Card>
  );
}
