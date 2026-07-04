import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/status-badge";
import { 
  Plus, Loader2, Globe, Building2, Mail, Phone, 
  Settings, Save, Trash2, Edit3, ShieldCheck, CheckSquare, UserCog
} from "lucide-react";
import { toast } from "sonner";
import { PerfisForncedores } from "@/components/hub/perfis-fornecedores";

export function CatalogoFornecedores() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [openModal, setOpenModal] = useState(false);
  
  // Estados para formulário
  const [editingId, setEditingId] = useState<string | null>(null);
  const [supplierName, setSupplierName] = useState("");
  const [supplierDomain, setSupplierDomain] = useState("");
  const [supplierUrl, setSupplierUrl] = useState("");
  const [supplierEmail, setSupplierEmail] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [supplierNotes, setSupplierNotes] = useState("");
  const [supplierMargin, setSupplierMargin] = useState(50);
  const [supplierStatus, setSupplierStatus] = useState("Ativo");

  // Busca fornecedores
  const { data: suppliers = [], isLoading: isLoadingSuppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // Busca itens do catálogo autorizado
  const { data: catalogItems = [], isLoading: isLoadingCatalog } = useQuery({
    queryKey: ["catalog-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_catalog_items")
        .select(`
          *,
          suppliers:supplier_id (name)
        `)
        .order("name", { ascending: true });
      if (error) throw error;
      return data;
    }
  });

  // Mutação para Salvar Fornecedor
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Usuário não autenticado.");
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();
      
      if (!profile?.company_id) throw new Error("Empresa do usuário não identificada.");

      const supplierData = {
        company_id: profile.company_id,
        name: supplierName,
        domain: supplierDomain || null,
        website_url: supplierUrl || null,
        contact_email: supplierEmail || null,
        contact_phone: supplierPhone || null,
        notes: supplierNotes || null,
        default_margin: supplierMargin,
        status: supplierStatus
      };

      let res;
      if (editingId) {
        res = await supabase
          .from("suppliers")
          .update(supplierData)
          .eq("id", editingId)
          .select()
          .single();
      } else {
        res = await supabase
          .from("suppliers")
          .insert(supplierData)
          .select()
          .single();
      }

      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      toast.success(editingId ? "Fornecedor atualizado!" : "Fornecedor cadastrado!");
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setOpenModal(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(`Erro ao salvar: ${err.message}`);
    }
  });

  // Mutação para Deletar Fornecedor
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("suppliers")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fornecedor removido com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: (err: any) => {
      toast.error(`Erro ao deletar: ${err.message}`);
    }
  });

  const resetForm = () => {
    setEditingId(null);
    setSupplierName("");
    setSupplierDomain("");
    setSupplierUrl("");
    setSupplierEmail("");
    setSupplierPhone("");
    setSupplierNotes("");
    setSupplierMargin(50);
    setSupplierStatus("Ativo");
  };

  const handleEdit = (s: any) => {
    setEditingId(s.id);
    setSupplierName(s.name);
    setSupplierDomain(s.domain || "");
    setSupplierUrl(s.website_url || "");
    setSupplierEmail(s.contact_email || "");
    setSupplierPhone(s.contact_phone || "");
    setSupplierNotes(s.notes || "");
    setSupplierMargin(s.default_margin || 50);
    setSupplierStatus(s.status || "Ativo");
    setOpenModal(true);
  };

  return (
    <Tabs defaultValue="fornecedores" className="w-full">
      <div className="flex justify-between items-center mb-4">
        <TabsList className="bg-muted p-1 rounded-lg">
          <TabsTrigger value="fornecedores" className="flex items-center gap-1.5 text-xs md:text-sm">
            <Building2 className="h-4 w-4" /> Fornecedores Vinculados
          </TabsTrigger>
          <TabsTrigger value="perfis" className="flex items-center gap-1.5 text-xs md:text-sm">
            <UserCog className="h-4 w-4 text-violet-500" /> Perfis de Conta
          </TabsTrigger>
          <TabsTrigger value="catalogo" className="flex items-center gap-1.5 text-xs md:text-sm">
            <ShieldCheck className="h-4 w-4" /> Catálogo Autorizado (API)
          </TabsTrigger>
        </TabsList>

        <Dialog open={openModal} onOpenChange={(val) => { setOpenModal(val); if(!val) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="flex items-center gap-1">
              <Plus className="h-4 w-4" /> Novo Fornecedor
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Fornecedor" : "Cadastrar Fornecedor"}</DialogTitle>
              <DialogDescription>
                Insira as informações do parceiro gráfico de suprimentos.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label htmlFor="name">Nome do Fornecedor *</Label>
                  <Input id="name" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Ex: Printi" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="domain">Domínio de Análise *</Label>
                  <Input id="domain" value={supplierDomain} onChange={(e) => setSupplierDomain(e.target.value)} placeholder="Ex: printi.com.br" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="margin">Margem Padrão (%)</Label>
                  <Input id="margin" type="number" value={supplierMargin} onChange={(e) => setSupplierMargin(parseInt(e.target.value) || 0)} placeholder="50" />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label htmlFor="url">Link do Site</Label>
                  <Input id="url" value={supplierUrl} onChange={(e) => setSupplierUrl(e.target.value)} placeholder="https://..." />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">E-mail de Contato</Label>
                  <Input id="email" value={supplierEmail} onChange={(e) => setSupplierEmail(e.target.value)} placeholder="contato@..." />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">WhatsApp / Telefone</Label>
                  <Input id="phone" value={supplierPhone} onChange={(e) => setSupplierPhone(e.target.value)} placeholder="(11) 9..." />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label htmlFor="notes">Observações</Label>
                  <Input id="notes" value={supplierNotes} onChange={(e) => setSupplierNotes(e.target.value)} placeholder="Anotações internas..." />
                </div>
              </div>
            </div>
            <DialogFooter className="mt-2">
              <Button variant="outline" size="sm" onClick={() => setOpenModal(false)}>Cancelar</Button>
              <Button size="sm" disabled={!supplierName || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />} Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* TABS CONTENT: LISTAGEM FORNECEDORES */}
      <TabsContent value="fornecedores" className="space-y-4 outline-none">
        <Card className="border-t-4 border-purple-500">
          <CardContent className="pt-6">
            {isLoadingSuppliers ? (
              <div className="h-32 flex items-center justify-center">
                <Loader2 className="h-6 w-6 text-primary animate-spin" />
              </div>
            ) : suppliers.length > 0 ? (
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Domínio de Análise</TableHead>
                      <TableHead>Margem Padrão</TableHead>
                      <TableHead>Site</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>WhatsApp</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suppliers.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-bold">{s.name}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{s.domain || "Não informado"}</TableCell>
                        <TableCell className="font-semibold text-primary">{s.default_margin || 50}%</TableCell>
                        <TableCell>
                          {s.website_url ? (
                            <a href={s.website_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline flex items-center gap-1 text-xs">
                              <Globe className="h-3.5 w-3.5" /> Acessar
                            </a>
                          ) : "-"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{s.contact_email || "-"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{s.contact_phone || "-"}</TableCell>
                        <TableCell>
                          <StatusBadge variant={s.status === "Ativo" ? "success" : "muted"}>
                            {s.status}
                          </StatusBadge>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button size="icon" variant="ghost" onClick={() => handleEdit(s)} className="h-8 w-8 text-primary hover:bg-primary/10">
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => {
                            if(window.confirm("Deseja mesmo excluir este fornecedor?")) {
                              deleteMutation.mutate(s.id);
                            }
                          }} className="h-8 w-8 text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="border border-dashed rounded-lg p-10 text-center flex flex-col items-center justify-center text-muted-foreground">
                <Building2 className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <h4 className="font-bold text-sm">Nenhum Fornecedor Cadastrado</h4>
                <p className="text-xs max-w-sm mt-1 mb-4">Cadastre seus parceiros gráficos de suprimentos para vinculá-los aos produtos importados e habilitar a importação por link.</p>
                <Button size="sm" onClick={() => { resetForm(); setOpenModal(true); }}>
                  <Plus className="h-4 w-4 mr-1" /> Cadastrar Fornecedor
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* TABS CONTENT: PERFIS DE CONTA */}
      <TabsContent value="perfis" className="space-y-4 outline-none">
        <PerfisForncedores />
      </TabsContent>

      {/* TABS CONTENT: CATÁLOGO AUTORIZADO */}
      <TabsContent value="catalogo" className="space-y-4 outline-none">
        <Card className="border-t-4 border-purple-500">
          <CardHeader>
            <CardTitle className="text-lg">Catálogo Autorizado de Produtos</CardTitle>
            <CardDescription>
              Lista de itens importados diretamente através das integrações de APIs oficiais de fornecedores autorizados.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {isLoadingCatalog ? (
              <div className="h-32 flex items-center justify-center">
                <Loader2 className="h-6 w-6 text-primary animate-spin" />
              </div>
            ) : catalogItems.length > 0 ? (
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU Fornecedor</TableHead>
                      <TableHead>Nome do Produto</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Preço de Custo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {catalogItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-xs font-semibold">{item.sku}</TableCell>
                        <TableCell className="font-bold">{item.name}</TableCell>
                        <TableCell>
                          <StatusBadge variant="info">{item.suppliers?.name || "Parceiro"}</StatusBadge>
                        </TableCell>
                        <TableCell>
                          <StatusBadge variant="muted">{item.category}</StatusBadge>
                        </TableCell>
                        <TableCell className="font-semibold">R$ {item.cost_price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell>
                          <StatusBadge variant={item.active ? "success" : "muted"}>
                            {item.active ? "Ativo" : "Inativo"}
                          </StatusBadge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" className="text-xs h-8">
                            <Plus className="h-3 w-3 mr-1" /> Criar no CRM
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="border border-dashed rounded-lg p-10 text-center flex flex-col items-center justify-center text-muted-foreground">
                <ShieldCheck className="h-10 w-10 text-muted-foreground/30 mb-3 animate-pulse" />
                <h4 className="font-bold text-sm">Integrações de Catálogo Limpas</h4>
                <p className="text-xs max-w-sm mt-1">Conecte via credenciais nas Configurações do Hub para alimentar e sincronizar o catálogo de APIs oficiais em tempo real.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
