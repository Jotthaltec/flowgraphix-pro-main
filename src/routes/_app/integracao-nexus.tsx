import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Archive,
  Download,
  ExternalLink,
  EyeOff,
  Loader2,
  MoreVertical,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  SquarePen,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { describeSyncHealth, syncStatusDisplay } from "@/lib/product-sync";
import {
  WITHDRAW_LABEL,
  describePublishSuccess,
  publishCrmProduct,
  storeProductUrl,
  withdrawCrmProduct,
  type WithdrawMode,
} from "@/lib/store-publication";
import {
  EMPTY_FILTERS,
  applyFilters,
  buildHealthRows,
  computeTotals,
  rowActions,
  runBulk,
  toCsv,
  type BulkResult,
  type CrmProductRow,
  type HealthFilters,
  type HealthRow,
  type HealthViewRow,
  type LogRow,
  type PanelStatus,
  type QueueRow,
  type RowAction,
  type SiteProductRow,
  type Tri,
} from "@/lib/integration-health";

export const Route = createFileRoute("/_app/integracao-nexus")({ component: IntegracaoNexusPage });

const LOJA_URL = import.meta.env.VITE_LOJA_URL ?? "http://localhost:3000";
// O schema store não está nos tipos gerados do Supabase.

const db = supabase as any;

const dateTime = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
        new Date(iso),
      )
    : "—";

const brl = (v: number | null) =>
  v == null
    ? "—"
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function age(iso: string | null) {
  if (!iso) return null;
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (min < 60) return `${min} min`;
  if (min < 48 * 60) return `${Math.round(min / 60)} h`;
  return `${Math.round(min / 1440)} dias`;
}

function statusDisplay(s: PanelStatus) {
  return s === "not_published"
    ? { label: "Não publicado", variant: "muted" as const }
    : syncStatusDisplay(s);
}

const STATUS_FILTERS: { value: PanelStatus; label: string }[] = [
  { value: "synced", label: "Sincronizados" },
  { value: "stale", label: "Desatualizados" },
  { value: "attention", label: "Com atenção" },
  { value: "error", label: "Com erro" },
  { value: "pending", label: "Despublicados / aguardando" },
  { value: "not_published", label: "Não publicados" },
  { value: "archived", label: "Arquivados" },
];

type ReasonTarget = { mode: WithdrawMode; rows: HealthRow[] };

function IntegracaoNexusPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<HealthFilters>(EMPTY_FILTERS);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reasonTarget, setReasonTarget] = useState<ReasonTarget | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<{ title: string; items: BulkResult[] } | null>(null);

  const data = useQuery({
    queryKey: ["integracao-nexus"],
    queryFn: async () => {
      const [health, site, crm, queue, lastOk, lastFail] = await Promise.all([
        db.schema("store").from("crm_product_sync_health").select("*"),
        supabase.from("site_products").select("id,categoria,preco_base,imagens,variantes,tiragens"),
        supabase
          .from("products")
          .select(
            "id,name,commercial_name,supplier_name,category,status,sale_price,imported_from_supplier,updated_at",
          ),
        db
          .schema("store")
          .from("product_sync_queue")
          .select("status,created_at")
          .in("status", ["pending", "processing", "error"]),
        db
          .schema("store")
          .from("sync_log")
          .select("created_at,sucesso,acao,erro")
          .eq("entidade", "produtos")
          .eq("sucesso", true)
          .order("created_at", { ascending: false })
          .limit(1),
        db
          .schema("store")
          .from("sync_log")
          .select("created_at,sucesso,acao,erro")
          .eq("entidade", "produtos")
          .eq("sucesso", false)
          .order("created_at", { ascending: false })
          .limit(1),
      ]);
      // A view de saúde é a fonte do status real: sem ela o painel não mostra nada inventado.
      if (health.error)
        throw new Error(`Status de sincronização indisponível: ${health.error.message}`);
      for (const r of [site, crm, queue, lastOk, lastFail])
        if (r.error) throw new Error(r.error.message);
      const rows = buildHealthRows(
        health.data as HealthViewRow[],
        site.data as SiteProductRow[],
        crm.data as CrmProductRow[],
      );
      const totals = computeTotals(rows, queue.data as QueueRow[], [
        ...(lastOk.data as LogRow[]),
        ...(lastFail.data as LogRow[]),
      ]);
      return { rows, totals };
    },
    refetchInterval: 60_000,
  });

  const rows = useMemo(() => data.data?.rows ?? [], [data.data]);
  const totals = data.data?.totals;
  const visible = useMemo(() => applyFilters(rows, filters), [rows, filters]);
  const suppliers = useMemo(
    () => [...new Set(rows.map((r) => r.supplier).filter((s): s is string => !!s))].sort(),
    [rows],
  );
  const categories = useMemo(
    () => [...new Set(rows.map((r) => r.category).filter((c): c is string => !!c))].sort(),
    [rows],
  );
  const selectedRows = visible.filter((r) => selected.has(r.key));

  const setFilter = <K extends keyof HealthFilters>(k: K, v: HealthFilters[K]) =>
    setFilters((f) => ({ ...f, [k]: v }));

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["integracao-nexus"] });
    queryClient.invalidateQueries({ queryKey: ["site_products"] });
  };

  // ---- Ações: cada item só conta como feito com o retorno do banco --------
  async function execute(action: RowAction | WithdrawMode, target: HealthRow[], why = "") {
    // "Repetir" (produto em erro) e "Publicar" são a mesma operação.
    const accepts = (r: HealthRow) => {
      const available = rowActions(r);
      return action === "publish" || action === "retry"
        ? available.includes("publish") || available.includes("retry")
        : available.includes(action);
    };
    const applicable = target.filter(accepts);
    const skipped: BulkResult[] = target
      .filter((r) => !applicable.includes(r))
      .map((r) => ({
        key: r.key,
        name: r.name,
        ok: false,
        message: "Ação não se aplica a este produto.",
      }));

    setBusy({ done: 0, total: applicable.length });
    const done = await runBulk(
      applicable,
      async (row) => {
        if (action === "unpublish" || action === "archive") {
          await withdrawCrmProduct(db, row.crmId!, action, why);
          return WITHDRAW_LABEL[action].done;
        }
        const result = await publishCrmProduct(db, row.crmId!);
        const { title, description } = describePublishSuccess(result);
        return result.warnings.length ? `${title} ${description}` : title;
      },
      (d, t) => setBusy({ done: d, total: t }),
    );
    setBusy(null);
    setSelected(new Set());
    refresh();

    const all = [...done, ...skipped];
    const failed = all.filter((r) => !r.ok).length;
    if (target.length === 1 && all.length === 1) {
      if (all[0].ok) toast.success(all[0].message);
      else toast.error(all[0].message);
      return;
    }
    const label =
      action === "unpublish"
        ? "Despublicação"
        : action === "archive"
          ? "Arquivamento"
          : "Publicação";
    setResults({ title: `${label}: ${all.length - failed} ok, ${failed} com falha`, items: all });
  }

  function askReason(mode: WithdrawMode, target: HealthRow[]) {
    setReason("");
    setReasonTarget({ mode, rows: target });
  }

  function exportCsv() {
    const blob = new Blob([toCsv(visible)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `integracao-nexus-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const toggleAll = (checked: boolean) =>
    setSelected(checked ? new Set(visible.map((r) => r.key)) : new Set());

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integração Nexus"
        description="Saúde da sincronização entre o Flow e a loja. Os status são calculados dos dados reais, não da última publicação."
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={refresh} disabled={data.isFetching}>
              <RefreshCw className={`h-4 w-4 mr-1 ${data.isFetching ? "animate-spin" : ""}`} />{" "}
              Atualizar
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!visible.length}>
              <Download className="h-4 w-4 mr-1" /> Exportar CSV
            </Button>
          </div>
        }
      />

      {data.error ? (
        <Card className="p-6">
          <p className="text-sm text-destructive">{(data.error as Error).message}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            O painel depende das migrações 20260929030000 e 20260929040000 aplicadas no banco.
          </p>
        </Card>
      ) : null}

      {totals ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
            <Metric
              label="No Flow"
              value={totals.crmProducts}
              hint={`${totals.importedFromSupplier} de fornecedor`}
            />
            <Metric label="Publicados" value={totals.published} hint="ativos na loja" />
            <Metric
              label="Não publicados"
              value={totals.notPublished + totals.pending}
              hint={`${totals.pending} despublicado(s)`}
              onClick={() => setFilter("statuses", ["not_published", "pending"])}
            />
            <Metric
              label="Desatualizados"
              value={totals.stale}
              tone="warning"
              onClick={() => setFilter("statuses", ["stale"])}
            />
            <Metric
              label="Com atenção"
              value={totals.attention}
              tone="warning"
              onClick={() => setFilter("statuses", ["attention"])}
            />
            <Metric
              label="Com erro"
              value={totals.error}
              tone="destructive"
              onClick={() => setFilter("statuses", ["error"])}
            />
            <Metric
              label="Órfãos"
              value={totals.orphans}
              tone={totals.orphans ? "destructive" : undefined}
              hint="sem produto no Flow"
            />
            <Metric
              label="Fila"
              value={totals.queueSize}
              hint={
                totals.oldestQueuedAt
                  ? `mais antigo há ${age(totals.oldestQueuedAt)}`
                  : totals.queueGaveUp
                    ? `${totals.queueGaveUp} desistência(s)`
                    : "vazia"
              }
              tone={totals.queueGaveUp ? "destructive" : undefined}
            />
          </div>
          <Card className="flex flex-col gap-1 p-3 text-xs text-muted-foreground md:flex-row md:gap-6">
            <span>
              Última sincronização bem-sucedida:{" "}
              <b className="text-foreground">{dateTime(totals.lastSuccessAt)}</b>
            </span>
            <span>
              Última falha: <b className="text-foreground">{dateTime(totals.lastFailureAt)}</b>
              {totals.lastFailureMessage ? ` — ${totals.lastFailureMessage}` : ""}
            </span>
            <span>
              Arquivados: <b className="text-foreground">{totals.archived}</b>
            </span>
          </Card>
        </>
      ) : null}

      <Card className="space-y-3 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por produto, fornecedor ou slug..."
              value={filters.search}
              onChange={(e) => setFilter("search", e.target.value)}
              className="pl-9"
            />
          </div>
          <FilterSelect
            label="Status"
            value={
              filters.statuses.length === 1
                ? filters.statuses[0]
                : filters.statuses.length
                  ? "multi"
                  : "all"
            }
            onChange={(v) => setFilter("statuses", v === "all" ? [] : [v as PanelStatus])}
            options={[
              ["all", "Todos os status"],
              ...(filters.statuses.length > 1
                ? ([["multi", "Seleção do card"]] as [string, string][])
                : []),
              ...STATUS_FILTERS.map((s) => [s.value, s.label] as [string, string]),
            ]}
          />
          <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
            Limpar filtros
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          <FilterSelect
            label="Origem"
            value={filters.origin}
            onChange={(v) => setFilter("origin", v as HealthFilters["origin"])}
            options={[
              ["all", "Todas"],
              ["supplier", "Fornecedor"],
              ["manual", "Cadastro manual"],
            ]}
          />
          <FilterSelect
            label="Fornecedor"
            value={filters.supplier || "all"}
            onChange={(v) => setFilter("supplier", v === "all" ? "" : v)}
            options={[["all", "Todos"], ...suppliers.map((s) => [s, s] as [string, string])]}
          />
          <FilterSelect
            label="Categoria"
            value={filters.category || "all"}
            onChange={(v) => setFilter("category", v === "all" ? "" : v)}
            options={[["all", "Todas"], ...categories.map((c) => [c, c] as [string, string])]}
          />
          <FilterSelect
            label="Publicação"
            value={filters.sync}
            onChange={(v) => setFilter("sync", v as HealthFilters["sync"])}
            options={[
              ["all", "Todas"],
              ["auto", "Automática"],
              ["manual", "Manual"],
            ]}
          />
          <TriSelect
            label="Preço"
            value={filters.withPrice}
            onChange={(v) => setFilter("withPrice", v)}
          />
          <TriSelect
            label="Variantes"
            value={filters.withVariants}
            onChange={(v) => setFilter("withVariants", v)}
          />
          <TriSelect
            label="Imagens"
            value={filters.withImages}
            onChange={(v) => setFilter("withImages", v)}
          />
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Alterado desde</Label>
            <Input
              type="date"
              value={filters.changedSince}
              onChange={(e) => setFilter("changedSince", e.target.value)}
            />
          </div>
        </div>
      </Card>

      {selectedRows.length > 0 ? (
        <Card className="flex flex-wrap items-center gap-2 p-3 text-sm">
          <span className="font-medium">{selectedRows.length} selecionado(s)</span>
          <Button size="sm" disabled={!!busy} onClick={() => execute("publish", selectedRows)}>
            <Send className="h-4 w-4 mr-1" /> Publicar / ressincronizar
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!!busy}
            onClick={() => askReason("unpublish", selectedRows)}
          >
            <EyeOff className="h-4 w-4 mr-1" /> Despublicar
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!!busy}
            onClick={() => askReason("archive", selectedRows)}
          >
            <Archive className="h-4 w-4 mr-1" /> Arquivar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Limpar seleção
          </Button>
          {busy ? (
            <span className="ml-auto flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {busy.done}/{busy.total}
            </span>
          ) : null}
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        {data.isLoading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Carregando...
          </div>
        ) : visible.length === 0 ? (
          <p className="p-12 text-center text-sm text-muted-foreground">
            {rows.length ? "Nenhum produto com esses filtros." : "Nenhum produto do Flow ainda."}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={visible.length > 0 && visible.every((r) => selected.has(r.key))}
                    onCheckedChange={(c) => toggleAll(!!c)}
                    aria-label="Selecionar todos"
                  />
                </TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Status real</TableHead>
                <TableHead>Na loja</TableHead>
                <TableHead>Quando</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((row) => (
                <HealthTableRow
                  key={row.key}
                  row={row}
                  checked={selected.has(row.key)}
                  onCheck={(c) =>
                    setSelected((s) => {
                      const next = new Set(s);
                      if (c) next.add(row.key);
                      else next.delete(row.key);
                      return next;
                    })
                  }
                  disabled={!!busy}
                  onAction={(a) =>
                    a === "unpublish" || a === "archive" ? askReason(a, [row]) : execute(a, [row])
                  }
                />
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={!!reasonTarget} onOpenChange={(o) => !o && setReasonTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reasonTarget ? WITHDRAW_LABEL[reasonTarget.mode].action : ""}
              {reasonTarget && reasonTarget.rows.length > 1
                ? ` (${reasonTarget.rows.length} produtos)`
                : ""}
            </DialogTitle>
            <DialogDescription>
              {reasonTarget?.mode === "archive"
                ? "Fica fora de venda com todo o histórico; só uma nova publicação pelo Flow o traz de volta."
                : "Sai da vitrine; volta com Publicar. Nada é apagado."}{" "}
              O motivo fica registrado no produto e no log.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo</Label>
            <Textarea
              id="motivo"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReasonTarget(null)}>
              Cancelar
            </Button>
            <Button
              disabled={!reason.trim()}
              onClick={() => {
                const t = reasonTarget!;
                setReasonTarget(null);
                execute(t.mode, t.rows, reason);
              }}
            >
              {reasonTarget ? WITHDRAW_LABEL[reasonTarget.mode].action : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!results} onOpenChange={(o) => !o && setResults(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{results?.title}</DialogTitle>
            <DialogDescription>Resultado de cada produto, confirmado pelo banco.</DialogDescription>
          </DialogHeader>
          <ul className="max-h-[60vh] space-y-2 overflow-y-auto text-sm">
            {results?.items.map((r) => (
              <li key={r.key} className="flex gap-2">
                <StatusBadge variant={r.ok ? "success" : "destructive"}>
                  {r.ok ? "ok" : "falhou"}
                </StatusBadge>
                <span>
                  <b>{r.name}</b> — <span className="text-muted-foreground">{r.message}</span>
                </span>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: "warning" | "destructive";
  onClick?: () => void;
}) {
  const color =
    value > 0 && tone === "destructive"
      ? "text-destructive"
      : value > 0 && tone === "warning"
        ? "text-warning-foreground"
        : "";
  return (
    <Card
      className={`p-3 ${onClick ? "cursor-pointer transition-colors hover:bg-muted/50" : ""}`}
      onClick={onClick}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold tabular-nums ${color}`}>{value}</p>
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </Card>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <div className="min-w-[150px] space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function TriSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Tri;
  onChange: (v: Tri) => void;
}) {
  return (
    <FilterSelect
      label={label}
      value={value}
      onChange={(v) => onChange(v as Tri)}
      options={[
        ["all", "Todos"],
        ["yes", "Com"],
        ["no", "Sem"],
      ]}
    />
  );
}

