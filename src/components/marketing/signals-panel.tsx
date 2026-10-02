import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleAlert, Loader2, Power } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { MetaConnectionCheck } from "@/components/marketing/meta-connection-check";
import {
  EVENT_STATUS_LABELS,
  SKIP_REASON_LABELS,
  signalHealth,
  type SignalStatus,
} from "@/lib/marketing-panel";

const when = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Sao_Paulo",
      }).format(new Date(iso))
    : "—";

const STATE_VARIANT = {
  desligado: "muted",
  incompleto: "warning",
  teste: "info",
  real: "success",
} as const;

function useSignalStatus() {
  return useQuery({
    queryKey: ["marketing-signal-status"],
    queryFn: async () => {
      const { data, error } = await supabase.schema("store").rpc("marketing_signal_status");
      if (error) throw error;
      return data as unknown as SignalStatus;
    },
    refetchInterval: 30_000,
  });
}

function SignalSettingsForm({ status }: { status: SignalStatus }) {
  const queryClient = useQueryClient();
  const s = status.settings;
  const [enabled, setEnabled] = useState(s?.enabled ?? false);
  const [mode, setMode] = useState<"test" | "live">(s?.mode ?? "test");
  const [pixel, setPixel] = useState(s?.pixel_id ?? "");
  const [testCode, setTestCode] = useState(s?.test_event_code ?? "");
  const [version, setVersion] = useState(s?.graph_api_version ?? "v25.0");

  const save = useMutation({
    mutationFn: async (values: { enabled: boolean; mode: "test" | "live" }) => {
      const { error } = await supabase.schema("store").rpc("set_marketing_signal_settings", {
        p_enabled: values.enabled,
        p_mode: values.mode,
        p_pixel_id: pixel.trim(),
        p_test_event_code: testCode.trim(),
        p_graph_api_version: version.trim(),
      });
      if (error) throw error;
    },
    onSuccess: (_d, values) => {
      toast.success(
        values.enabled ? "Configuração salva." : "Sinais desligados: Pixel e envio parados.",
      );
      void queryClient.invalidateQueries({ queryKey: ["marketing-signal-status"] });
    },
    onError: (error: { message?: string }) =>
      toast.error(error.message ?? "Não foi possível salvar."),
  });

  const confirmLive = () =>
    mode !== "live" ||
    window.confirm(
      "Modo real envia compras e leads para a Meta e influencia a otimização dos anúncios. Confirma?",
    );

  return (
    <Card className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-semibold">Configuração</h2>
        <Button
          variant="destructive"
          size="sm"
          disabled={!s?.enabled || save.isPending}
          onClick={() => save.mutate({ enabled: false, mode })}
        >
          <Power className="mr-1 h-4 w-4" /> Desligar agora
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="pixel-id">Pixel (ID do conjunto de dados)</Label>
          <Input
            id="pixel-id"
            inputMode="numeric"
            value={pixel}
            onChange={(e) => setPixel(e.target.value.replace(/\D/g, ""))}
            placeholder="Ex.: 123456789012345"
          />
        </div>
        <div className="space-y-2">
          <Label>Modo</Label>
          <Select value={mode} onValueChange={(v) => setMode(v as "test" | "live")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="test">Teste (Testar eventos)</SelectItem>
              <SelectItem value="live">Real</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="test-code">Código de teste do Gerenciador de Eventos</Label>
          <Input
            id="test-code"
            value={testCode}
            onChange={(e) => setTestCode(e.target.value.replace(/[^A-Za-z0-9]/g, ""))}
            placeholder="Ex.: TEST12345"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="graph-version">Versão da API da Meta</Label>
          <Input id="graph-version" value={version} onChange={(e) => setVersion(e.target.value)} />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={enabled} onCheckedChange={setEnabled} />
          Ligar Pixel na loja e envio pelo servidor
        </label>
        <Button
          disabled={save.isPending}
          onClick={() => confirmLive() && save.mutate({ enabled, mode })}
        >
          {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Salvar
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        O token da Conversions API não é digitado aqui: ele fica no Vault do Supabase
        (meta_capi_access_token) e nunca chega ao navegador. A loja leva até 5 minutos para mostrar
        ou esconder o Pixel depois de salvar.
      </p>
    </Card>
  );
}

type AttributionSettings = { window_days: number; primary_model: string; version: number } | null;

function AttributionSettings() {
  const { data, isLoading } = useQuery({
    queryKey: ["marketing-attribution-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema("store")
        .from("marketing_attribution_settings")
        .select("window_days, primary_model, version")
        .maybeSingle();
      if (error) throw error;
      return data as AttributionSettings;
    },
  });
  if (isLoading) return null;
  // Remonta o formulário quando a versão salva muda.
  return <AttributionSettingsForm key={data?.version ?? 0} data={data ?? null} />;
}

function AttributionSettingsForm({ data }: { data: AttributionSettings }) {
  const queryClient = useQueryClient();
  const [windowDays, setWindowDays] = useState(String(data?.window_days ?? 7));
  const [model, setModel] = useState(data?.primary_model ?? "last_touch");

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.schema("store").rpc("set_marketing_attribution_settings", {
        p_window_days: Number(windowDays),
        p_primary_model: model,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Regras de atribuição salvas. Valem para os próximos pagamentos.");
      void queryClient.invalidateQueries({ queryKey: ["marketing-attribution-settings"] });
    },
    onError: (error: { message?: string }) =>
      toast.error(error.message ?? "Não foi possível salvar."),
  });

  return (
    <Card className="space-y-4 p-4">
      <h2 className="font-semibold">Regras de atribuição</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="janela">Janela (dias, 1–90)</Label>
          <Input
            id="janela"
            type="number"
            min={1}
            max={90}
            value={windowDays}
            onChange={(e) => setWindowDays(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Modelo principal</Label>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last_touch">Último contato</SelectItem>
              <SelectItem value="first_touch">Primeiro contato</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Versão {data?.version ?? "padrão"} · os dois modelos são sempre calculados; o principal é
          o exibido nos números.
        </p>
        <Button
          variant="outline"
          disabled={save.isPending || !(Number(windowDays) >= 1 && Number(windowDays) <= 90)}
          onClick={() => save.mutate()}
        >
          Salvar regras
        </Button>
      </div>
    </Card>
  );
}

function EventQueue() {
  const { data, error, isLoading } = useQuery({
    queryKey: ["marketing-conversion-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema("store")
        .from("conversion_events")
        .select(
          "id, event_name, event_id, status, skip_reason, attempts, last_http_status, last_error_code, last_error_message, sent_mode, sent_at, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    refetchInterval: 30_000,
  });

  return (
    <Card className="p-4">
      <h2 className="mb-3 font-semibold">Últimos eventos para a Meta</h2>
      {isLoading ? (
        <Loader2 className="animate-spin" />
      ) : error ? (
        <p className="text-sm text-muted-foreground">
          A fila é visível só para quem gerencia anúncios.
        </p>
      ) : data?.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum evento ainda.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Evento</TableHead>
              <TableHead>Criado</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="hidden md:table-cell">Detalhe</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.map((e) => (
              <TableRow key={e.id}>
                <TableCell>
                  <div className="font-medium">{e.event_name}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">{e.event_id}</div>
                </TableCell>
                <TableCell className="text-sm">{when(e.created_at)}</TableCell>
                <TableCell>
                  <StatusBadge
                    variant={
                      e.status === "sent"
                        ? "success"
                        : e.status === "failed" || e.status === "expired"
                          ? "destructive"
                          : e.status === "skipped"
                            ? "muted"
                            : "info"
                    }
                  >
                    {EVENT_STATUS_LABELS[e.status] ?? e.status}
                    {e.status === "sent" && e.sent_mode === "test" ? " (teste)" : ""}
                  </StatusBadge>
                </TableCell>
                <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                  {e.status === "skipped"
                    ? (SKIP_REASON_LABELS[e.skip_reason ?? ""] ?? e.skip_reason)
                    : e.last_error_code
                      ? `${e.last_error_code}${e.last_error_message ? ` — ${e.last_error_message}` : ""} · ${e.attempts} tentativa(s)`
                      : e.sent_at
                        ? `Enviado ${when(e.sent_at)}`
                        : `${e.attempts} tentativa(s)`}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}

export function SignalsPanel() {
  const { data: status, isLoading, error } = useSignalStatus();
  if (isLoading) return <Loader2 className="mx-auto my-10 animate-spin" />;
  if (error || !status) {
    return (
      <Card className="p-6 text-sm text-destructive">Não foi possível carregar os sinais.</Card>
    );
  }
  const health = signalHealth(status);

  return (
    <div className="space-y-6">
      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge variant={STATE_VARIANT[health.state]}>
            {health.state === "real"
              ? "Real"
              : health.state === "teste"
                ? "Teste"
                : health.state === "incompleto"
                  ? "Incompleto"
                  : "Desligado"}
          </StatusBadge>
          <span className="text-sm">{health.title}</span>
        </div>
        {health.stalled ? (
          <p className="text-sm text-destructive">
            Há eventos esperando há mais de 30 minutos com tudo configurado: verifique o despacho.
          </p>
        ) : null}
        <ul className="grid gap-2 sm:grid-cols-2">
          {health.checks.map((c) => (
            <li key={c.label} className="flex items-start gap-2 text-sm">
              {c.ok ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              ) : (
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              )}
              <span>
                {c.label}
                {!c.ok ? (
                  <span className="block text-xs text-muted-foreground">{c.hint}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
        <div className="text-xs text-muted-foreground">
          Último envio: {when(status.last_sent_at)}
          {status.last_failure
            ? ` · última falha: ${status.last_failure.code ?? "?"} em ${when(status.last_failure.at)}`
            : ""}
        </div>
      </Card>
      <MetaConnectionCheck />
      <SignalSettingsForm key={status.settings?.version ?? 0} status={status} />
      <EventQueue />
      <AttributionSettings />
    </div>
  );
}
