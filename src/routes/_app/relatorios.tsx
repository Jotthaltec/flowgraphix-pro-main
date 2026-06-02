import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2, Download } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/relatorios")({ component: RelatoriosPage });

const reports = [
  { id: "vendas", t: "Vendas por período", d: "Faturamento mensal e anual (Exportar Pagamentos)" },
  { id: "produtos", t: "Lucro por produto", d: "Identifique os produtos mais rentáveis (Exportar Pedidos)" },
  { id: "clientes", t: "Clientes", d: "Exportação da base de clientes completa" },
  { id: "orcamentos", t: "Orçamentos", d: "Lista de todos os orçamentos e status" },
];

function RelatoriosPage() {
  const [loadingReport, setLoadingReport] = useState<string | null>(null);

  const exportCSV = async (id: string, fileName: string) => {
    setLoadingReport(id);
    try {
      let data: any[] = [];
      let headers: string[] = [];

      if (id === "vendas") {
        const { data: d } = await supabase.from("payments").select("*, orders(order_number), clients(name)");
        data = d || [];
        headers = ["ID", "Pedido", "Cliente", "Valor Total", "Valor Pago", "Pendente", "Status", "Forma Pagamento", "Vencimento", "Data Pagamento"];
        data = data.map(r => [r.id, r.orders?.order_number, r.clients?.name, r.total_value, r.paid_value, r.pending_value, r.status, r.payment_method, r.due_date, r.paid_at]);
      } else if (id === "produtos") {
        const { data: d } = await supabase.from("orders").select("*, clients(name)");
        data = d || [];
        headers = ["Pedido", "Cliente", "Produto", "Qtd", "Valor Total", "Custo", "Lucro", "Status Produção", "Prazo"];
        data = data.map(r => [r.order_number, r.clients?.name, r.product_name, r.quantity, r.total_value, r.cost_value, r.profit_value, r.production_status, r.deadline]);
      } else if (id === "clientes") {
        const { data: d } = await supabase.from("clients").select("*");
        data = d || [];
        headers = ["Nome", "Empresa", "Documento", "WhatsApp", "Email", "Status", "Total Gasto"];
        data = data.map(r => [r.name, r.company_name, r.document, r.whatsapp, r.email, r.status, r.total_spent]);
      } else if (id === "orcamentos") {
        const { data: d } = await supabase.from("quotes").select("*, clients(name)");
        data = d || [];
        headers = ["Orçamento", "Cliente", "Serviço", "Custo", "Venda", "Desconto", "Final", "Lucro", "Margem %", "Status"];
        data = data.map(r => [r.quote_number, r.clients?.name, r.service_name, r.cost_value, r.sale_value, r.discount_value, r.final_value, r.estimated_profit, r.margin_percent, r.status]);
      }

      if (data.length === 0) {
        toast.info("Nenhum dado encontrado para exportar.");
        setLoadingReport(null);
        return;
      }

      const csvContent = [
        headers.join(";"),
        ...data.map(row => row.map((v: any) => `"${String(v || '').replace(/"/g, '""')}"`).join(";"))
      ].join("\n");

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `${fileName}_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success("Relatório gerado com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao gerar relatório: " + error.message);
    } finally {
      setLoadingReport(null);
    }
  };

  return (
    <>
      <PageHeader title="Relatórios e Exportação" description="Baixe planilhas CSV com os dados da sua gráfica para análise" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map((r) => (
          <Card key={r.id} className="group hover:shadow-lg hover:border-primary/30 transition-all">
            <CardHeader>
              <CardTitle className="text-base">{r.t}</CardTitle>
              <CardDescription className="text-xs">{r.d}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="outline" 
                size="sm" 
                disabled={loadingReport === r.id}
                onClick={() => exportCSV(r.id, r.id)}
              >
                {loadingReport === r.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                Baixar CSV
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="mt-6 p-6">
        <h3 className="font-semibold mb-2">Painel Analítico</h3>
        <p className="text-sm text-muted-foreground mb-4">Para visualização gráfica dos dados, utilize a aba Dashboard. Esta seção de Relatórios é destinada à exportação de dados brutos.</p>
        <Button variant="secondary" onClick={() => window.location.href = '/dashboard'}>
          <ArrowRight className="h-4 w-4 mr-2" /> Ir para o Dashboard
        </Button>
      </Card>
    </>
  );
}
