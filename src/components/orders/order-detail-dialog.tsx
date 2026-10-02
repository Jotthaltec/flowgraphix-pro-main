import { useQuery } from "@tanstack/react-query";
import { Download, Loader2, Mail, MessageCircle } from "lucide-react";
import { toast } from "sonner";
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

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const dateTime = (v: string) => new Date(v).toLocaleString("pt-BR");

const humanize = (v: string | null | undefined) => (v ?? "").replace(/_/g, " ");

const SOURCE_LABELS: Record<string, string> = {
  loja: "Site",
  site: "Site",
  flow: "CRM",
  admin: "Equipe",
  balcao: "Balcão",
};

const SHIPPING_LABELS: Record<string, string> = {
  retirada: "Retirada no balcão",
  entrega_local: "Entrega local",
  correios_pac: "Correios PAC",
  correios_sedex: "Correios SEDEX",
  transportadora: "Transportadora",
};

type Address = {
  recipient?: string;
  cep?: string;
  street?: string;
  number?: string;
  complement?: string | null;
  district?: string;
  city?: string;
  state?: string;
  reference?: string | null;
};

type SelectedOption = { label?: string; value?: string };

/** Detalhe de um pedido da loja: cliente, entrega, itens com opções, arte e pagamentos (store.orders). */
export function OrderDetailDialog({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const {
    data: o,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["order-detail", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema("store")
        .from("orders")
        .select(
          `id, number, status, payment_status, payment_method, source, created_at, estimated_delivery,
           shipping_method, shipping_address, tracking_code, is_rush, notes, internal_notes,
           subtotal, discount_total, coupon_code, shipping_cost, credit_used, total,
           customer:customers (name, email, phone, document),
           items:order_items (id, product_id, product_name, sku, quantity, total_price, options, notes, art_status),
           arts:art_files!art_files_order_id_fkey (id, file_name, storage_path, status, version, is_current, created_at),
           payments (id, method, status, amount, paid_at, created_at),
           history:order_status_history (id, from_status, to_status, note, created_at)`,
        )
        .eq("id", orderId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      // Nome de cada opção (ex.: "material" → "Material") vem dos grupos do produto.
      const productIds = [...new Set((data.items ?? []).map((i) => i.product_id).filter(Boolean))];
      const { data: groups } = productIds.length
        ? await supabase
            .schema("store")
            .from("product_option_groups")
            .select("product_id, key, name")
            .in("product_id", productIds as string[])
        : { data: [] };
      const groupNames = new Map((groups ?? []).map((g) => [`${g.product_id}:${g.key}`, g.name]));
      return { ...data, groupNames };
    },
  });

  async function downloadArt(path: string) {
    const { data, error } = await supabase.storage.from("artes").createSignedUrl(path, 600);
    if (error || !data?.signedUrl) {
      toast.error("Não foi possível baixar o arquivo de arte.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  const name = o?.customer?.name ?? null;
  const email = o?.customer?.email ?? null;
  const phone = (o?.customer?.phone ?? "").replace(/\D/g, "");
  const address = (o?.shipping_address ?? null) as Address | null;
  const arts = [...(o?.arts ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const history = [...(o?.history ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));

  function optionLines(productId: string | null, options: unknown): string[] {
    if (!options || typeof options !== "object") return [];
    return Object.entries(options as Record<string, unknown>).flatMap(([key, raw]) => {
      if (!raw || typeof raw !== "object") return [];
      const opt = raw as SelectedOption;
      if (!opt.label) return [];
      const group =
        o?.groupNames.get(`${productId}:${key}`) ?? humanize(key.replace(/^extra-/, ""));
      if (key.startsWith("extra-")) return opt.value === "nao" ? [] : [`+ ${group}`];
      return [`${group}: ${opt.label}`];
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Pedido {o?.number ?? ""}</DialogTitle>
          <DialogDescription>
            {o
              ? `${SOURCE_LABELS[o.source ?? ""] ?? o.source ?? "—"} · criado em ${dateTime(o.created_at)}`
              : "Carregando…"}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <Loader2 className="mx-auto my-6 animate-spin" />
        ) : error || !o ? (
          <p className="text-sm text-destructive">Não foi possível abrir este pedido.</p>
        ) : (
          <div className="space-y-5 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge>{humanize(o.status)}</StatusBadge>
              <StatusBadge>Pagamento: {humanize(o.payment_status)}</StatusBadge>
              {o.is_rush ? <StatusBadge>Urgente</StatusBadge> : null}
              {o.estimated_delivery ? (
                <span className="text-muted-foreground">
                  Previsão: {formatCivilDate(o.estimated_delivery)}
                </span>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <section className="space-y-1">
                <h3 className="font-semibold">Cliente</h3>
                <p>{name ?? "Sem cliente vinculado"}</p>
                {o.customer?.document ? (
                  <p className="text-muted-foreground">{o.customer.document}</p>
                ) : null}
                {email ? <p className="text-muted-foreground">{email}</p> : null}
                {phone ? <p className="text-muted-foreground">{phone}</p> : null}
                <div className="flex flex-wrap gap-2 pt-1">
                  {email ? (
                    <Button asChild size="sm" variant="outline">
                      <a
                        href={`mailto:${email}?subject=${encodeURIComponent(`Pedido ${o.number}`)}`}
                      >
                        <Mail className="mr-1 h-4 w-4" /> E-mail
                      </a>
                    </Button>
                  ) : null}
                  {phone ? (
                    <Button asChild size="sm" variant="outline">
                      <a
                        href={`https://wa.me/${phone.length <= 11 ? `55${phone}` : phone}?text=${encodeURIComponent(
                          `Olá${name ? `, ${name.split(" ")[0]}` : ""}! Aqui é da Nexus Printi, sobre o pedido ${o.number}.`,
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

              <section className="space-y-1">
                <h3 className="font-semibold">Entrega</h3>
                <p>
                  {SHIPPING_LABELS[o.shipping_method ?? ""] ?? humanize(o.shipping_method) ?? "—"}
                </p>
                {address?.street ? (
                  <p className="text-muted-foreground">
                    {address.recipient ? `${address.recipient} · ` : ""}
                    {address.street}, {address.number}
                    {address.complement ? ` - ${address.complement}` : ""} · {address.district} ·{" "}
                    {address.city}/{address.state} · CEP {address.cep}
                    {address.reference ? ` · Ref.: ${address.reference}` : ""}
                  </p>
                ) : null}
                {o.tracking_code ? (
                  <p className="text-muted-foreground">Rastreio: {o.tracking_code}</p>
                ) : null}
              </section>
            </div>

            {o.notes ? (
              <section className="space-y-1">
                <h3 className="font-semibold">Observações do cliente</h3>
                <p className="whitespace-pre-wrap rounded-md bg-muted p-3">{o.notes}</p>
              </section>
            ) : null}
            {o.internal_notes ? (
              <section className="space-y-1">
                <h3 className="font-semibold">Observações internas</h3>
                <p className="whitespace-pre-wrap rounded-md bg-muted p-3">{o.internal_notes}</p>
              </section>
            ) : null}

            <section className="space-y-2">
              <h3 className="font-semibold">Itens</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto e especificações</TableHead>
                    <TableHead className="text-right">Qtd.</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(o.items ?? []).map((i) => (
                    <TableRow key={i.id}>
                      <TableCell>
                        <span className="font-medium">{i.product_name}</span>
                        {i.sku ? (
                          <span className="ml-1 text-xs text-muted-foreground">({i.sku})</span>
                        ) : null}
                        {optionLines(i.product_id, i.options).map((line) => (
                          <span key={line} className="block text-xs text-muted-foreground">
                            {line}
                          </span>
                        ))}
                        {i.art_status ? (
                          <span className="block text-xs">Arte: {humanize(i.art_status)}</span>
                        ) : null}
                        {i.notes ? <span className="block text-xs">Obs.: {i.notes}</span> : null}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number(i.quantity).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {brl(Number(i.total_price))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="ml-auto w-full max-w-xs space-y-0.5 tabular-nums">
                <p className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{brl(Number(o.subtotal))}</span>
                </p>
                {Number(o.discount_total) > 0 ? (
                  <p className="flex justify-between text-muted-foreground">
                    <span>Desconto{o.coupon_code ? ` (${o.coupon_code})` : ""}</span>
                    <span>−{brl(Number(o.discount_total))}</span>
                  </p>
                ) : null}
                {Number(o.shipping_cost) > 0 ? (
                  <p className="flex justify-between text-muted-foreground">
                    <span>Frete</span>
                    <span>{brl(Number(o.shipping_cost))}</span>
                  </p>
                ) : null}
                {Number(o.credit_used) > 0 ? (
                  <p className="flex justify-between text-muted-foreground">
                    <span>Crédito usado</span>
                    <span>−{brl(Number(o.credit_used))}</span>
                  </p>
                ) : null}
                <p className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span>{brl(Number(o.total))}</span>
                </p>
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="font-semibold">Arte</h3>
              {arts.length === 0 ? (
                <p className="text-muted-foreground">Nenhum arquivo enviado.</p>
              ) : (
                arts.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-3 rounded-md border p-2"
                  >
                    <div>
                      <p className="font-medium">{a.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        v{a.version} · {humanize(a.status)}
                        {a.is_current ? " · atual" : ""} · {dateTime(a.created_at)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void downloadArt(a.storage_path)}
                    >
                      <Download className="mr-1 h-4 w-4" /> Baixar
                    </Button>
                  </div>
                ))
              )}
            </section>

            <section className="space-y-2">
              <h3 className="font-semibold">Pagamentos</h3>
              {(o.payments ?? []).length === 0 ? (
                <p className="text-muted-foreground">
                  Nenhum pagamento registrado ({humanize(o.payment_method)}).
                </p>
              ) : (
                (o.payments ?? []).map((p) => (
                  <p key={p.id} className="flex justify-between">
                    <span>
                      {humanize(p.method)} · {humanize(p.status)}
                      {p.paid_at ? ` em ${dateTime(p.paid_at)}` : ""}
                    </span>
                    <span className="tabular-nums">{brl(Number(p.amount))}</span>
                  </p>
                ))
              )}
            </section>

            {history.length ? (
              <section className="space-y-1">
                <h3 className="font-semibold">Histórico</h3>
                {history.map((h) => (
                  <p key={h.id} className="text-xs text-muted-foreground">
                    {dateTime(h.created_at)} —{" "}
                    {h.from_status ? `${humanize(h.from_status)} → ` : ""}
                    {humanize(h.to_status)}
                    {h.note ? ` (${h.note})` : ""}
                  </p>
                ))}
              </section>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
