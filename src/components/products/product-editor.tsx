import { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  Sheet, SheetContent,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/status-badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Package, DollarSign, Layers, ListOrdered, Truck, Image as ImageIcon,
  Store, ClipboardList, Percent, History, X, Loader2, Plus, Trash2, Copy,
  Archive, FilePlus2, RefreshCcw, ExternalLink, Sparkles, AlertTriangle,
  Check, Save, Wand2, Download, Star, Calculator,
} from "lucide-react";

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (v?: string | null) => {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR");
};

const CATEGORIAS = ["DTF Têxtil", "DTF UV", "Sublimação", "Offset", "Comunicação visual", "Design", "Acabamento"];
const TIPOS = [
  { value: "product", label: "Produto" },
  { value: "service", label: "Serviço" },
  { value: "kit", label: "Kit" },
  { value: "art", label: "Arte/Criação" },
  { value: "finishing", label: "Acabamento" },
];
const ORIGENS = [
  { value: "manual", label: "Manual" },
  { value: "supplier_import", label: "Hub Fornecedor" },
  { value: "marketplace", label: "Marketplace" },
  { value: "production", label: "Produção própria" },
];
const STATUS = [
  { value: "Ativo", label: "Ativo" },
  { value: "Inativo", label: "Inativo" },
  { value: "Rascunho", label: "Rascunho" },
  { value: "Arquivado", label: "Arquivado" },
];
const UNIDADES = ["Unidade", "m²", "Metro linear", "Folha", "Kit", "Pacote", "Cento", "Milheiro"];
const VARIATION_TYPES = ["Material", "Formato", "Tamanho", "Cor", "Acabamento", "Enobrecimento", "Quantidade", "Prazo"];
const MK_STATUS = [
  { value: "draft", label: "Rascunho" },
  { value: "ready", label: "Pronto" },
  { value: "published", label: "Publicado" },
  { value: "error", label: "Erro" },
];
const DEFAULT_CHECKLIST = [
  "Conferir arquivo", "Conferir medida", "Conferir sangria", "Conferir cor",
  "Produzir", "Acabamento", "Embalar", "Entregar",
];

type VariationRow = { id: string; type: string; name: string; cost: number; price: number; sku: string; active: boolean };
type QtyRow = { id: string; quantity: number; unitCost: number; unitPrice: number; deadline: string; active: boolean };
type FileRow = { id: string; name: string; url: string; kind: string };
type ChecklistItem = { id: string; label: string; done: boolean };
type HistoryEntry = { date: string; action: string; user: string; origin: string; detail?: string };

const uid = () => Math.random().toString(36).slice(2, 10);
const num = (v: any) => { const n = Number(v); return isNaN(n) ? 0 : n; };

interface ProductEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: any | null;
  suppliers?: { id: string; name: string }[];
  onSaved?: () => void;
  onRequestQuote?: (productId: string) => void;
  onRequestMarketplace?: (product: any) => void;
  onRequestDuplicate?: (product: any) => void;
}

function emptyForm() {
  return {
    // básicos
    name: "", commercial_name: "", internal_sku: "", supplier_sku: "", barcode: "",
    type: "product", origin: "manual", status: "Ativo",
    category: "Comunicação visual", subcategory: "", unit_measure: "Unidade",
    minimum_quantity: 1, tags: [] as string[], description: "", technical_description: "",
    // preços
    base_cost: 0, target_margin: 45, use_auto_price: true, sale_price_manual: 0,
    commission_pct: 0, fixed_fee: 0, packaging_cost: 0, freight_cost: 0, taxes_pct: 0,
    promo_price: 0, promo_start: "", promo_end: "", min_margin_alert: 15,
    // variações / tabela
    variation_rows: [] as VariationRow[],
    qty_rows: [] as QtyRow[],
    // fornecedor
    supplier_id: "", supplier_name: "", source_url: "", supplier_deadline: "",
    last_import: "", sync_status: "", supplier_notes: "",
    // mídia
    main_image_url: "", gallery: [] as string[], video_url: "", files: [] as FileRow[],
    // marketplace
    ml_title: "", ml_description: "", ml_category: "",
    shopee_title: "", shopee_description: "", shopee_category: "",
    store_title: "", seo_title: "", seo_description: "", keywords: "",
    warranty: "", mk_production_time: "", condition: "novo", mk_status: "draft",
    // produção
    available_quote: true, available_order: true, available_marketplace: false,
    production_step: "", internal_time: "", production_notes: "",
    needs_art: false, needs_approval: false, allow_art_charge: false,
    art_creation_value: 0, art_check_value: 0,
    checklist: [] as ChecklistItem[],
    // comercial
    allow_discount: true, max_discount_pct: 0, highlight: false, recurring: false,
    on_request: false, outsourced: false, requires_signal: false, signal_pct: 50,
    commercial_notes: "", whatsapp_message: "",
    // histórico
    history: [] as HistoryEntry[],
    created_at: "", updated_at: "",
  };
}

type FormState = ReturnType<typeof emptyForm>;

