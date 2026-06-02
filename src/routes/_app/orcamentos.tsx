import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search, Filter, MoreVertical, Loader2, FilePlus2, CheckCircle2, XCircle, FileSignature } from "lucide-react";
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
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_app/orcamentos")({ component: OrcamentosPage });

function OrcamentosPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    client_id: "",
    service_name: "",
    cost_value: 0,
    sale_value: 0,
    discount_value: 0,
    final_value: 0,
    estimated_profit: 0,
    margin_percent: 0,
    status: "rascunho"
  });

  // Calculate final values when cost, sale, or discount changes
  useEffect(() => {
    const sale = Number(formData.sale_value) || 0;
    const discount = Number(formData.discount_value) || 0;
    const cost = Number(formData.cost_value) || 0;

    const final = sale - discount;
    const profit = final - cost;
    const margin = final > 0 ? (profit / final) * 100 : 0;

    setFormData(prev => ({
      ...prev,
      final_value: final,
      estimated_profit: profit,
      margin_percent: Number(margin.toFixed(2))
    }));
  }, [formData.sale_value, formData.discount_value, formData.cost_value]);

  const { data: clients } = useQuery({
    queryKey: ["clients_list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!profile,
  });

  const { data: quotes, isLoading } = useQuery({
    queryKey: ["quotes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select(`
          *,
          clients:client_id (name)
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile,
  });

  const filteredData = quotes?.filter(item => {
    const matchesSearch = item.quote_number.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.clients?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" ? true : item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: profileData } = await supabase.from('profiles').select('company_id').eq('id', (await supabase.auth.getUser()).data.user?.id).single();
      
      // Generate Quote Number
      const { count } = await supabase.from("quotes").select("*", { count: "exact", head: true });
      const qNum = `ORC-${String((count || 0) + 1).padStart(6, '0')}`;

      const { error } = await supabase.from("quotes").insert([{ 
        ...data, 
        company_id: profileData?.company_id,
        quote_number: qNum
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast.success("Orçamento gerado!");
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err) => {
      toast.error("Erro ao gerar: " + err.message);
    }
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const { error } = await supabase.from("quotes").update({ status }).eq("id", id);
      if (error) throw error;
      
      if (status === 'convertido_pedido') {
        toast.info("Em breve: Criação de pedido automático e redirecionamento.");
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast.success(`Orçamento marcado como ${variables.status.replace("_", " ")}`);
    },
    onError: (err) => toast.error("Erro ao alterar: " + err.message)
  });

  function resetForm() {
    setFormData({ 
      client_id: "", service_name: "", cost_value: 0, 
      sale_value: 0, discount_value: 0, final_value: 0, 
      estimated_profit: 0, margin_percent: 0, status: "rascunho" 
    });
  }

  function getStatusVariant(status: string) {
    switch(status) {
      case 'aprovado': return 'success';
      case 'convertido_pedido': return 'info';
      case 'aguardando_cliente':
      case 'enviado': return 'warning';
      case 'recusado':
      case 'vencido': return 'destructive';
      default: return 'default';
    }
  }

  return (
    <>
      <PageHeader 
        title="Orçamentos" 
        description="Crie, envie e acompanhe orçamentos" 
        action="Novo orçamento" 
        onAction={() => { resetForm(); setIsModalOpen(true); }}
      />
      
      <Card className="p-4 mb-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por número ou cliente..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9" 
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-44"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="rascunho">Rascunho</SelectItem>
              <SelectItem value="enviado">Enviado</SelectItem>
              <SelectItem value="aguardando_cliente">Aguardando cliente</SelectItem>
              <SelectItem value="aprovado">Aprovado</SelectItem>
              <SelectItem value="recusado">Recusado</SelectItem>
              <SelectItem value="convertido_pedido">Convertido</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="hidden md:table-cell">Serviço</TableHead>
              <TableHead>Valor Final</TableHead>
              <TableHead className="hidden lg:table-cell">Lucro</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-6"><Loader2 className="mx-auto animate-spin" /></TableCell></TableRow>
            ) : filteredData?.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Nenhum orçamento encontrado.</TableCell></TableRow>
            ) : filteredData?.map((q) => (
              <TableRow key={q.id}>
                <TableCell className="font-mono font-semibold text-primary">{q.quote_number}</TableCell>
                <TableCell className="font-medium">{q.clients?.name}</TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">{q.service_name}</TableCell>
                <TableCell className="font-semibold">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(q.final_value)}
                </TableCell>
                <TableCell className="hidden lg:table-cell text-success font-medium">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(q.estimated_profit)}
                </TableCell>
                <TableCell><StatusBadge variant={getStatusVariant(q.status) as any}>{q.status.replace("_", " ")}</StatusBadge></TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost"><MoreVertical className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => statusMutation.mutate({ id: q.id, status: 'aprovado' })}>
                        <CheckCircle2 className="h-4 w-4 mr-2 text-success" /> Aprovar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => statusMutation.mutate({ id: q.id, status: 'recusado' })}>
                        <XCircle className="h-4 w-4 mr-2 text-destructive" /> Recusar
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        disabled={q.status !== 'aprovado'}
                        onClick={() => statusMutation.mutate({ id: q.id, status: 'convertido_pedido' })}
                      >
                        <FilePlus2 className="h-4 w-4 mr-2" /> Converter p/ Pedido
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        disabled={q.status !== 'aprovado'}
                        onClick={() => toast.info("Geração de contrato será implementada no módulo Contratos.")}
                      >
                        <FileSignature className="h-4 w-4 mr-2" /> Gerar Contrato
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Novo Orçamento</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Cliente *</Label>
              <Select value={formData.client_id} onValueChange={(val) => setFormData({...formData, client_id: val})}>
                <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                <SelectContent>
                  {clients?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Serviço/Produto *</Label>
              <Input value={formData.service_name} onChange={(e) => setFormData({...formData, service_name: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Custo de Produção (R$)</Label>
                <Input type="number" min="0" value={formData.cost_value} onChange={(e) => setFormData({...formData, cost_value: parseFloat(e.target.value) || 0})} />
              </div>
              <div className="grid gap-2">
                <Label>Valor de Venda Base (R$)</Label>
                <Input type="number" min="0" value={formData.sale_value} onChange={(e) => setFormData({...formData, sale_value: parseFloat(e.target.value) || 0})} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Desconto (R$)</Label>
                <Input type="number" min="0" value={formData.discount_value} onChange={(e) => setFormData({...formData, discount_value: parseFloat(e.target.value) || 0})} />
              </div>
            </div>
            <div className="p-3 bg-secondary/50 rounded-md grid grid-cols-2 gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Valor Final</p>
                <p className="font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(formData.final_value)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Lucro Esperado</p>
                <p className="font-bold text-success">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(formData.estimated_profit)} ({formData.margin_percent}%)</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button 
              disabled={!formData.client_id || !formData.service_name || saveMutation.isPending} 
              onClick={() => saveMutation.mutate(formData)}
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
