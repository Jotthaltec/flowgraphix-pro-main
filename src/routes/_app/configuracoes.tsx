import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, Send, Truck, Store } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_app/configuracoes")({ component: ConfigPage });

// Termos de contrato são uma anotação local (não há coluna no banco ao vivo).
const CONTRACT_TERMS_KEY = "company_contract_terms";

const emptyCompanyForm = {
  // Dados cadastrais
  name: "",
  legal_name: "",
  cnpj: "",
  state_registration: "",
  phone: "",
  whatsapp: "",
  email: "",
  // Endereço fiscal
  zip_code: "",
  address: "",
  address_number: "",
  complement: "",
  neighborhood: "",
  // Recebimento padrão do fornecedor
  default_receiving_mode: "delivery",
  preferred_pickup_point: "",
  // Endereço de entrega (quando diferente do fiscal)
  delivery_same_as_fiscal: true,
  delivery_recipient: "",
  delivery_zip: "",
  delivery_address: "",
  delivery_number: "",
  delivery_complement: "",
  delivery_neighborhood: "",
  delivery_city: "",
  delivery_state: "",
  delivery_phone: "",
};

type CompanyForm = typeof emptyCompanyForm;

function ConfigPage() {
  const { profile } = useAuth();
  const [formData, setFormData] = useState<CompanyForm>(emptyCompanyForm);

  // Termos de contrato (anotação local)
  const [contractTerms, setContractTerms] = useState(
    () => localStorage.getItem(CONTRACT_TERMS_KEY) || ""
  );

  // WhatsApp Templates State (localStorage, sem mudanças de schema)
  const [templates, setTemplates] = useState(() => {
    const saved = localStorage.getItem("whatsapp_templates");
    if (saved) return JSON.parse(saved);
    return {
      orcamento: "Olá *{cliente}*, seu orçamento nº *{numero}* no valor de *{valor}* já está disponível para aprovação.",
      pedido_pronto: "Boas notícias, *{cliente}*! Seu pedido *{numero}* ({produto}) já está pronto para retirada/envio.",
      cobranca: "Olá *{cliente}*, identificamos que a parcela do pedido *{numero}* está pendente. Por favor, regularize para iniciarmos a produção."
    };
  });

  const { data: company, isLoading: companyLoading } = useQuery({
    queryKey: ["company", profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return null;
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("id", profile.company_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.company_id
  });

  useEffect(() => {
    if (company) {
      const c = company as Record<string, unknown>;
      const str = (k: string) => (typeof c[k] === "string" ? (c[k] as string) : "");
      setFormData({
        name: str("name"),
        legal_name: str("legal_name"),
        cnpj: str("cnpj"),
        // aceita o legado `ie` se `state_registration` ainda não foi preenchido
        state_registration: str("state_registration") || str("ie"),
        phone: str("phone"),
        whatsapp: str("whatsapp"),
        email: str("email"),
        zip_code: str("zip_code"),
        address: str("address"),
        address_number: str("address_number"),
        complement: str("complement"),
        neighborhood: str("neighborhood"),
        default_receiving_mode: str("default_receiving_mode") || "delivery",
        preferred_pickup_point: str("preferred_pickup_point"),
        delivery_same_as_fiscal:
          c["delivery_same_as_fiscal"] === undefined || c["delivery_same_as_fiscal"] === null
            ? true
            : Boolean(c["delivery_same_as_fiscal"]),
        delivery_recipient: str("delivery_recipient"),
        delivery_zip: str("delivery_zip"),
        delivery_address: str("delivery_address"),
        delivery_number: str("delivery_number"),
        delivery_complement: str("delivery_complement"),
        delivery_neighborhood: str("delivery_neighborhood"),
        delivery_city: str("delivery_city"),
        delivery_state: str("delivery_state"),
        delivery_phone: str("delivery_phone"),
      });
    } else if (profile?.company_name) {
      setFormData(prev => ({ ...prev, name: profile.company_name as string }));
    }
  }, [company, profile]);

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
    mutationFn: async (data: CompanyForm) => {
      if (!profile?.company_id) throw new Error("Empresa não identificada.");
      const { error } = await supabase.from("companies").update(data).eq("id", profile.company_id);
      if (error) throw error;
    },
    onSuccess: () => toast.success("Dados da gráfica atualizados!"),
    onError: (err: any) => toast.error("Erro ao atualizar: " + err.message)
  });

  const saveContractTerms = () => {
    localStorage.setItem(CONTRACT_TERMS_KEY, contractTerms);
    toast.success("Termos de contrato salvos (anotação local).");
  };

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

  const set = (patch: Partial<CompanyForm>) => setFormData(prev => ({ ...prev, ...patch }));

  return (
    <>
      <PageHeader title="Configurações" description="Personalize sua gráfica, equipe e templates de comunicação" />
      <Tabs defaultValue="grafica">
        <TabsList className="flex flex-wrap h-auto mb-4">
          <TabsTrigger value="grafica">Dados da gráfica</TabsTrigger>
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          <TabsTrigger value="msg">Templates WhatsApp</TabsTrigger>
        </TabsList>

        <TabsContent value="grafica" className="space-y-4">
          {companyLoading ? (
            <Card><CardContent className="flex justify-center p-8"><Loader2 className="animate-spin text-muted-foreground" /></CardContent></Card>
          ) : (
            <>
              {/* ─── Dados cadastrais ─────────────────────────────── */}
              <Card>
                <CardHeader>
                  <CardTitle>Dados cadastrais</CardTitle>
                  <CardDescription>Usados para cadastro automático nos fornecedores e emissão de documentos.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Nome fantasia / Nome da gráfica</Label>
                      <Input value={formData.name} onChange={(e) => set({ name: e.target.value })} />
                    </div>
                    <div>
                      <Label>Razão social</Label>
                      <Input value={formData.legal_name} onChange={(e) => set({ legal_name: e.target.value })} placeholder="Razão social registrada" />
                    </div>
                    <div>
                      <Label>CNPJ</Label>
                      <Input value={formData.cnpj} onChange={(e) => set({ cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
                    </div>
                    <div>
                      <Label>Inscrição Estadual (IE)</Label>
                      <Input value={formData.state_registration} onChange={(e) => set({ state_registration: e.target.value })} placeholder="Isento ou número da IE" />
                    </div>
                    <div>
                      <Label>Telefone</Label>
                      <Input value={formData.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="(00) 0000-0000" />
                    </div>
                    <div>
                      <Label>WhatsApp</Label>
                      <Input value={formData.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} placeholder="(00) 90000-0000" />
                    </div>
                    <div className="md:col-span-2">
                      <Label>E-mail de contato</Label>
                      <Input value={formData.email} onChange={(e) => set({ email: e.target.value })} placeholder="contato@grafica.com.br" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ─── Endereço fiscal ──────────────────────────────── */}
              <Card>
                <CardHeader>
                  <CardTitle>Endereço fiscal</CardTitle>
                  <CardDescription>Endereço cadastral da gráfica.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                    <div className="md:col-span-2">
                      <Label>CEP</Label>
                      <Input value={formData.zip_code} onChange={(e) => set({ zip_code: e.target.value })} placeholder="00000-000" />
                    </div>
                    <div className="md:col-span-4">
                      <Label>Logradouro</Label>
                      <Input value={formData.address} onChange={(e) => set({ address: e.target.value })} placeholder="Rua / Avenida" />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Número</Label>
                      <Input value={formData.address_number} onChange={(e) => set({ address_number: e.target.value })} placeholder="Nº" />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Complemento</Label>
                      <Input value={formData.complement} onChange={(e) => set({ complement: e.target.value })} placeholder="Sala, bloco..." />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Bairro</Label>
                      <Input value={formData.neighborhood} onChange={(e) => set({ neighborhood: e.target.value })} placeholder="Bairro" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ─── Recebimento e entrega ────────────────────────── */}
              <Card>
                <CardHeader>
                  <CardTitle>Recebimento dos fornecedores</CardTitle>
                  <CardDescription>Define o padrão de como a gráfica recebe as compras feitas nos fornecedores.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Modo de recebimento padrão</Label>
                    <Select
                      value={formData.default_receiving_mode}
                      onValueChange={(val) => set({ default_receiving_mode: val })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="delivery"><span className="flex items-center gap-2"><Truck className="h-4 w-4" /> Entregar na gráfica</span></SelectItem>
                        <SelectItem value="pickup"><span className="flex items-center gap-2"><Store className="h-4 w-4" /> Retirar no balcão do fornecedor</span></SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.default_receiving_mode === "pickup" && (
                    <div>
                      <Label>Ponto de retirada preferido</Label>
                      <Input value={formData.preferred_pickup_point} onChange={(e) => set({ preferred_pickup_point: e.target.value })} placeholder="Unidade / balcão preferido" />
                    </div>
                  )}

                  {formData.default_receiving_mode === "delivery" && (
                    <div className="space-y-4 border-t pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Endereço de entrega igual ao fiscal</Label>
                          <p className="text-sm text-muted-foreground">Desative para informar um endereço de entrega diferente.</p>
                        </div>
                        <Switch
                          checked={formData.delivery_same_as_fiscal}
                          onCheckedChange={(checked) => set({ delivery_same_as_fiscal: checked })}
                        />
                      </div>

                      {!formData.delivery_same_as_fiscal && (
                        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                          <div className="md:col-span-3">
                            <Label>Destinatário</Label>
                            <Input value={formData.delivery_recipient} onChange={(e) => set({ delivery_recipient: e.target.value })} placeholder="Quem recebe" />
                          </div>
                          <div className="md:col-span-3">
                            <Label>Telefone de entrega</Label>
                            <Input value={formData.delivery_phone} onChange={(e) => set({ delivery_phone: e.target.value })} placeholder="(00) 90000-0000" />
                          </div>
                          <div className="md:col-span-2">
                            <Label>CEP</Label>
                            <Input value={formData.delivery_zip} onChange={(e) => set({ delivery_zip: e.target.value })} placeholder="00000-000" />
                          </div>
                          <div className="md:col-span-4">
                            <Label>Logradouro</Label>
                            <Input value={formData.delivery_address} onChange={(e) => set({ delivery_address: e.target.value })} placeholder="Rua / Avenida" />
                          </div>
                          <div className="md:col-span-2">
                            <Label>Número</Label>
                            <Input value={formData.delivery_number} onChange={(e) => set({ delivery_number: e.target.value })} placeholder="Nº" />
                          </div>
                          <div className="md:col-span-2">
                            <Label>Complemento</Label>
                            <Input value={formData.delivery_complement} onChange={(e) => set({ delivery_complement: e.target.value })} placeholder="Sala, bloco..." />
                          </div>
                          <div className="md:col-span-2">
                            <Label>Bairro</Label>
                            <Input value={formData.delivery_neighborhood} onChange={(e) => set({ delivery_neighborhood: e.target.value })} placeholder="Bairro" />
                          </div>
                          <div className="md:col-span-4">
                            <Label>Cidade</Label>
                            <Input value={formData.delivery_city} onChange={(e) => set({ delivery_city: e.target.value })} placeholder="Cidade" />
                          </div>
                          <div className="md:col-span-2">
                            <Label>UF</Label>
                            <Input value={formData.delivery_state} onChange={(e) => set({ delivery_state: e.target.value })} placeholder="UF" maxLength={2} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex justify-end pt-2">
                    <Button
                      disabled={updateCompanyMutation.isPending || !formData.name}
                      onClick={() => updateCompanyMutation.mutate(formData)}
                    >
                      {updateCompanyMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Salvar alterações
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* ─── Termos de contrato (anotação local) ──────────── */}
              <Card>
                <CardHeader>
                  <CardTitle>Termos padrão de contrato</CardTitle>
                  <CardDescription>Anotação local (salva neste navegador). Não é compartilhada com a equipe.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    rows={4}
                    placeholder="Cláusulas padrão..."
                    value={contractTerms}
                    onChange={(e) => setContractTerms(e.target.value)}
                  />
                  <div className="flex justify-end">
                    <Button variant="outline" onClick={saveContractTerms}>Salvar termos</Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
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
