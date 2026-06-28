import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  Link2,
  Loader2,
  Sparkles,
  Layers,
  ListChecks,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Trash2,
  Save,
  History,
  Image as ImageIcon,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import { supabase } from "@/integrations/supabase/client";
import { analyzeSupplierLink, discoverCatalogLinks, scanProductVariants } from "@/integrations/supabase/importer-actions";
import { validateImportUrl, parseBatchUrls } from "@/services/productImporterService";
import { persistImportedProduct } from "@/lib/importer-persistence";
import {
  createCatalogJob,
  loadOpenJobs,
  loadJobItems,
  updateImportItem,
  updateImportJob,
  syncJobCounters,
  type ImportJobRow,
} from "@/lib/importer-jobs";
import type { ImportedProduct, ImportItemStatus } from "@/types/importedProduct";

type Mode = "single" | "batch" | "catalog";

interface QueueItem {
  id: string;
  url: string;
  status: ImportItemStatus;
  product?: ImportedProduct;
  error?: string;
  selected: boolean;
  /** id da linha em product_import_items (fila persistente). */
  dbId?: string;
  // edições manuais (sobrescrevem o produto na hora de salvar)
  editName?: string;
  editCategory?: string;
  editSubcategory?: string;
  saved?: "created" | "updated" | "skipped";
}

interface ImporterOptions {
  updateExisting: boolean;
  importImages: boolean;
  importPriceTiers: boolean;
  importTemplates: boolean;
  importDescription: boolean;
  descriptionInternalOnly: boolean;
  saveAsExternalSupplier: boolean;
  scanVariants: boolean;
  copyImagesToStorage: boolean;
}

const DEFAULT_OPTIONS: ImporterOptions = {
  updateExisting: false,
  importImages: true,
  importPriceTiers: true,
  importTemplates: true,
  importDescription: true,
  descriptionInternalOnly: false,
  saveAsExternalSupplier: true,
  scanVariants: false,
  copyImagesToStorage: false,
};

const SLEEP = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

let seq = 0;
const nextId = () => `q${++seq}-${Date.now()}`;

