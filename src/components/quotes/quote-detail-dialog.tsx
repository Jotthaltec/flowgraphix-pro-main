import { useQuery } from "@tanstack/react-query";
import { Loader2, Mail, MessageCircle } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { formatCivilDate } from "@/lib/date";
import { quoteStatusMeta, toneVariant } from "@/lib/store-domain-ui";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const SOURCE_LABELS: Record<string, string> = {
  site: "Formulário do site",
  painel: "Painel",
  admin: "Equipe",
};

/** Detalhe de um orçamento: contato, mensagem, itens e valores (store.quotes). */
export function QuoteDetailDialog({ quoteId, onClose }: { quoteId: string; onClose: () => void }) {
  const {
    data: q,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["quote-detail", quoteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema("store")
        .from("quotes")
        .select(
          `id, number, status, title, source, created_at, valid_until, total, subtotal, discount_total,
           shipping_cost, notes, contact_name, contact_email, contact_phone,
           customer:customer_id (name, email, phone),
           items:quote_items (id, description, detail, quantity, unit_price, total_price, position)`,
        )
        .eq("id", quoteId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const name = q?.customer?.name ?? q?.contact_name ?? null;
  const email = q?.customer?.email ?? q?.contact_email ?? null;
  const phone = (q?.customer?.phone ?? q?.contact_phone ?? "").replace(/\D/g, "");
  const items = [...(q?.items ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Orçamento {q?.number ?? ""}</DialogTitle>
          <DialogDescription>
            {q
              ? `${SOURCE_LABELS[q.source] ?? q.source} · criado em ${formatCivilDate(q.created_at)}`
              : "Carregando…"}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <Loader2 className="mx-auto my-6 animate-spin" />
        ) : error || !q ? (
          <p className="text-sm text-destructive">Não foi possível abrir este orçamento.</p>
        ) : (
          <div className="space-y-5 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge variant={toneVariant(quoteStatusMeta(q.status).tone)}>
                {quoteStatusMeta(q.status).label}
              </StatusBadge>
              {q.valid_until ? (
                <span className="text-muted-foreground">
                  Válido até {formatCivilDate(q.valid_until)}
                </span>
              ) : null}
            </div>

            <section className="space-y-1">
              <h3 className="font-semibold">Contato</h3>
              <p>{name ?? "Sem nome informado"}</p>
              {email ? <p className="text-muted-foreground">{email}</p> : null}
              {phone ? <p className="text-muted-foreground">{phone}</p> : null}
              <div className="flex flex-wrap gap-2 pt-1">
                {email ? (
                  <Button asChild size="sm" variant="outline">
                    <a
                      href={`mailto:${email}?subject=${encodeURIComponent(`Orçamento ${q.number}`)}`}
                    >
                      <Mail className="mr-1 h-4 w-4" /> E-mail
                    </a>
                  </Button>
                ) : null}
                {phone ? (
                  <Button asChild size="sm" variant="outline">
                    <a
                      href={`https://wa.me/${phone.length <= 11 ? `55${phone}` : phone}?text=${encodeURIComponent(
                        `Olá${name ? `, ${name.split(" ")[0]}` : ""}! Aqui é da Nexus Printi, sobre o orçamento ${q.number}.`,
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle className="mr-1 h-4 w-4" /> WhatsApp
                    </a>
                  </Button>
                ) : null}
              </div>
            </section>

            {q.notes ? (
              <section className="space-y-1">
                <h3 className="font-semibold">Pedido do cliente</h3>
                <p className="whitespace-pre-wrap rounded-md bg-muted p-3">{q.notes}</p>
              </section>
            ) : null}

            <section className="space-y-2">
              <h3 className="font-semibold">Itens</h3>
              {items.length === 0 ? (
                <p className="text-muted-foreground">
                  Ainda sem itens: é uma solicitação. Monte o orçamento com produtos e valores antes
                  de aprovar ou converter em pedido.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Qtd.</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell>
                          {i.description}
                          {i.detail ? (
                            <span className="block text-xs text-muted-foreground">{i.detail}</span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{i.quantity}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {brl(Number(i.total_price))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <div className="flex justify-end gap-6 font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{brl(Number(q.total))}</span>
              </div>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
