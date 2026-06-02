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
import { Input } from "@/components/ui/input";
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
    paid_value: 0,
    payment_method: ""
  });

  const { data: payments, isLoading } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select(`
          *,
          orders(order_number),
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
      
      const total = Number(selectedPayment.total_value) || 0;
      const paid = Number(data.paid_value) || 0;
      const pending = total - paid;
      
      let newStatus = 'nao_pago';
      if (paid >= total) {
        newStatus = 'pago';
      } else if (paid > 0) {
        newStatus = 'entrada_paga';
      } else {
        const isLate = selectedPayment.due_date && new Date(selectedPayment.due_date) < new Date() && new Date(selectedPayment.due_date).toDateString() !== new Date().toDateString();
        if (isLate) newStatus = 'atrasado';
      }

      const { error: paymentError } = await supabase.from("payments").update({
        paid_value: paid,
        pending_value: pending,
        payment_method: data.payment_method,
        status: newStatus
      }).eq("id", selectedPayment.id);
      if (paymentError) throw paymentError;

      const { error: orderError } = await supabase.from("orders").update({
        financial_status: newStatus
      }).eq("id", selectedPayment.order_id);
      if (orderError) throw orderError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] }); // For global consistency
      toast.success("Pagamento atualizado com sucesso!");
      setIsModalOpen(false);
    },
    onError: (err) => {
      toast.error("Erro ao atualizar pagamento: " + err.message);
    }
  });

  const handleEdit = (p: any) => {
    setSelectedPayment(p);
    setFormData({
      paid_value: p.paid_value || 0,
      payment_method: p.payment_method || ""
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
      totalRecebido += Number(p.paid_value) || 0;
      totalPendente += Number(p.pending_value) || 0;
      if (p.status === 'pago') pagos++;
      if (p.status === 'entrada_paga') comEntrada++;
      if (p.status === 'atrasado') atrasados++;
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
              <TableHead>Total</TableHead>
              <TableHead className="hidden md:table-cell">Pago</TableHead>
              <TableHead className="hidden md:table-cell">Pendente</TableHead>
              <TableHead className="hidden lg:table-cell">Forma</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Vencimento</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={9} className="text-center py-6"><Loader2 className="mx-auto animate-spin" /></TableCell></TableRow>
            ) : payments?.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">Nenhum registro financeiro encontrado.</TableCell></TableRow>
            ) : payments?.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono font-semibold text-primary">{r.orders?.order_number}</TableCell>
                <TableCell className="font-medium">{r.clients?.name}</TableCell>
                <TableCell className="font-semibold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(r.total_value)}</TableCell>
                <TableCell className="hidden md:table-cell text-success">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(r.paid_value)}</TableCell>
                <TableCell className="hidden md:table-cell text-destructive">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(r.pending_value)}</TableCell>
                <TableCell className="hidden lg:table-cell text-muted-foreground">{r.payment_method || '—'}</TableCell>
                <TableCell><StatusBadge variant={getFinVariant(r.status) as any}>{r.status.replace("_", " ")}</StatusBadge></TableCell>
                <TableCell className="hidden md:table-cell text-sm">{r.due_date ? new Date(r.due_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—'}</TableCell>
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
          <DialogHeader><DialogTitle>Atualizar Pagamento</DialogTitle></DialogHeader>
          {selectedPayment && (
            <div className="grid gap-4 py-4">
              <div className="bg-secondary/50 p-3 rounded-md text-sm mb-2">
                <p><strong>Pedido:</strong> {selectedPayment.orders?.order_number}</p>
                <p><strong>Cliente:</strong> {selectedPayment.clients?.name}</p>
                <p><strong>Valor Total:</strong> {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedPayment.total_value)}</p>
              </div>
              <div className="grid gap-2">
                <Label>Valor Pago (R$)</Label>
                <Input 
                  type="number" 
                  min="0" 
                  step="0.01" 
                  max={selectedPayment.total_value}
                  value={formData.paid_value} 
                  onChange={(e) => setFormData({...formData, paid_value: parseFloat(e.target.value) || 0})} 
                />
              </div>
              <div className="grid gap-2">
                <Label>Forma de Pagamento</Label>
                <Select value={formData.payment_method} onValueChange={(val) => setFormData({...formData, payment_method: val})}>
                  <SelectTrigger><SelectValue placeholder="Ex: PIX, Cartão, Boleto" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PIX">PIX</SelectItem>
                    <SelectItem value="Cartão de Crédito">Cartão de Crédito</SelectItem>
                    <SelectItem value="Cartão de Débito">Cartão de Débito</SelectItem>
                    <SelectItem value="Boleto">Boleto</SelectItem>
                    <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="Transferência">Transferência</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="text-sm text-muted-foreground mt-2">
                Valor Restante: <span className="font-bold text-destructive">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedPayment.total_value - formData.paid_value)}
                </span>
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
