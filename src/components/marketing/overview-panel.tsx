import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { CHANNEL_LABELS } from "@/lib/marketing-attribution";
import { rate, revenueRoas } from "@/lib/marketing-panel";

type Overview = {
  funnel: {
    tracked_sessions: number;
    ad_sessions: number;
    quotes: number;
    ad_quotes: number;
    orders: number;
    ad_orders: number;
    paid_orders: number;
    ad_paid_orders: number;
  };
  revenue: { total: number; ads: number; reversed_orders: number };
  by_channel: { channel: string; orders: number; revenue: number }[];
  by_campaign: {
    campaign: string;
    meta_campaign_id: string | null;
    source: string | null;
    channel: string;
    orders: number;
    revenue: number;
    last_order_at: string;
  }[];
  spend: { value: number | null; reason: string | null };
  margin: { available: boolean; products_with_cost: number; reason: string };
};

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const pct = (v: number | null) =>
  v === null
    ? "—"
    : new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 }).format(v);

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </Card>
  );
}

function useMarketingOverview(from: string, to: string) {
  return useQuery({
    queryKey: ["marketing-overview", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema("store")
        .rpc("marketing_overview", { p_from: from, p_to: to });
      if (error) throw error;
      return data as unknown as Overview;
    },
  });
}

export function OverviewPanel({ from, to }: { from: string; to: string }) {
  const { data, isLoading, error } = useMarketingOverview(from, to);

  if (isLoading) return <Loader2 className="mx-auto my-10 animate-spin" />;
  if (error || !data) {
    return (
      <Card className="p-6 text-sm text-destructive">
        {(error as { code?: string })?.code === "42501"
          ? "Seu usuário não tem permissão para ver Anúncios e Crescimento."
          : "Não foi possível carregar os números agora."}
      </Card>
    );
  }

  const f = data.funnel;
  const roas = revenueRoas(data.revenue.ads, data.spend.value, data.spend.reason);
  const ticket = f.paid_orders > 0 ? data.revenue.total / f.paid_orders : null;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Receita atribuída a anúncios"
          value={brl(data.revenue.ads)}
          hint={`${f.ad_paid_orders} pedido(s) pago(s) via anúncio`}
        />
        <Kpi
          label="Receita paga no período"
          value={brl(data.revenue.total)}
          hint={`${f.paid_orders} pedido(s) pago(s), todas as origens`}
        />
        <Kpi
          label="Investimento"
          value={data.spend.value === null ? "Indisponível" : brl(data.spend.value)}
          hint={data.spend.reason ?? undefined}
        />
        <Kpi
          label="ROAS de receita"
          value={roas.value === null ? "Indisponível" : roas.value.toFixed(2).replace(".", ",")}
          hint={roas.reason ?? "Receita de anúncios ÷ investimento"}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Ticket médio (pagos)" value={ticket === null ? "—" : brl(ticket)} />
        <Kpi
          label="Margem de contribuição"
          value={data.margin.available ? "—" : "Indisponível"}
          hint={
            data.margin.products_with_cost === 0
              ? "Nenhum produto tem custo cadastrado."
              : data.margin.reason
          }
        />
        <Kpi
          label="Estornos/cancelamentos"
          value={String(data.revenue.reversed_orders)}
          hint="Pedidos que estavam pagos e foram revertidos no período"
        />
        <Kpi
          label="Conversão anúncio → pedido pago"
          value={pct(rate(f.ad_paid_orders, f.ad_sessions))}
          hint={`${f.ad_sessions} visita(s) vindas de anúncio`}
        />
      </div>

      <Card className="p-4">
        <h2 className="mb-3 font-semibold">Funil rastreado</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Etapa</TableHead>
              <TableHead className="text-right">Todas as origens</TableHead>
              <TableHead className="text-right">Via anúncio</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[
              ["Visitas com origem identificada", f.tracked_sessions, f.ad_sessions],
              ["Orçamentos pedidos no site", f.quotes, f.ad_quotes],
              ["Pedidos criados no site", f.orders, f.ad_orders],
              ["Pedidos pagos", f.paid_orders, f.ad_paid_orders],
            ].map(([label, all, ads]) => (
              <TableRow key={label as string}>
                <TableCell>{label}</TableCell>
                <TableCell className="text-right tabular-nums">{all}</TableCell>
                <TableCell className="text-right tabular-nums">{ads}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="mt-2 text-xs text-muted-foreground">
          Pedidos pagos contam pela data de confirmação do pagamento; visitas, orçamentos e pedidos,
          pela data em que aconteceram. Acesso direto sem campanha não gera visita rastreada.
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 font-semibold">Receita por canal</h2>
          {data.by_channel.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum pedido pago no período.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Canal</TableHead>
                  <TableHead className="text-right">Pedidos</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.by_channel.map((c) => (
                  <TableRow key={c.channel}>
                    <TableCell>{CHANNEL_LABELS[c.channel] ?? c.channel}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.orders}</TableCell>
                    <TableCell className="text-right tabular-nums">{brl(c.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 font-semibold">Receita por campanha</h2>
          {data.by_campaign.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum pedido pago com campanha identificada no período.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campanha</TableHead>
                  <TableHead className="text-right">Pedidos</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.by_campaign.map((c) => (
                  <TableRow key={c.campaign}>
                    <TableCell>
                      <div className="font-medium">{c.campaign}</div>
                      <div className="text-xs text-muted-foreground">
                        {CHANNEL_LABELS[c.channel] ?? c.channel}
                        {c.source ? ` · ${c.source}` : ""}
                        {c.meta_campaign_id ? ` · ID ${c.meta_campaign_id}` : ""}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{c.orders}</TableCell>
                    <TableCell className="text-right tabular-nums">{brl(c.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
