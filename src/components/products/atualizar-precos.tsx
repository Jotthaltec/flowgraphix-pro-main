import { Fragment, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  Loader2,
  RefreshCw,
  Save,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Package,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import {
  loadImportedProducts,
  checkProductPrice,
  applyCostUpdate,
  type ImportedProductRow,
  type PriceCheckResult,
} from "@/lib/importer-price-update";

const SLEEP = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fmtBRL = (n: number | null | undefined) =>
  n == null ? "—" : Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function AtualizarPrecos() {
  const { profile } = useAuth();
  const qc = useQueryClient();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["imported-products-price", profile?.company_id],
    enabled: !!profile?.company_id,
    queryFn: () => loadImportedProducts(profile!.company_id!),
  });

  // Alertas gravados pela coleta diária (routes/api.precos.fornecedor.ts).
  const { data: alerts = [] } = useQuery({
    queryKey: ["supplier-alerts", profile?.company_id],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_alerts")
        .select("id, alert_type, severity, title, message, created_at")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data;
    },
  });
  const resolveAlert = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("supplier_alerts")
        .update({ status: "resolved", resolved_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["supplier-alerts"] }),
    onError: (err: Error) => toast.error(err.message),
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<Record<string, PriceCheckResult>>({});
  const [checking, setChecking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [applying, setApplying] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelected(new Set(products.map((p) => p.id)));
  }, [products]);

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  async function checkSelected() {
    const list = products.filter((p) => selected.has(p.id));
    if (!list.length) return toast.error("Selecione ao menos um produto.");
    setChecking(true);
    setProgress(0);
    for (let i = 0; i < list.length; i++) {
      const res = await checkProductPrice(list[i]);
      setResults((r) => ({ ...r, [list[i].id]: res }));
      setProgress(Math.round(((i + 1) / list.length) * 100));
      if (i < list.length - 1) await SLEEP(700);
    }
    setChecking(false);
    toast.success("Verificação de preços concluída.");
  }

  async function apply(row: ImportedProductRow) {
    const result = results[row.id];
    if (!result?.fresh || !profile?.company_id) return;
    setApplying((s) => new Set(s).add(row.id));
    try {
      await applyCostUpdate(result, profile.company_id);
      toast.success(`Custo atualizado: ${row.name}`);
      setResults((r) => {
        const n = { ...r };
        delete n[row.id];
        return n;
      });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["imported-products-price"] });
    } catch (e) {
      toast.error(`Falha ao atualizar ${row.name}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setApplying((s) => {
        const n = new Set(s);
        n.delete(row.id);
        return n;
      });
    }
  }

  async function applyAllChanged() {
    const changed = products.filter((p) => results[p.id]?.comparison?.status === "changed");
    for (const row of changed) await apply(row);
  }

  const stats = useMemo(() => {
    const vals = Object.values(results);
    return {
      changed: vals.filter((r) => r.comparison?.status === "changed").length,
      unchanged: vals.filter((r) => r.comparison?.status === "unchanged").length,
      unavailable: vals.filter((r) => r.comparison?.status === "unavailable").length,
      errors: vals.filter((r) => r.error).length,
    };
  }, [results]);

  if (isLoading) {
    return (
      <div className="p-10 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
      </div>
    );
  }

  if (!products.length) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-muted-foreground">
          <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
          Nenhum produto importado de fornecedor com link de origem.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
        <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <span>
          Se o custo do fornecedor <b>subir</b>, só o custo é atualizado: o seu preço de venda não
          muda. Se o custo <b>cair</b>, a loja mostra uma <b>promoção</b> com o mesmo percentual de
          queda (sua margem % é mantida); quando o custo volta, volta o preço normal. A coleta roda
          sozinha todo dia às 6h; aqui você pode conferir na hora.
        </span>
      </div>

      {alerts.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-sm font-semibold">Alertas do fornecedor</p>
            {alerts.map((a) => (
              <div
                key={a.id}
                className="flex items-start justify-between gap-3 rounded-md border p-2 text-xs"
              >
                <div className="flex items-start gap-2">
                  {a.severity === "info" ? (
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle
                      className={`h-4 w-4 shrink-0 mt-0.5 ${a.severity === "critical" ? "text-destructive" : "text-amber-500"}`}
                    />
                  )}
                  <div>
                    <p className="font-medium text-foreground">{a.title}</p>
                    {a.message && <p className="text-muted-foreground">{a.message}</p>}
                    <p className="text-muted-foreground">
                      {new Date(a.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={resolveAlert.isPending}
                  onClick={() => resolveAlert.mutate(a.id)}
                >
                  Resolvido
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <Button onClick={checkSelected} disabled={checking}>
            {checking ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Verificar preços ({selected.size})
          </Button>
          {stats.changed > 0 && (
            <Button variant="outline" onClick={applyAllChanged} disabled={applying.size > 0}>
              <Save className="h-4 w-4 mr-2" /> Aplicar todos alterados ({stats.changed})
            </Button>
          )}
          <div className="ml-auto flex items-center gap-3 text-xs">
            {stats.changed > 0 && <span className="text-amber-600">{stats.changed} alterados</span>}
            {stats.unchanged > 0 && (
              <span className="text-emerald-600">{stats.unchanged} iguais</span>
            )}
            {stats.unavailable > 0 && (
              <span className="text-destructive">{stats.unavailable} indisponíveis</span>
            )}
            {stats.errors > 0 && <span className="text-destructive">{stats.errors} erros</span>}
          </div>
          {(checking || progress > 0) && <Progress value={progress} className="h-2 w-full" />}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Custo atual</TableHead>
                <TableHead>Custo novo</TableHead>
                <TableHead>Variação</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => {
                const res = results[p.id];
                const cmp = res?.comparison;
                const oldCost =
                  Number(p.cost_price) || (p.quantity_price_table?.[0]?.price ?? null);
                const newCost = res?.fresh?.variants[0]?.price_tiers?.[0]?.total_price ?? null;
                const firstChanged = cmp?.tiers.find((t) => t.kind === "changed");
                const deltaPct = firstChanged?.deltaPct ?? null;
                return (
                  <Fragment key={p.id}>
                    <TableRow>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(p.id)}
                          onCheckedChange={() => toggle(p.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium text-sm max-w-[260px] truncate">
                        {p.name}
                      </TableCell>
                      <TableCell className="text-sm">{fmtBRL(oldCost)}</TableCell>
                      <TableCell className="text-sm">{res ? fmtBRL(newCost) : "—"}</TableCell>
                      <TableCell className="text-sm">
                        {deltaPct == null ? (
                          "—"
                        ) : (
                          <span
                            className={
                              deltaPct > 0
                                ? "text-destructive"
                                : deltaPct < 0
                                  ? "text-emerald-600"
                                  : ""
                            }
                          >
                            {deltaPct > 0 ? "+" : ""}
                            {deltaPct}%
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {res?.error ? (
                          <StatusBadge variant="destructive">erro</StatusBadge>
                        ) : !cmp ? (
                          <StatusBadge variant="muted">não verificado</StatusBadge>
                        ) : cmp.status === "changed" ? (
                          <StatusBadge variant="warning">
                            <AlertTriangle className="h-3 w-3" /> alterado
                          </StatusBadge>
                        ) : cmp.status === "unavailable" ? (
                          <StatusBadge variant="destructive">indisponível</StatusBadge>
                        ) : (
                          <StatusBadge variant="success">
                            <CheckCircle2 className="h-3 w-3" /> igual
                          </StatusBadge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {cmp?.status === "changed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={applying.has(p.id)}
                            onClick={() => apply(p)}
                          >
                            {applying.has(p.id) ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <>Aplicar custo</>
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                    {cmp && (cmp.changedCount > 0 || cmp.newCount > 0 || cmp.removedCount > 0) && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-muted/20 py-2">
                          <Accordion type="single" collapsible>
                            <AccordionItem value="d" className="border-0">
                              <AccordionTrigger className="py-1 text-xs">
                                {cmp.changedCount} alteradas · {cmp.newCount} novas ·{" "}
                                {cmp.removedCount} removidas
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-1 text-[11px]">
                                  {cmp.tiers
                                    .filter((t) => t.kind !== "same")
                                    .map((t) => (
                                      <div
                                        key={t.quantity}
                                        className="bg-card border rounded px-2 py-1"
                                      >
                                        <b>{t.quantity}un</b>{" "}
                                        {t.kind === "new" ? (
                                          <span className="text-emerald-600">
                                            nova {fmtBRL(t.newCost)}
                                          </span>
                                        ) : t.kind === "removed" ? (
                                          <span className="text-destructive">removida</span>
                                        ) : (
                                          <span>
                                            {fmtBRL(t.oldCost)} → {fmtBRL(t.newCost)}{" "}
                                            <span
                                              className={
                                                (t.deltaPct ?? 0) > 0
                                                  ? "text-destructive"
                                                  : "text-emerald-600"
                                              }
                                            >
                                              ({(t.deltaPct ?? 0) > 0 ? "+" : ""}
                                              {t.deltaPct}%)
                                            </span>
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
