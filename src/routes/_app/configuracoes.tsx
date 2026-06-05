import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, Copy, Send } from "lucide-react";

export const Route = createFileRoute("/_app/configuracoes")({ component: ConfigPage });

function ConfigPage() {
  const { profile, user } = useAuth();
  const [companyName, setCompanyName] = useState("");
  
  // WhatsApp Templates State (using localStorage for simplicity without schema changes)
  const [templates, setTemplates] = useState(() => {
    const saved = localStorage.getItem("whatsapp_templates");
    if (saved) return JSON.parse(saved);
    return {
      orcamento: "Olá *{cliente}*, seu orçamento nº *{numero}* no valor de *{valor}* já está disponível para aprovação.",
      pedido_pronto: "Boas notícias, *{cliente}*! Seu pedido *{numero}* ({produto}) já está pronto para retirada/envio.",
      cobranca: "Olá *{cliente}*, identificamos que a parcela do pedido *{numero}* está pendente. Por favor, regularize para iniciarmos a produção."
    };
  });

  useEffect(() => {
    if (profile?.company_name) setCompanyName(profile.company_name);
  }, [profile]);

  const { data: team, isLoading: teamLoading } = useQuery({
    queryKey: ["team"],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, created_at")
        .eq("company_id", profile.company_id);
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.company_id
  });

  const updateCompanyMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!profile?.company_id) throw new Error("Empresa não identificada.");
      const { error } = await supabase.from("companies").update({ name }).eq("id", profile.company_id);
      if (error) throw error;
    },
    onSuccess: () => toast.success("Dados da gráfica atualizados!"),
    onError: (err) => toast.error("Erro ao atualizar: " + err.message)
  });

  const saveTemplates = () => {
    localStorage.setItem("whatsapp_templates", JSON.stringify(templates));
    toast.success("Templates do WhatsApp salvos com sucesso!");
  };

  const handleTemplateChange = (key: string, value: string) => {
    setTemplates({ ...templates, [key]: value });
  };

  const testWhatsApp = (text: string) => {
    const textEncoded = encodeURIComponent(text.replace("{cliente}", "João").replace("{numero}", "1234").replace("{valor}", "R$ 150,00").replace("{produto}", "Cartões"));
    window.open(`https://wa.me/?text=${textEncoded}`, '_blank');
  };

  return (
    <>
      <PageHeader title="Configurações" description="Personalize sua gráfica, equipe e templates de comunicação" />
      <Tabs defaultValue="grafica">
        <TabsList className="flex flex-wrap h-auto mb-4">
          <TabsTrigger value="grafica">Dados da gráfica</TabsTrigger>
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          <TabsTrigger value="msg">Templates WhatsApp</TabsTrigger>
        </TabsList>

        <TabsContent value="grafica">
          <Card>
            <CardHeader><CardTitle>Dados da gráfica</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Nome da gráfica</Label>
                  <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                </div>
                <div><Label>E-mail de Cadastro</Label><Input disabled value={user?.email || ""} /></div>
                <div className="md:col-span-2">
                  <Label>Termos padrão de contrato (Anotação Local)</Label>
                  <Textarea rows={4} placeholder="Cláusulas padrão..." />
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <Button 
                  disabled={updateCompanyMutation.isPending || !companyName}
                  onClick={() => updateCompanyMutation.mutate(companyName)}
                >
                  {updateCompanyMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar alterações
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usuarios">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Equipe</CardTitle>
                <CardDescription>Usuários com acesso a esta empresa</CardDescription>
              </div>
              <Button size="sm" onClick={() => toast.info("Convite de usuários requer painel do Supabase Auth.")}>Convidar usuário</Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Função</TableHead><TableHead>Membro desde</TableHead></TableRow></TableHeader>
                <TableBody>
                  {teamLoading ? (
                    <TableRow><TableCell colSpan={3} className="text-center py-4"><Loader2 className="animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                  ) : team?.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.full_name || 'Sem nome'}</TableCell>
                      <TableCell><StatusBadge variant="info">Membro</StatusBadge></TableCell>
                      <TableCell className="text-muted-foreground text-sm">{new Date(u.created_at).toLocaleDateString('pt-BR')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="msg">
          <Card>
            <CardHeader>
              <CardTitle>Templates de WhatsApp</CardTitle>
              <CardDescription>Configure as mensagens automáticas. Variáveis disponíveis: {'{cliente}, {numero}, {valor}, {produto}'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Envio de Orçamento</Label>
                <div className="flex gap-2">
                  <Textarea 
                    value={templates.orcamento} 
                    onChange={(e) => handleTemplateChange("orcamento", e.target.value)} 
                    rows={2}
                  />
                  <Button variant="outline" size="icon" onClick={() => testWhatsApp(templates.orcamento)}><Send className="h-4 w-4 text-success" /></Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Pedido Pronto para Retirada/Envio</Label>
                <div className="flex gap-2">
                  <Textarea 
                    value={templates.pedido_pronto} 
                    onChange={(e) => handleTemplateChange("pedido_pronto", e.target.value)} 
                    rows={2}
                  />
                  <Button variant="outline" size="icon" onClick={() => testWhatsApp(templates.pedido_pronto)}><Send className="h-4 w-4 text-success" /></Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Aviso de Pendência Financeira / Cobrança</Label>
                <div className="flex gap-2">
                  <Textarea 
                    value={templates.cobranca} 
                    onChange={(e) => handleTemplateChange("cobranca", e.target.value)} 
                    rows={2}
                  />
                  <Button variant="outline" size="icon" onClick={() => testWhatsApp(templates.cobranca)}><Send className="h-4 w-4 text-success" /></Button>
                </div>
              </div>
              <div className="flex justify-end pt-4 border-t">
                <Button onClick={saveTemplates}>Salvar Templates</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