export function ImportadorProdutos() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>("single");
  const [singleUrl, setSingleUrl] = useState("");
  const [batchText, setBatchText] = useState("");
  const [catalogUrl, setCatalogUrl] = useState("");
  const [margin, setMargin] = useState(50);
  const [options, setOptions] = useState<ImporterOptions>(DEFAULT_OPTIONS);

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [openJobs, setOpenJobs] = useState<ImportJobRow[]>([]);

  const patch = (id: string, p: Partial<QueueItem>) =>
    setQueue((q) => q.map((it) => (it.id === id ? { ...it, ...p } : it)));

  // Carrega importações de catálogo em aberto (para retomar — seção 30).
  async function refreshOpenJobs() {
    if (!profile?.company_id) return;
    setOpenJobs(await loadOpenJobs(profile.company_id));
  }
  useEffect(() => {
    refreshOpenJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.company_id]);

  // ---- Análise de 1 item (não salva no catálogo — só extrai a prévia) -------
  async function analyzeOne(item: QueueItem) {
    patch(item.id, { status: "analisando", error: undefined });
    const v = validateImportUrl(item.url);
    if (!v.ok) {
      patch(item.id, { status: "bloqueado", error: v.reason });
      if (item.dbId) await updateImportItem(item.dbId, { status: "bloqueado", errors: [v.reason || "URL inválida"] });
      return;
    }
    const res = options.scanVariants
      ? await scanProductVariants({ data: { url: v.url! } })
      : await analyzeSupplierLink({ data: { url: v.url! } });
    if (!res.success) {
      patch(item.id, { status: "erro", error: res.error });
      if (item.dbId) await updateImportItem(item.dbId, { status: "erro", errors: [res.error] });
      return;
    }
    const product = res.product;
    const status: ImportItemStatus = product.classification.review_required ? "revisao_necessaria" : "extraido";
    patch(item.id, {
      status,
      product,
      selected: product.errors.length === 0,
      editName: product.original_name,
      editCategory: product.classification.category,
      editSubcategory: product.classification.subcategory,
    });
    if (item.dbId) await updateImportItem(item.dbId, { status, normalized_data: product, errors: product.errors });
  }

  /**
   * Processa, em fila sequencial e com intervalo, apenas os itens ainda
   * pendentes (seção 30: não reprocessa o que já foi feito; pode retomar).
   */
  async function processPending(items: QueueItem[], jobId: string | null) {
    const pending = items.filter((it) => it.status === "pendente");
    if (!pending.length) return;
    setIsRunning(true);
    setProgress(0);
    for (let i = 0; i < pending.length; i++) {
      await analyzeOne(pending[i]);
      setProgress(Math.round(((i + 1) / pending.length) * 100));
      if (jobId && (i % 5 === 0 || i === pending.length - 1)) await syncJobCounters(jobId);
      if (i < pending.length - 1) await SLEEP(700);
    }
    setIsRunning(false);
    if (jobId) {
      await syncJobCounters(jobId);
      refreshOpenJobs();
    }
  }

  async function runAnalysis() {
    if (!profile?.company_id) {
      toast.error("Empresa do usuário não identificada.");
      return;
    }

    // ----- Modo catálogo: descobre links, persiste a fila e processa --------
    if (mode === "catalog") {
      const v = validateImportUrl(catalogUrl);
      if (!v.ok) return toast.error(v.reason || "URL de catálogo inválida.");
      setIsRunning(true);
      setProgress(3);
      const disc = await discoverCatalogLinks({ data: { url: v.url! } });
      setIsRunning(false);
      setProgress(0);
      if (!disc.success) return toast.error(disc.error);
      toast.success(`${disc.links.length} produtos encontrados (${disc.pages_crawled} página(s)).`);

      // Fila persistente: cria job + itens no banco (com fallback em memória).
      const created = await createCatalogJob(profile.company_id, v.url!, disc.links);
      let items: QueueItem[];
      let jobId: string | null = null;
      if (created) {
        jobId = created.job.id;
        items = created.items.map((it) => ({
          id: nextId(),
          dbId: it.id,
          url: it.source_url,
          status: it.status,
          selected: false,
        }));
        toast.info("Fila salva — a importação pode ser retomada se você sair da página.");
      } else {
        items = disc.links.map((url) => ({ id: nextId(), url, status: "pendente" as ImportItemStatus, selected: false }));
      }
      setCurrentJobId(jobId);
      setQueue(items);
      await processPending(items, jobId);
      return;
    }

    // ----- Modos individual / lote (em memória) -----------------------------
    let urls: string[] = [];
    if (mode === "single") urls = singleUrl.trim() ? [singleUrl.trim()] : [];
    if (mode === "batch") urls = parseBatchUrls(batchText);
    if (!urls.length) return toast.error("Informe ao menos um link válido.");

    const items: QueueItem[] = urls.map((url) => ({ id: nextId(), url, status: "pendente", selected: false }));
    setCurrentJobId(null);
    setQueue(items);
    await processPending(items, null);
  }

  // Retoma um job de catálogo interrompido: recarrega itens e processa pendentes.
  async function resumeJob(job: ImportJobRow) {
    const rows = await loadJobItems(job.id);
    if (!rows.length) return toast.error("Não há itens para retomar neste job.");
    const items: QueueItem[] = rows.map((r) => ({
      id: nextId(),
      dbId: r.id,
      url: r.source_url,
      status: r.status,
      product: r.normalized_data || undefined,
      selected: !!r.normalized_data && (r.normalized_data.errors?.length ?? 0) === 0 && r.status !== "importado",
      editName: r.normalized_data?.original_name,
      editCategory: r.normalized_data?.classification.category,
      editSubcategory: r.normalized_data?.classification.subcategory,
      error: r.errors?.[0],
    }));
    setCurrentJobId(job.id);
    setMode("catalog");
    setQueue(items);
    const pendingCount = items.filter((it) => it.status === "pendente").length;
    toast.success(`Retomando: ${items.length} itens (${pendingCount} pendentes).`);
    await processPending(items, job.id);
  }

  // ---- Aplica edições + opções ao produto antes de salvar ------------------
  function buildEffective(item: QueueItem): ImportedProduct {
    const p = structuredClone(item.product!) as ImportedProduct;
    if (item.editName) {
      p.original_name = item.editName;
      p.normalized_name = item.editName;
    }
    if (item.editCategory) p.classification.category = item.editCategory;
    if (item.editSubcategory) p.classification.subcategory = item.editSubcategory;
    if (!options.importImages) p.images = [];
    if (!options.importPriceTiers) p.variants.forEach((v) => (v.price_tiers = []));
    if (!options.importTemplates) p.templates = [];
    if (!options.importDescription) p.description = undefined;
    return p;
  }

  async function saveSelected() {
    if (!profile?.company_id) {
      toast.error("Empresa do usuário não identificada.");
      return;
    }
    const toSave = queue.filter((it) => it.selected && it.product);
    if (!toSave.length) return toast.error("Selecione ao menos um produto para salvar.");

    setIsSaving(true);
    let created = 0,
      updated = 0,
      skipped = 0,
      failed = 0,
      structuredWarn = 0;

    for (const item of toSave) {
      try {
        patch(item.id, { status: "importando" });
        const product = buildEffective(item);
        const result = await persistImportedProduct(product, {
          companyId: profile.company_id,
          marginPercent: margin,
          supplierName: options.saveAsExternalSupplier ? product.supplier : null,
          updateExisting: options.updateExisting,
          descriptionInternalOnly: options.descriptionInternalOnly,
          copyImages: options.copyImagesToStorage,
        });
        if (result.action === "created") created++;
        else if (result.action === "updated") updated++;
        else skipped++;
        const finalStatus: ImportItemStatus =
          result.action === "skipped" ? "ignorado" : result.action === "updated" ? "atualizado" : "importado";
        patch(item.id, { status: finalStatus, saved: result.action });
        if (result.structuredWarnings?.length) structuredWarn += result.structuredWarnings.length;
        if (item.dbId) await updateImportItem(item.dbId, { status: finalStatus, product_id: result.productId });

        // Registra histórico (best-effort, não bloqueia a importação).
        if (result.action !== "skipped") {
          const tiers = product.variants[0]?.price_tiers || [];
          supabase
            .from("supplier_imports")
            .insert({
              company_id: profile.company_id,
              source_url: product.source_url,
              supplier_domain: product.supplier_domain,
              extraction_status: "imported",
              product_name: product.original_name,
              supplier_sku: product.external_id ?? null,
              current_price: tiers[0]?.total_price ?? null,
              main_image_url: product.images.find((im) => im.is_main)?.url ?? null,
              production_deadline: product.production_time?.original_production_time ?? null,
            })
            .then(undefined, () => {});
        }
      } catch (e: any) {
        failed++;
        patch(item.id, { status: "erro", error: e?.message || "Falha ao salvar." });
      }
    }

    setIsSaving(false);
    if (currentJobId) {
      await updateImportJob(currentJobId, { status: "importado", finished_at: new Date().toISOString() });
      await syncJobCounters(currentJobId);
      refreshOpenJobs();
    }
    toast.success(
      `Importação concluída: ${created} criados, ${updated} atualizados, ${skipped} ignorados${failed ? `, ${failed} com erro` : ""}.`,
    );
    if (structuredWarn > 0) {
      toast.warning(`${structuredWarn} aviso(s) ao gravar dados estruturados (variantes/atributos). Produto salvo mesmo assim.`);
    }
  }

  // ---- Agregações para os painéis de avisos/erros --------------------------
  const stats = useMemo(() => {
    const analyzed = queue.filter((q) => q.product);
    const warnings = analyzed.flatMap((q) => (q.product?.warnings || []).map((w) => ({ url: q.url, w })));
    const errors = queue
      .filter((q) => q.error)
      .map((q) => ({ url: q.url, e: q.error! }))
      .concat(analyzed.flatMap((q) => (q.product?.errors || []).map((e) => ({ url: q.url, e }))));
    const selectedCount = queue.filter((q) => q.selected && q.product).length;
    const reviewCount = queue.filter((q) => q.status === "revisao_necessaria").length;
    return { analyzedCount: analyzed.length, warnings, errors, selectedCount, reviewCount };
  }, [queue]);

  return (
    <div className="flex flex-col gap-6">
      {/* Aviso de segurança / política */}
      <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
        <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <span>
          A coleta acontece no servidor com proteção anti-SSRF e somente para domínios permitidos (FuturaIM). Nada é
          salvo automaticamente — você revisa e aprova antes. Avaliações e dados pessoais não são importados.
        </span>
      </div>

      {/* Retomar importações de catálogo interrompidas (fila persistente) */}
      {openJobs.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-amber-700">
            <History className="h-4 w-4" /> Importações de catálogo em andamento
          </div>
          <div className="space-y-2">
            {openJobs.map((job) => {
              const pending = Math.max(0, (job.total_found || 0) - (job.total_processed || 0));
              return (
                <div key={job.id} className="flex items-center gap-3 text-xs">
                  <span className="flex-1 truncate text-muted-foreground">{job.source_url}</span>
                  <span className="text-muted-foreground">
                    {job.total_processed}/{job.total_found} processados
                  </span>
                  <Button size="sm" variant="outline" disabled={isRunning} onClick={() => resumeJob(job)}>
                    Retomar ({pending})
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* PAINEL ESQUERDO: entrada + opções */}
        <Card className="lg:col-span-1 border-t-4 border-primary h-fit">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary" /> Importar produtos
            </CardTitle>
            <CardDescription>Cole um link, vários links ou uma página de catálogo da FuturaIM.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="single" className="text-xs">
                  <Link2 className="h-3.5 w-3.5 mr-1" /> Individual
                </TabsTrigger>
                <TabsTrigger value="batch" className="text-xs">
                  <ListChecks className="h-3.5 w-3.5 mr-1" /> Lote
                </TabsTrigger>
                <TabsTrigger value="catalog" className="text-xs">
                  <Layers className="h-3.5 w-3.5 mr-1" /> Catálogo
                </TabsTrigger>
              </TabsList>

              <TabsContent value="single" className="pt-3">
                <Label className="text-xs">Link do produto</Label>
                <Input
                  placeholder="https://www.futuraim.com.br/produto/...?id=4627"
                  value={singleUrl}
                  onChange={(e) => setSingleUrl(e.target.value)}
                />
              </TabsContent>
              <TabsContent value="batch" className="pt-3">
                <Label className="text-xs">Vários links (um por linha)</Label>
                <Textarea
                  rows={6}
                  placeholder={"https://www.futuraim.com.br/produto/a?id=1\nhttps://www.futuraim.com.br/produto/b?id=2"}
                  value={batchText}
                  onChange={(e) => setBatchText(e.target.value)}
                  className="font-mono text-xs"
                />
              </TabsContent>
              <TabsContent value="catalog" className="pt-3">
                <Label className="text-xs">Link da página de catálogo / categoria</Label>
                <Input
                  placeholder="https://www.futuraim.com.br/todos-os-produtos"
                  value={catalogUrl}
                  onChange={(e) => setCatalogUrl(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  O sistema localiza os links de produto da página e monta a fila de importação.
                </p>
              </TabsContent>
            </Tabs>

            <div className="space-y-2 rounded-lg border p-3 bg-muted/20">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Margem de venda</Label>
                <span className="text-xs font-bold text-primary">{margin}%</span>
              </div>
              <Input
                type="range"
                min={10}
                max={300}
                step={5}
                value={margin}
                onChange={(e) => setMargin(parseInt(e.target.value))}
                className="accent-primary"
              />
              <p className="text-[10px] text-muted-foreground">
                Custo do fornecedor e preço de venda são mantidos separados.
              </p>
            </div>

            {/* Opções */}
            <div className="space-y-2.5">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Opções de importação</Label>
              {(
                [
                  ["updateExisting", "Atualizar produtos já existentes"],
                  ["importImages", "Importar imagens"],
                  ["importPriceTiers", "Importar tabelas de preço"],
                  ["importTemplates", "Importar gabaritos"],
                  ["importDescription", "Importar descrição"],
                  ["descriptionInternalOnly", "Descrição só como referência interna"],
                  ["saveAsExternalSupplier", "Salvar como fornecedor externo"],
                  ["scanVariants", "Varredura completa de variantes (mais requisições)"],
                  ["copyImagesToStorage", "Copiar imagens para o Storage"],
                ] as Array<[keyof ImporterOptions, string]>
              ).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-xs">{label}</span>
                  <Switch
                    checked={options[key]}
                    onCheckedChange={(c) => setOptions((o) => ({ ...o, [key]: c }))}
                  />
                </div>
              ))}
            </div>

            <Button className="w-full" disabled={isRunning} onClick={runAnalysis}>
              {isRunning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analisando...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {mode === "catalog" ? "Importar catálogo" : "Analisar link"}
                </>
              )}
            </Button>

            {(isRunning || progress > 0) && <Progress value={progress} className="h-2" />}
          </CardContent>
        </Card>

        {/* PAINEL DIREITO: prévia + aprovação */}
        <div className="lg:col-span-2 space-y-4">
          {/* Resumo / erros / avisos */}
          {queue.length > 0 && (
            <Card>
              <CardContent className="p-4 flex flex-wrap items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5">
                  <ListChecks className="h-4 w-4 text-primary" /> {queue.length} na fila
                </span>
                <span className="flex items-center gap-1.5 text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" /> {stats.analyzedCount} analisados
                </span>
                {stats.reviewCount > 0 && (
                  <span className="flex items-center gap-1.5 text-amber-600">
                    <AlertTriangle className="h-4 w-4" /> {stats.reviewCount} p/ revisão
                  </span>
                )}
                {stats.errors.length > 0 && (
                  <span className="flex items-center gap-1.5 text-destructive">
                    <AlertTriangle className="h-4 w-4" /> {stats.errors.length} erros
                  </span>
                )}
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{stats.selectedCount} selecionados</span>
                  <Button size="sm" disabled={isSaving || stats.selectedCount === 0} onClick={saveSelected}>
                    {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                    Salvar selecionados
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Avisos agregados */}
          {stats.warnings.length > 0 && (
            <Accordion type="single" collapsible className="rounded-lg border bg-amber-500/5">
              <AccordionItem value="warnings" className="border-0">
                <AccordionTrigger className="px-4 text-sm text-amber-600">
                  {stats.warnings.length} avisos de extração
                </AccordionTrigger>
                <AccordionContent className="px-4">
                  <ul className="text-xs space-y-1 text-muted-foreground list-disc pl-4">
                    {stats.warnings.slice(0, 30).map((w, i) => (
                      <li key={i}>{w.w}</li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}

          {queue.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-semibold">Nenhum produto analisado ainda.</p>
                <p className="text-sm">Informe um link e clique em “Analisar link”.</p>
              </CardContent>
            </Card>
          ) : (
            queue.map((item) => <PreviewCard key={item.id} item={item} margin={margin} patch={patch} setQueue={setQueue} />)
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card de prévia / edição por produto
// ---------------------------------------------------------------------------
function PreviewCard({
  item,
  margin,
  patch,
  setQueue,
}: {
  item: QueueItem;
  margin: number;
  patch: (id: string, p: Partial<QueueItem>) => void;
  setQueue: React.Dispatch<React.SetStateAction<QueueItem[]>>;
}) {
  const p = item.product;
  const statusVariant =
    item.status === "erro" || item.status === "bloqueado"
      ? "destructive"
      : item.status === "revisao_necessaria"
        ? "warning"
        : item.status === "importado" || item.status === "atualizado"
          ? "success"
          : item.status === "ignorado"
            ? "muted"
            : "info";

  const tiers = p?.variants[0]?.price_tiers || [];
  const factor = 1 + margin / 100;

  return (
    <Card className={item.selected ? "ring-1 ring-primary/40" : ""}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {p && (
            <Checkbox
              checked={item.selected}
              onCheckedChange={(c) => patch(item.id, { selected: !!c })}
              className="mt-1"
            />
          )}
          {p?.images[0]?.url ? (
            <img src={p.images[0].url} alt="" className="h-14 w-14 rounded-md object-cover border" />
          ) : (
            <div className="h-14 w-14 rounded-md bg-muted flex items-center justify-center">
              <ImageIcon className="h-5 w-5 text-muted-foreground" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge variant={statusVariant as any}>{item.status}</StatusBadge>
              {p && (
                <span className="text-[10px] text-muted-foreground">
                  confiança {p.classification.confidence}%
                </span>
              )}
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-primary inline-flex items-center gap-0.5 truncate max-w-[260px]"
              >
                <ExternalLink className="h-3 w-3" /> {item.url}
              </a>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 ml-auto text-destructive"
                onClick={() => setQueue((q) => q.filter((it) => it.id !== item.id))}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            {item.error && <p className="text-xs text-destructive mt-1">{item.error}</p>}

            {p && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
                  <div className="md:col-span-3">
                    <Label className="text-[10px]">Nome</Label>
                    <Input
                      className="h-8 text-sm"
                      value={item.editName ?? p.original_name}
                      onChange={(e) => patch(item.id, { editName: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">Categoria</Label>
                    <Input
                      className="h-8 text-xs"
                      value={item.editCategory ?? p.classification.category}
                      onChange={(e) => patch(item.id, { editCategory: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">Subcategoria</Label>
                    <Input
                      className="h-8 text-xs"
                      value={item.editSubcategory ?? p.classification.subcategory}
                      onChange={(e) => patch(item.id, { editSubcategory: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">Técnica</Label>
                    <Input className="h-8 text-xs bg-muted" value={p.classification.production_sector} readOnly />
                  </div>
                </div>

                {p.classification.segments.length > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Segmentos: {p.classification.segments.join(", ")}
                  </p>
                )}

                <Accordion type="single" collapsible className="mt-2">
                  <AccordionItem value="details" className="border rounded-md">
                    <AccordionTrigger className="px-3 py-2 text-xs">
                      Detalhes ({tiers.length} tiragens · {p.variant_axes.length} variações · {p.extras.length} extras)
                    </AccordionTrigger>
                    <AccordionContent className="px-3 pb-3 space-y-3">
                      {/* Especificações */}
                      {p.specifications.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {p.specifications.map((s) => (
                            <span key={s.normalized_name} className="text-[10px] bg-muted rounded px-1.5 py-0.5">
                              <b>{s.name}:</b> {s.value}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Tiragens reais */}
                      {tiers.length > 0 && (
                        <div className="border rounded max-h-48 overflow-y-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Qtd</TableHead>
                                <TableHead className="text-xs">Custo total</TableHead>
                                <TableHead className="text-xs">Custo unit.</TableHead>
                                <TableHead className="text-xs text-emerald-600">Venda ({margin}%)</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {tiers.map((t, i) => (
                                <TableRow key={i}>
                                  <TableCell className="text-xs font-semibold">{t.quantity}</TableCell>
                                  <TableCell className="text-xs">{fmtBRL(t.total_price)}</TableCell>
                                  <TableCell className="text-xs text-muted-foreground">{fmtBRL(t.unit_price)}</TableCell>
                                  <TableCell className="text-xs text-emerald-600 font-semibold">
                                    {fmtBRL(t.total_price * factor)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}

                      {/* Variações */}
                      {p.variant_axes.length > 0 && (
                        <div className="space-y-1">
                          {p.variant_axes.map((a) => (
                            <div key={a.normalized_name} className="text-[10px]">
                              <b>{a.name}:</b> {a.options.map((o) => o.value).join(", ")}
                            </div>
                          ))}
                          {p.variant_scan_status !== "complete" && (
                            <p className="text-[10px] text-amber-600">
                              Variantes pendentes de varredura — importada apenas a selecionada.
                            </p>
                          )}
                        </div>
                      )}

                      {/* Extras */}
                      {p.extras.length > 0 && (
                        <div className="text-[10px] text-muted-foreground">
                          Extras: {p.extras.map((e) => `${e.name} (${fmtBRL(e.price)})`).join(" · ")}
                        </div>
                      )}

                      {p.production_time?.original_production_time && (
                        <div className="text-[10px] text-muted-foreground">
                          Prazo: {p.production_time.original_production_time}
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