function fromProduct(p: any): FormState {
  const f = emptyForm();
  const m = (p?.editor_meta && typeof p.editor_meta === "object") ? p.editor_meta : {};
  f.name = p.name || "";
  f.commercial_name = p.commercial_name || "";
  f.internal_sku = p.internal_sku || "";
  f.supplier_sku = p.supplier_sku || "";
  f.barcode = m.barcode || "";
  f.type = p.type || "product";
  f.origin = p.origin || "manual";
  f.status = p.status || "Ativo";
  f.category = p.category || "Comunicação visual";
  f.subcategory = p.subcategory || "";
  f.unit_measure = p.unit_measure || "Unidade";
  f.minimum_quantity = num(p.minimum_quantity) || 1;
  f.tags = Array.isArray(m.tags) ? m.tags : [];
  f.description = p.description || "";
  f.technical_description = p.technical_description || "";

  f.base_cost = num(p.cost_price ?? p.base_cost);
  f.target_margin = num(p.margin_percent ?? p.target_margin) || 45;
  const pr = m.pricing || {};
  f.use_auto_price = pr.use_auto_price ?? true;
  f.sale_price_manual = num(pr.sale_price_manual ?? p.sale_price);
  f.commission_pct = num(pr.commission_pct);
  f.fixed_fee = num(pr.fixed_fee);
  f.packaging_cost = num(pr.packaging_cost);
  f.freight_cost = num(pr.freight_cost);
  f.taxes_pct = num(pr.taxes_pct);
  f.promo_price = num(pr.promo_price);
  f.promo_start = pr.promo_start || "";
  f.promo_end = pr.promo_end || "";
  f.min_margin_alert = pr.min_margin_alert ?? 15;

  f.variation_rows = Array.isArray(m.variation_rows) ? m.variation_rows : [];
  // tabela de quantidade: lê da coluna real quantity_prices (compatível com marketplace modal)
  const qp = Array.isArray(p.quantity_prices) ? p.quantity_prices : [];
  f.qty_rows = qp.map((q: any) => ({
    id: uid(),
    quantity: num(q.quantity),
    unitCost: num(q.price ?? q.unitCost),
    unitPrice: num(q.sellPrice ?? q.unitPrice ?? q.price),
    deadline: q.deadline || "",
    active: q.active !== false,
  }));

  f.supplier_id = p.supplier_id || "";
  f.supplier_name = p.supplier_name || "";
  f.source_url = p.source_url || "";
  const sup = m.supplier || {};
  f.supplier_deadline = sup.deadline || p.production_deadline || "";
  f.last_import = sup.last_import || "";
  f.sync_status = sup.sync_status || (p.origin === "supplier_import" ? "Sincronizado" : "");
  f.supplier_notes = sup.notes || "";

  f.main_image_url = p.main_image_url || p.image_url || "";
  f.gallery = Array.isArray(p.gallery_images) ? p.gallery_images : [];
  const md = m.media || {};
  f.video_url = md.video_url || "";
  f.files = Array.isArray(md.files) ? md.files : [];

  f.ml_title = p.marketplace_title || "";
  f.ml_description = p.marketplace_description || "";
  const mk = m.marketplace || {};
  f.ml_category = mk.ml_category || "";
  f.shopee_title = mk.shopee_title || "";
  f.shopee_description = mk.shopee_description || "";
  f.shopee_category = mk.shopee_category || "";
  f.store_title = mk.store_title || "";
  f.seo_title = mk.seo_title || "";
  f.seo_description = mk.seo_description || "";
  f.keywords = mk.keywords || "";
  f.warranty = mk.warranty || "";
  f.mk_production_time = mk.production_time || p.avg_production_time || "";
  f.condition = mk.condition || "novo";
  f.mk_status = mk.status || "draft";

  const prod = m.production || {};
  f.available_quote = prod.available_quote ?? true;
  f.available_order = prod.available_order ?? true;
  f.available_marketplace = prod.available_marketplace ?? false;
  f.production_step = prod.production_step || "";
  f.internal_time = prod.internal_time || p.avg_production_time || "";
  f.production_notes = prod.production_notes || "";
  f.needs_art = prod.needs_art ?? false;
  f.needs_approval = prod.needs_approval ?? false;
  f.allow_art_charge = prod.allow_art_charge ?? false;
  f.art_creation_value = num(prod.art_creation_value);
  f.art_check_value = num(prod.art_check_value);
  f.checklist = Array.isArray(prod.checklist) ? prod.checklist : [];

  const com = m.commercial || {};
  f.allow_discount = com.allow_discount ?? true;
  f.max_discount_pct = num(com.max_discount_pct);
  f.highlight = com.highlight ?? false;
  f.recurring = com.recurring ?? false;
  f.on_request = com.on_request ?? false;
  f.outsourced = com.outsourced ?? false;
  f.requires_signal = com.requires_signal ?? false;
  f.signal_pct = com.signal_pct ?? 50;
  f.commercial_notes = com.commercial_notes || "";
  f.whatsapp_message = com.whatsapp_message || "";

  f.history = Array.isArray(m.history) ? m.history : [];
  f.created_at = p.created_at || "";
  f.updated_at = p.updated_at || "";
  return f;
}

const TABS = [
  { key: "basic", label: "Dados Básicos", icon: Package },
  { key: "pricing", label: "Preços & Margem", icon: DollarSign },
  { key: "variations", label: "Variações", icon: Layers, hideForService: true },
  { key: "quantity", label: "Tabela de Quantidade", icon: ListOrdered },
  { key: "supplier", label: "Fornecedor", icon: Truck, hideForService: true },
  { key: "media", label: "Mídia & Arquivos", icon: ImageIcon, hideForService: true },
  { key: "marketplace", label: "Marketplace", icon: Store },
  { key: "production", label: "Orçamento & Produção", icon: ClipboardList },
  { key: "commercial", label: "Regras Comerciais", icon: Percent },
  { key: "history", label: "Histórico", icon: History },
] as const;

/* ---------- pequenos helpers de UI ---------- */
function Field({ label, children, hint, className = "" }: { label: string; children: React.ReactNode; hint?: string; className?: string }) {
  return (
    <div className={`grid gap-1.5 ${className}`}>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground/70">{hint}</p>}
    </div>
  );
}

