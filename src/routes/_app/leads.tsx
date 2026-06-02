import { createFileRoute } from "@tanstack/react-router";
import { Search, Star, MapPin, Phone, MoreVertical, Loader2, Edit, Trash2, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_app/leads")({ component: LeadsPage });

const CATEGORIES = ["Restaurantes", "Pizzarias", "Barbearias", "Salões de beleza", "Escolas", "Clínicas", "Mercados", "Lojas de roupas", "Academias", "Igrejas", "Escritórios", "Pet shops"];

function LeadsPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<any>(null);

  const [formData, setFormData] = useState({
    company_name: "",
    category: "",
    address: "",
    phone: "",
    rating: 0,
    status: "novo",
    source: "manual"
  });

  const { data: leads, isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile,
  });

  const filteredData = leads?.filter(item => {
    return item.company_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
           (item.category && item.category.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: profileData } = await supabase.from('profiles').select('company_id').eq('id', (await supabase.auth.getUser()).data.user?.id).single();
      
      if (editingLead) {
        const { error } = await supabase.from("leads").update(data).eq("id", editingLead.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("leads").insert([{ ...data, company_id: profileData?.company_id }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success(editingLead ? "Lead atualizado!" : "Lead criado!");
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err) => {
      toast.error("Erro ao salvar lead: " + err.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead removido!");
    },
    onError: (err) => toast.error("Erro ao remover lead: " + err.message)
  });

  const convertToClientMutation = useMutation({
    mutationFn: async (lead: any) => {
      const { data: profileData } = await supabase.from('profiles').select('company_id').eq('id', (await supabase.auth.getUser()).data.user?.id).single();
      
      // Insert into clients
      const { error: clientErr } = await supabase.from("clients").insert([{
        company_id: profileData?.company_id,
        name: lead.company_name,
        company_name: lead.company_name,
        whatsapp: lead.phone,
        address: lead.address,
        client_type: 'pessoa_juridica',
        status: 'novo'
      }]);
      if (clientErr) throw clientErr;

      // Update lead status
      const { error: leadErr } = await supabase.from("leads").update({ status: 'fechado' }).eq("id", lead.id);
      if (leadErr) throw leadErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Lead convertido em Cliente!");
    },
    onError: (err) => toast.error("Erro na conversão: " + err.message)
  });

  function resetForm() {
    setEditingLead(null);
    setFormData({ company_name: "", category: "", address: "", phone: "", rating: 0, status: "novo", source: "manual" });
  }

  function handleEdit(lead: any) {
    setEditingLead(lead);
    setFormData({
      company_name: lead.company_name,
      category: lead.category || "",
      address: lead.address || "",
      phone: lead.phone || "",
      rating: lead.rating || 0,
      status: lead.status || "novo",
      source: lead.source || "manual"
    });
    setIsModalOpen(true);
  }

  const handleGoogleMapsSearch = () => {
    toast.info("A busca no Google Maps via Edge Function requer configuração da Chave de API do GCP no painel do Supabase. A funcionalidade está desativada no momento.", { duration: 5000 });
  };

  function getStatusVariant(status: string) {
    switch(status) {
      case 'fechado': return 'success';
      case 'contatado': return 'info';
      case 'interessado':
      case 'orcamento_enviado': return 'warning';
      case 'perdido': return 'destructive';
      default: return 'default';
    }
  }

  return (
    <>
      <PageHeader 
        title="Leads" 
        description="Gerencie contatos e potenciais clientes" 
        action="Novo lead manual" 
        onAction={() => { resetForm(); setIsModalOpen(true); }}
      />
      
      <Card className="p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-4 relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Cidade ou bairro para busca (G.Maps)" 
              className="pl-9" 
              defaultValue="São Paulo, SP" 
            />
          </div>
          <div className="md:col-span-2"><Input placeholder="Raio (km)" defaultValue="5" /></div>
          <div className="md:col-span-3">
            <Select defaultValue="Restaurantes">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button className="md:col-span-3" onClick={handleGoogleMapsSearch}>
            <Search className="h-4 w-4 mr-1" /> Buscar leads via API
          </Button>
        </div>
      </Card>

      <Card className="mb-4">
        <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative flex-1 w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Filtrar tabela..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9" 
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.slice(0, 5).map((c) => (
              <button key={c} onClick={() => setSearchTerm(c)} className="text-xs px-3 py-1.5 rounded-full bg-secondary hover:bg-primary hover:text-primary-foreground transition-colors">{c}</button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="hidden lg:table-cell">Endereço</TableHead>
              <TableHead className="hidden md:table-cell">Telefone</TableHead>
              <TableHead>Avaliação</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-6"><Loader2 className="mx-auto animate-spin" /></TableCell></TableRow>
            ) : filteredData?.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Nenhum lead encontrado.</TableCell></TableRow>
            ) : filteredData?.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">{l.company_name}</TableCell>
                <TableCell><StatusBadge variant="muted">{l.category || '-'}</StatusBadge></TableCell>
                <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">{l.address || '-'}</TableCell>
                <TableCell className="hidden md:table-cell text-sm"><Phone className="inline h-3 w-3 mr-1 text-muted-foreground" />{l.phone || '-'}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1 text-sm">
                    {l.rating > 0 ? <><Star className="h-3.5 w-3.5 fill-warning text-warning" />{l.rating}</> : '-'}
                  </span>
                </TableCell>
                <TableCell><StatusBadge variant={getStatusVariant(l.status) as any}>{l.status.replace("_", " ")}</StatusBadge></TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost"><MoreVertical className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(l)}>
                        <Edit className="h-4 w-4 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        disabled={l.status === 'fechado'}
                        onClick={() => convertToClientMutation.mutate(l)}
                      >
                        <Plus className="h-4 w-4 mr-2" /> Converter p/ Cliente
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-destructive focus:text-destructive"
                        onClick={() => {
                          if(confirm("Tem certeza que deseja remover este lead?")) deleteMutation.mutate(l.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> Remover
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
          <DialogHeader><DialogTitle>{editingLead ? "Editar Lead" : "Novo Lead"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Nome da Empresa *</Label>
              <Input value={formData.company_name} onChange={(e) => setFormData({...formData, company_name: e.target.value})} />
            </div>
            <div className="grid gap-2">
              <Label>Categoria</Label>
              <Input placeholder="Ex: Pizzaria, Escola..." value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Telefone / WhatsApp</Label>
                <Input value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
              </div>
              <div className="grid gap-2">
                <Label>Avaliação (0-5)</Label>
                <Input type="number" step="0.1" min="0" max="5" value={formData.rating} onChange={(e) => setFormData({...formData, rating: parseFloat(e.target.value) || 0})} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Endereço</Label>
              <Input value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} />
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(val) => setFormData({...formData, status: val})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="novo">Novo</SelectItem>
                  <SelectItem value="contatado">Contatado</SelectItem>
                  <SelectItem value="interessado">Interessado</SelectItem>
                  <SelectItem value="orcamento_enviado">Orçamento Enviado</SelectItem>
                  <SelectItem value="fechado">Fechado</SelectItem>
                  <SelectItem value="perdido">Perdido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button 
              disabled={!formData.company_name || saveMutation.isPending} 
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
