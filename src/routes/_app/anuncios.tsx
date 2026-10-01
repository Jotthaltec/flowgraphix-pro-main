import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { AttributedOrders } from "@/components/marketing/attributed-orders";
import { OverviewPanel } from "@/components/marketing/overview-panel";
import { SignalsPanel } from "@/components/marketing/signals-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PERIOD_LABELS, periodRange, type PeriodPreset } from "@/lib/marketing-panel";

export const Route = createFileRoute("/_app/anuncios")({ component: AnunciosPage });

function AnunciosPage() {
  const [preset, setPreset] = useState<PeriodPreset>("30d");
  const { from, to } = periodRange(preset);

  return (
    <div>
      <PageHeader
        title="Anúncios e Crescimento"
        description="Origem dos pedidos pagos, receita por campanha e sinais de conversão para a Meta."
        action={
          <Select value={preset} onValueChange={(v) => setPreset(v as PeriodPreset)}>
            <SelectTrigger className="w-48" aria-label="Período">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PERIOD_LABELS) as PeriodPreset[]).map((p) => (
                <SelectItem key={p} value={p}>
                  {PERIOD_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      <Tabs defaultValue="visao-geral">
        <TabsList>
          <TabsTrigger value="visao-geral">Visão geral</TabsTrigger>
          <TabsTrigger value="pedidos">Pedidos atribuídos</TabsTrigger>
          <TabsTrigger value="sinais">Sinais e configurações</TabsTrigger>
        </TabsList>
        <TabsContent value="visao-geral" className="mt-4">
          <OverviewPanel from={from} to={to} />
        </TabsContent>
        <TabsContent value="pedidos" className="mt-4">
          <AttributedOrders from={from} to={to} />
        </TabsContent>
        <TabsContent value="sinais" className="mt-4">
          <SignalsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