const ACTION_LABEL: Record<RowAction, { label: string; icon: typeof Send }> = {
  publish: { label: "Publicar / ressincronizar", icon: Send },
  retry: { label: "Repetir publicação", icon: RotateCcw },
  unpublish: { label: "Despublicar", icon: EyeOff },
  archive: { label: "Arquivar", icon: Archive },
};

function HealthTableRow({
  row,
  checked,
  onCheck,
  onAction,
  disabled,
}: {
  row: HealthRow;
  checked: boolean;
  onCheck: (c: boolean) => void;
  onAction: (a: RowAction) => void;
  disabled: boolean;
}) {
  const status = statusDisplay(row.status);
  const detail = row.health ? describeSyncHealth(row.health) : null;
  const actions = rowActions(row);
  return (
    <TableRow>
      <TableCell>
        <Checkbox
          checked={checked}
          onCheckedChange={(c) => onCheck(!!c)}
          aria-label={`Selecionar ${row.name}`}
        />
      </TableCell>
      <TableCell className="max-w-[360px]">
        <p className="font-medium">{row.name}</p>
        <p className="text-xs text-muted-foreground">
          {[row.supplier, row.category, row.autoSync === false ? "publicação manual" : null]
            .filter(Boolean)
            .join(" · ") || "—"}
        </p>
        {detail?.summary.map((s) => (
          <p key={s} className="text-xs text-muted-foreground">
            {s}
          </p>
        ))}
        {!detail && row.orphan ? (
          <p className="text-xs text-destructive">Ver proposta de reconciliação</p>
        ) : null}
      </TableCell>
      <TableCell>
        <StatusBadge variant={status.variant}>{status.label}</StatusBadge>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {row.storeId ? (
          <>
            <p>{brl(row.price)}</p>
            <p>
              {row.images} img · {row.variants} var · {row.tiers} tir
            </p>
            {!row.active ? <p>fora da vitrine</p> : null}
          </>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {detail ? (
          detail.dates.map((d) => <p key={d}>{d}</p>)
        ) : (
          <p>Flow alterado: {dateTime(row.crmUpdatedAt)}</p>
        )}
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              disabled={disabled}
              aria-label={`Ações de ${row.name}`}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {actions.map((a) => {
              const { label, icon: Icon } = ACTION_LABEL[a];
              return (
                <DropdownMenuItem key={a} onClick={() => onAction(a)}>
                  <Icon className="h-4 w-4 mr-2" /> {label}
                </DropdownMenuItem>
              );
            })}
            {actions.length ? <DropdownMenuSeparator /> : null}
            {row.crmId && !row.orphan ? (
              <DropdownMenuItem asChild>
                <Link to="/produtos" search={{ editar: row.crmId }}>
                  <SquarePen className="h-4 w-4 mr-2" /> Abrir no Flow
                </Link>
              </DropdownMenuItem>
            ) : null}
            {row.slug && row.active ? (
              <DropdownMenuItem asChild>
                <a
                  href={storeProductUrl(LOJA_URL, row.slug)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 mr-2" /> Abrir na loja
                </a>
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
