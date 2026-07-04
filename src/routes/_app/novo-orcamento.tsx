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

  const [step, setStep] = useState(1);

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

  const selectedClient = clients?.find(c => c.id === clientId);

  // Validação dos passos
  const canGoStep2 = !!clientId;
  const canGoStep3 = items.length > 0 && items.every(i => i.product_name.trim() !== "");

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
          cost_price: item.unit_cost + Object.values(item.attribute_price_impacts).reduce((s, v) => s + (v || 0), 0),
          margin_percent: item.margin_percent,
          supplier_id: item.supplier_id || null,
          source_origin: item.supplier_id ? "supplier_import" : "manual",
          notes: item.notes || null,
          item_attributes: {
            values: item.attributes,
            price_impacts: item.attribute_price_impacts
          }
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

  const stepIndicators = [
    { num: 1, label: "Cliente", icon: User },
    { num: 2, label: "Itens", icon: ShoppingCart },
    { num: 3, label: "Resumo", icon: Calculator },
  ];

  return (
    <>
      <PageHeader
        title="Novo Orçamento"
        description="Monte o orçamento com produtos, variações e preços calculados automaticamente"
      />

      {/* Step Indicators */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {stepIndicators.map((s, idx) => (
          <div key={s.num} className="flex items-center gap-2">
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer ${
                step === s.num
                  ? "bg-primary text-primary-foreground shadow-md"
                  : step > s.num
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                    : "bg-secondary text-muted-foreground"
              }`}
              onClick={() => {
                if (s.num < step) setStep(s.num);
              }}
            >
              {step > s.num ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <s.icon className="h-4 w-4" />
              )}
              {s.label}
            </div>
            {idx < stepIndicators.length - 1 && (
              <div className={`w-8 h-0.5 ${step > s.num ? "bg-emerald-400" : "bg-border"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Cliente */}
      {step === 1 && (
        <Card className="max-w-2xl mx-auto">
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Dados do Cliente</h3>
                <p className="text-sm text-muted-foreground">Selecione o cliente e defina prazos</p>
              </div>
            </div>

            <div className="grid gap-4">
              <div>
                <Label>Cliente *</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
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
                  <Label className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" /> Validade (dias)
                  </Label>
                  <Input type="number" min="1" value={validUntilDays} onChange={(e) => setValidUntilDays(parseInt(e.target.value) || 15)} />
                </div>
                <div>
                  <Label className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" /> Prazo de Entrega (dias)
                  </Label>
                  <Input type="number" min="1" value={deliveryDays} onChange={(e) => setDeliveryDays(parseInt(e.target.value) || 7)} />
                </div>
              </div>

              <div>
                <Label>Observações Gerais</Label>
                <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Informações adicionais sobre o orçamento..." />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button disabled={!canGoStep2} onClick={() => setStep(2)}>
                Próximo: Itens <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Itens */}
      {step === 2 && (
        <div className="max-w-2xl mx-auto space-y-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Itens do Orçamento</h3>
                  <p className="text-sm text-muted-foreground">
                    Adicione produtos e configure materiais/variações. O preço é calculado automaticamente.
                  </p>
                </div>
              </div>

              <QuoteItemBuilder items={items} onItemsChange={setItems} />
            </CardContent>
          </Card>

          {/* Subtotal flutuante */}
          {items.length > 0 && (
            <Card className="sticky bottom-4 bg-background/95 backdrop-blur border-primary/20 shadow-lg">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex gap-6">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Itens</p>
                      <p className="font-bold text-lg">{items.length}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Custo Total</p>
                      <p className="font-bold text-sm">{fmt.format(subtotalCost)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Subtotal</p>
                      <p className="font-bold text-lg text-primary">{fmt.format(subtotalPrice)}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
            </Button>
            <Button disabled={!canGoStep3} onClick={() => setStep(3)}>
              Próximo: Resumo <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Resumo Financeiro */}
      {step === 3 && (
        <div className="max-w-2xl mx-auto space-y-4">
          <Card>
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Calculator className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Resumo do Orçamento</h3>
                  <p className="text-sm text-muted-foreground">Revise os valores antes de gerar</p>
                </div>
              </div>

              {/* Cliente Info */}
              <div className="p-3 bg-secondary/50 rounded-md flex items-center gap-3">
                <User className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-semibold text-sm">{selectedClient?.name || "Cliente não selecionado"}</p>
                  <p className="text-xs text-muted-foreground">
                    Validade: {validUntilDays} dias · Entrega: {deliveryDays} dias
                  </p>
                </div>
              </div>

              {/* Lista resumida de itens */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Itens ({items.length})</h4>
                {items.map((item, idx) => {
                  const attrCount = Object.keys(item.attributes).length;
                  return (
                    <div key={item.id} className="flex items-center justify-between p-2 bg-secondary/30 rounded-md text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground w-5">{idx + 1}.</span>
                        <span className="font-medium">{item.product_name}</span>
                        <span className="text-xs text-muted-foreground">x{item.quantity}</span>
                        {attrCount > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                            {attrCount} variação(ões)
                          </span>
                        )}
                      </div>
                      <span className="font-bold">{fmt.format(item.total_price)}</span>
                    </div>
                  );
                })}
              </div>

              {/* Desconto global */}
              <div className="grid gap-2">
                <Label className="flex items-center gap-1.5">
                  <Percent className="h-3.5 w-3.5" /> Desconto Global (R$)
                </Label>
                <Input
                  type="number" min="0" step="0.01"
                  value={globalDiscount}
                  onChange={(e) => setGlobalDiscount(parseFloat(e.target.value) || 0)}
                />
              </div>

              {/* Painel financeiro final */}
              <div className="p-4 rounded-lg bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 grid grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Custo Total</p>
                  <p className="font-bold text-sm">{fmt.format(subtotalCost)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Valor Final</p>
                  <p className="font-black text-xl text-primary">{fmt.format(finalValue)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Lucro</p>
                  <p className={`font-bold text-sm ${totalProfit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                    {fmt.format(totalProfit)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Margem</p>
                  <p className={`font-bold text-lg ${globalMargin >= 30 ? "text-emerald-600" : globalMargin >= 15 ? "text-amber-600" : "text-red-500"}`}>
                    {globalMargin.toFixed(1)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
            </Button>
            <Button
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
              className="min-w-[200px]"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              Gerar Orçamento
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
