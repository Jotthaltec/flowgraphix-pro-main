import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { Wallet, Clock, CheckCircle2, AlertCircle, CreditCard, Loader2, Edit } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/financeiro")({ component: FinanceiroPage });

function FinanceiroPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);

  const [formData, setFormData] = useState({
    payment_status: ""
  });

  const { data: payments, isLoading } = useQuery({
    queryKey: ["payments_from_orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          order_number,
          product_desc,
          total_value,
          payment_status,
          production_status,
          deadline,
          created_at,
          clients(name)
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!selectedPayment) return;
      
      const { error } = await supabase.from("orders").update({
        payment_status: data.payment_status
      }).eq("id", selectedPayment.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments_from_orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Status de pagamento atualizado com sucesso!");
      setIsModalOpen(false);
    },
    onError: (err) => {
      toast.error("Erro ao atualizar pagamento: " + err.message);
    }
  });

  const handleEdit = (p: any) => {
    setSelectedPayment(p);
    setFormData({
      payment_status: p.payment_status || "nao_pago"
    });
    setIsModalOpen(true);
  };

  const calcCards = () => {
    let totalRecebido = 0;
    let totalPendente = 0;
    let pagos = 0;
    let comEntrada = 0;
    let atrasados = 0;

    payments?.forEach(p => {
      const val = Number(p.total_value) || 0;
      if (p.payment_status === 'pago') {
        totalRecebido += val;
        pagos++;
      } else if (p.payment_status === 'entrada_paga') {
        totalRecebido += val * 0.5;
        totalPendente += val * 0.5;
        comEntrada++;
      } else {
        totalPendente += val;
        if (p.payment_status === 'atrasado') atrasados++;
      }
    });

    return [
      { l: "Total recebido", v: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalRecebido), icon: CheckCircle2, c: "text-success" },
      { l: "Total pendente", v: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPendente), icon: Clock, c: "text-warning-foreground" },
      { l: "Pedidos pagos", v: pagos.toString(), icon: Wallet, c: "text-primary" },
      { l: "Com entrada", v: comEntrada.toString(), icon: CreditCard, c: "text-info" },
      { l: "Em atraso", v: atrasados.toString(), icon: AlertCircle, c: "text-destructive" },
    ];
  };

  const cards = calcCards();

  function getFinVariant(status: string) {
    switch(status) {
      case 'pago': return 'success';
      case 'entrada_paga': return 'warning';
      case 'atrasado':
      case 'cancelado': return 'destructive';
      default: return 'default';
    }
  }

  return (
    <>
      <PageHeader title="Financeiro" description="Controle de recebimentos e pagamentos vinculados aos pedidos" />
      
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {cards.map((c) => (
          <Card key={c.l}><CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] text-muted-foreground">{c.l}</p>
                <p className="text-xl font-bold mt-1">{c.v}</p>
              </div>
              <c.icon className={`h-4 w-4 ${c.c}`} />
            </div>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pedido</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Faturamento Total</TableHead>
              <TableHead className="hidden md:table-cell">Status Financeiro</TableHead>
              <TableHead className="hidden md:table-cell">Status Produção</TableHead>
              <TableHead className="hidden lg:table-cell">Prazo</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-6"><Loader2 className="mx-auto animate-spin" /></TableCell></TableRow>
            ) : payments?.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Nenhum registro financeiro encontrado.</TableCell></TableRow>
            ) : payments?.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono font-semibold text-primary">{r.order_number}</TableCell>
                <TableCell className="font-medium">{r.clients?.name}</TableCell>
                <TableCell className="font-semibold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(r.total_value)}</TableCell>
                <TableCell><StatusBadge variant={getFinVariant(r.payment_status || "") as any}>{(r.payment_status || "").replace("_", " ")}</StatusBadge></TableCell>
                <TableCell className="hidden md:table-cell"><StatusBadge variant="muted">{r.production_status || 'pedido_criado'}</StatusBadge></TableCell>
                <TableCell className="hidden lg:table-cell text-sm">{r.deadline ? new Date(r.deadline).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—'}</TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" onClick={() => handleEdit(r)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Atualizar Status Financeiro</DialogTitle></DialogHeader>
          {selectedPayment && (
            <div className="grid gap-4 py-4">
              <div className="bg-secondary/50 p-3 rounded-md text-sm mb-2">
                <p><strong>Pedido:</strong> {selectedPayment.order_number}</p>
                <p><strong>Cliente:</strong> {selectedPayment.clients?.name}</p>
                <p><strong>Faturamento Total:</strong> {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedPayment.total_value)}</p>
              </div>
              <div className="grid gap-2">
                <Label>Status de Pagamento</Label>
                <Select value={formData.payment_status} onValueChange={(val) => setFormData({...formData, payment_status: val})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nao_pago">Não Pago</SelectItem>
                    <SelectItem value="entrada_paga">Entrada Paga</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="atrasado">Atrasado</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button 
              disabled={updateMutation.isPending} 
              onClick={() => updateMutation.mutate(formData)}
            >
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Atualizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
