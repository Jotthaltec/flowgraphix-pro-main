import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Factory, AlertTriangle, CheckCircle2, Clock, TrendingUp, PackageMinus, BarChart3, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemo } from "react";

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function ProductionDashboard() {

  // Cast necessário: tipos do Supabase não foram regenerados após a migration de produção.
  const db = supabase as any;

  // 1. Todas as OPs
  const { data: orders, isLoading: loadingOrders } = useQuery({
    queryKey: ["dashboard_production_orders"],
    queryFn: async () => {
      const { data, error } = await db
        .from("production_orders")
        .select("id, order_number, status, priority, expected_delivery, created_at");
      if (error) throw error;
      return (data || []) as any[];
    }
  });

  // 2. Todos os Itens de Produção
  const { data: items, isLoading: loadingItems } = useQuery({
    queryKey: ["dashboard_production_items"],
    queryFn: async () => {
      const { data, error } = await db
        .from("production_order_items")
        .select("id, status, quantity, production_order_id, created_at");
      if (error) throw error;
      return (data || []) as any[];
    }
  });

  // 3. Consumo de Materiais (custo total)
  const { data: materials, isLoading: loadingMat } = useQuery({
    queryKey: ["dashboard_materials"],
    queryFn: async () => {
      const { data, error } = await db
        .from("production_materials_consumption")
        .select("actual_qty, unit_cost");
      if (error) throw error;
      return (data || []) as any[];
    }
  });

  // 4. Refações
  const { data: reworks, isLoading: loadingRew } = useQuery({
    queryKey: ["dashboard_reworks"],
    queryFn: async () => {
      const { data, error } = await db
        .from("production_reworks")
        .select("id, status, reason, created_at");
      if (error) throw error;
      return (data || []) as any[];
    }
  });

  const isLoading = loadingOrders || loadingItems || loadingMat || loadingRew;

  // Métricas calculadas
  const metrics = useMemo(() => {
    if (!orders || !items || !materials || !reworks) return null;

    const totalOPs = orders.length;
    const opsEmAndamento = orders.filter(o => o.status === 'em_producao' || o.status === 'aprovado').length;
    const opsConcluidas = orders.filter(o => o.status === 'concluido').length;
    const opsUrgentes = orders.filter(o => o.priority === 'urgente' || o.priority === 'alta').length;

    const totalItens = items.length;
    const itensAguardando = items.filter(i => (i.status || 'aguardando') === 'aguardando').length;
    const itensPreImpressao = items.filter(i => i.status === 'pre_impressao').length;
    const itensImpressao = items.filter(i => i.status === 'impressao').length;
    const itensAcabamento = items.filter(i => i.status === 'acabamento').length;
    const itensFinalizado = items.filter(i => i.status === 'finalizado').length;

    const custoTotal = materials.reduce((sum, m) => sum + ((m.actual_qty || 0) * (m.unit_cost || 0)), 0);
    const totalApontamentos = materials.length;

    const totalRefacoes = reworks.length;
    const refacoesPendentes = reworks.filter(r => r.status === 'pendente').length;
    const refacoesResolvidas = reworks.filter(r => r.status === 'resolvido').length;
    const taxaRefacao = totalItens > 0 ? ((totalRefacoes / totalItens) * 100).toFixed(1) : "0.0";

    // Itens atrasados (OP com expected_delivery no passado e item não finalizado)
    const today = new Date();
    today.setHours(0,0,0,0);
    const opsMap = new Map(orders.map(o => [o.id, o]));
    const itensAtrasados = items.filter(i => {
      const op = opsMap.get(i.production_order_id);
      if (!op?.expected_delivery) return false;
      const delivery = new Date(op.expected_delivery);
      delivery.setHours(0,0,0,0);
      return delivery < today && i.status !== 'finalizado';
    }).length;

    // Distribuição por status para gráfico de barras simples (CSS)
    const statusDist = [
      { label: "Aguardando", count: itensAguardando, color: "bg-muted-foreground/60" },
      { label: "Pré-impressão", count: itensPreImpressao, color: "bg-amber-500" },
      { label: "Impressão", count: itensImpressao, color: "bg-sky-500" },
      { label: "Acabamento", count: itensAcabamento, color: "bg-violet-500" },
      { label: "Finalizado", count: itensFinalizado, color: "bg-emerald-500" },
    ];
    const maxCount = Math.max(...statusDist.map(s => s.count), 1);

    return {
      totalOPs, opsEmAndamento, opsConcluidas, opsUrgentes,
      totalItens, itensAtrasados,
      custoTotal, totalApontamentos,
      totalRefacoes, refacoesPendentes, refacoesResolvidas, taxaRefacao,
      statusDist, maxCount
    };
  }, [orders, items, materials, reworks]);

  if (isLoading) {
    return <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-muted-foreground" /></div>;
  }

  if (!metrics) return null;

  return (
    <div className="space-y-6">
      {/* Linha 1: KPIs Principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="OPs Abertas"
          value={metrics.opsEmAndamento}
          subtitle={`${metrics.totalOPs} no total`}
          icon={<Factory className="h-5 w-5 text-sky-500" />}
          accentColor="border-sky-500/50"
        />
        <KPICard
          title="OPs Concluídas"
          value={metrics.opsConcluidas}
          subtitle={metrics.totalOPs > 0 ? `${((metrics.opsConcluidas / metrics.totalOPs) * 100).toFixed(0)}% de taxa` : "—"}
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />}
          accentColor="border-emerald-500/50"
        />
        <KPICard
          title="Itens Atrasados"
          value={metrics.itensAtrasados}
          subtitle={metrics.itensAtrasados > 0 ? "Ação necessária!" : "Nenhum atraso"}
          icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
          accentColor={metrics.itensAtrasados > 0 ? "border-red-500/50 bg-red-500/5" : "border-emerald-500/50"}
        />
        <KPICard
          title="Prioridade Alta/Urgente"
          value={metrics.opsUrgentes}
          subtitle="OPs com alta prioridade"
          icon={<Zap className="h-5 w-5 text-amber-500" />}
          accentColor="border-amber-500/50"
        />
      </div>

      {/* Linha 2: Custo e Qualidade */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard
          title="Custo Total Apontado"
          value={fmt.format(metrics.custoTotal)}
          subtitle={`${metrics.totalApontamentos} lançamento(s)`}
          icon={<TrendingUp className="h-5 w-5 text-indigo-500" />}
          accentColor="border-indigo-500/50"
          isValueString
        />
        <KPICard
          title="Refações Registradas"
          value={metrics.totalRefacoes}
          subtitle={`${metrics.refacoesPendentes} pendentes · ${metrics.refacoesResolvidas} resolvidas`}
          icon={<PackageMinus className="h-5 w-5 text-rose-500" />}
          accentColor="border-rose-500/50"
        />
        <KPICard
          title="Taxa de Refação"
          value={`${metrics.taxaRefacao}%`}
          subtitle="Refações / Total de Itens"
          icon={<BarChart3 className="h-5 w-5 text-orange-500" />}
          accentColor="border-orange-500/50"
          isValueString
        />
      </div>

      {/* Linha 3: Distribuição por Status (gráfico de barras simples em CSS) */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" /> Distribuição de Itens por Etapa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {metrics.statusDist.map(s => (
              <div key={s.label} className="flex items-center gap-3">
                <span className="text-xs font-medium text-muted-foreground w-28 shrink-0 text-right">{s.label}</span>
                <div className="flex-1 h-7 bg-secondary/50 rounded-md overflow-hidden relative">
                  <div
                    className={`h-full ${s.color} rounded-md transition-all duration-500 ease-out`}
                    style={{ width: `${Math.max((s.count / metrics.maxCount) * 100, s.count > 0 ? 8 : 0)}%` }}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-foreground/70">
                    {s.count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KPICard({ title, value, subtitle, icon, accentColor, isValueString }: {
  title: string;
  value: number | string;
  subtitle: string;
  icon: React.ReactNode;
  accentColor: string;
  isValueString?: boolean;
}) {
  return (
    <Card className={`shadow-sm border-l-4 ${accentColor} transition-shadow hover:shadow-md`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
          {icon}
        </div>
        <p className={`font-black ${isValueString ? 'text-xl' : 'text-3xl'} text-foreground leading-none mb-1`}>
          {value}
        </p>
        <p className="text-[11px] text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  );
}
