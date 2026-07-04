import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save, Loader2, ListTree, AlertCircle, FileText, PackageMinus, Plus, Trash2, ShieldAlert, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/status-badge";

interface TechnicalSheetEditorProps {
  productionOrderItemId: string;
  onSaved?: () => void;
}

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function TechnicalSheetEditor({ productionOrderItemId, onSaved }: TechnicalSheetEditorProps) {
  const queryClient = useQueryClient();
  // Cast necessário: tipos do Supabase não regenerados após migration de produção.
  const db = supabase as any;
  const [activeTab, setActiveTab] = useState("specs");
  
  // States da Ficha Técnica
  const [formData, setFormData] = useState<Record<string, any>>({});
  
  // States de Materiais
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [matForm, setMatForm] = useState({ step_id: "", material_name: "", actual_qty: 0, unit_cost: 0 });

  // States de Refação
  const [isReworkModalOpen, setIsReworkModalOpen] = useState(false);
  const [reworkForm, setReworkForm] = useState({ reason: "" });

  // Queries (Motor e Item)
  const { data: motorData, isLoading: loadingMotor } = useQuery({
    queryKey: ["motor_fields"],
    queryFn: async () => {
      const [groupsRes, attrsRes] = await Promise.all([
        supabase.from("technical_attribute_groups").select("*").order("order_index"),
        supabase.from("technical_attributes").select("*").order("name")
      ]);
      if (groupsRes.error) throw groupsRes.error;
      if (attrsRes.error) throw attrsRes.error;
      return { groups: groupsRes.data || [], attributes: attrsRes.data || [] };
    }
  });

  const { data: savedAttributes, isLoading: loadingSaved } = useQuery({
    queryKey: ["item_attributes", productionOrderItemId],
    queryFn: async () => {
      const { data, error } = await supabase.from("production_item_attributes").select("*").eq("production_order_item_id", productionOrderItemId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!productionOrderItemId
  });

  const { data: steps, isLoading: loadingSteps } = useQuery({
    queryKey: ["item_steps", productionOrderItemId],
    queryFn: async () => {
      const { data, error } = await supabase.from("production_steps").select("id, step_name, order_index").eq("production_order_item_id", productionOrderItemId).order("order_index");
      if (error) throw error;
      return data || [];
    },
    enabled: !!productionOrderItemId
  });

  const { data: materials, isLoading: loadingMaterials } = useQuery({
    queryKey: ["item_materials", productionOrderItemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_materials_consumption")
        .select(`id, material_name, actual_qty, unit_cost, created_at, production_steps!inner(production_order_item_id, step_name)`)
        .eq("production_steps.production_order_item_id", productionOrderItemId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!productionOrderItemId
  });

  // Query: Refações reportadas
  const { data: reworks, isLoading: loadingReworks } = useQuery({
    queryKey: ["item_reworks", productionOrderItemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_reworks")
        .select(`id, reason, status, created_at, profiles(full_name)`)
        .eq("production_order_item_id", productionOrderItemId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!productionOrderItemId
  });

  useEffect(() => {
    if (savedAttributes && savedAttributes.length > 0 && motorData?.attributes) {
      const initialData: Record<string, any> = {};
      savedAttributes.forEach(sa => {
        const attr = motorData.attributes.find(a => a.id === sa.attribute_id);
        if (attr) initialData[attr.code] = sa.attribute_value;
      });
      setFormData(initialData);
    }
  }, [savedAttributes, motorData]);

  // Mutations
  const saveSpecsMutation = useMutation({
    mutationFn: async () => {
      if (!motorData?.attributes) throw new Error("Motor não carregado.");
      const payloadToUpsert = motorData.attributes
        .filter(attr => formData[attr.code] !== undefined && formData[attr.code] !== "")
        .map(attr => ({
          production_order_item_id: productionOrderItemId,
          attribute_id: attr.id,
          attribute_value: formData[attr.code] 
        }));
      const { error: delErr } = await supabase.from("production_item_attributes").delete().eq("production_order_item_id", productionOrderItemId);
      if (delErr) throw delErr;
      if (payloadToUpsert.length > 0) {
        const { error: insErr } = await supabase.from("production_item_attributes").insert(payloadToUpsert);
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["item_attributes", productionOrderItemId] });
      toast.success("Ficha Técnica salva!");
    },
    onError: (err) => toast.error("Erro ao salvar: " + err.message)
  });

  const saveMaterialMutation = useMutation({
    mutationFn: async (payload: typeof matForm) => {
      const { data: profile } = await supabase.auth.getUser();
      const { error } = await supabase.from("production_materials_consumption").insert([{
        step_id: payload.step_id,
        material_name: payload.material_name,
        actual_qty: payload.actual_qty,
        unit_cost: payload.unit_cost,
        recorded_by: profile.user?.id
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["item_materials", productionOrderItemId] });
      setIsMaterialModalOpen(false);
      setMatForm({ step_id: steps?.[0]?.id || "", material_name: "", actual_qty: 0, unit_cost: 0 });
      toast.success("Material apontado com sucesso!");
    },
    onError: (err) => toast.error("Erro ao registrar material: " + err.message)
  });

  const deleteMaterialMutation = useMutation({
    mutationFn: async (matId: string) => {
      const { error } = await supabase.from("production_materials_consumption").delete().eq("id", matId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["item_materials", productionOrderItemId] });
      toast.success("Apontamento removido.");
    }
  });

  const saveReworkMutation = useMutation({
    mutationFn: async (payload: typeof reworkForm) => {
      const { data: profile } = await supabase.auth.getUser();
      const { error } = await supabase.from("production_reworks").insert([{
        production_order_item_id: productionOrderItemId,
        reason: payload.reason,
        reported_by: profile.user?.id,
        status: 'pendente'
      }]);
      if (error) throw error;
      
      // Quando aponta refação, ele deve jogar o item para trás no Kanban.
      // Vou jogar para "aguardando" (imprimindo novamente ou iniciando o fluxo).
      await supabase.from("production_order_items").update({ status: 'aguardando' }).eq("id", productionOrderItemId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["item_reworks", productionOrderItemId] });
      queryClient.invalidateQueries({ queryKey: ["factory_production_items"] });
      setIsReworkModalOpen(false);
      setReworkForm({ reason: "" });
      toast.success("Retrabalho reportado com sucesso! Item voltou para a fila inicial.");
    },
    onError: (err) => toast.error("Erro ao reportar refação: " + err.message)
  });

  const updateReworkStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const { error } = await supabase.from("production_reworks").update({ status, resolved_at: status === 'resolvido' ? new Date().toISOString() : null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["item_reworks", productionOrderItemId] });
      toast.success("Status do retrabalho atualizado.");
    }
  });

  const handleChange = (code: string, value: any) => setFormData(prev => ({ ...prev, [code]: value }));

  if (loadingMotor || loadingSaved || loadingSteps) {
    return <div className="flex items-center justify-center p-10"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  const groups = motorData?.groups || [];
  const attributes = motorData?.attributes || [];
  const groupedAttrs = groups.map(g => ({ ...g, items: attributes.filter(a => a.group_id === g.id) })).filter(g => g.items.length > 0);
  const orphans = attributes.filter(a => !a.group_id || a.group_id === 'none');
  if (orphans.length > 0) groupedAttrs.push({ id: "orphan", name: "Outras Especificações", items: orphans } as any);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-500" />
            Gestor de Produção do Item
          </h3>
          <p className="text-sm text-muted-foreground">Especifique regras, aponte custos e gerencie a qualidade.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 mb-4 bg-secondary">
          <TabsTrigger value="specs">Especificações</TabsTrigger>
          <TabsTrigger value="materials">Materiais e Custos</TabsTrigger>
          <TabsTrigger value="quality" className="text-destructive data-[state=active]:text-destructive">Qualidade (Refação)</TabsTrigger>
        </TabsList>

        {/* ABA 1: Ficha Técnica */}
        <TabsContent value="specs" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => saveSpecsMutation.mutate()} disabled={saveSpecsMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700">
              {saveSpecsMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar Ficha Técnica
            </Button>
          </div>
          
          {groupedAttrs.length === 0 ? (
            <Alert variant="default" className="bg-secondary/50 border-dashed">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              <AlertDescription className="text-muted-foreground">Nenhum atributo cadastrado no Motor Universal.</AlertDescription>
            </Alert>
          ) : (
            <div className="grid gap-6">
              {groupedAttrs.map(group => (
                <Card key={group.id} className="overflow-hidden border-sidebar-border shadow-sm">
                  <div className="bg-secondary/30 border-b px-4 py-2.5 flex items-center gap-2">
                    <ListTree className="h-4 w-4 text-muted-foreground" />
                    <h4 className="font-medium text-sm text-secondary-foreground uppercase tracking-wider">{group.name}</h4>
                  </div>
                  <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                    {group.items.map((attr: any) => (
                      <div key={attr.id} className="space-y-1.5">
                        <Label className="text-xs font-semibold text-foreground/80 flex items-center justify-between">
                          {attr.name} {attr.is_required && <span className="text-destructive">*</span>}
                        </Label>
                        
                        {attr.type === "text" && <Input placeholder="..." value={formData[attr.code] || ""} onChange={e => handleChange(attr.code, e.target.value)} className="bg-background"/>}
                        {attr.type === "number" && <Input type="number" placeholder="0" value={formData[attr.code] || ""} onChange={e => handleChange(attr.code, e.target.value)} className="bg-background"/>}
                        {attr.type === "dimension" && (
                          <div className="relative">
                            <Input placeholder="0x0" value={formData[attr.code] || ""} onChange={e => handleChange(attr.code, e.target.value)} className="bg-background pr-8"/>
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">cm</span>
                          </div>
                        )}
                        {attr.type === "boolean" && (
                          <div className="flex items-center h-10 px-3 border rounded-md bg-background">
                            <Switch checked={formData[attr.code] === "true"} onCheckedChange={c => handleChange(attr.code, c ? "true" : "false")}/>
                            <span className="ml-3 text-sm text-muted-foreground">{formData[attr.code] === "true" ? "Sim" : "Não"}</span>
                          </div>
                        )}
                        {attr.type === "select" && (
                          <Select value={formData[attr.code] || ""} onValueChange={v => handleChange(attr.code, v)}>
                            <SelectTrigger className="bg-background"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="op1">Opção Padrão 1</SelectItem>
                              <SelectItem value="op2">Opção Padrão 2</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ABA 2: Materiais e Custos */}
        <TabsContent value="materials">
          <Card>
            <div className="p-4 flex items-center justify-between border-b">
              <div>
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <PackageMinus className="h-5 w-5 text-warning" /> Materiais Consumidos
                </h3>
                <p className="text-sm text-muted-foreground">Registre matérias-primas utilizadas.</p>
              </div>
              <Button onClick={() => {
                setMatForm({ step_id: steps?.[0]?.id || "", material_name: "", actual_qty: 1, unit_cost: 0 });
                setIsMaterialModalOpen(true);
              }} variant="secondary" className="shadow-sm">
                <Plus className="h-4 w-4 mr-2" /> Apontar Consumo
              </Button>
            </div>
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material / Insumo</TableHead>
                  <TableHead>Etapa (Step)</TableHead>
                  <TableHead>Qtde</TableHead>
                  <TableHead>Custo Unit.</TableHead>
                  <TableHead>Custo Total</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingMaterials ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-6"><Loader2 className="animate-spin mx-auto text-muted-foreground"/></TableCell></TableRow>
                ) : materials?.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Nenhum material apontado ainda.</TableCell></TableRow>
                ) : materials?.map((mat: any) => (
                  <TableRow key={mat.id}>
                    <TableCell className="font-semibold">{mat.material_name}</TableCell>
                    <TableCell className="text-muted-foreground">{mat.production_steps?.step_name}</TableCell>
                    <TableCell>{mat.actual_qty}</TableCell>
                    <TableCell>{fmt.format(mat.unit_cost)}</TableCell>
                    <TableCell className="font-bold text-destructive">{fmt.format(mat.actual_qty * mat.unit_cost)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => deleteMaterialMutation.mutate(mat.id)} className="text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ABA 3: Qualidade e Refação */}
        <TabsContent value="quality">
          <Card className="border-destructive/30">
            <div className="p-4 flex items-center justify-between border-b bg-destructive/5">
              <div>
                <h3 className="font-semibold text-lg flex items-center gap-2 text-destructive">
                  <ShieldAlert className="h-5 w-5" /> Controle de Perdas e Refação
                </h3>
                <p className="text-sm text-muted-foreground">Registre se houve problemas na produção e por que precisou ser refeito.</p>
              </div>
              <Button onClick={() => setIsReworkModalOpen(true)} variant="destructive" className="shadow-sm">
                <AlertCircle className="h-4 w-4 mr-2" /> Reportar Problema / Refação
              </Button>
            </div>
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Motivo da Refação</TableHead>
                  <TableHead>Reportado por</TableHead>
                  <TableHead>Status (Gestor)</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingReworks ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-6"><Loader2 className="animate-spin mx-auto text-muted-foreground"/></TableCell></TableRow>
                ) : reworks?.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6 border-dashed border-2 m-4 rounded">Nenhum retrabalho registrado para este item. Produção limpa!</TableCell></TableRow>
                ) : reworks?.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="font-semibold text-destructive">{r.reason}</TableCell>
                    <TableCell className="text-sm">{r.profiles?.full_name || "Operador"}</TableCell>
                    <TableCell>
                      <StatusBadge variant={r.status === 'pendente' ? 'warning' : 'success'}>
                        {r.status.toUpperCase()}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>
                      {r.status === 'pendente' && (
                         <Button variant="ghost" size="sm" onClick={() => updateReworkStatusMutation.mutate({ id: r.id, status: 'resolvido' })} className="text-success hover:bg-success/10 flex gap-1 text-xs">
                           <CheckCircle2 className="h-3 w-3" /> Resolver
                         </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

      </Tabs>

      {/* Modal Apontar Material */}
      <Dialog open={isMaterialModalOpen} onOpenChange={setIsMaterialModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Apontar Consumo Real</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Etapa Produtiva</Label>
              <Select value={matForm.step_id} onValueChange={v => setMatForm({...matForm, step_id: v})}>
                <SelectTrigger><SelectValue placeholder="Selecione a etapa" /></SelectTrigger>
                <SelectContent>
                  {steps?.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.step_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Material Utilizado</Label>
              <Input placeholder="Ex: Vinil Fosco, Tinta Preta..." value={matForm.material_name} onChange={e => setMatForm({...matForm, material_name: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantidade</Label>
                <Input type="number" min="0.01" step="0.01" value={matForm.actual_qty} onChange={e => setMatForm({...matForm, actual_qty: parseFloat(e.target.value) || 0})} />
              </div>
              <div className="space-y-2">
                <Label>Custo Unitário (R$)</Label>
                <Input type="number" min="0" step="0.01" value={matForm.unit_cost} onChange={e => setMatForm({...matForm, unit_cost: parseFloat(e.target.value) || 0})} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMaterialModalOpen(false)}>Cancelar</Button>
            <Button disabled={saveMaterialMutation.isPending || !matForm.material_name || !matForm.step_id} onClick={() => saveMaterialMutation.mutate(matForm)}>
              {saveMaterialMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Registrar Baixa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Reportar Refação */}
      <Dialog open={isReworkModalOpen} onOpenChange={setIsReworkModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-destructive flex items-center gap-2"><ShieldAlert className="h-5 w-5"/> Reportar Problema / Refação</DialogTitle></DialogHeader>
          <div className="py-4">
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>
                Ao reportar refação, o card deste item voltará automaticamente para o status <strong>"Aguardando"</strong> na coluna inicial do PCP para ser refeito.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label>Motivo da Refação</Label>
              <Input placeholder="Ex: Erro de corte, impressão manchada, cor errada..." value={reworkForm.reason} onChange={e => setReworkForm({ reason: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReworkModalOpen(false)}>Cancelar</Button>
            <Button variant="destructive" disabled={saveReworkMutation.isPending || !reworkForm.reason} onClick={() => saveReworkMutation.mutate(reworkForm)}>
              {saveReworkMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar Refação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
