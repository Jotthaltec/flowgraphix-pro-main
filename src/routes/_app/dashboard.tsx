import { createFileRoute } from "@tanstack/react-router";
import {
  DollarSign, FileText, Workflow, AlertTriangle, UserPlus, FileSignature, MapPin, Loader2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { PageHeader } from "@/components/page-header";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { profile } = useAuth();

  // Load everything for the dashboard
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ["dashboard_stats"],
    queryFn: async () => {
      // Current date info
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      // Fetch core tables
      const [
        { data: orders },
        { data: quotes },
        { count: newClientsCount },
        { count: pendingContractsCount },
        { count: leadsCount }
      ] = await Promise.all([
        supabase.from("orders").select("id, created_at, product_desc, total_value, payment_status, production_status, deadline, clients(name)").order("created_at", { ascending: false }),
        supabase.from("quotes").select("status"),
        supabase.from("clients").select("id", { count: "exact", head: true }).gte("created_at", firstDayOfMonth),
        supabase.from("contracts").select("id", { count: "exact", head: true }).eq("status", "aguardando_assinatura"),
        supabase.from("leads").select("id", { count: "exact", head: true })
      ]);

      // Calculate Revenue
      let faturamentoMes = 0;
      let faturamentoAno = 0;

      orders?.forEach(o => {
        const val = Number(o.total_value) || 0;
        const createdDate = new Date(o.created_at);

        // Revenue calculation (100% for paid, 50% for upfront paid)
        let revenueContribution = 0;
        if (o.payment_status === 'pago') {
          revenueContribution = val;
        } else if (o.payment_status === 'entrada_paga') {
          revenueContribution = val * 0.5;
        }

        faturamentoAno += revenueContribution;

        if (createdDate.getMonth() === now.getMonth() && createdDate.getFullYear() === now.getFullYear()) {
          faturamentoMes += revenueContribution;
        }
      });

      let orcamentosAbertos = quotes?.filter(q => !['aprovado', 'recusado', 'convertido_pedido'].includes(q.status || '')).length || 0;
      let pedidosProducao = orders?.filter(o => !['entregue', 'cancelado'].includes(o.production_status || '')).length || 0;
      let pedidosAtrasados = orders?.filter(o => o.deadline && new Date(o.deadline) < now && !['entregue'].includes(o.production_status || '')).length || 0;

      // Calculate Sales Chart (Monthly)
      const salesByMonth = Array(12).fill(0);
      orders?.forEach(o => {
        if (o.payment_status === 'pago' || o.payment_status === 'entrada_paga') {
          const m = new Date(o.created_at).getMonth();
          const val = Number(o.total_value) || 0;
          salesByMonth[m] += o.payment_status === 'pago' ? val : val * 0.5;
        }
      });
      const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      const salesChart = salesByMonth.map((v, i) => ({ m: monthNames[i], v })).slice(0, now.getMonth() + 1);

      // Calculate Pie Chart (Production Status)
      const statusCounts: Record<string, number> = {};
      orders?.forEach(o => {
        const s = o.production_status || 'pedido_criado';
        statusCounts[s] = (statusCounts[s] || 0) + 1;
      });
      const statusMap: Record<string, {name: string, color: string}> = {
        'pedido_criado': { name: 'Criado', color: 'var(--muted-foreground)' },
        'arte_pendente': { name: 'Aguardando Arte', color: 'var(--chart-2)' },
        'arte_em_criacao': { name: 'Arte em Criação', color: 'var(--chart-4)' },
        'arte_aprovada': { name: 'Arte Aprovada', color: 'var(--info)' },
        'em_producao': { name: 'Em Produção', color: 'var(--chart-1)' },
        'em_acabamento': { name: 'Acabamento', color: 'var(--warning)' },
        'pronto': { name: 'Pronto', color: 'var(--chart-3)' },
      };
      const pieData = Object.keys(statusCounts)
        .filter(k => k !== 'entregue' && k !== 'cancelado') // Hide delivered in pie
        .map(k => ({
          name: statusMap[k]?.name || k,
          value: statusCounts[k],
          color: statusMap[k]?.color || 'var(--chart-5)'
        }));

      // Calculate Bar Chart (Products)
      const productCounts: Record<string, number> = {};
      orders?.forEach(o => {
        const name = o.product_desc?.split(" (x")[0] || 'Diversos';
        productCounts[name] = (productCounts[name] || 0) + 1;
      });
      const productsChart = Object.keys(productCounts)
        .map(k => ({ name: k, v: productCounts[k] }))
        .sort((a, b) => b.v - a.v)
        .slice(0, 5);

      // Latest activities (orders mapped)
      const activities = orders?.slice(0, 5).map(o => ({
        date: new Date(o.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
        client: o.clients?.name || 'Cliente',
        action: `Novo pedido de ${o.product_desc}`,
        status: o.production_status?.replace('_', ' ') || 'Criado',
        v: 'info' as const
      })) || [];

      return {
        cards: [
          { title: "Faturamento Anual", value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(faturamentoAno), trend: "Ano atual", icon: DollarSign, color: "text-success" },
          { title: "Orçamentos em aberto", value: orcamentosAbertos.toString(), trend: "pendentes", icon: FileText, color: "text-info" },
          { title: "Pedidos na fila", value: pedidosProducao.toString(), trend: "ativos", icon: Workflow, color: "text-accent" },
          { title: "Pedidos atrasados", value: pedidosAtrasados.toString(), trend: "atenção", icon: AlertTriangle, color: "text-destructive" },
          { title: "Clientes novos", value: newClientsCount?.toString() || "0", trend: "este mês", icon: UserPlus, color: "text-success" },
          { title: "Contratos pendentes", value: pendingContractsCount?.toString() || "0", trend: "aguardando", icon: FileSignature, color: "text-warning-foreground" },
          { title: "Leads captados", value: leadsCount?.toString() || "0", trend: "total", icon: MapPin, color: "text-accent" },
        ],
        salesChart,
        pieData,
        productsChart,
        activities
      };
    },
    enabled: !!profile,
  });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { cards = [], salesChart = [], pieData = [], productsChart = [], activities = [] } = dashboardData || {};

  return (
    <>
      <PageHeader
        title={`Olá, ${profile?.full_name?.split(" ")[0] || "tudo bem"} 👋`}
        description={`Visão geral de ${profile?.company_name || "sua gráfica"} hoje`}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {cards.slice(0, 4).map((c) => (
          <Card key={c.title} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{c.title}</p>
                  <p className="text-2xl font-bold mt-1.5">{c.value}</p>
                  <p className={`text-xs mt-0.5 ${c.color}`}>{c.trend}</p>
                </div>
                <div className={`h-9 w-9 rounded-lg bg-secondary flex items-center justify-center ${c.color}`}>
                  <c.icon className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recebimentos do Ano</CardTitle>
            <CardDescription>Evolução de pagamentos efetuados</CardDescription>
          </CardHeader>
          <CardContent>
            {salesChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={salesChart}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="m" stroke="var(--color-muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={12} width={80} tickFormatter={(val) => `R$ ${val}`} />
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                  <Area type="monotone" dataKey="v" stroke="var(--chart-1)" strokeWidth={2.5} fill="url(#g1)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground border-2 border-dashed rounded-md">
                Sem dados financeiros no período
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fila de Produção</CardTitle>
            <CardDescription>Distribuição atual de pedidos não entregues</CardDescription>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>
                    {pieData.map((d: any) => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground border-2 border-dashed rounded-md">
                Fila de produção vazia
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle>Top Produtos (Qtd)</CardTitle></CardHeader>
          <CardContent>
            {productsChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={productsChart} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                  <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={11} />
                  <YAxis type="category" dataKey="name" stroke="var(--color-muted-foreground)" fontSize={11} width={80} />
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                  <Bar dataKey="v" fill="var(--chart-2)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground border-2 border-dashed rounded-md">
                Nenhum pedido registrado
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Últimos Pedidos</CardTitle>
            <CardDescription>Acompanhe as entradas mais recentes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y -mx-2">
              {activities.length > 0 ? activities.map((a: any, i: number) => (
                <div key={i} className="flex items-center justify-between gap-4 px-2 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{a.client}</p>
                    <p className="text-xs text-muted-foreground truncate">{a.action}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <StatusBadge variant={a.v as any}>{a.status}</StatusBadge>
                    <span className="text-xs text-muted-foreground hidden sm:inline">{a.date}</span>
                  </div>
                </div>
              )) : (
                <div className="py-8 text-center text-sm text-muted-foreground border-2 border-dashed rounded-md mx-2">
                  Nenhum pedido recente.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
