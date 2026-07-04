import { createFileRoute } from "@tanstack/react-router";
import { Search, Loader2, ShoppingCart, ExternalLink, Package, Truck, Store, CreditCard } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ComprarDialog } from "@/components/purchase/comprar-dialog";

export const Route = createFileRoute("/_app/pedidos-compra")({ component: PedidosCompraPage });

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Fluxo de status do pedido de compra, em ordem. */
const STATUS: { value: string; label: string; variant: "default" | "info" | "accent" | "success" | "destructive" }[] = [
  { value: "rascunho", label: "Rascunho", variant: "default" },
  { value: "pronto_para_compra", label: "Pronto p/ compra", variant: "info" },
  { value: "comprado", label: "Comprado", variant: "accent" },
  { value: "recebido", label: "Recebido", variant: "success" },
  { value: "cancelado", label: "Cancelado", variant: "destructive" },
];

function statusMeta(value: string) {
  return STATUS.find((s) => s.value === value) ?? STATUS[0];
}

type POItem = {
  id: string;
  product_name: string;
  source_url: string | null;
  supplier_sku: string | null;
  quantity: number;
  unit_cost: number;
  total_cost: number;
};

type PurchaseOrder = {
  id: string;
  po_number: string;
  status: string;
  supplier_id: string | null;
  receiving_mode: string | null;
  total_cost: number;
  created_at: string;
  delivery_snapshot: Record<string, any> | null;
  suppliers: { name: string; website_url: string | null } | null;
  orders: { order_number: string } | null;
  purchase_order_items: POItem[];
  supplier_order_number: string | null;
  actual_cost: number | null;
  purchased_at: string | null;
  expected_delivery: string | null;
  tracking_code: string | null;
  purchase_notes: string | null;
};

function PedidosCompraPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [detail, setDetail] = useState<PurchaseOrder | null>(null);
  const [buying, setBuying] = useState<PurchaseOrder | null>(null);

  const { data: pos, isLoading } = useQuery({
    queryKey: ["purchase_orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select(`
          id, po_number, status, supplier_id, receiving_mode, total_cost, created_at, delivery_snapshot,
          supplier_order_number, actual_cost, purchased_at, expected_delivery, tracking_code, purchase_notes,
          suppliers:supplier_id (name, website_url),
          orders:order_id (order_number),
          purchase_order_items (*)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as PurchaseOrder[];
    },
    enabled: !!profile,
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("purchase_orders").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      toast.success("Status do pedido de compra atualizado.");
    },
    onError: (err: any) => toast.error("Erro ao atualizar: " + err.message),
  });

  const filtered = pos?.filter((po) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      po.po_number.toLowerCase().includes(q) ||
      (po.suppliers?.name || "").toLowerCase().includes(q) ||
      (po.orders?.order_number || "").toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" ? true : po.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <>
      <PageHeader
        title="Pedidos de Compra"
        description="Compras aos fornecedores geradas a partir dos pedidos convertidos — agrupadas por fornecedor"
      />

      <Card className="p-4 mb-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por PC, fornecedor ou pedido..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-52"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              {STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PC</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead className="hidden md:table-cell">Pedido</TableHead>
              <TableHead className="hidden md:table-cell">Recebimento</TableHead>
              <TableHead>Itens</TableHead>
              <TableHead>Custo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Criado</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={9} className="text-center py-6"><Loader2 className="mx-auto animate-spin" /></TableCell></TableRow>
            ) : !filtered?.length ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                  <ShoppingCart className="mx-auto h-8 w-8 mb-2 opacity-40" />
                  Nenhum pedido de compra ainda. Eles são gerados ao converter um orçamento com itens de fornecedor em pedido.
                </TableCell>
              </TableRow>
            ) : filtered.map((po) => {
              const meta = statusMeta(po.status);
              return (
                <TableRow key={po.id}>
                  <TableCell className="font-mono font-semibold text-primary">{po.po_number}</TableCell>
                  <TableCell className="font-medium">{po.suppliers?.name || "—"}</TableCell>
                  <TableCell className="hidden md:table-cell font-mono text-sm text-muted-foreground">{po.orders?.order_number || "—"}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm">
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      {po.receiving_mode === "pickup" ? <><Store className="h-3.5 w-3.5" /> Retirada</> : <><Truck className="h-3.5 w-3.5" /> Entrega</>}
                    </span>
                  </TableCell>
                  <TableCell>{po.purchase_order_items?.length || 0}</TableCell>
                  <TableCell className="font-semibold">{fmt.format(po.total_cost || 0)}</TableCell>
                  <TableCell>
                    <Select value={po.status} onValueChange={(status) => statusMutation.mutate({ id: po.id, status })}>
                      <SelectTrigger className="h-8 w-auto border-0 bg-transparent p-0 gap-1 [&>svg]:opacity-50">
                        <StatusBadge variant={meta.variant}>{meta.label}</StatusBadge>
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{new Date(po.created_at).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-0.5">
                      <Button size="icon" variant="ghost" onClick={() => setBuying(po)} title="Comprar no fornecedor">
                        <CreditCard className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setDetail(po)} title="Ver itens e destino">
                        <Package className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="font-mono">{detail?.po_number}</span>
              <span className="text-muted-foreground font-normal text-sm">· {detail?.suppliers?.name}</span>
            </DialogTitle>
          </DialogHeader>

          {detail && (
            <div className="space-y-5">
              {/* Destino da compra (snapshot) */}
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <p className="font-medium mb-1 flex items-center gap-1.5">
                  {detail.receiving_mode === "pickup" ? <Store className="h-4 w-4" /> : <Truck className="h-4 w-4" />}
                  {detail.receiving_mode === "pickup" ? "Retirada no fornecedor" : "Entrega"}
                </p>
                <DeliverySnapshot snapshot={detail.delivery_snapshot} mode={detail.receiving_mode} />
              </div>

              {/* Itens */}
              <div>
                <p className="text-sm font-medium mb-2">Itens ({detail.purchase_order_items?.length || 0})</p>
                <div className="space-y-2">
                  {detail.purchase_order_items?.map((it) => (
                    <div key={it.id} className="flex items-center gap-3 rounded-lg border p-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{it.product_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {it.quantity} × {fmt.format(it.unit_cost)} = <span className="font-medium">{fmt.format(it.total_cost)}</span>
                          {it.supplier_sku ? ` · SKU ${it.supplier_sku}` : ""}
                        </p>
                      </div>
                      {it.source_url && (
                        <Button size="sm" variant="outline" asChild>
                          <a href={it.source_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Abrir no fornecedor
                          </a>
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between border-t pt-3">
                <span className="text-sm text-muted-foreground">Custo total do pedido de compra</span>
                <span className="text-lg font-semibold">{fmt.format(detail.total_cost || 0)}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ComprarDialog
        po={buying}
        companyId={profile?.company_id ?? ""}
        open={!!buying}
        onOpenChange={(o) => !o && setBuying(null)}
      />
    </>
  );
}

function DeliverySnapshot({ snapshot, mode }: { snapshot: Record<string, any> | null; mode: string | null }) {
  if (!snapshot) return <p className="text-muted-foreground">Sem detalhes de destino.</p>;
  if (mode === "pickup") {
    return <p className="text-muted-foreground">{snapshot.pickup_point || "Ponto de retirada não definido."}</p>;
  }
  const line2 = [snapshot.neighborhood, snapshot.city, snapshot.state].filter(Boolean).join(" · ");
  return (
    <div className="text-muted-foreground leading-relaxed">
      {snapshot.recipient && <p className="text-foreground font-medium">{snapshot.recipient}</p>}
      <p>
        {[snapshot.address, snapshot.number].filter(Boolean).join(", ")}
        {snapshot.complement ? ` — ${snapshot.complement}` : ""}
      </p>
      {line2 && <p>{line2}</p>}
      {snapshot.zip && <p>CEP {snapshot.zip}</p>}
      {snapshot.phone && <p>Tel. {snapshot.phone}</p>}
    </div>
  );
}
