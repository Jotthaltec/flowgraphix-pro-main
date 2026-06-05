import { createFileRoute } from "@tanstack/react-router";
import { Search, Download, Send, MoreVertical, Loader2, Edit, Trash2 } from "lucide-react";
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
import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_app/contratos")({ component: ContratosPage });

function ContratosPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<any>(null);

  const [formData, setFormData] = useState({
    client_id: "",
    service_description: "",
    total_value: 0,
    upfront_value: 0,
    payment_method: "",
    delivery_date: "",
    status: "rascunho"
  });

  const { data: clients } = useQuery({
    queryKey: ["clients_list_contracts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name, document, address").order("name");
      if (error) throw error;
      return data;
    }
  });

  const { data: contracts, isLoading } = useQuery({
    queryKey: ["contracts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select(`
          *,
          clients:client_id (name, document, address)
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile,
  });

  const filteredData = contracts?.filter(item => {
    const matchesSearch = item.contract_number.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.clients?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" ? true : item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: profileData } = await supabase.from('profiles').select('company_id').eq('user_id', (await supabase.auth.getUser()).data.user?.id || "").single();
      
      if (!profileData?.company_id) throw new Error("Empresa não identificada.");
      
      const { count } = await supabase.from("contracts").select("*", { count: "exact", head: true });
      const cNum = `CTR-${String((count || 0) + 1).padStart(6, '0')}`;

      const { error } = await supabase.from("contracts").insert([{ 
        company_id: profileData.company_id,
        client_id: data.client_id,
        contract_number: cNum,
        total_value: data.total_value,
        down_payment: data.upfront_value,
        payment_method: data.payment_method,
        delivery_date: data.delivery_date,
        status: data.status,
        notes: data.service_description,
        approval_terms: "1. O contratante concorda com as artes enviadas. \n2. Cancelamentos terão multa de 20%.\n3. O prazo inicia após a aprovação da arte final e pagamento da entrada."
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      toast.success("Contrato criado!");
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err) => {
      toast.error("Erro ao gerar: " + err.message);
    }
  });

  function resetForm() {
    setFormData({ 
      client_id: "", service_description: "", total_value: 0, 
      upfront_value: 0, payment_method: "", delivery_date: "", status: "rascunho" 
    });
  }

  function getStatusVariant(status: string) {
    switch(status) {
      case 'assinado': return 'success';
      case 'finalizado': return 'muted';
      case 'aguardando_assinatura':
      case 'enviado': return 'warning';
      case 'cancelado': return 'destructive';
      default: return 'default';
    }
  }

  const handlePrint = (contract: any) => {
    setSelectedContract(contract);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #printable-contract, #printable-contract * { visibility: visible; }
          #printable-contract { position: absolute; left: 0; top: 0; width: 100%; padding: 40px; }
          .no-print { display: none !important; }
        }
      `}</style>
      <PageHeader 
        title="Contratos" 
        description="Documentos formais entre você e seus clientes" 
        action="Novo contrato" 
        onAction={() => { resetForm(); setIsModalOpen(true); }}
      />
      
      <div className="no-print">
        <Card className="p-4 mb-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por cliente ou número..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9" 
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="rascunho">Rascunho</SelectItem>
                <SelectItem value="enviado">Enviado</SelectItem>
                <SelectItem value="aguardando_assinatura">Aguardando assinatura</SelectItem>
                <SelectItem value="assinado">Assinado</SelectItem>
                <SelectItem value="finalizado">Finalizado</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="hidden md:table-cell">Serviço</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead className="hidden lg:table-cell">Entrega</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-6"><Loader2 className="mx-auto animate-spin" /></TableCell></TableRow>
                ) : filteredData?.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Nenhum contrato encontrado.</TableCell></TableRow>
                ) : filteredData?.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => setSelectedContract(c)}>
                    <TableCell className="font-mono font-semibold text-primary">{c.contract_number}</TableCell>
                    <TableCell className="font-medium">{c.clients?.name}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">{c.notes}</TableCell>
                    <TableCell className="font-semibold">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c.total_value)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{c.delivery_date}</TableCell>
                    <TableCell><StatusBadge variant={getStatusVariant(c.status || "") as any}>{(c.status || "").replace("_", " ")}</StatusBadge></TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); handlePrint(c); }}>
                        <Download className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold mb-3">Pré-visualização</h3>
            <div className="rounded-lg border-2 border-dashed border-border bg-secondary/40 p-6 min-h-[400px]">
              {selectedContract ? (
                <>
                  <div className="text-center text-xs uppercase tracking-wider text-muted-foreground mb-4">Contrato {selectedContract.contract_number}</div>
                  <div className="bg-card rounded p-4 text-xs space-y-2 shadow-sm whitespace-pre-wrap">
                    <p className="font-bold text-center text-sm mb-2">CONTRATO DE PRESTAÇÃO DE SERVIÇOS GRÁFICOS</p>
                    <p className="text-muted-foreground"><strong>Contratante:</strong> {selectedContract.clients?.name}</p>
                    <p className="text-muted-foreground"><strong>Documento:</strong> {selectedContract.clients?.document || 'Não informado'}</p>
                    <p className="text-muted-foreground"><strong>Objeto:</strong> {selectedContract.notes}</p>
                    <p className="text-muted-foreground"><strong>Valor Total:</strong> {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedContract.total_value)}</p>
                    <p className="text-muted-foreground"><strong>Data de Entrega:</strong> {selectedContract.delivery_date}</p>
                    <p className="text-muted-foreground pt-2"><strong>Termos:</strong></p>
                    <p className="text-muted-foreground line-clamp-4">{selectedContract.approval_terms}</p>
                  </div>
                </>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground text-center">
                  Selecione um contrato na tabela para visualizar ou imprimir
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" size="sm" className="flex-1" disabled={!selectedContract} onClick={() => handlePrint(selectedContract)}>
                <Download className="h-3.5 w-3.5 mr-1" /> Imprimir / PDF
              </Button>
              <Button size="sm" className="flex-1" disabled={!selectedContract} onClick={() => toast.info("Integração de envio via WhatsApp/Email em breve.")}>
                <Send className="h-3.5 w-3.5 mr-1" /> Enviar
              </Button>
            </div>
          </Card>
        </div>

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader><DialogTitle>Novo Contrato Manual</DialogTitle></DialogHeader>
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
                <Label>Serviço Contratado *</Label>
                <Input value={formData.service_description} onChange={(e) => setFormData({...formData, service_description: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Valor Total (R$)</Label>
                  <Input type="number" min="0" value={formData.total_value} onChange={(e) => setFormData({...formData, total_value: parseFloat(e.target.value) || 0})} />
                </div>
                <div className="grid gap-2">
                  <Label>Entrada (R$)</Label>
                  <Input type="number" min="0" value={formData.upfront_value} onChange={(e) => setFormData({...formData, upfront_value: parseFloat(e.target.value) || 0})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Prazo / Data Entrega</Label>
                  <Input type="date" value={formData.delivery_date} onChange={(e) => setFormData({...formData, delivery_date: e.target.value})} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
              <Button 
                disabled={!formData.client_id || !formData.service_description || saveMutation.isPending} 
                onClick={() => saveMutation.mutate(formData)}
              >
                {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Gerar Contrato
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Printable Area (Hidden normally, visible only in print mode via CSS) */}
      {selectedContract && (
        <div id="printable-contract" className="hidden">
          <div style={{ maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif', lineHeight: '1.6' }}>
            <h1 style={{ textAlign: 'center', fontSize: '24px', marginBottom: '20px' }}>CONTRATO DE PRESTAÇÃO DE SERVIÇOS GRÁFICOS</h1>
            <p style={{ textAlign: 'right' }}><strong>Contrato Nº:</strong> {selectedContract.contract_number}</p>
            
            <h3 style={{ marginTop: '30px', borderBottom: '1px solid #ccc' }}>1. AS PARTES</h3>
            <p><strong>Contratante:</strong> {selectedContract.clients?.name}</p>
            <p><strong>Documento:</strong> {selectedContract.clients?.document || 'Não informado'}</p>
            <p><strong>Endereço:</strong> {selectedContract.clients?.address || 'Não informado'}</p>

            <h3 style={{ marginTop: '30px', borderBottom: '1px solid #ccc' }}>2. DO OBJETO</h3>
            <p>A Contratada se obriga a prestar os seguintes serviços gráficos: <strong>{selectedContract.notes}</strong>.</p>

            <h3 style={{ marginTop: '30px', borderBottom: '1px solid #ccc' }}>3. DO VALOR E FORMA DE PAGAMENTO</h3>
            <p>Pelo serviço descrito, o Contratante pagará o valor total de <strong>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedContract.total_value)}</strong>.</p>
            <p>Sendo um valor de entrada de <strong>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedContract.down_payment || 0)}</strong> acordado entre as partes.</p>

            <h3 style={{ marginTop: '30px', borderBottom: '1px solid #ccc' }}>4. DO PRAZO</h3>
            <p>O prazo acordado para entrega é: <strong>{selectedContract.delivery_date || 'A combinar'}</strong>.</p>

            <h3 style={{ marginTop: '30px', borderBottom: '1px solid #ccc' }}>5. TERMOS GERAIS</h3>
            <p style={{ whiteSpace: 'pre-wrap' }}>{selectedContract.approval_terms}</p>

            <div style={{ marginTop: '80px', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ width: '45%', textAlign: 'center', borderTop: '1px solid black', paddingTop: '10px' }}>
                <p><strong>A GRÁFICA</strong></p>
                <p>Contratada</p>
              </div>
              <div style={{ width: '45%', textAlign: 'center', borderTop: '1px solid black', paddingTop: '10px' }}>
                <p><strong>{selectedContract.clients?.name}</strong></p>
                <p>Contratante</p>
              </div>
            </div>
            <div style={{ textAlign: 'center', marginTop: '40px', fontSize: '12px', color: '#666' }}>
              Gerado via PrintFlow CRM em {new Date().toLocaleDateString('pt-BR')}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
