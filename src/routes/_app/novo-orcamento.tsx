import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, ArrowRight, CheckCircle2, Loader2, User, ShoppingCart,
  Calculator, FileText, Calendar, Percent
} from "lucide-react";
import { QuoteItemBuilder, QuoteItemData } from "@/components/quotes/quote-item-builder";

export const Route = createFileRoute("/_app/novo-orcamento")({ component: NovoOrcamentoPage });

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const db = supabase as any;

function NovoOrcamentoPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Step 1: Client data
  const [clientId, setClientId] = useState("");
  const [validUntilDays, setValidUntilDays] = useState(15);
  const [deliveryDays, setDeliveryDays] = useState(7);
  const [notes, setNotes] = useState("");

  // Step 2: Items
  const [items, setItems] = useState<QuoteItemData[]>([]);

  // Step 3: Discount
  const [globalDiscount, setGlobalDiscount] = useState(0);

  // Buscar clientes
  const { data: clients } = useQuery({
    queryKey: ["clients_list_quote"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name, email, whatsapp").order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!profile,
  });

  // Cálculos financeiros
  const subtotalPrice = items.reduce((s, i) => s + i.total_price, 0);
  const subtotalCost = items.reduce((s, i) => s + i.total_cost, 0);
  const finalValue = subtotalPrice - globalDiscount;
  const totalProfit = finalValue - subtotalCost;
  const globalMargin = finalValue > 0 ? (totalProfit / finalValue) * 100 : 0;

  const isFormValid = !!clientId && items.length > 0 && items.every(i => i.product_name.trim() !== "");

  // Mutation: Salvar
  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: profileData } = await supabase.from('profiles').select('company_id').eq('user_id', (await supabase.auth.getUser()).data.user?.id || "").single();
      if (!profileData?.company_id) throw new Error("Empresa não identificada.");

      // Número sequencial
      const { count } = await supabase.from("quotes").select("*", { count: "exact", head: true });
      const qNum = `ORC-${String((count || 0) + 1).padStart(6, '0')}`;

      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + validUntilDays);

      // 1. Inserir o orçamento
      const { data: insertedQuote, error: quoteError } = await (db).from("quotes").insert([{
        company_id: profileData.company_id,
        client_id: clientId || null,
        quote_number: qNum,
        service_desc: items.map(i => i.product_name).join(", "),
        quantity: items.reduce((s, i) => s + i.quantity, 0),
        cost_value: subtotalCost,
        sale_price: subtotalPrice,
        margin_percentage: globalMargin,
        discount: globalDiscount,
        final_value: finalValue,
        notes: notes || null,
        status: "rascunho",
        valid_until: validUntil.toISOString().split('T')[0],
        delivery_days: deliveryDays,
      }]).select("id").single();

      if (quoteError) throw quoteError;

      // 2. Inserir os itens do orçamento
      if (insertedQuote) {
        const itemsPayload = items.map(item => ({
          quote_id: insertedQuote.id,
          product_service_id: item.product_id || null,
          item_name: item.product_name,
          description: item.notes || null,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
          cost_price: item.is_supplier
            ? item.unit_cost
            : item.unit_cost + Object.values(item.attribute_price_impacts).reduce((s, v) => s + (v || 0), 0),
          margin_percent: item.margin_percent,
          supplier_id: item.supplier_id || null,
          source_origin: item.supplier_id || item.is_supplier ? "supplier_import" : "manual",
          notes: item.notes || null,
          item_attributes: {
            values: item.attributes,
            price_impacts: item.attribute_price_impacts,
            // Snapshot da configuração no momento do orçamento (seção 19): trava
            // custo/preço/prazo/opções usados, para uma atualização futura do
            // fornecedor não alterar silenciosamente um orçamento já enviado.
            snapshot: {
              is_supplier: !!item.is_supplier,
              unit_cost: item.unit_cost,
              unit_price: item.unit_price,
              quantity: item.quantity,
              production_deadline: item.production_deadline || null,
              source_url: item.source_url || null,
              selection: item.selection_snapshot || {},
              override_cost: item.override_unit_cost ?? null,
              captured_at: new Date().toISOString(),
              family_id: item.family_id || null,
              combination_calc: item.calc_snapshot || null,
            },
          },
        }));

        const { error: itemsError } = await (db).from("quote_items").insert(itemsPayload);
        if (itemsError) {
          console.error("Erro ao salvar itens:", itemsError);
        }
      }

      return { quoteNumber: qNum };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["quote_items_all"] });
      toast.success(`Orçamento ${result.quoteNumber} criado com sucesso!`);
      navigate({ to: "/orcamentos", search: { selectProductId: undefined } });
    },
    onError: (err) => toast.error("Erro ao gerar: " + err.message)
  });

  return (
    <>
      <PageHeader
        title="Novo Orçamento Completo"
        description="Configure o cliente, defina os itens e veja os custos numa única tela detalhada."
      />

      <div className="max-w-5xl mx-auto space-y-6 pb-20">
        
        {/* Seção 1: Cliente */}
        <Card className="border-primary/20 shadow-sm">
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">1. Dados do Cliente</h3>
                <p className="text-sm text-muted-foreground">Selecione o cliente e defina os prazos</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label>Cliente *</Label>
                  <Select value={clientId} onValueChange={setClientId}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Busque e selecione o cliente..." /></SelectTrigger>
                    <SelectContent>
                      {clients?.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          <div className="flex items-center gap-2">
                            <span>{c.name}</span>
                            {c.whatsapp && <span className="text-[10px] text-muted-foreground">({c.whatsapp})</span>}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="flex items-center gap-1.5 mt-1">
                      <Calendar className="h-3.5 w-3.5" /> Validade (dias)
                    </Label>
                    <Input type="number" min="1" value={validUntilDays} onChange={(e) => setValidUntilDays(parseInt(e.target.value) || 15)} />
                  </div>
                  <div>
                    <Label className="flex items-center gap-1.5 mt-1">
                      <Calendar className="h-3.5 w-3.5" /> Prazo (dias)
                    </Label>
                    <Input type="number" min="1" value={deliveryDays} onChange={(e) => setDeliveryDays(parseInt(e.target.value) || 7)} />
                  </div>
                </div>
              </div>

              <div>
                <Label>Observações Gerais do Orçamento</Label>
                <Textarea className="mt-1" rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Informações adicionais que aparecerão no orçamento..." />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Seção 2: Itens Detalhados */}
        <Card className="border-primary/20 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <ShoppingCart className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">2. Itens do Orçamento e Variações</h3>
                <p className="text-sm text-muted-foreground">
                  Adicione produtos e configure os materiais e variações individualmente.
                </p>
              </div>
            </div>

            <QuoteItemBuilder items={items} onItemsChange={setItems} />
          </CardContent>
        </Card>

        {/* Seção 3: Resumo Financeiro */}
        <Card className="border-primary/20 shadow-sm overflow-hidden">
          <div className="bg-secondary/30 px-6 py-4 border-b">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Calculator className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">3. Resumo Financeiro e Fechamento</h3>
                <p className="text-sm text-muted-foreground">Ajuste descontos e visualize a rentabilidade</p>
              </div>
            </div>
          </div>
          
          <CardContent className="p-6">
            <div className="grid md:grid-cols-2 gap-8">
              {/* Lista Resumida */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground border-b pb-2">Resumo dos {items.length} itens</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                  {items.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">Nenhum item adicionado ainda.</p>
                  ) : (
                    items.map((item, idx) => {
                      const attrCount = Object.keys(item.attributes).length;
                      return (
                        <div key={item.id} className="flex items-center justify-between p-2.5 bg-secondary/30 rounded-md text-sm hover:bg-secondary/50 transition-colors">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-muted-foreground w-5">{idx + 1}.</span>
                            <span className="font-medium truncate max-w-[180px]">{item.product_name}</span>
                            <span className="text-xs text-muted-foreground">x{item.quantity}</span>
                            {attrCount > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                {attrCount} mat.
                              </span>
                            )}
                          </div>
                          <span className="font-bold">{fmt.format(item.total_price)}</span>
                        </div>
                      );
                    })
                  )}
                </div>
                
                <div className="pt-2">
                  <Label className="flex items-center gap-1.5">
                    <Percent className="h-4 w-4" /> Desconto Global (R$)
                  </Label>
                  <Input
                    className="mt-1"
                    type="number" min="0" step="0.01"
                    value={globalDiscount}
                    onChange={(e) => setGlobalDiscount(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              {/* Painel Final */}
              <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-6 border border-primary/20 flex flex-col justify-center gap-6">
                <div className="grid grid-cols-2 gap-6 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-medium">Subtotal</p>
                    <p className="font-semibold text-lg">{fmt.format(subtotalPrice)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-medium">Custo Produção</p>
                    <p className="font-semibold text-lg">{fmt.format(subtotalCost)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-medium">Lucro Estimado</p>
                    <p className={`font-bold text-lg ${totalProfit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {fmt.format(totalProfit)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-medium">Margem Global</p>
                    <p className={`font-black text-2xl ${globalMargin >= 30 ? "text-emerald-600" : globalMargin >= 15 ? "text-amber-600" : "text-red-500"}`}>
                      {globalMargin.toFixed(1)}%
                    </p>
                  </div>
                </div>
                
                <div className="pt-4 border-t border-primary/10 text-center">
                  <p className="text-sm text-muted-foreground uppercase font-semibold tracking-widest mb-1">Valor Final para o Cliente</p>
                  <p className="text-4xl font-black text-primary">{fmt.format(finalValue)}</p>
                </div>
                
                <Button
                  size="lg"
                  className="w-full h-14 text-lg font-bold mt-2 shadow-lg hover:shadow-xl transition-all"
                  disabled={!isFormValid || saveMutation.isPending}
                  onClick={() => saveMutation.mutate()}
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="h-6 w-6 mr-2 animate-spin" />
                  ) : (
                    <FileText className="h-6 w-6 mr-2" />
                  )}
                  {isFormValid ? "Gerar Orçamento Oficial" : "Preencha cliente e itens para gerar"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
