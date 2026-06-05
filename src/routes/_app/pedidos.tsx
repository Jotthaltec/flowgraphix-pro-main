import { createFileRoute } from "@tanstack/react-router";
import { Search, MoreVertical, Loader2, Edit, Trash2 } from "lucide-react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_app/pedidos")({ component: PedidosPage });

function PedidosPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [prodFilter, setProdFilter] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    client_id: "",
    product_name: "",
    quantity: 1,
    total_value: 0,
    deadline: "",
    priority: "normal",
    machine: "offset",
  });

  const { data: clients } = useQuery({
    queryKey: ["clients_list_orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name").order("name");
      if (error) throw error;
      return data;
    }
  });

  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
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

  const filteredData = orders?.filter(item => {
    const matchesSearch = item.order_number.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.clients?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesProd = prodFilter === "all" ? true : item.production_status === prodFilter;
    return matchesSearch && matchesProd;
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: profileData } = await supabase.from('profiles').select('company_id').eq('id', (await supabase.auth.getUser()).data.user?.id || "").single();
      
      if (!profileData?.company_id) throw new Error("Empresa não identificada.");
      
      const { count } = await supabase.from("orders").select("*", { count: "exact", head: true });
      const oNum = `PED-${String((count || 0) + 1).padStart(6, '0')}`;

      const { data: newOrder, error: orderError } = await supabase.from("orders").insert([{ 
        company_id: profileData.company_id,
        client_id: data.client_id,
        order_number: oNum,
        product_desc: `${data.product_name} (x${data.quantity})`,
        total_value: data.total_value,
        deadline: data.deadline,
        priority: data.priority,
        machine_section: data.machine,
        payment_status: 'nao_pago',
        production_status: 'pedido_criado'
      }]).select().single();
      
      if (orderError) throw orderError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Pedido gerado com sucesso! Produção e Financeiro atualizados.");
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err) => {
      toast.error("Erro ao gerar: " + err.message);
    }
  });

  function resetForm() {
    setFormData({ 
      client_id: "", product_name: "", quantity: 1, 
      total_value: 0, deadline: "", priority: "normal", machine: "offset"
    });
  }

  function getFinVariant(status: string) {
    switch(status) {
      case 'pago': return 'success';
      case 'entrada_paga': return 'warning';
      case 'atrasado':
      case 'cancelado': return 'destructive';
      default: return 'default';
    }
  }

  function getProdVariant(status: string) {
    switch(status) {
      case 'entregue':
      case 'finalizado': return 'muted';
      case 'pronto': return 'success';
      case 'arte_em_criacao':
      case 'em_producao': return 'accent';
      case 'em_acabamento': return 'warning';
      default: return 'default';
    }
  }

  return (
    <>
      <PageHeader 
        title="Pedidos" 
        description="Acompanhe todos os pedidos e gerencie a fila de produção e financeiro" 
        action="Novo pedido manual" 
        onAction={() => { resetForm(); setIsModalOpen(true); }}
      />
      <Card className="p-4 mb-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar pedido por número ou cliente..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9" 
            />
          </div>
          <Select value={prodFilter} onValueChange={setProdFilter}>
            <SelectTrigger className="w-full md:w-44"><SelectValue placeholder="Status produção" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="pedido_criado">Pedido Criado</SelectItem>
              <SelectItem value="arte_pendente">Arte Pendente</SelectItem>
              <SelectItem value="em_producao">Em Produção</SelectItem>
              <SelectItem value="pronto">Pronto</SelectItem>
              <SelectItem value="entregue">Entregue</SelectItem>
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
              <TableHead className="hidden md:table-cell">Produto/Serviço</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Financeiro</TableHead>
              <TableHead>Produção</TableHead>
              <TableHead className="hidden md:table-cell">Prazo</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-6"><Loader2 className="mx-auto animate-spin" /></TableCell></TableRow>
            ) : filteredData?.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">Nenhum pedido encontrado.</TableCell></TableRow>
            ) : filteredData?.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono font-semibold text-primary">{p.order_number}</TableCell>
                <TableCell className="font-medium">{p.clients?.name}</TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">{p.product_desc}</TableCell>
                <TableCell className="font-semibold">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.total_value)}
                </TableCell>
                <TableCell><StatusBadge variant={getFinVariant(p.payment_status || "") as any}>{(p.payment_status || "").replace("_", " ")}</StatusBadge></TableCell>
                <TableCell><StatusBadge variant={getProdVariant(p.production_status || "") as any}>{(p.production_status || "").replace("_", " ")}</StatusBadge></TableCell>
                <TableCell className="hidden md:table-cell text-sm">{p.deadline ? new Date(p.deadline).toLocaleDateString('pt-BR') : '-'}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost"><MoreVertical className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => toast.info("Você pode mudar o status na aba Produção e o financeiro na aba Financeiro.")}>
                        Ver detalhes integrados
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
          <DialogHeader><DialogTitle>Novo Pedido Manual</DialogTitle></DialogHeader>
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
              <Label>Produto / Serviço *</Label>
              <Input value={formData.product_name} onChange={(e) => setFormData({...formData, product_name: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Quantidade</Label>
                <Input type="number" min="1" value={formData.quantity} onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value) || 1})} />
              </div>
              <div className="grid gap-2">
                <Label>Valor Total (R$)</Label>
                <Input type="number" min="0" value={formData.total_value} onChange={(e) => setFormData({...formData, total_value: parseFloat(e.target.value) || 0})} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Máquina / Setor</Label>
                <Select value={formData.machine} onValueChange={(val) => setFormData({...formData, machine: val})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="offset">Offset</SelectItem>
                    <SelectItem value="dtf_textil">DTF Têxtil</SelectItem>
                    <SelectItem value="dtf_uv">DTF UV</SelectItem>
                    <SelectItem value="sublimacao">Sublimação</SelectItem>
                    <SelectItem value="acabamento">Acabamento</SelectItem>
                    <SelectItem value="design">Design</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Prioridade</Label>
                <Select value={formData.priority} onValueChange={(val) => setFormData({...formData, priority: val})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Prazo de Entrega</Label>
                <Input type="date" value={formData.deadline} onChange={(e) => setFormData({...formData, deadline: e.target.value})} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button 
              disabled={!formData.client_id || !formData.product_name || saveMutation.isPending} 
              onClick={() => saveMutation.mutate(formData)}
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Criar Pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
