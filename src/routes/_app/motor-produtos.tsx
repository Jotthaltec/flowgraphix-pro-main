import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Settings2, Plus, Edit, Trash2, Loader2, Layers, AlignLeft, CheckSquare } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_app/motor-produtos")({ component: MotorProdutosPage });

function MotorProdutosPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("models");
  
  // States para os modais
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isAttributeModalOpen, setIsAttributeModalOpen] = useState(false);
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);

  // Forms states
  const [groupForm, setGroupForm] = useState({ id: "", name: "" });
  const [attrForm, setAttrForm] = useState({ id: "", name: "", code: "", type: "text", group_id: "", is_required: false });
  const [modelForm, setModelForm] = useState({ id: "", name: "", description: "" });

  // Queries
  const { data: groups, isLoading: loadingGroups } = useQuery({
    queryKey: ["technical_groups"],
    queryFn: async () => {
      const { data, error } = await supabase.from("technical_attribute_groups").select("*").order("order_index");
      if (error) throw error;
      return data;
    },
    enabled: !!profile,
  });

  const { data: attributes, isLoading: loadingAttrs } = useQuery({
    queryKey: ["technical_attributes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("technical_attributes").select("*, technical_attribute_groups(name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!profile,
  });

  const { data: models, isLoading: loadingModels } = useQuery({
    queryKey: ["product_models"],
    queryFn: async () => {
      const { data, error } = await supabase.from("product_models").select("*").order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!profile,
  });

  // Mutations - Grupos
  const saveGroupMutation = useMutation({
    mutationFn: async (payload: { id?: string; name: string }) => {
      const { data: profileData } = await supabase.from('profiles').select('company_id').eq('user_id', (await supabase.auth.getUser()).data.user?.id || "").single();
      
      if (payload.id) {
        const { error } = await (supabase as any).from("technical_attribute_groups").update({ name: payload.name }).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("technical_attribute_groups").insert([{ name: payload.name, company_id: profileData?.company_id }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["technical_groups"] });
      setIsGroupModalOpen(false);
      toast.success("Grupo salvo com sucesso!");
    },
    onError: (err) => toast.error("Erro ao salvar grupo: " + err.message)
  });

  // Mutations - Atributos
  const saveAttributeMutation = useMutation({
    mutationFn: async (payload: typeof attrForm) => {
      const { data: profileData } = await supabase.from('profiles').select('company_id').eq('user_id', (await supabase.auth.getUser()).data.user?.id || "").single();
      
      const dbPayload = {
        name: payload.name,
        code: payload.code.toUpperCase().replace(/\s+/g, '_'),
        type: payload.type,
        group_id: payload.group_id && payload.group_id !== 'none' ? payload.group_id : null,
        is_required: payload.is_required,
        company_id: profileData?.company_id
      };

      if (payload.id) {
        const { error } = await (supabase as any).from("technical_attributes").update(dbPayload).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("technical_attributes").insert([dbPayload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["technical_attributes"] });
      setIsAttributeModalOpen(false);
      toast.success("Atributo salvo com sucesso!");
    },
    onError: (err) => toast.error("Erro ao salvar atributo: " + err.message)
  });

  // Mutations - Models
  const saveModelMutation = useMutation({
    mutationFn: async (payload: { id?: string; name: string; description: string }) => {
      const { data: profileData } = await supabase.from('profiles').select('company_id').eq('user_id', (await supabase.auth.getUser()).data.user?.id || "").single();
      
      const dbPayload = {
        name: payload.name,
        description: payload.description,
        company_id: profileData?.company_id
      };
      
      if (payload.id) {
        const { error } = await (supabase as any).from("product_models").update(dbPayload).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("product_models").insert([dbPayload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product_models"] });
      setIsModelModalOpen(false);
      toast.success("Modelo salvo com sucesso!");
    },
    onError: (err) => toast.error("Erro ao salvar modelo: " + err.message)
  });


  return (
    <>
      <PageHeader 
        title="Motor Universal de Produtos" 
        description="Gerencie regras, atributos e modelos de produção"
        action={
          <Button 
            className="shadow-md hover:shadow-lg transition-all"
            onClick={() => {
              if (activeTab === "groups") { setGroupForm({ id: "", name: "" }); setIsGroupModalOpen(true); }
              if (activeTab === "attributes") { setAttrForm({ id: "", name: "", code: "", type: "text", group_id: "", is_required: false }); setIsAttributeModalOpen(true); }
              if (activeTab === "models") { setModelForm({ id: "", name: "", description: "" }); setIsModelModalOpen(true); }
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            {activeTab === "groups" && "Novo Grupo"}
            {activeTab === "attributes" && "Novo Atributo"}
            {activeTab === "models" && "Novo Modelo"}
          </Button>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-3 max-w-md">
          <TabsTrigger value="models" className="flex gap-2"><Layers className="h-4 w-4" /> Modelos</TabsTrigger>
          <TabsTrigger value="groups" className="flex gap-2"><AlignLeft className="h-4 w-4" /> Grupos</TabsTrigger>
          <TabsTrigger value="attributes" className="flex gap-2"><CheckSquare className="h-4 w-4" /> Atributos</TabsTrigger>
        </TabsList>

        <TabsContent value="models">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome do Modelo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingModels ? <TableRow><TableCell colSpan={3} className="text-center py-4"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground"/></TableCell></TableRow> : null}
                {models?.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell className="text-muted-foreground">{m.description || "-"}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => { setModelForm({ id: m.id, name: m.name, description: m.description || "" }); setIsModelModalOpen(true); }}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {models?.length === 0 && !loadingModels && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">Nenhum modelo cadastrado.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="groups">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome do Grupo</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingGroups ? <TableRow><TableCell colSpan={2} className="text-center py-4"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground"/></TableCell></TableRow> : null}
                {groups?.map((g: any) => (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">{g.name}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => { setGroupForm({ id: g.id, name: g.name }); setIsGroupModalOpen(true); }}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {groups?.length === 0 && !loadingGroups && <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-6">Nenhum grupo cadastrado.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="attributes">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Grupo</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingAttrs ? <TableRow><TableCell colSpan={5} className="text-center py-4"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground"/></TableCell></TableRow> : null}
                {attributes?.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell className="font-mono text-xs">{a.code}</TableCell>
                    <TableCell>{a.type}</TableCell>
                    <TableCell className="text-muted-foreground">{a.technical_attribute_groups?.name || "-"}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => { setAttrForm({ id: a.id, name: a.name, code: a.code, type: a.type, group_id: a.group_id || "none", is_required: a.is_required }); setIsAttributeModalOpen(true); }}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {attributes?.length === 0 && !loadingAttrs && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhum atributo cadastrado.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

      </Tabs>

      {/* MODAL GRUPOS */}
      <Dialog open={isGroupModalOpen} onOpenChange={setIsGroupModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{groupForm.id ? "Editar Grupo" : "Novo Grupo"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome do Grupo</Label>
              <Input value={groupForm.name} onChange={e => setGroupForm(prev => ({...prev, name: e.target.value}))} placeholder="Ex: Dimensões, Cores..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsGroupModalOpen(false)}>Cancelar</Button>
            <Button disabled={saveGroupMutation.isPending || !groupForm.name} onClick={() => saveGroupMutation.mutate(groupForm)}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL ATRIBUTOS */}
      <Dialog open={isAttributeModalOpen} onOpenChange={setIsAttributeModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{attrForm.id ? "Editar Atributo" : "Novo Atributo"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2 col-span-2">
              <Label>Nome do Atributo</Label>
              <Input value={attrForm.name} onChange={e => setAttrForm(prev => ({...prev, name: e.target.value}))} placeholder="Ex: Cor de Impressão" />
            </div>
            <div className="space-y-2">
              <Label>Código (Referência)</Label>
              <Input value={attrForm.code} onChange={e => setAttrForm(prev => ({...prev, code: e.target.value.toUpperCase().replace(/\s/g, '_')}))} placeholder="Ex: COR_IMPRESSAO" />
            </div>
            <div className="space-y-2">
              <Label>Tipo do Campo</Label>
              <Select value={attrForm.type} onValueChange={v => setAttrForm(prev => ({...prev, type: v}))}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Texto Simples</SelectItem>
                  <SelectItem value="select">Seleção (Dropdown)</SelectItem>
                  <SelectItem value="number">Número</SelectItem>
                  <SelectItem value="dimension">Medida (cm/m)</SelectItem>
                  <SelectItem value="boolean">Sim/Não</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Grupo</Label>
              <Select value={attrForm.group_id} onValueChange={v => setAttrForm(prev => ({...prev, group_id: v}))}>
                <SelectTrigger><SelectValue placeholder="Selecione um grupo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem grupo</SelectItem>
                  {groups?.map((g: any) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAttributeModalOpen(false)}>Cancelar</Button>
            <Button disabled={saveAttributeMutation.isPending || !attrForm.name || !attrForm.code} onClick={() => saveAttributeMutation.mutate(attrForm)}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL MODELOS */}
      <Dialog open={isModelModalOpen} onOpenChange={setIsModelModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{modelForm.id ? "Editar Modelo" : "Novo Modelo"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome do Modelo</Label>
              <Input value={modelForm.name} onChange={e => setModelForm(prev => ({...prev, name: e.target.value}))} placeholder="Ex: Camiseta, Cartão de Visita..." />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={modelForm.description} onChange={e => setModelForm(prev => ({...prev, description: e.target.value}))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModelModalOpen(false)}>Cancelar</Button>
            <Button disabled={saveModelMutation.isPending || !modelForm.name} onClick={() => saveModelMutation.mutate(modelForm)}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
