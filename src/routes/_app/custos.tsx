import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calculator, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/custos")({ component: CustosPage });

const fields = [
  { k: "material", l: "Custo do material" },
  { k: "tinta", l: "Tinta" },
  { k: "papel", l: "Papel / mídia" },
  { k: "filme", l: "Filme" },
  { k: "energia", l: "Energia" },
  { k: "mao", l: "Mão de obra" },
  { k: "acabamento", l: "Acabamento" },
  { k: "perda", l: "Perda / refugo" },
  { k: "embalagem", l: "Embalagem" },
  { k: "taxas", l: "Taxas" },
] as const;

function CustosPage() {
  const queryClient = useQueryClient();
  const [productName, setProductName] = useState("");
  const [qty, setQty] = useState(100);
  const [venda, setVenda] = useState(38);
  const [vals, setVals] = useState<Record<string, number>>({});

  const total = useMemo(() => Object.values(vals).reduce((a, b) => a + (b || 0), 0), [vals]);
  const unit = total / Math.max(qty, 1);
  const lucro = venda - unit;
  const margem = venda > 0 ? (lucro / venda) * 100 : 0;
  const sugerido = unit / (1 - 0.50); // Sugerido baseado em margem alvo de 50%

  const saveProductMutation = useMutation({
    mutationFn: async () => {
      const { data: profileData } = await supabase.from('profiles').select('company_id').eq('id', (await supabase.auth.getUser()).data.user?.id).single();
      const { error } = await supabase.from("products").insert([{
        company_id: profileData?.company_id,
        name: productName || "Produto Simulado",
        category: "Simulação",
        unit: "Unidade",
        base_cost: unit,
        suggested_price: sugerido,
        desired_margin: 50, // Default 50%
        active: true
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Simulação salva como Produto no catálogo!");
      setProductName("");
    },
    onError: (err) => toast.error("Erro ao salvar produto: " + err.message)
  });

  return (
    <>
      <PageHeader title="Custos & Lucro" description="Calculadora completa de custo, preço e margem" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5 text-primary" />Calculadora de custo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <div>
                <Label>Produto</Label>
                <Input 
                  placeholder="Ex: Camiseta DTF" 
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                />
              </div>
              <div>
                <Label>Quantidade</Label>
                <Input type="number" min="1" value={qty} onChange={(e) => setQty(Number(e.target.value) || 1)} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {fields.map((f) => (
                <div key={f.k}>
                  <Label className="text-xs">{f.l} (R$)</Label>
                  <Input type="number" min="0" step="0.01" placeholder="0.00" onChange={(e) => setVals({ ...vals, [f.k]: Number(e.target.value) })} />
                </div>
              ))}
              <div className="md:col-span-2">
                <Label className="text-xs font-semibold">Valor de venda desejado (unitário) (R$)</Label>
                <Input type="number" min="0" step="0.01" value={venda} onChange={(e) => setVenda(Number(e.target.value))} />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button 
                variant="outline" 
                className="flex-1"
                disabled={saveProductMutation.isPending}
                onClick={() => saveProductMutation.mutate()}
              >
                {saveProductMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar como Produto
              </Button>
              <Button 
                className="flex-1"
                onClick={() => toast.info("Para salvar como orçamento, vá até a aba Orçamentos e insira o custo base calculado.")}
              >
                Salvar como Orçamento
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="p-5" style={{ background: "var(--gradient-brand)" }}>
            <p className="text-xs uppercase tracking-wider text-white/80">Resultado</p>
            <p className="text-3xl font-bold text-white mt-1">{margem.toFixed(1)}%</p>
            <p className="text-xs text-white/80 mt-1">Margem real sobre a venda</p>
            <div className="mt-4 pt-4 border-t border-white/20 grid grid-cols-2 gap-3 text-white">
              <div><p className="text-[10px] uppercase opacity-80">Lucro/un</p><p className="text-lg font-semibold">R$ {lucro.toFixed(2)}</p></div>
              <div><p className="text-[10px] uppercase opacity-80">Custo/un</p><p className="text-lg font-semibold">R$ {unit.toFixed(2)}</p></div>
            </div>
          </Card>
          <Card className="p-5">
            <h4 className="font-semibold text-sm mb-3">Resumo do cálculo</h4>
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between"><span className="text-muted-foreground">Custo da produção ({qty} un)</span><strong>R$ {total.toFixed(2)}</strong></li>
              <li className="flex justify-between"><span className="text-muted-foreground">Custo por unidade</span><strong>R$ {unit.toFixed(2)}</strong></li>
              <li className="flex justify-between"><span className="text-muted-foreground">Preço mínimo de segurança (1.5x)</span><strong>R$ {(unit * 1.5).toFixed(2)}</strong></li>
              <li className="flex justify-between"><span className="text-muted-foreground">Preço sugerido (Margem 50%)</span><strong className="text-primary">R$ {sugerido.toFixed(2)}</strong></li>
              <li className="flex justify-between mt-3 pt-3 border-t"><span className="text-muted-foreground">Faturamento bruto projetado</span><strong className="text-foreground">R$ {(venda * qty).toFixed(2)}</strong></li>
              <li className="flex justify-between"><span className="text-muted-foreground">Lucro líquido projetado</span><strong className="text-success">R$ {(lucro * qty).toFixed(2)}</strong></li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
