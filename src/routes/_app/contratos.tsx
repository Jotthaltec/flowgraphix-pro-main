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
import { Textarea } from "@/components/ui/textarea";
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
    additional_terms: "",
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
          clients:client_id (name, document, address, whatsapp)
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile,
  });

  // Dados da própria empresa (Contratada) para qualificar no contrato.
  const { data: company } = useQuery({
    queryKey: ["company_for_contract", profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("*").eq("id", profile!.company_id!).maybeSingle();
      return data;
    },
    enabled: !!profile?.company_id,
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
        approval_terms: data.additional_terms || null
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
      upfront_value: 0, payment_method: "", delivery_date: "", additional_terms: "", status: "rascunho"
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

  // Marca o contrato como enviado ao disparar a mensagem (apenas se ainda em rascunho).
  const sendMutation = useMutation({
    mutationFn: async (contract: any) => {
      if (contract.status && contract.status !== "rascunho") return;
      const { error } = await supabase.from("contracts").update({ status: "enviado" }).eq("id", contract.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["contracts"] }),
    onError: (err: any) => toast.error("Não foi possível atualizar o status: " + err.message),
  });

  const handleSendContract = (contract: any) => {
    if (!contract) return;
    const valor = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(contract.total_value || 0);
    const msg =
      `Olá ${contract.clients?.name || ""}! Segue o contrato *${contract.contract_number}* ` +
      `referente a "${contract.notes || "serviços gráficos"}" no valor de *${valor}*. ` +
      `Prazo de entrega: ${contract.delivery_date || "a combinar"}. ` +
      `Por favor, confirme a leitura e o aceite para iniciarmos a produção.`;
    const digits = (contract.clients?.whatsapp || "").replace(/\D/g, "");
    const phone = digits ? (digits.length <= 11 ? `55${digits}` : digits) : "";
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
    sendMutation.mutate(contract);
    toast.success(
      phone
        ? "Contrato aberto no WhatsApp do cliente. Status atualizado para 'enviado'."
        : "Contrato aberto no WhatsApp (selecione o contato). Status atualizado para 'enviado'."
    );
  };

  const fmtBRL = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

  return (
    <>
      <style>{`
        /* Escondido na tela; visível apenas na impressão/PDF.
           (Antes usava a classe 'hidden' = display:none, que 'visibility:visible'
           NÃO anula — por isso o download saía em branco.) */
        #printable-contract { display: none; }
        @media print {
          body * { visibility: hidden; }
          #printable-contract, #printable-contract * { visibility: visible; }
          #printable-contract { display: block; position: absolute; left: 0; top: 0; width: 100%; padding: 0; }
          .no-print { display: none !important; }
          @page { margin: 1.6cm; }
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
                    <p className="text-muted-foreground"><strong>Entrada:</strong> {fmtBRL(selectedContract.down_payment || 0)}</p>
                    <p className="text-muted-foreground"><strong>Data de Entrega:</strong> {selectedContract.delivery_date || '—'}</p>
                    <p className="text-[11px] text-foreground/80 pt-2 border-t mt-2">📄 O contrato completo — com cláusulas de pagamento, prazo, aprovação de arte, cancelamento (retenção de sinal + multa), tolerâncias técnicas, LGPD e foro — é gerado ao clicar em <strong>Imprimir / PDF</strong>.</p>
                    {selectedContract.approval_terms && String(selectedContract.approval_terms).trim() && (
                      <p className="text-muted-foreground line-clamp-3"><strong>Cláusulas adicionais:</strong> {selectedContract.approval_terms}</p>
                    )}
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
              <Button size="sm" className="flex-1" disabled={!selectedContract || sendMutation.isPending} onClick={() => handleSendContract(selectedContract)}>
                {sendMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />} Enviar
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
                <div className="grid gap-2">
                  <Label>Forma de pagamento</Label>
                  <Input placeholder="Ex.: 50% entrada + 50% na entrega (Pix)" value={formData.payment_method} onChange={(e) => setFormData({...formData, payment_method: e.target.value})} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Cláusulas adicionais / observações (opcional)</Label>
                <Textarea
                  rows={3}
                  placeholder="Cláusulas específicas deste contrato. As cláusulas de proteção padrão (pagamento, prazo, aprovação de arte, cancelamento, tolerâncias etc.) já entram automaticamente no documento."
                  value={formData.additional_terms}
                  onChange={(e) => setFormData({...formData, additional_terms: e.target.value})}
                />
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

      {/* Área imprimível — contrato completo (escondida na tela, visível na impressão/PDF) */}
      {selectedContract && (() => {
        const sc = selectedContract;
        const compName = company?.legal_name || company?.name || "________________________";
        const compDoc = company?.cnpj ? `inscrita no CNPJ sob o nº ${company.cnpj}` : "inscrita no CNPJ sob o nº ________________";
        const compEnd =
          [company?.address, company?.address_number, company?.neighborhood, company?.complement, company?.zip_code ? `CEP ${company.zip_code}` : null]
            .filter(Boolean).join(", ") || "endereço constante em seus registros";
        const cliName = sc.clients?.name || "________________________";
        const cliDoc = sc.clients?.document ? `inscrito(a) no CPF/CNPJ sob o nº ${sc.clients.document}` : "documento a ser informado";
        const cliEnd = sc.clients?.address || "endereço constante em seu cadastro";
        const total = sc.total_value || 0;
        const entrada = sc.down_payment || 0;
        const saldo = Math.max(total - entrada, 0);
        const P = { margin: "0 0 8px", textAlign: "justify" as const };

        return (
          <div id="printable-contract">
            <div style={{ maxWidth: "820px", margin: "0 auto", fontFamily: '"Times New Roman", Georgia, serif', fontSize: "12.5px", lineHeight: 1.5, color: "#111" }}>
              <h1 style={{ textAlign: "center", fontSize: "16px", margin: "0 0 2px", textTransform: "uppercase" }}>
                Contrato de Prestação de Serviços Gráficos
              </h1>
              <p style={{ textAlign: "center", margin: "0 0 16px", fontSize: "11px", color: "#444" }}>Nº {sc.contract_number}</p>

              <p style={P}>
                <strong>CONTRATADA:</strong> {compName}, {compDoc}, com sede em {compEnd}.
              </p>
              <p style={P}>
                <strong>CONTRATANTE:</strong> {cliName}, {cliDoc}, com endereço em {cliEnd}.
              </p>
              <p style={P}>
                As partes acima qualificadas têm, entre si, justo e contratado o presente Contrato de Prestação de Serviços
                Gráficos, que se regerá pelas cláusulas e condições seguintes, que mutuamente aceitam:
              </p>

              <p style={P}><strong>CLÁUSULA 1ª – DO OBJETO.</strong> A CONTRATADA obriga-se a prestar ao CONTRATANTE os seguintes serviços gráficos: <strong>{sc.notes || "conforme pedido/orçamento aprovado"}</strong>, compreendendo, quando aplicável, a preparação de arte, impressão e acabamento, segundo as especificações aprovadas.</p>

              <p style={P}><strong>CLÁUSULA 2ª – DO PREÇO E DA FORMA DE PAGAMENTO.</strong> Pela prestação dos serviços, o CONTRATANTE pagará o valor total de <strong>{fmtBRL(total)}</strong>, sendo <strong>{fmtBRL(entrada)}</strong> a título de entrada/sinal e o saldo de <strong>{fmtBRL(saldo)}</strong> {sc.payment_method ? <>na seguinte forma: <strong>{sc.payment_method}</strong></> : "na forma ajustada entre as partes"}. <strong>2.1.</strong> O sinal confirma o pedido e a produção somente se inicia após sua compensação. <strong>2.2.</strong> O atraso de qualquer pagamento acarretará multa de <strong>2%</strong>, juros de mora de <strong>1% ao mês</strong> e correção monetária, sem prejuízo da suspensão dos serviços e da cobrança do débito.</p>

              <p style={P}><strong>CLÁUSULA 3ª – DO PRAZO.</strong> O prazo estimado de entrega é <strong>{sc.delivery_date || "a ser ajustado entre as partes"}</strong>, contado a partir do cumprimento cumulativo do pagamento da entrada e da aprovação final da arte. <strong>3.1.</strong> Atrasos causados pelo CONTRATANTE (demora na aprovação da arte, no envio de arquivos/materiais ou no pagamento) suspendem e prorrogam automaticamente o prazo, sem qualquer penalidade à CONTRATADA.</p>

              <p style={P}><strong>CLÁUSULA 4ª – DA APROVAÇÃO DA ARTE.</strong> A produção somente se inicia após a aprovação expressa da arte final pelo CONTRATANTE. <strong>4.1.</strong> Após a aprovação, o CONTRATANTE assume integral responsabilidade por eventuais erros de texto, ortografia, medidas, cores, imagens e dados, não cabendo à CONTRATADA refação, reembolso ou reimpressão gratuita. <strong>4.2.</strong> Alterações solicitadas após a aprovação da arte ou o início da produção serão orçadas à parte e implicarão novo prazo.</p>

              <p style={P}><strong>CLÁUSULA 5ª – DAS OBRIGAÇÕES DO CONTRATANTE.</strong> Fornecer informações e arquivos corretos, completos e em qualidade adequada; aprovar a arte tempestivamente; efetuar os pagamentos nas datas ajustadas; e conferir os produtos no ato da entrega.</p>

              <p style={P}><strong>CLÁUSULA 6ª – DA PROPRIEDADE INTELECTUAL E ISENÇÃO.</strong> O CONTRATANTE declara e garante ser titular ou legítimo autorizado dos direitos de uso de marcas, logotipos, imagens, textos e demais conteúdos fornecidos, respondendo com exclusividade por qualquer violação de direitos de terceiros e isentando e mantendo indene a CONTRATADA de toda reclamação, indenização, custa ou honorário daí decorrentes.</p>

              <p style={P}><strong>CLÁUSULA 7ª – DAS TOLERÂNCIAS TÉCNICAS.</strong> Em razão da natureza do processo gráfico, não configuram defeito: (a) variação de até <strong>10%</strong>, para mais ou para menos, na quantidade produzida, faturando-se a quantidade efetivamente entregue; (b) pequenas variações de cor em relação ao visualizado em tela ou a impressões anteriores; e (c) pequenas variações de corte, dobra, registro e acabamento dentro das tolerâncias usuais do mercado.</p>

              <p style={P}><strong>CLÁUSULA 8ª – DA ENTREGA E DOS VÍCIOS.</strong> O CONTRATANTE deverá conferir os produtos no recebimento; vícios aparentes deverão ser reclamados por escrito em até <strong>7 (sete) dias</strong> corridos, sob pena de aceitação tácita. Constatado vício comprovadamente atribuível à CONTRATADA, sua obrigação limita-se à refação da parte defeituosa, excluída qualquer outra indenização.</p>

              <p style={P}><strong>CLÁUSULA 9ª – DO CANCELAMENTO E DA RESCISÃO.</strong> Tratando-se de produto personalizado, feito sob encomenda, o cancelamento pelo CONTRATANTE após o início dos trabalhos <strong>não dá direito à devolução do sinal</strong> e obriga-o ao ressarcimento dos custos e materiais já empregados, acrescidos de multa de <strong>20%</strong> sobre o saldo do contrato. O inadimplemento de qualquer cláusula faculta à parte inocente rescindir o contrato e exigir as perdas e danos cabíveis.</p>

              <p style={P}><strong>CLÁUSULA 10 – DA LIMITAÇÃO DE RESPONSABILIDADE.</strong> A responsabilidade total da CONTRATADA, por qualquer causa, fica limitada ao valor efetivamente pago por este contrato, não respondendo por lucros cessantes, danos indiretos ou expectativas de terceiros.</p>

              <p style={P}><strong>CLÁUSULA 11 – DO CASO FORTUITO E FORÇA MAIOR.</strong> Nenhuma das partes responderá por descumprimento decorrente de caso fortuito ou força maior, nos termos do art. 393 do Código Civil.</p>

              <p style={P}><strong>CLÁUSULA 12 – DA PROTEÇÃO DE DADOS (LGPD).</strong> As partes tratarão os dados pessoais estritamente para a execução deste contrato, em conformidade com a Lei nº 13.709/2018, adotando medidas de segurança e não os utilizando para finalidades diversas sem consentimento.</p>

              <p style={P}><strong>CLÁUSULA 13 – DAS DISPOSIÇÕES GERAIS.</strong> Toda alteração deverá ser feita por escrito; a tolerância quanto ao descumprimento de qualquer cláusula não implica novação ou renúncia; e a eventual nulidade de uma cláusula não prejudica as demais.</p>

              {sc.approval_terms && String(sc.approval_terms).trim() && (
                <p style={{ ...P, whiteSpace: "pre-wrap" }}><strong>CLÁUSULA 14 – DAS CONDIÇÕES ADICIONAIS.</strong> {sc.approval_terms}</p>
              )}

              <p style={P}><strong>CLÁUSULA {sc.approval_terms && String(sc.approval_terms).trim() ? "15" : "14"} – DO FORO.</strong> Fica eleito o foro da comarca da sede da CONTRATADA para dirimir quaisquer dúvidas oriundas deste contrato, com renúncia a qualquer outro, por mais privilegiado que seja.</p>

              <p style={{ ...P, marginTop: "14px" }}>E, por estarem assim justas e contratadas, firmam o presente instrumento em 2 (duas) vias de igual teor e forma, na presença das testemunhas abaixo.</p>

              <p style={{ margin: "18px 0 40px" }}>{company?.name ? `${company.name}, ` : ""}{new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}.</p>

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "50px" }}>
                <div style={{ width: "45%", textAlign: "center", borderTop: "1px solid #000", paddingTop: "6px" }}>
                  <p style={{ margin: 0 }}><strong>{compName}</strong></p>
                  <p style={{ margin: 0, fontSize: "11px" }}>CONTRATADA</p>
                </div>
                <div style={{ width: "45%", textAlign: "center", borderTop: "1px solid #000", paddingTop: "6px" }}>
                  <p style={{ margin: 0 }}><strong>{cliName}</strong></p>
                  <p style={{ margin: 0, fontSize: "11px" }}>CONTRATANTE</p>
                </div>
              </div>

              <div style={{ marginTop: "34px", fontSize: "11.5px" }}>
                <p style={{ margin: "0 0 18px" }}>Testemunha 1: ______________________________  CPF: ______________________</p>
                <p style={{ margin: 0 }}>Testemunha 2: ______________________________  CPF: ______________________</p>
              </div>

              <div style={{ textAlign: "center", marginTop: "26px", fontSize: "10px", color: "#777" }}>
                Documento gerado via PrintFlow CRM — {sc.contract_number}
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