function ToggleRow({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-bold text-foreground border-b pb-2 mb-3">{children}</h3>;
}

function Pending({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded px-1.5 py-0.5">
      <AlertTriangle className="h-3 w-3" /> {children}
    </span>
  );
}

export function ProductEditor({
  open, onOpenChange, product, suppliers = [],
  onSaved, onRequestQuote, onRequestMarketplace, onRequestDuplicate,
}: ProductEditorProps) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const isEditing = !!product?.id;

  const [tab, setTab] = useState<string>("basic");
  const [f, setF] = useState<FormState>(emptyForm());
  const [tagInput, setTagInput] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // (re)carrega o form quando abre / muda o produto
  useEffect(() => {
    if (open) {
      setF(product ? fromProduct(product) : emptyForm());
      setTab("basic");
    }
  }, [open, product?.id]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setF((prev) => ({ ...prev, [key]: value }));

  const isService = f.type === "service";
  const visibleTabs = TABS.filter((t) => !(isService && (t as any).hideForService));

  /* ---------- cálculo de preços ---------- */
  const pricing = useMemo(() => {
    const base = num(f.base_cost);
    const extras = num(f.packaging_cost) + num(f.freight_cost);
    const costTotalBase = base + extras;
    const marginFrac = num(f.target_margin) / 100;
    const taxesFrac = num(f.taxes_pct) / 100;
    const commFrac = num(f.commission_pct) / 100;
    const denom = 1 - marginFrac - taxesFrac - commFrac;
    let suggested = 0;
    if (costTotalBase > 0 && denom > 0) {
      suggested = (costTotalBase + num(f.fixed_fee)) / denom;
    }
    suggested = Number(suggested.toFixed(2));

    const finalPrice = f.use_auto_price ? suggested : num(f.sale_price_manual);
    const taxesVal = finalPrice * taxesFrac;
    const commVal = finalPrice * commFrac;
    const costTotal = costTotalBase + taxesVal + commVal + num(f.fixed_fee);
    const profit = finalPrice - costTotal;
    const realMargin = finalPrice > 0 ? (profit / finalPrice) * 100 : 0;
    const markup = base > 0 ? ((finalPrice / base) - 1) * 100 : 0;
    const belowMin = realMargin < num(f.min_margin_alert);
    return { suggested, finalPrice, costTotal, profit, realMargin, markup, belowMin };
  }, [f.base_cost, f.packaging_cost, f.freight_cost, f.target_margin, f.taxes_pct, f.commission_pct, f.fixed_fee, f.use_auto_price, f.sale_price_manual, f.min_margin_alert]);

  /* ---------- save ---------- */
  const saveMutation = useMutation({
    mutationFn: async ({ closeAfter }: { closeAfter: boolean }) => {
      const company_id = profile?.company_id;
      if (!company_id) throw new Error("Empresa não identificada.");

      // valida
      if (!f.name.trim()) throw new Error("Nome do produto é obrigatório.");
      if (!f.internal_sku.trim()) throw new Error("SKU interno é obrigatório.");
      if (num(f.base_cost) < 0) throw new Error("Custo não pode ser negativo.");
      if (num(f.target_margin) < 0) throw new Error("Margem não pode ser negativa.");
      if (!f.on_request && pricing.finalPrice > 0 && pricing.finalPrice <= num(f.base_cost)) {
        throw new Error("Preço de venda precisa ser maior que o custo (ou marque 'Produto sob consulta').");
      }

      const finalPrice = Number(pricing.finalPrice.toFixed(2));

      // histórico — registra alterações de preço/margem
      const history = [...f.history];
      const userName = profile?.full_name || "Usuário";
      const nowIso = new Date().toISOString();
      if (isEditing) {
        const oldPrice = num(product.sale_price ?? product.suggested_price);
        const oldMargin = num(product.margin_percent ?? product.target_margin);
        if (Math.abs(oldPrice - finalPrice) > 0.001)
          history.unshift({ date: nowIso, action: "Alteração de preço", user: userName, origin: "Editor", detail: `${fmt.format(oldPrice)} → ${fmt.format(finalPrice)}` });
        if (Math.abs(oldMargin - num(f.target_margin)) > 0.001)
          history.unshift({ date: nowIso, action: "Alteração de margem", user: userName, origin: "Editor", detail: `${oldMargin}% → ${num(f.target_margin)}%` });
      } else {
        history.unshift({ date: nowIso, action: "Produto criado", user: userName, origin: "Editor" });
      }

      const editor_meta = {
        barcode: f.barcode,
        tags: f.tags,
        pricing: {
          use_auto_price: f.use_auto_price, sale_price_manual: num(f.sale_price_manual),
          commission_pct: num(f.commission_pct), fixed_fee: num(f.fixed_fee),
          packaging_cost: num(f.packaging_cost), freight_cost: num(f.freight_cost),
          taxes_pct: num(f.taxes_pct), promo_price: num(f.promo_price),
          promo_start: f.promo_start || null, promo_end: f.promo_end || null,
          min_margin_alert: num(f.min_margin_alert),
        },
        variation_rows: f.variation_rows,
        supplier: { deadline: f.supplier_deadline, last_import: f.last_import, sync_status: f.sync_status, notes: f.supplier_notes },
        media: { video_url: f.video_url, files: f.files },
        marketplace: {
          ml_category: f.ml_category, shopee_title: f.shopee_title, shopee_description: f.shopee_description,
          shopee_category: f.shopee_category, store_title: f.store_title, seo_title: f.seo_title,
          seo_description: f.seo_description, keywords: f.keywords, warranty: f.warranty,
          production_time: f.mk_production_time, condition: f.condition, status: f.mk_status,
        },
        production: {
          available_quote: f.available_quote, available_order: f.available_order, available_marketplace: f.available_marketplace,
          production_step: f.production_step, internal_time: f.internal_time, production_notes: f.production_notes,
          needs_art: f.needs_art, needs_approval: f.needs_approval, allow_art_charge: f.allow_art_charge,
          art_creation_value: num(f.art_creation_value), art_check_value: num(f.art_check_value),
          checklist: f.checklist,
        },
        commercial: {
          allow_discount: f.allow_discount, max_discount_pct: num(f.max_discount_pct),
          highlight: f.highlight, recurring: f.recurring, on_request: f.on_request,
          outsourced: f.outsourced, requires_signal: f.requires_signal, signal_pct: num(f.signal_pct),
          commercial_notes: f.commercial_notes, whatsapp_message: f.whatsapp_message,
        },
        history,
      };

      // tabela de quantidade -> coluna real (compatível com o modal de marketplace)
      const quantity_prices = f.qty_rows
        .filter((r) => num(r.quantity) > 0)
        .map((r) => ({
          quantity: num(r.quantity), price: num(r.unitCost),
          unitPrice: num(r.unitPrice), sellPrice: num(r.unitPrice),
          total: num(r.unitPrice) * num(r.quantity), deadline: r.deadline, active: r.active,
        }));

      const corePayload: any = {
        company_id,
        name: f.name.trim(),
        commercial_name: f.commercial_name || f.name.trim(),
        type: f.type,
        origin: isEditing ? (product.origin || f.origin) : f.origin,
        status: f.status,
        internal_sku: f.internal_sku.trim(),
        supplier_sku: f.supplier_sku || null,
        supplier_id: f.supplier_id || null,
        supplier_name: f.supplier_name || null,
        source_url: f.source_url || null,
        category: f.category,
        subcategory: f.subcategory || null,
        unit_measure: f.unit_measure,
        minimum_quantity: num(f.minimum_quantity) || 1,
        description: f.description || f.name.trim(),
        technical_description: f.technical_description || null,
        base_cost: num(f.base_cost),
        cost_price: num(f.base_cost),
        target_margin: num(f.target_margin),
        margin_percent: num(f.target_margin),
        suggested_price: pricing.suggested,
        sale_price: finalPrice,
        min_price: Number((finalPrice * 0.9).toFixed(2)),
        main_image_url: f.main_image_url || null,
        image_url: f.main_image_url || null,
        gallery_images: f.gallery,
        quantity_prices,
        marketplace_title: f.ml_title || null,
        marketplace_description: f.ml_description || null,
        avg_production_time: f.internal_time || f.mk_production_time || null,
        production_deadline: f.supplier_deadline || null,
      };

      const fullPayload = { ...corePayload, editor_meta };

      // Persistência resiliente: tenta com editor_meta; se a coluna ainda não existir
      // (migração não aplicada), salva os campos core e avisa.
      let metaSaved = true;
      async function run(payload: any) {
        if (isEditing) {
          return supabase.from("products").update(payload).eq("id", product.id);
        }
        return supabase.from("products").insert([payload]);
      }
      let { error } = await run(fullPayload);
      if (error && /editor_meta/i.test(error.message || "")) {
        metaSaved = false;
        ({ error } = await run(corePayload));
      }
      if (error) throw error;
      return { metaSaved, closeAfter };
    },
    onSuccess: ({ metaSaved, closeAfter }) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      if (!metaSaved) {
        toast.warning("Salvo. Os campos avançados não foram persistidos: aplique a migração 'editor_meta' no banco.");
      } else {
        toast.success(isEditing ? "Produto atualizado!" : "Produto criado!");
      }
      onSaved?.();
      if (closeAfter) onOpenChange(false);
    },
    onError: (err: any) => toast.error(err.message || "Erro ao salvar produto."),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!product?.id) return;
      const { error } = await supabase.from("products").delete().eq("id", product.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produto excluído.");
      setConfirmDelete(false);
      onOpenChange(false);
      onSaved?.();
    },
    onError: (err: any) => toast.error(err.message || "Erro ao excluir."),
  });

  const archiveMutation = useMutation({
    mutationFn: async () => {
      if (!product?.id) throw new Error("Salve o produto antes de arquivar.");
      const { error } = await supabase.from("products").update({ status: "Arquivado" }).eq("id", product.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      set("status", "Arquivado");
      toast.success("Produto arquivado.");
      onSaved?.();
    },
    onError: (err: any) => toast.error(err.message || "Erro ao arquivar."),
  });

  /* ---------- ações de linhas (variações / qty / etc.) ---------- */
  const addVariation = () => set("variation_rows", [...f.variation_rows, { id: uid(), type: "Material", name: "", cost: num(f.base_cost), price: pricing.finalPrice, sku: "", active: true }]);
  const dupVariation = (row: VariationRow) => set("variation_rows", [...f.variation_rows, { ...row, id: uid(), name: `${row.name} (cópia)` }]);
  const importSupplierVariations = () => {
    const raw = Array.isArray(product?.variations) ? product.variations : [];
    const rows: VariationRow[] = [];
    for (const v of raw) {
      if (v?.name && Array.isArray(v?.values)) {
        for (const val of v.values) rows.push({ id: uid(), type: v.name, name: String(val), cost: num(f.base_cost), price: pricing.finalPrice, sku: "", active: true });
      }
    }
    if (rows.length === 0) { toast.info("Nenhuma variação do fornecedor encontrada neste produto."); return; }
    set("variation_rows", [...f.variation_rows, ...rows]);
    toast.success(`${rows.length} variações importadas do fornecedor.`);
  };
  const updVariation = (id: string, patch: Partial<VariationRow>) =>
    set("variation_rows", f.variation_rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const delVariation = (id: string) => set("variation_rows", f.variation_rows.filter((r) => r.id !== id));

  const addQty = () => set("qty_rows", [...f.qty_rows, { id: uid(), quantity: 1, unitCost: num(f.base_cost), unitPrice: pricing.finalPrice, deadline: "", active: true }]);
  const updQty = (id: string, patch: Partial<QtyRow>) => set("qty_rows", f.qty_rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const delQty = (id: string) => set("qty_rows", f.qty_rows.filter((r) => r.id !== id));
  const genQtyTiers = () => {
    const base = num(f.base_cost);
    const tiers = [1, 3, 5, 10, 25, 50, 100];
    const marginFrac = num(f.target_margin) / 100;
    const rows: QtyRow[] = tiers.map((q, i) => {
      const discount = Math.min(i * 0.05, 0.3); // desconto de escala no custo
      const unitCost = Number((base * (1 - discount)).toFixed(2));
      const unitPrice = marginFrac < 1 && marginFrac >= 0 ? Number((unitCost / (1 - marginFrac)).toFixed(2)) : unitCost;
      return { id: uid(), quantity: q, unitCost, unitPrice, deadline: "", active: true };
    });
    set("qty_rows", rows);
    toast.success("Faixas geradas automaticamente. Revise os valores.");
  };
  const recalcQty = () => {
    const marginFrac = num(f.target_margin) / 100;
    set("qty_rows", f.qty_rows.map((r) => ({
      ...r,
      unitPrice: marginFrac < 1 && marginFrac >= 0 ? Number((num(r.unitCost) / (1 - marginFrac)).toFixed(2)) : num(r.unitCost),
    })));
    toast.success("Faixas recalculadas com a margem atual.");
  };

  const addGalleryUrl = (url: string) => { if (url.trim()) set("gallery", [...f.gallery, url.trim()]); };
  const removeGallery = (i: number) => set("gallery", f.gallery.filter((_, idx) => idx !== i));
  const addFile = () => set("files", [...f.files, { id: uid(), name: "", url: "", kind: "PDF" }]);
  const updFile = (id: string, patch: Partial<FileRow>) => set("files", f.files.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const delFile = (id: string) => set("files", f.files.filter((r) => r.id !== id));

  const addChecklistDefault = () => set("checklist", DEFAULT_CHECKLIST.map((l) => ({ id: uid(), label: l, done: false })));
  const addChecklistItem = () => set("checklist", [...f.checklist, { id: uid(), label: "", done: false }]);
  const updChecklist = (id: string, patch: Partial<ChecklistItem>) => set("checklist", f.checklist.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const delChecklist = (id: string) => set("checklist", f.checklist.filter((c) => c.id !== id));

  const addTag = () => { const t = tagInput.trim(); if (t && !f.tags.includes(t)) { set("tags", [...f.tags, t]); setTagInput(""); } };
  const removeTag = (t: string) => set("tags", f.tags.filter((x) => x !== t));

  /* ---------- gerar copy (template, sem publicar) ---------- */
  const genCopy = (platform: "ml" | "shopee" | "seo") => {
    const nameBase = f.commercial_name || f.name;
    if (!nameBase) { toast.error("Informe o nome do produto primeiro."); return; }
    const price = pricing.finalPrice;
    const priceStr = price > 0 ? ` — a partir de ${fmt.format(price)}` : "";
    const specs = [f.category, f.unit_measure].filter(Boolean).join(" · ");
    const desc = [
      f.description || f.technical_description || `${nameBase} de alta qualidade.`,
      specs && `Especificações: ${specs}.`,
      f.mk_production_time && `Prazo de produção: ${f.mk_production_time}.`,
      f.warranty && `Garantia: ${f.warranty}.`,
    ].filter(Boolean).join("\n");
    if (platform === "ml") {
      set("ml_title", `${nameBase}${priceStr}`.slice(0, 60));
      set("ml_description", desc);
    } else if (platform === "shopee") {
      set("shopee_title", `${nameBase} | ${f.category}`.slice(0, 100));
      set("shopee_description", desc);
    } else {
      set("seo_title", `${nameBase} | ${f.category}`.slice(0, 60));
      set("seo_description", desc.slice(0, 160));
      if (!f.keywords) set("keywords", [nameBase, f.category, f.subcategory].filter(Boolean).join(", "));
    }
    toast.success("Copy gerada por template. Revise antes de publicar.");
  };

  const exportMarketplaceCsv = () => {
    const headers = ["nome", "sku", "preco", "categoria", "titulo_ml", "descricao_ml", "titulo_shopee", "palavras_chave"];
    const row = [f.name, f.internal_sku, pricing.finalPrice, f.category, f.ml_title, (f.ml_description || "").replace(/\n/g, " "), f.shopee_title, f.keywords]
      .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",");
    const csv = headers.join(",") + "\n" + row;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `marketplace-${f.internal_sku || "produto"}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success("CSV de marketplace exportado.");
  };

  const reimportSupplier = () => {
    if (!f.source_url) { toast.error("Sem link do fornecedor para reimportar."); return; }
    toast.info("Reimportação pelo Hub: configuração pendente. Use o Hub de Fornecedores para atualizar via link.");
  };

  /* ---------- render ---------- */
  const statusVariant = f.status === "Ativo" ? "success" : f.status === "Arquivado" ? "muted" : f.status === "Rascunho" ? "warning" : "muted";

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-full md:max-w-[1100px] p-0 flex flex-col gap-0 [&>button]:hidden"
        >
          {/* HEADER */}
          <div className="border-b px-4 py-3 flex items-center gap-3">
            <div className="h-12 w-12 rounded-md border bg-secondary flex items-center justify-center overflow-hidden shrink-0">
              {f.main_image_url
                ? <img src={f.main_image_url} alt={f.name} className="h-full w-full object-cover" />
                : <Package className="h-5 w-5 text-muted-foreground" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold truncate">{f.name || "Novo Produto"}</h2>
                <StatusBadge variant={statusVariant as any}>{f.status}</StatusBadge>
                <StatusBadge variant="muted">{ORIGENS.find((o) => o.value === f.origin)?.label || f.origin}</StatusBadge>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                <span className="font-mono">{f.internal_sku || "sem SKU"}</span>
                <span className="font-bold text-foreground">{fmt.format(pricing.finalPrice)}</span>
                <span className={pricing.belowMin ? "text-destructive font-semibold" : "text-success font-semibold"}>
                  {pricing.realMargin.toFixed(0)}% margem
                </span>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}><X className="h-4 w-4" /></Button>
          </div>

          {/* BODY: nav + conteúdo */}
          <div className="flex flex-1 min-h-0">
            {/* NAV lateral */}
            <nav className="w-14 md:w-56 border-r overflow-y-auto shrink-0 py-2">
              {visibleTabs.map((t) => {
                const Icon = t.icon;
                const active = tab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`w-full flex items-center gap-2.5 px-3 md:px-4 py-2.5 text-sm text-left transition-colors ${active ? "bg-primary/10 text-primary font-semibold border-r-2 border-primary" : "text-muted-foreground hover:bg-muted"}`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="hidden md:inline">{t.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* CONTEÚDO */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              {tab === "basic" && <BasicTab f={f} set={set} tagInput={tagInput} setTagInput={setTagInput} addTag={addTag} removeTag={removeTag} />}
              {tab === "pricing" && <PricingTab f={f} set={set} pricing={pricing} />}
              {tab === "variations" && <VariationsTab f={f} addVariation={addVariation} dupVariation={dupVariation} importSupplierVariations={importSupplierVariations} updVariation={updVariation} delVariation={delVariation} />}
              {tab === "quantity" && <QuantityTab f={f} addQty={addQty} updQty={updQty} delQty={delQty} genQtyTiers={genQtyTiers} recalcQty={recalcQty} />}
              {tab === "supplier" && <SupplierTab f={f} set={set} suppliers={suppliers} reimportSupplier={reimportSupplier} />}
              {tab === "media" && <MediaTab f={f} set={set} addGalleryUrl={addGalleryUrl} removeGallery={removeGallery} addFile={addFile} updFile={updFile} delFile={delFile} />}
              {tab === "marketplace" && <MarketplaceTab f={f} set={set} genCopy={genCopy} exportCsv={exportMarketplaceCsv} onRequestMarketplace={isEditing ? () => onRequestMarketplace?.(product) : undefined} />}
              {tab === "production" && <ProductionTab f={f} set={set} addChecklistDefault={addChecklistDefault} addChecklistItem={addChecklistItem} updChecklist={updChecklist} delChecklist={delChecklist} />}
              {tab === "commercial" && <CommercialTab f={f} set={set} />}
              {tab === "history" && <HistoryTab f={f} product={product} />}
            </div>
          </div>

          {/* FOOTER fixo */}
          <div className="border-t px-4 py-3 flex items-center gap-2 flex-wrap">
            {isEditing && (
              <div className="flex items-center gap-1 mr-auto">
                <Button variant="ghost" size="sm" onClick={() => onRequestDuplicate?.(product)} title="Duplicar">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => archiveMutation.mutate()} disabled={archiveMutation.isPending} title="Arquivar">
                  <Archive className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)} title="Excluir">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
            {isEditing && (
              <Button
                variant="outline" size="sm"
                onClick={() => { saveMutation.mutate({ closeAfter: true }, { onSuccess: () => onRequestQuote?.(product.id) }); }}
                disabled={saveMutation.isPending}
              >
                <FilePlus2 className="h-4 w-4 mr-1.5" /> Salvar e criar orçamento
              </Button>
            )}
            <Button size="sm" onClick={() => saveMutation.mutate({ closeAfter: false })} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
              Salvar alterações
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Confirmação de exclusão */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader><DialogTitle>Excluir produto</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir <strong>{f.name}</strong>? Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ============================ ABAS ============================ */

function BasicTab({ f, set, tagInput, setTagInput, addTag, removeTag }: any) {
  return (
    <div className="space-y-5 max-w-3xl">
      <SectionTitle>Identificação</SectionTitle>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Nome do produto *" className="sm:col-span-2">
          <Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex: Cartela DTF UV" />
        </Field>
        <Field label="Nome comercial">
          <Input value={f.commercial_name} onChange={(e) => set("commercial_name", e.target.value)} />
        </Field>
        <Field label="SKU interno *">
          <Input value={f.internal_sku} onChange={(e) => set("internal_sku", e.target.value)} placeholder="Ex: PRD-0001" />
        </Field>
        <Field label="SKU fornecedor">
          <Input value={f.supplier_sku} onChange={(e) => set("supplier_sku", e.target.value)} />
        </Field>
        <Field label="Código de barras (opcional)">
          <Input value={f.barcode} onChange={(e) => set("barcode", e.target.value)} />
        </Field>
      </div>

      <SectionTitle>Classificação</SectionTitle>
      <div className="grid sm:grid-cols-3 gap-4">
        <Field label="Tipo">
          <Select value={f.type} onValueChange={(v) => set("type", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Origem">
          <Select value={f.origin} onValueChange={(v) => set("origin", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{ORIGENS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Status">
          <Select value={f.status} onValueChange={(v) => set("status", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{STATUS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Categoria">
          <Select value={f.category} onValueChange={(v) => set("category", v)}>
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>{CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Subcategoria">
          <Input value={f.subcategory} onChange={(e) => set("subcategory", e.target.value)} />
        </Field>
        <Field label="Unidade">
          <Select value={f.unit_measure} onValueChange={(v) => set("unit_measure", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{UNIDADES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Quantidade mínima">
          <Input type="number" min={1} value={f.minimum_quantity} onChange={(e) => set("minimum_quantity", num(e.target.value))} />
        </Field>
      </div>

      <Field label="Tags internas">
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {f.tags.map((t: string) => (
            <span key={t} className="inline-flex items-center gap-1 text-xs bg-secondary rounded-full px-2 py-0.5">
              {t}<button onClick={() => removeTag(t)}><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="Adicionar tag e Enter"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} />
          <Button type="button" variant="outline" size="sm" onClick={addTag}><Plus className="h-4 w-4" /></Button>
        </div>
      </Field>

      <SectionTitle>Descrições</SectionTitle>
      <Field label="Descrição curta">
        <Textarea rows={2} value={f.description} onChange={(e) => set("description", e.target.value)} />
      </Field>
      <Field label="Descrição técnica">
        <Textarea rows={4} value={f.technical_description} onChange={(e) => set("technical_description", e.target.value)} />
      </Field>
    </div>
  );
}

function MetricCard({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "good" | "bad" }) {
  const color = tone === "good" ? "text-success" : tone === "bad" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-lg border p-3 bg-card">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${color}`}>{value}</p>
    </div>
  );
}

function PricingTab({ f, set, pricing }: any) {
  return (
    <div className="space-y-5 max-w-3xl">
      <SectionTitle>Custos & Margem</SectionTitle>
      <div className="grid sm:grid-cols-3 gap-4">
        <Field label="Custo base (R$)"><Input type="number" min={0} step="0.01" value={f.base_cost} onChange={(e) => set("base_cost", num(e.target.value))} /></Field>
        <Field label="Margem desejada (%)"><Input type="number" min={0} max={99} value={f.target_margin} onChange={(e) => set("target_margin", num(e.target.value))} /></Field>
        <Field label="Alerta margem mínima (%)"><Input type="number" min={0} value={f.min_margin_alert} onChange={(e) => set("min_margin_alert", num(e.target.value))} /></Field>
        <Field label="Custo de embalagem (R$)"><Input type="number" min={0} step="0.01" value={f.packaging_cost} onChange={(e) => set("packaging_cost", num(e.target.value))} /></Field>
        <Field label="Frete estimado (R$)"><Input type="number" min={0} step="0.01" value={f.freight_cost} onChange={(e) => set("freight_cost", num(e.target.value))} /></Field>
        <Field label="Impostos (%)"><Input type="number" min={0} step="0.01" value={f.taxes_pct} onChange={(e) => set("taxes_pct", num(e.target.value))} /></Field>
        <Field label="Comissão marketplace (%)"><Input type="number" min={0} step="0.01" value={f.commission_pct} onChange={(e) => set("commission_pct", num(e.target.value))} /></Field>
        <Field label="Taxa fixa marketplace (R$)"><Input type="number" min={0} step="0.01" value={f.fixed_fee} onChange={(e) => set("fixed_fee", num(e.target.value))} /></Field>
      </div>

      <SectionTitle>Preço de venda</SectionTitle>
      <ToggleRow label="Usar preço automático (sugerido)" checked={f.use_auto_price} onChange={(v) => set("use_auto_price", v)}
        hint="Quando ligado, o preço de venda usa o valor sugerido calculado." />
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Preço sugerido (calculado)">
          <div className="h-9 px-3 flex items-center rounded-md border bg-secondary/50 font-bold">{fmt.format(pricing.suggested)}</div>
        </Field>
        <Field label="Preço de venda manual (R$)">
          <Input type="number" min={0} step="0.01" value={f.sale_price_manual} disabled={f.use_auto_price}
            onChange={(e) => set("sale_price_manual", num(e.target.value))} />
        </Field>
      </div>

      <SectionTitle>Promoção</SectionTitle>
      <div className="grid sm:grid-cols-3 gap-4">
        <Field label="Preço promocional (R$)"><Input type="number" min={0} step="0.01" value={f.promo_price} onChange={(e) => set("promo_price", num(e.target.value))} /></Field>
        <Field label="Início da promoção"><Input type="date" value={f.promo_start} onChange={(e) => set("promo_start", e.target.value)} /></Field>
        <Field label="Fim da promoção"><Input type="date" value={f.promo_end} onChange={(e) => set("promo_end", e.target.value)} /></Field>
      </div>

      <SectionTitle>Resumo</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <MetricCard label="Custo total" value={fmt.format(pricing.costTotal)} />
        <MetricCard label="Preço final" value={fmt.format(pricing.finalPrice)} />
        <MetricCard label="Lucro líquido" value={fmt.format(pricing.profit)} tone={pricing.profit > 0 ? "good" : "bad"} />
        <MetricCard label="Margem real" value={`${pricing.realMargin.toFixed(1)}%`} tone={pricing.belowMin ? "bad" : "good"} />
        <MetricCard label="Markup" value={`${pricing.markup.toFixed(0)}%`} />
      </div>
      {pricing.belowMin && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
          <AlertTriangle className="h-4 w-4" /> Margem real ({pricing.realMargin.toFixed(1)}%) abaixo do mínimo configurado ({num(f.min_margin_alert)}%).
        </div>
      )}
    </div>
  );
}

function VariationsTab({ f, addVariation, dupVariation, importSupplierVariations, updVariation, delVariation }: any) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <SectionTitle>Variações do produto</SectionTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={importSupplierVariations}><Truck className="h-4 w-4 mr-1.5" />Importar do fornecedor</Button>
          <Button size="sm" onClick={addVariation}><Plus className="h-4 w-4 mr-1.5" />Adicionar variação</Button>
        </div>
      </div>
      {f.variation_rows.length === 0 ? (
        <p className="text-sm text-muted-foreground italic border border-dashed rounded-lg p-8 text-center">Nenhuma variação cadastrada.</p>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="text-left p-2">Tipo</th><th className="text-left p-2">Nome</th>
                <th className="text-left p-2">Custo</th><th className="text-left p-2">Preço</th>
                <th className="text-left p-2">SKU</th><th className="p-2">Ativo</th><th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {f.variation_rows.map((r: VariationRow) => (
                <tr key={r.id} className="border-t">
                  <td className="p-1.5">
                    <Select value={r.type} onValueChange={(v) => updVariation(r.id, { type: v })}>
                      <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>{VARIATION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </td>
                  <td className="p-1.5"><Input className="h-8 min-w-32" value={r.name} onChange={(e) => updVariation(r.id, { name: e.target.value })} /></td>
                  <td className="p-1.5"><Input className="h-8 w-24" type="number" step="0.01" value={r.cost} onChange={(e) => updVariation(r.id, { cost: num(e.target.value) })} /></td>
                  <td className="p-1.5"><Input className="h-8 w-24" type="number" step="0.01" value={r.price} onChange={(e) => updVariation(r.id, { price: num(e.target.value) })} /></td>
                  <td className="p-1.5"><Input className="h-8 w-28" value={r.sku} onChange={(e) => updVariation(r.id, { sku: e.target.value })} /></td>
                  <td className="p-1.5 text-center"><Switch checked={r.active} onCheckedChange={(v) => updVariation(r.id, { active: v })} /></td>
                  <td className="p-1.5 whitespace-nowrap">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => dupVariation(r)}><Copy className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => delVariation(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function QuantityTab({ f, addQty, updQty, delQty, genQtyTiers, recalcQty }: any) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <SectionTitle>Tabela de quantidade (faixas)</SectionTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={genQtyTiers}><Wand2 className="h-4 w-4 mr-1.5" />Gerar faixas</Button>
          <Button size="sm" variant="outline" onClick={recalcQty}><Calculator className="h-4 w-4 mr-1.5" />Recalcular</Button>
          <Button size="sm" onClick={addQty}><Plus className="h-4 w-4 mr-1.5" />Adicionar faixa</Button>
        </div>
      </div>
      {f.qty_rows.length === 0 ? (
        <p className="text-sm text-muted-foreground italic border border-dashed rounded-lg p-8 text-center">Nenhuma faixa cadastrada.</p>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="text-left p-2">Qtd</th><th className="text-left p-2">Custo un.</th>
                <th className="text-left p-2">Preço un.</th><th className="text-left p-2">Total</th>
                <th className="text-left p-2">Margem</th><th className="text-left p-2">Prazo</th>
                <th className="p-2">Ativo</th><th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {f.qty_rows.map((r: QtyRow) => {
                const total = num(r.unitPrice) * num(r.quantity);
                const margin = num(r.unitPrice) > 0 ? ((num(r.unitPrice) - num(r.unitCost)) / num(r.unitPrice)) * 100 : 0;
                return (
                  <tr key={r.id} className="border-t">
                    <td className="p-1.5"><Input className="h-8 w-20" type="number" value={r.quantity} onChange={(e) => updQty(r.id, { quantity: num(e.target.value) })} /></td>
                    <td className="p-1.5"><Input className="h-8 w-24" type="number" step="0.01" value={r.unitCost} onChange={(e) => updQty(r.id, { unitCost: num(e.target.value) })} /></td>
                    <td className="p-1.5"><Input className="h-8 w-24" type="number" step="0.01" value={r.unitPrice} onChange={(e) => updQty(r.id, { unitPrice: num(e.target.value) })} /></td>
                    <td className="p-1.5 font-medium">{fmt.format(total)}</td>
                    <td className="p-1.5"><span className={margin >= 30 ? "text-success" : margin >= 15 ? "text-warning" : "text-destructive"}>{margin.toFixed(0)}%</span></td>
                    <td className="p-1.5"><Input className="h-8 w-24" value={r.deadline} onChange={(e) => updQty(r.id, { deadline: e.target.value })} placeholder="3 dias" /></td>
                    <td className="p-1.5 text-center"><Switch checked={r.active} onCheckedChange={(v) => updQty(r.id, { active: v })} /></td>
                    <td className="p-1.5"><Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => delQty(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SupplierTab({ f, set, suppliers, reimportSupplier }: any) {
  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2">
        <AlertTriangle className="h-4 w-4 shrink-0" /> Dados importados podem ser revisados antes de atualizar o produto.
      </div>
      <SectionTitle>Vínculo com fornecedor</SectionTitle>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Fornecedor vinculado">
          <Select value={f.supplier_id || "none"} onValueChange={(v) => {
            const s = suppliers.find((x: any) => x.id === v);
            set("supplier_id", v === "none" ? "" : v);
            set("supplier_name", s?.name || "");
          }}>
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="SKU fornecedor"><Input value={f.supplier_sku} onChange={(e) => set("supplier_sku", e.target.value)} /></Field>
        <Field label="Link original do produto" className="sm:col-span-2"><Input value={f.source_url} onChange={(e) => set("source_url", e.target.value)} placeholder="https://..." /></Field>
        <Field label="Custo do fornecedor (R$)"><Input type="number" step="0.01" value={f.base_cost} onChange={(e) => set("base_cost", num(e.target.value))} /></Field>
        <Field label="Prazo do fornecedor"><Input value={f.supplier_deadline} onChange={(e) => set("supplier_deadline", e.target.value)} placeholder="Ex: 5 dias úteis" /></Field>
        <Field label="Última importação"><div className="h-9 px-3 flex items-center rounded-md border bg-secondary/30 text-sm text-muted-foreground">{fmtDate(f.last_import)}</div></Field>
        <Field label="Status da sincronização"><Input value={f.sync_status} onChange={(e) => set("sync_status", e.target.value)} /></Field>
        <Field label="Observações do fornecedor" className="sm:col-span-2"><Textarea rows={3} value={f.supplier_notes} onChange={(e) => set("supplier_notes", e.target.value)} /></Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={reimportSupplier}><RefreshCcw className="h-4 w-4 mr-1.5" />Reimportar do fornecedor</Button>
        <Button size="sm" variant="outline" onClick={reimportSupplier}><RefreshCcw className="h-4 w-4 mr-1.5" />Atualizar preço pelo link</Button>
        <Button size="sm" variant="outline" disabled={!f.source_url} onClick={() => window.open(f.source_url, "_blank")}><ExternalLink className="h-4 w-4 mr-1.5" />Abrir página original</Button>
      </div>
    </div>
  );
}

function MediaTab({ f, set, addGalleryUrl, removeGallery, addFile, updFile, delFile }: any) {
  const [galInput, setGalInput] = useState("");
  return (
    <div className="space-y-5 max-w-3xl">
      <SectionTitle>Imagem principal</SectionTitle>
      <div className="flex gap-4 items-start">
        <div className="h-28 w-28 rounded-md border bg-secondary flex items-center justify-center overflow-hidden shrink-0">
          {f.main_image_url ? <img src={f.main_image_url} className="h-full w-full object-cover" /> : <ImageIcon className="h-6 w-6 text-muted-foreground" />}
        </div>
        <div className="flex-1 space-y-2">
          <Field label="URL da imagem principal"><Input value={f.main_image_url} onChange={(e) => set("main_image_url", e.target.value)} placeholder="https://..." /></Field>
          <p className="text-xs text-muted-foreground inline-flex items-center gap-1"><Pending>Upload de arquivo em desenvolvimento</Pending> — use URL por enquanto.</p>
        </div>
      </div>

      <SectionTitle>Galeria de imagens</SectionTitle>
      <div className="flex gap-2">
        <Input value={galInput} onChange={(e) => setGalInput(e.target.value)} placeholder="URL da imagem + Enter"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addGalleryUrl(galInput); setGalInput(""); } }} />
        <Button variant="outline" size="sm" onClick={() => { addGalleryUrl(galInput); setGalInput(""); }}><Plus className="h-4 w-4" /></Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {f.gallery.map((g: string, i: number) => (
          <div key={i} className="relative h-20 w-20 rounded-md border overflow-hidden group">
            <img src={g} className="h-full w-full object-cover" />
            <button onClick={() => removeGallery(i)} className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5 text-white opacity-0 group-hover:opacity-100"><X className="h-3 w-3" /></button>
            <button onClick={() => set("main_image_url", g)} className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] py-0.5 opacity-0 group-hover:opacity-100">Definir principal</button>
          </div>
        ))}
      </div>

      <SectionTitle>Vídeo</SectionTitle>
      <Field label="URL do vídeo do produto"><Input value={f.video_url} onChange={(e) => set("video_url", e.target.value)} placeholder="YouTube, Vimeo..." /></Field>

      <SectionTitle>Arquivos técnicos / Gabaritos</SectionTitle>
      <div className="space-y-2">
        {f.files.map((file: FileRow) => (
          <div key={file.id} className="flex gap-2 items-center">
            <Input className="w-28" value={file.kind} onChange={(e) => updFile(file.id, { kind: e.target.value })} placeholder="PDF/AI/CDR" />
            <Input className="flex-1" value={file.name} onChange={(e) => updFile(file.id, { name: e.target.value })} placeholder="Nome do arquivo" />
            <Input className="flex-1" value={file.url} onChange={(e) => updFile(file.id, { url: e.target.value })} placeholder="URL" />
            {file.url && <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => window.open(file.url, "_blank")}><Download className="h-4 w-4" /></Button>}
            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => delFile(file.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={addFile}><Plus className="h-4 w-4 mr-1.5" />Adicionar arquivo</Button>
      </div>
    </div>
  );
}

function MarketplaceTab({ f, set, genCopy, exportCsv, onRequestMarketplace }: any) {
  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 border rounded-md px-3 py-2">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" /> Nada é publicado automaticamente — os rascunhos exigem confirmação.
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <SectionTitle>Mercado Livre</SectionTitle>
        <Button size="sm" variant="outline" onClick={() => genCopy("ml")}><Sparkles className="h-4 w-4 mr-1.5" />Gerar copy</Button>
      </div>
      <Field label="Título"><Input value={f.ml_title} onChange={(e) => set("ml_title", e.target.value)} maxLength={60} /></Field>
      <Field label="Descrição"><Textarea rows={3} value={f.ml_description} onChange={(e) => set("ml_description", e.target.value)} /></Field>
      <Field label="Categoria"><Input value={f.ml_category} onChange={(e) => set("ml_category", e.target.value)} /></Field>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <SectionTitle>Shopee</SectionTitle>
        <Button size="sm" variant="outline" onClick={() => genCopy("shopee")}><Sparkles className="h-4 w-4 mr-1.5" />Gerar copy</Button>
      </div>
      <Field label="Título"><Input value={f.shopee_title} onChange={(e) => set("shopee_title", e.target.value)} maxLength={100} /></Field>
      <Field label="Descrição"><Textarea rows={3} value={f.shopee_description} onChange={(e) => set("shopee_description", e.target.value)} /></Field>
      <Field label="Categoria"><Input value={f.shopee_category} onChange={(e) => set("shopee_category", e.target.value)} /></Field>

      <SectionTitle>Loja própria (Nuvemshop/WooCommerce)</SectionTitle>
      <Field label="Título da loja"><Input value={f.store_title} onChange={(e) => set("store_title", e.target.value)} /></Field>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <SectionTitle>SEO</SectionTitle>
        <Button size="sm" variant="outline" onClick={() => genCopy("seo")}><Sparkles className="h-4 w-4 mr-1.5" />Gerar SEO</Button>
      </div>
      <Field label="SEO title"><Input value={f.seo_title} onChange={(e) => set("seo_title", e.target.value)} maxLength={60} /></Field>
      <Field label="SEO description"><Textarea rows={2} value={f.seo_description} onChange={(e) => set("seo_description", e.target.value)} maxLength={160} /></Field>
      <Field label="Palavras-chave"><Input value={f.keywords} onChange={(e) => set("keywords", e.target.value)} placeholder="separadas por vírgula" /></Field>

      <SectionTitle>Atributos do anúncio</SectionTitle>
      <div className="grid sm:grid-cols-3 gap-4">
        <Field label="Garantia"><Input value={f.warranty} onChange={(e) => set("warranty", e.target.value)} /></Field>
        <Field label="Prazo de produção"><Input value={f.mk_production_time} onChange={(e) => set("mk_production_time", e.target.value)} /></Field>
        <Field label="Condição">
          <Select value={f.condition} onValueChange={(v) => set("condition", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="novo">Novo</SelectItem>
              <SelectItem value="sob_encomenda">Sob encomenda</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Status marketplace">
          <Select value={f.mk_status} onValueChange={(v) => set("mk_status", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{MK_STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
      </div>

      <div className="flex flex-wrap gap-2 border-t pt-4">
        <Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1.5" />Exportar CSV</Button>
        {onRequestMarketplace
          ? <Button size="sm" variant="outline" onClick={onRequestMarketplace}><Store className="h-4 w-4 mr-1.5" />Gerar rascunhos (variações)</Button>
          : <span className="text-xs text-muted-foreground inline-flex items-center"><Pending>Salve o produto para gerar rascunhos</Pending></span>}
      </div>
    </div>
  );
}

function ProductionTab({ f, set, addChecklistDefault, addChecklistItem, updChecklist, delChecklist }: any) {
  return (
    <div className="space-y-5 max-w-3xl">
      <SectionTitle>Disponibilidade</SectionTitle>
      <div className="grid sm:grid-cols-3 gap-3">
        <ToggleRow label="Disponível para orçamento" checked={f.available_quote} onChange={(v) => set("available_quote", v)} />
        <ToggleRow label="Disponível para pedido" checked={f.available_order} onChange={(v) => set("available_order", v)} />
        <ToggleRow label="Disponível para marketplace" checked={f.available_marketplace} onChange={(v) => set("available_marketplace", v)} />
      </div>

      <SectionTitle>Produção</SectionTitle>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Etapa de produção padrão"><Input value={f.production_step} onChange={(e) => set("production_step", e.target.value)} /></Field>
        <Field label="Tempo interno de produção"><Input value={f.internal_time} onChange={(e) => set("internal_time", e.target.value)} placeholder="Ex: 2 dias" /></Field>
      </div>
      <Field label="Observações para produção"><Textarea rows={3} value={f.production_notes} onChange={(e) => set("production_notes", e.target.value)} /></Field>

      <SectionTitle>Arte & Aprovação</SectionTitle>
      <div className="grid sm:grid-cols-3 gap-3">
        <ToggleRow label="Precisa de arte?" checked={f.needs_art} onChange={(v) => set("needs_art", v)} />
        <ToggleRow label="Precisa aprovação do cliente?" checked={f.needs_approval} onChange={(v) => set("needs_approval", v)} />
        <ToggleRow label="Permite cobrar criação de arte?" checked={f.allow_art_charge} onChange={(v) => set("allow_art_charge", v)} />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Valor sugerido criação de arte (R$)"><Input type="number" step="0.01" value={f.art_creation_value} onChange={(e) => set("art_creation_value", num(e.target.value))} /></Field>
        <Field label="Valor sugerido checagem de arte (R$)"><Input type="number" step="0.01" value={f.art_check_value} onChange={(e) => set("art_check_value", num(e.target.value))} /></Field>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <SectionTitle>Checklist de produção</SectionTitle>
        <div className="flex gap-2">
          {f.checklist.length === 0 && <Button size="sm" variant="outline" onClick={addChecklistDefault}>Usar checklist padrão</Button>}
          <Button size="sm" variant="outline" onClick={addChecklistItem}><Plus className="h-4 w-4 mr-1.5" />Item</Button>
        </div>
      </div>
      <div className="space-y-1.5">
        {f.checklist.map((c: ChecklistItem) => (
          <div key={c.id} className="flex items-center gap-2">
            <button onClick={() => updChecklist(c.id, { done: !c.done })}
              className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 ${c.done ? "bg-primary border-primary" : "border-muted-foreground"}`}>
              {c.done && <Check className="h-3 w-3 text-primary-foreground" />}
            </button>
            <Input className="h-8 flex-1" value={c.label} onChange={(e) => updChecklist(c.id, { label: e.target.value })} placeholder="Etapa do checklist" />
            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => delChecklist(c.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function CommercialTab({ f, set }: any) {
  return (
    <div className="space-y-5 max-w-3xl">
      <SectionTitle>Descontos & destaque</SectionTitle>
      <div className="grid sm:grid-cols-2 gap-3">
        <ToggleRow label="Permitir desconto?" checked={f.allow_discount} onChange={(v) => set("allow_discount", v)} />
        <Field label="Desconto máximo (%)"><Input type="number" min={0} max={100} value={f.max_discount_pct} disabled={!f.allow_discount} onChange={(e) => set("max_discount_pct", num(e.target.value))} /></Field>
        <ToggleRow label="Produto destaque?" checked={f.highlight} onChange={(v) => set("highlight", v)} />
        <ToggleRow label="Produto recorrente?" checked={f.recurring} onChange={(v) => set("recurring", v)} />
        <ToggleRow label="Produto sob consulta?" checked={f.on_request} onChange={(v) => set("on_request", v)} />
        <ToggleRow label="Produto terceirizado?" checked={f.outsourced} onChange={(v) => set("outsourced", v)} />
      </div>

      <SectionTitle>Sinal / Entrada</SectionTitle>
      <div className="grid sm:grid-cols-2 gap-3 items-start">
        <ToggleRow label="Exige sinal?" checked={f.requires_signal} onChange={(v) => set("requires_signal", v)} />
        <Field label="Percentual de sinal (%)"><Input type="number" min={0} max={100} value={f.signal_pct} disabled={!f.requires_signal} onChange={(e) => set("signal_pct", num(e.target.value))} /></Field>
      </div>

      <SectionTitle>Mensagens</SectionTitle>
      <Field label="Observações comerciais"><Textarea rows={3} value={f.commercial_notes} onChange={(e) => set("commercial_notes", e.target.value)} /></Field>
      <Field label="Mensagem padrão para WhatsApp"><Textarea rows={3} value={f.whatsapp_message} onChange={(e) => set("whatsapp_message", e.target.value)} placeholder="Olá! Sobre o produto..." /></Field>
    </div>
  );
}

function HistoryTab({ f, product }: any) {
  return (
    <div className="space-y-5 max-w-3xl">
      <SectionTitle>Resumo</SectionTitle>
      <div className="grid sm:grid-cols-3 gap-3">
        <MetricCard label="Criado em" value={fmtDate(f.created_at)} />
        <MetricCard label="Última edição" value={fmtDate(f.updated_at)} />
        <MetricCard label="Última importação" value={fmtDate(f.last_import)} />
      </div>

      <SectionTitle>Linha do tempo</SectionTitle>
      {(!f.history || f.history.length === 0) ? (
        <p className="text-sm text-muted-foreground italic border border-dashed rounded-lg p-8 text-center">
          {product?.id ? "Nenhuma alteração registrada ainda." : "O histórico aparece após salvar o produto."}
        </p>
      ) : (
        <div className="space-y-2">
          {f.history.map((h: HistoryEntry, i: number) => (
            <div key={i} className="flex gap-3 border-l-2 border-primary/40 pl-3 py-1">
              <div className="flex-1">
                <p className="text-sm font-medium">{h.action} {h.detail && <span className="text-muted-foreground font-normal">— {h.detail}</span>}</p>
                <p className="text-[11px] text-muted-foreground">{fmtDate(h.date)} · {h.user} · {h.origin}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
        <Pending>Logs de integração detalhados em desenvolvimento</Pending>
      </p>
    </div>
  );
}
