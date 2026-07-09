import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/status-badge";
import {
  Search, ExternalLink, Download, Trash2, ShoppingCart,
  RefreshCcw, Link2Off, Loader2, PackageX, FileSpreadsheet,
  Edit3, Save, Plus, Trash, Layers, X, CheckSquare
} from "lucide-react";
import { fetchSupplierPage } from "@/integrations/supabase/importer-actions";
import { extractProductFromHtml } from "@/lib/supplier-extractor";
import { toast } from "sonner";
import { MarketplaceVariationsModal } from "@/components/hub/marketplace-variations-modal";
import { useNavigate } from "@tanstack/react-router";

interface ProdutosImportadosProps {
  onNavigateToDrafts: () => void;
}

export function ProdutosImportados({ onNavigateToDrafts }: ProdutosImportadosProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState("");

  // Seleção em massa
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [openBulkEditModal, setOpenBulkEditModal] = useState(false);
  // Barra de progresso da sincronização em massa
  const [bulkSync, setBulkSync] = useState<{ running: boolean; done: number; total: number } | null>(null);

  // Campos da edição em massa — cada campo só é aplicado se seu toggle estiver ligado
  const [bulkApplyCategory, setBulkApplyCategory] = useState(false);
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkApplySubcategory, setBulkApplySubcategory] = useState(false);
  const [bulkSubcategory, setBulkSubcategory] = useState("");
  const [bulkApplyMargin, setBulkApplyMargin] = useState(false);
  const [bulkMargin, setBulkMargin] = useState(50);
  const [bulkApplyDeadline, setBulkApplyDeadline] = useState(false);
  const [bulkDeadline, setBulkDeadline] = useState("");
  const [bulkApplyStatus, setBulkApplyStatus] = useState(false);
  const [bulkStatus, setBulkStatus] = useState("Ativo");

  // Estado para o modal de variações de marketplace
  const [marketplaceModalProduct, setMarketplaceModalProduct] = useState<any>(null);
  // Estados para edição manual de produto
  const [openEditModal, setOpenEditModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [editSku, setEditSku] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editSubcategory, setEditSubcategory] = useState("");
  const [editCost, setEditCost] = useState(0);
  const [editMargin, setEditMargin] = useState(50);
  const [editDeadline, setEditDeadline] = useState("");
  
  // Estados para o editor completo com tudo e mais um pouco
  const [editDescription, setEditDescription] = useState("");
  const [editMainImageUrl, setEditMainImageUrl] = useState("");
  const [editGalleryImages, setEditGalleryImages] = useState<string[]>([]);
  const [editSpecifications, setEditSpecifications] = useState<Record<string, string>>({});
  const [editVariations, setEditVariations] = useState<Array<{ name: string; values: string[] }>>([]);
  const [editQuantityPrices, setEditQuantityPrices] = useState<Array<{ quantity: number; price: number; unitPrice: number; sellPrice?: number; unitSellPrice?: number }>>([]);
  const [editExtraServices, setEditExtraServices] = useState<Array<{ name: string; price: number }>>([]);
  const [editTemplateLinks, setEditTemplateLinks] = useState<Array<{ name: string; url: string }>>([]);
  const [activeTab, setActiveTab] = useState("geral");

  // Estados temporários para campos de adição dinâmica no editor
  const [newGalleryUrl, setNewGalleryUrl] = useState("");
  const [newSpecKey, setNewSpecKey] = useState("");
  const [newSpecVal, setNewSpecVal] = useState("");
  const [newVarName, setNewVarName] = useState("");
  const [newVarValues, setNewVarValues] = useState("");
  const [newExtraName, setNewExtraName] = useState("");
  const [newExtraPrice, setNewExtraPrice] = useState(0);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateUrl, setNewTemplateUrl] = useState("");

  // Busca produtos importados reais da gráfica no Supabase
  const { data: products = [], isLoading: isLoadingProducts } = useQuery({
    queryKey: ["imported-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          suppliers:supplier_id (name)
        `)
        // Fonte única: TODO produto de fornecedor (origin = supplier_import),
        // independente de qual fluxo o importou (imported_from_supplier true/false).
        // Assim Hub e Produtos enxergam exatamente o mesmo conjunto.
        .eq("origin", "supplier_import")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // Busca fornecedores para o filtro
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data;
    }
  });

  // Mutação para deletar produto do CRM
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produto removido com sucesso do CRM!");
      queryClient.invalidateQueries({ queryKey: ["imported-products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (err: any) => {
      toast.error(`Erro ao deletar: ${err.message}`);
    }
  });

  // Mutação para desvincular do fornecedor
  const unlinkMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("products")
        .update({
          imported_from_supplier: false,
          supplier_id: null,
          import_status: "manual",
          // origin passa a "manual": tira o produto do Hub (que agora filtra por
          // origin) e o converte definitivamente em produto próprio do catálogo.
          origin: "manual",
          updated_at: new Date().toISOString()
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produto desvinculado! Agora ele é tratado como produto manual no CRM.");
      queryClient.invalidateQueries({ queryKey: ["imported-products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (err: any) => {
      toast.error(`Erro ao desvincular: ${err.message}`);
    }
  });

  // Geração de rascunhos de marketplace agora é feita pelo MarketplaceVariationsModal

  // Núcleo reutilizável de sincronização: busca a página do fornecedor, aplica
  // as regras de mapeamento e grava os campos atualizados. Usado tanto na
  // sincronização individual quanto na sincronização em massa.
  const syncProductWithSupplier = async (product: any) => {
    if (!product.source_url) throw new Error("Este produto não possui link de fornecedor vinculado.");

    // 1. Fetch do HTML atualizado — fetcher seguro (anti-SSRF: HTTPS-only,
    //    bloqueio de IPs/redes internas, allowlist de domínio, timeout e limite).
    const htmlRes = await fetchSupplierPage({ data: { url: product.source_url } });
    if (!htmlRes.success || !htmlRes.html) {
      throw new Error(htmlRes.error || "Não foi possível obter o conteúdo do fornecedor.");
    }

    const domain = htmlRes.domain || "";

    // 2. Busca regras de mapeamento para o domínio
    const { data: rules } = await supabase
      .from("supplier_mapping_rules")
      .select("*")
      .eq("company_id", product.company_id)
      .eq("supplier_domain", domain);

    // 3. Executa extrator
    const extracted = extractProductFromHtml(htmlRes.html, rules || []);

    // 4. Calcula sugeridos
    const baseCost = extracted.current_price || product.cost_price || product.base_cost || 0;
    const margin = product.margin_percent || product.target_margin || 50;
    const suggestedPrice = parseFloat((baseCost * (1 + margin / 100)).toFixed(2));

    const updatedFields = {
      name: extracted.product_name || product.name,
      commercial_name: extracted.product_name || product.name,
      type: 'product',
      origin: 'supplier_import',
      description: extracted.specifications["Descrição"] || product.description || extracted.product_name || product.name,
      base_cost: baseCost,
      cost_price: baseCost,
      suggested_price: suggestedPrice,
      sale_price: suggestedPrice,
      min_price: suggestedPrice * 0.9,
      avg_production_time: extracted.production_deadline !== "5 dias úteis" ? extracted.production_deadline : (product.avg_production_time || "5 dias úteis"),
      production_deadline: extracted.production_deadline !== "5 dias úteis" ? extracted.production_deadline : (product.avg_production_time || "5 dias úteis"),
      supplier_sku: extracted.supplier_sku || product.supplier_sku,
      main_image_url: extracted.main_image_url || product.main_image_url,
      image_url: extracted.main_image_url || product.main_image_url,
      gallery_images: extracted.gallery_images.length > 0 ? extracted.gallery_images : product.gallery_images,
      specifications: { ...product.specifications, ...extracted.specifications },
      variations: extracted.variations.length > 0 ? extracted.variations : product.variations,
      quantity_prices: extracted.quantity_prices.length > 0 ? extracted.quantity_prices : product.quantity_prices,
      quantity_price_table: extracted.quantity_prices.length > 0 ? extracted.quantity_prices : product.quantity_prices,
      extra_services: extracted.extra_services.length > 0 ? extracted.extra_services : product.extra_services,
      template_links: extracted.template_links.length > 0 ? extracted.template_links : product.template_links,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from("products")
      .update(updatedFields)
      .eq("id", product.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  // Mutação para enriquecer/sincronizar produto com o fornecedor
  const [enrichingProductId, setEnrichingProductId] = useState<string | null>(null);
  const enrichMutation = useMutation({
    mutationFn: async (product: any) => {
      setEnrichingProductId(product.id);
      return syncProductWithSupplier(product);
    },
    onSuccess: (data) => {
      toast.success(`"${data.name}" enriquecido e sincronizado com dados atuais do fornecedor!`);
      queryClient.invalidateQueries({ queryKey: ["imported-products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setEnrichingProductId(null);
    },
    onError: (err: any) => {
      toast.error(`Erro ao enriquecer dados: ${err.message}`);
      setEnrichingProductId(null);
    }
  });

  // Mutação para salvar a edição manual do produto
  const updateProductMutation = useMutation({
    mutationFn: async () => {
      if (!editingProduct) return;

      const suggestedPrice = parseFloat((editCost * (1 + editMargin / 100)).toFixed(2));

      const { error } = await supabase
        .from("products")
        .update({
          name: editName,
          commercial_name: editName,
          type: 'product',
          origin: 'supplier_import',
          description: editDescription,
          supplier_sku: editSku,
          category: editCategory,
          subcategory: editSubcategory,
          base_cost: editCost,
          cost_price: editCost,
          target_margin: editMargin,
          margin_percent: editMargin,
          suggested_price: suggestedPrice,
          sale_price: suggestedPrice,
          min_price: suggestedPrice * 0.9,
          avg_production_time: editDeadline,
          production_deadline: editDeadline,
          main_image_url: editMainImageUrl,
          image_url: editMainImageUrl,
          gallery_images: editGalleryImages,
          specifications: editSpecifications,
          variations: editVariations,
          quantity_prices: editQuantityPrices,
          quantity_price_table: editQuantityPrices,
          extra_services: editExtraServices,
          template_links: editTemplateLinks,
          updated_at: new Date().toISOString()
        })
        .eq("id", editingProduct.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dados do produto CRM atualizados com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["imported-products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setOpenEditModal(false);
      setEditingProduct(null);
    },
    onError: (err: any) => {
      toast.error(`Erro ao salvar edições: ${err.message}`);
    }
  });

  // ─── AÇÕES EM MASSA ──────────────────────────────────────────────────────

  // Sincronização em massa: percorre os produtos selecionados sequencialmente
  // (evita disparar N fetches simultâneos contra o fornecedor) e reporta progresso.
  const bulkSyncMutation = useMutation({
    mutationFn: async (productsToSync: any[]) => {
      let ok = 0;
      let failed = 0;
      setBulkSync({ running: true, done: 0, total: productsToSync.length });
      for (let i = 0; i < productsToSync.length; i++) {
        try {
          await syncProductWithSupplier(productsToSync[i]);
          ok++;
        } catch {
          failed++;
        }
        setBulkSync({ running: true, done: i + 1, total: productsToSync.length });
      }
      return { ok, failed };
    },
    onSuccess: ({ ok, failed }) => {
      if (failed === 0) {
        toast.success(`${ok} produto(s) sincronizado(s) com o fornecedor!`);
      } else {
        toast.warning(`${ok} sincronizado(s), ${failed} com falha (ex.: sem link ou fora da allowlist).`);
      }
      queryClient.invalidateQueries({ queryKey: ["imported-products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setBulkSync(null);
      setSelectedIds(new Set());
    },
    onError: (err: any) => {
      toast.error(`Erro na sincronização em massa: ${err.message}`);
      setBulkSync(null);
    }
  });

  // Edição em massa: aplica somente os campos com toggle ativo aos produtos selecionados.
  const bulkEditMutation = useMutation({
    mutationFn: async (productsToEdit: any[]) => {
      const patch: Record<string, any> = { updated_at: new Date().toISOString() };
      if (bulkApplyCategory) patch.category = bulkCategory;
      if (bulkApplySubcategory) patch.subcategory = bulkSubcategory;
      if (bulkApplyDeadline) {
        patch.avg_production_time = bulkDeadline;
        patch.production_deadline = bulkDeadline;
      }
      if (bulkApplyStatus) patch.status = bulkStatus;

      // Se estiver aplicando margem, cada produto recalcula preço a partir do seu próprio custo.
      for (const p of productsToEdit) {
        const rowPatch = { ...patch };
        if (bulkApplyMargin) {
          const cost = p.cost_price || p.base_cost || 0;
          const suggestedPrice = parseFloat((cost * (1 + bulkMargin / 100)).toFixed(2));
          rowPatch.margin_percent = bulkMargin;
          rowPatch.target_margin = bulkMargin;
          rowPatch.suggested_price = suggestedPrice;
          rowPatch.sale_price = suggestedPrice;
          rowPatch.min_price = suggestedPrice * 0.9;
        }
        const { error } = await supabase.from("products").update(rowPatch as any).eq("id", p.id);
        if (error) throw error;
      }
      return productsToEdit.length;
    },
    onSuccess: (count) => {
      toast.success(`Edição em massa aplicada a ${count} produto(s)!`);
      queryClient.invalidateQueries({ queryKey: ["imported-products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setOpenBulkEditModal(false);
      setSelectedIds(new Set());
    },
    onError: (err: any) => {
      toast.error(`Erro na edição em massa: ${err.message}`);
    }
  });

  // Desvincular / deletar em massa
  const bulkUnlinkMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("products")
        .update({ imported_from_supplier: false, supplier_id: null, import_status: "manual", origin: "manual", updated_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} produto(s) desvinculado(s) do fornecedor!`);
      queryClient.invalidateQueries({ queryKey: ["imported-products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setSelectedIds(new Set());
    },
    onError: (err: any) => toast.error(`Erro ao desvincular: ${err.message}`)
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("products").delete().in("id", ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} produto(s) removido(s) do CRM!`);
      queryClient.invalidateQueries({ queryKey: ["imported-products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setSelectedIds(new Set());
    },
    onError: (err: any) => toast.error(`Erro ao deletar: ${err.message}`)
  });

  const handleEditClick = (product: any) => {
    setEditingProduct(product);
    setEditName(product.name || "");
    setEditSku(product.supplier_sku || "");
    setEditCategory(product.category || "Impressos");
    setEditSubcategory(product.subcategory || "Geral");
    setEditCost(product.cost_price || product.base_cost || 0);
    setEditMargin(product.margin_percent || product.target_margin || 50);
    setEditDeadline(product.avg_production_time || product.production_deadline || "5 dias úteis");
    setEditDescription(product.description || "");
    setEditMainImageUrl(product.main_image_url || "");
    
    // Tratando dados em JSONB de forma segura
    setEditGalleryImages(Array.isArray(product.gallery_images) ? product.gallery_images : []);
    setEditSpecifications(typeof product.specifications === 'object' && product.specifications !== null ? product.specifications : {});
    setEditVariations(Array.isArray(product.variations) ? product.variations : []);
    setEditQuantityPrices(Array.isArray(product.quantity_prices) ? product.quantity_prices : []);
    setEditExtraServices(Array.isArray(product.extra_services) ? product.extra_services : []);
    setEditTemplateLinks(Array.isArray(product.template_links) ? product.template_links : []);
    
    // Reset inputs temporários
    setNewGalleryUrl("");
    setNewSpecKey("");
    setNewSpecVal("");
    setNewVarName("");
    setNewVarValues("");
    setNewExtraName("");
    setNewExtraPrice(0);
    setNewTemplateName("");
    setNewTemplateUrl("");
    
    setActiveTab("geral");
    setOpenEditModal(true);
  };

  // Filtra produtos na tela
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (p.supplier_sku && p.supplier_sku.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesSupplier = selectedSupplier ? p.supplier_id === selectedSupplier : true;
    return matchesSearch && matchesSupplier;
  });

  // ─── SELEÇÃO EM MASSA (helpers) ──────────────────────────────────────────
  const selectedProducts = filteredProducts.filter((p) => selectedIds.has(p.id));
  const allVisibleSelected = filteredProducts.length > 0 && filteredProducts.every((p) => selectedIds.has(p.id));
  const someVisibleSelected = filteredProducts.some((p) => selectedIds.has(p.id)) && !allVisibleSelected;

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev);
        filteredProducts.forEach((p) => next.delete(p.id));
        return next;
      }
      const next = new Set(prev);
      filteredProducts.forEach((p) => next.add(p.id));
      return next;
    });
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openBulkEdit = () => {
    // Pré-preenche com valores do primeiro selecionado como ponto de partida
    const first = selectedProducts[0];
    setBulkApplyCategory(false);
    setBulkApplySubcategory(false);
    setBulkApplyMargin(false);
    setBulkApplyDeadline(false);
    setBulkApplyStatus(false);
    setBulkCategory(first?.category || "Impressos");
    setBulkSubcategory(first?.subcategory || "Geral");
    setBulkMargin(first?.margin_percent || first?.target_margin || 50);
    setBulkDeadline(first?.avg_production_time || first?.production_deadline || "5 dias úteis");
    setBulkStatus(first?.status || "Ativo");
    setOpenBulkEditModal(true);
  };

  // Função para exportar os produtos em CSV (Totalmente Funcional!)
  const exportToCSV = () => {
    if (filteredProducts.length === 0) {
      toast.error("Nenhum produto para exportar.");
      return;
    }

    const headers = [
      "Nome do Produto", "SKU Interno", "SKU Fornecedor", "Categoria", 
      "Subcategoria", "Custo Fornecedor (R$)", "Venda CRM (R$)", 
      "Margem (%)", "URL Origem", "Status do Vínculo"
    ];

    const rows = filteredProducts.map(p => [
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.supplier_sku ? "HUB-" + p.supplier_sku : "HUB-" + p.id.substring(0, 6)}"`,
      `"${p.supplier_sku || ""}"`,
      `"${p.category || "Impressos"}"`,
      `"${p.subcategory || "Geral"}"`,
      p.cost_price || p.base_cost || 0,
      p.sale_price || p.suggested_price || 0,
      p.margin_percent || p.target_margin || 0,
      `"${p.source_url || ""}"`,
      `"${p.import_status || "imported"}"`
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `produtos_importados_hub_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Arquivo CSV exportado com sucesso!");
  };

  return (
    <Card className="border-t-4 border-emerald-500">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
            Produtos Importados no CRM
          </CardTitle>
          <CardDescription>
            Visualize os produtos gráficos que vieram do Hub de Fornecedores e estão ativos no catálogo.
          </CardDescription>
        </div>
        <Button 
          onClick={exportToCSV} 
          variant="outline" 
          size="sm" 
          className="border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/5 hover:border-emerald-500/40 flex items-center gap-1.5 self-start sm:self-center"
        >
          <Download className="h-4 w-4" /> Exportar CSV
        </Button>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        
        {/* FILTROS E BUSCA */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por nome ou SKU do fornecedor..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={selectedSupplier}
            onChange={(e) => setSelectedSupplier(e.target.value)}
            className="h-10 px-3 rounded-md border border-input bg-card text-sm w-full md:w-56 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Todos os Fornecedores</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* BARRA DE AÇÕES EM MASSA */}
        {selectedIds.size > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-violet-500/30 bg-violet-500/5 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-violet-500">
              <CheckSquare className="h-4 w-4" />
              {selectedIds.size} selecionado(s)
            </div>

            {bulkSync?.running ? (
              <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                <Progress value={(bulkSync.done / bulkSync.total) * 100} className="h-2 flex-1" />
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  Sincronizando {bulkSync.done}/{bulkSync.total}...
                </span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const withLink = selectedProducts.filter((p) => p.source_url);
                    if (withLink.length === 0) {
                      toast.error("Nenhum dos produtos selecionados possui link de fornecedor.");
                      return;
                    }
                    bulkSyncMutation.mutate(withLink);
                  }}
                  disabled={bulkSyncMutation.isPending}
                  className="h-8 text-xs text-sky-500 border-sky-500/30 hover:bg-sky-500/10"
                >
                  <RefreshCcw className="h-3.5 w-3.5 mr-1.5" /> Sincronizar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={openBulkEdit}
                  className="h-8 text-xs text-primary border-primary/30 hover:bg-primary/10"
                >
                  <Layers className="h-3.5 w-3.5 mr-1.5" /> Editar em massa
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (window.confirm(`Desvincular ${selectedIds.size} produto(s) do fornecedor? Eles continuam no CRM como produtos manuais.`)) {
                      bulkUnlinkMutation.mutate(Array.from(selectedIds));
                    }
                  }}
                  disabled={bulkUnlinkMutation.isPending}
                  className="h-8 text-xs text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
                >
                  <Link2Off className="h-3.5 w-3.5 mr-1.5" /> Desvincular
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (window.confirm(`Deletar ${selectedIds.size} produto(s) do CRM? Esta ação não pode ser desfeita.`)) {
                      bulkDeleteMutation.mutate(Array.from(selectedIds));
                    }
                  }}
                  disabled={bulkDeleteMutation.isPending}
                  className="h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Deletar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedIds(new Set())}
                  className="h-8 text-xs text-muted-foreground"
                >
                  <X className="h-3.5 w-3.5 mr-1" /> Limpar
                </Button>
              </div>
            )}
          </div>
        )}

        {/* TABELA DE PRODUTOS */}
        {isLoadingProducts ? (
          <div className="h-48 flex items-center justify-center">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Selecionar todos"
                    />
                  </TableHead>
                  <TableHead className="w-16">Preview</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>SKU Fornecedor</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Custo Base</TableHead>
                  <TableHead className="text-emerald-500">Venda CRM</TableHead>
                  <TableHead className="text-primary">Margem</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((p) => {
                  const hasSupplier = p.suppliers && p.suppliers.name;
                  const marginPercent = p.margin_percent || p.target_margin || 0;
                  const cost = p.cost_price || p.base_cost || 0;
                  const sale = p.sale_price || p.suggested_price || 0;

                  return (
                    <TableRow key={p.id} data-state={selectedIds.has(p.id) ? "selected" : undefined}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(p.id)}
                          onCheckedChange={() => toggleSelectOne(p.id)}
                          aria-label={`Selecionar ${p.name}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="h-10 w-10 border rounded bg-muted flex items-center justify-center overflow-hidden">
                          {p.main_image_url ? (
                            <img src={p.main_image_url} alt={p.name} className="object-cover h-full w-full" />
                          ) : (
                            <PackageX className="h-5 w-5 text-muted-foreground/30" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold max-w-xs truncate">
                        <div>
                          <p className="truncate">{p.name}</p>
                          <span className="text-[10px] text-muted-foreground font-mono">ID: {p.id.substring(0, 8)}...</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{p.supplier_sku || "Manual"}</TableCell>
                      <TableCell>
                        <StatusBadge variant="info">
                          {p.suppliers?.name || "Indireto"}
                        </StatusBadge>
                      </TableCell>
                      <TableCell>
                        <StatusBadge variant="muted">{p.category || "Impressos"}</StatusBadge>
                      </TableCell>
                      <TableCell>R$ {cost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-emerald-500 font-bold">R$ {sale.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-primary font-semibold">{marginPercent}%</TableCell>
                      <TableCell>
                        <StatusBadge variant={p.status === "Ativo" ? "success" : "muted"}>
                          {p.status || "Ativo"}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="text-right space-x-1 whitespace-nowrap">
                        {p.source_url && (
                          <a 
                            href={p.source_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center h-8 w-8 rounded-md border hover:bg-muted"
                            title="Ver link original no Fornecedor"
                          >
                            <ExternalLink className="h-4 w-4 text-muted-foreground" />
                          </a>
                        )}
                        {p.source_url && (
                          <Button 
                            size="icon" 
                            variant="outline" 
                            onClick={() => enrichMutation.mutate(p)}
                            disabled={enrichMutation.isPending}
                            title="Enriquecer e Sincronizar com Fornecedor"
                            className="h-8 w-8 text-sky-500 hover:bg-sky-500/10 border-sky-500/20"
                          >
                            {enrichingProductId === p.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCcw className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        <Button 
                          size="icon" 
                          variant="outline" 
                          onClick={() => handleEditClick(p)}
                          title="Editar Informações CRM"
                          className="h-8 w-8 text-primary hover:bg-primary/10 border-primary/20"
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="outline" 
                          onClick={() => setMarketplaceModalProduct(p)}
                          title="Gerar Anúncios de Marketplace com Variações"
                          className="h-8 w-8 text-rose-500 hover:bg-rose-500/10 border-rose-500/20"
                        >
                          <ShoppingCart className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="outline" 
                          onClick={() => {
                            if (window.confirm("Desvincular o produto do fornecedor? Ele continuará no CRM, mas não receberá mais atualizações de custo.")) {
                              unlinkMutation.mutate(p.id);
                            }
                          }}
                          disabled={unlinkMutation.isPending}
                          title="Desvincular do Fornecedor"
                          className="h-8 w-8 text-amber-500 hover:bg-amber-500/10 border-amber-500/20"
                        >
                          <Link2Off className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="outline" 
                          onClick={() => {
                            if (window.confirm("Tem certeza que deseja deletar este produto do catálogo do CRM? Esta ação não pode ser desfeita.")) {
                              deleteMutation.mutate(p.id);
                            }
                          }}
                          disabled={deleteMutation.isPending}
                          title="Deletar Produto"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10 border-destructive/20"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="border border-dashed rounded-lg p-12 text-center text-muted-foreground flex flex-col items-center justify-center">
            <PackageX className="h-12 w-12 text-muted-foreground/30 mb-4 animate-bounce" />
            <h4 className="font-semibold text-base">Nenhum Produto Importado</h4>
            <p className="text-sm max-w-sm mt-1">
              Você ainda não importou produtos de fornecedores gráficos. Acesse a aba "Importar por Link" para cadastrar seu primeiro produto!
            </p>
          </div>
        )}
      </CardContent>

      {/* MODAL DE EDIÇÃO AVANÇADO */}
      <Dialog open={openEditModal} onOpenChange={setOpenEditModal}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Edit3 className="h-5 w-5 text-emerald-500" />
              Editor de Produto CRM Completo
            </DialogTitle>
            <DialogDescription>
              Ajuste detalhadamente os dados comerciais, mídias, especificações e acabamentos importados do fornecedor.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-2">
            <TabsList className="grid grid-cols-5 w-full bg-muted mb-4">
              <TabsTrigger value="geral">Geral</TabsTrigger>
              <TabsTrigger value="comercial">Preços & Tiragens</TabsTrigger>
              <TabsTrigger value="midia">Galeria & Mídia</TabsTrigger>
              <TabsTrigger value="especificacoes">Especificações</TabsTrigger>
              <TabsTrigger value="acabamentos">Acabamentos</TabsTrigger>
            </TabsList>

            {/* ABA 1: INFORMAÇÕES GERAIS */}
            <TabsContent value="geral" className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="edit-name">Nome do Produto no CRM</Label>
                <Input 
                  id="edit-name" 
                  value={editName} 
                  onChange={(e) => setEditName(e.target.value)} 
                  placeholder="Nome comercial do produto"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-sku">SKU Fornecedor</Label>
                  <Input 
                    id="edit-sku" 
                    value={editSku} 
                    onChange={(e) => setEditSku(e.target.value)} 
                    placeholder="Código do produto"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-category">Categoria</Label>
                  <Input 
                    id="edit-category" 
                    value={editCategory} 
                    onChange={(e) => setEditCategory(e.target.value)} 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-subcategory">Subcategoria</Label>
                  <Input 
                    id="edit-subcategory" 
                    value={editSubcategory} 
                    onChange={(e) => setEditSubcategory(e.target.value)} 
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label htmlFor="edit-source-url">Link de Origem no Fornecedor</Label>
                  <div className="flex gap-2">
                    <Input 
                      id="edit-source-url" 
                      value={editingProduct?.source_url || "Sem link original"} 
                      disabled 
                      className="bg-muted text-muted-foreground font-mono text-xs flex-1 truncate" 
                    />
                    {editingProduct?.source_url && (
                      <a 
                        href={editingProduct.source_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center px-3 rounded-md border bg-card hover:bg-muted text-xs font-semibold gap-1"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> Abrir
                      </a>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-deadline">Prazo Médio Produção</Label>
                  <Input 
                    id="edit-deadline" 
                    value={editDeadline} 
                    onChange={(e) => setEditDeadline(e.target.value)} 
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-desc">Descrição Rica / Detalhes de Impressão</Label>
                <Textarea 
                  id="edit-desc" 
                  value={editDescription} 
                  onChange={(e) => setEditDescription(e.target.value)} 
                  rows={5}
                  placeholder="Instruções de gabarito, tipo de papel, acabamento incluso e restrições de montagem da arte..."
                />
              </div>
            </TabsContent>

            {/* ABA 2: PREÇOS & TIRAGENS */}
            <TabsContent value="comercial" className="space-y-4 pt-1">
              <div className="grid grid-cols-2 gap-3 p-3 bg-muted/40 rounded-lg border">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-cost">Custo Base de Fábrica (R$)</Label>
                  <Input 
                    id="edit-cost" 
                    type="number" 
                    step="0.01"
                    value={editCost} 
                    onChange={(e) => setEditCost(parseFloat(e.target.value) || 0)} 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-margin">Margem Geral Sugerida (%)</Label>
                  <Input 
                    id="edit-margin" 
                    type="number" 
                    value={editMargin} 
                    onChange={(e) => setEditMargin(parseInt(e.target.value) || 0)} 
                  />
                </div>
                <div className="col-span-2 pt-1 text-xs text-muted-foreground flex justify-between font-semibold">
                  <span>Preço Unitário Geral Estimado:</span>
                  <span className="text-emerald-500 font-bold text-sm">
                    R$ {(editCost * (1 + editMargin / 100)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Tabela de Preços por Quantidade */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold text-sm">Preços por Tiragem (Grade de Quantidades)</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newQty = editQuantityPrices.length > 0 
                        ? editQuantityPrices[editQuantityPrices.length - 1].quantity * 2 
                        : 100;
                      const newCost = editCost;
                      const factor = 1 + editMargin / 100;
                      const newSell = parseFloat((newCost * factor).toFixed(2));
                      setEditQuantityPrices([
                        ...editQuantityPrices,
                        { quantity: newQty, price: newCost, unitPrice: newCost / newQty, sellPrice: newSell, unitSellPrice: newSell / newQty }
                      ]);
                    }}
                    className="text-xs flex items-center gap-1 h-8"
                  >
                    <Plus className="h-3 w-3" /> Adicionar Tiragem
                  </Button>
                </div>

                <div className="border rounded-md max-h-[240px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">Qtd/Tiragem</TableHead>
                        <TableHead>Custo Fornecedor (Total)</TableHead>
                        <TableHead>Custo Unitário</TableHead>
                        <TableHead className="text-emerald-500">Venda CRM (Sugerido)</TableHead>
                        <TableHead className="text-emerald-500">Venda Unitário</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {editQuantityPrices.map((qp, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <Input
                              type="number"
                              value={qp.quantity}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                const updated = [...editQuantityPrices];
                                updated[idx] = {
                                  ...updated[idx],
                                  quantity: val,
                                  unitPrice: qp.price / val,
                                  unitSellPrice: (qp.sellPrice || (qp.price * (1 + editMargin / 100))) / val
                                };
                                setEditQuantityPrices(updated);
                              }}
                              className="h-8 text-xs font-semibold p-1"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={qp.price}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                const sellVal = parseFloat((val * (1 + editMargin / 100)).toFixed(2));
                                const updated = [...editQuantityPrices];
                                updated[idx] = {
                                  ...updated[idx],
                                  price: val,
                                  unitPrice: val / qp.quantity,
                                  sellPrice: sellVal,
                                  unitSellPrice: sellVal / qp.quantity
                                };
                                setEditQuantityPrices(updated);
                              }}
                              className="h-8 text-xs p-1"
                            />
                          </TableCell>
                          <TableCell className="text-[10px] text-muted-foreground font-mono">
                            R$ {(qp.price / qp.quantity || 0).toLocaleString("pt-BR", { minimumFractionDigits: 4 })}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={qp.sellPrice || parseFloat((qp.price * (1 + editMargin / 100)).toFixed(2))}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                const updated = [...editQuantityPrices];
                                updated[idx] = {
                                  ...updated[idx],
                                  sellPrice: val,
                                  unitSellPrice: val / qp.quantity
                                };
                                setEditQuantityPrices(updated);
                              }}
                              className="h-8 text-xs font-bold text-emerald-500 p-1 bg-emerald-500/5 border-emerald-500/20"
                            />
                          </TableCell>
                          <TableCell className="text-[10px] text-emerald-500 font-mono">
                            R$ {((qp.sellPrice || (qp.price * (1 + editMargin / 100))) / qp.quantity || 0).toLocaleString("pt-BR", { minimumFractionDigits: 4 })}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                const updated = editQuantityPrices.filter((_, i) => i !== idx);
                                setEditQuantityPrices(updated);
                              }}
                              className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            >
                              <Trash className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            {/* ABA 3: IMAGENS & GALERIA */}
            <TabsContent value="midia" className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="edit-main-img">URL da Imagem Principal (Capa)</Label>
                <div className="flex gap-2">
                  <Input 
                    id="edit-main-img" 
                    value={editMainImageUrl} 
                    onChange={(e) => setEditMainImageUrl(e.target.value)} 
                    placeholder="Cole o link da foto de capa"
                    className="flex-1 font-mono text-xs" 
                  />
                  {editMainImageUrl && (
                    <div className="h-10 w-10 border rounded bg-muted overflow-hidden flex-shrink-0 flex items-center justify-center">
                      <img src={editMainImageUrl} alt="Preview" className="object-cover h-full w-full" />
                    </div>
                  )}
                </div>
              </div>

              {/* Adicionar Fotos na Galeria */}
              <div className="space-y-2">
                <Label className="font-semibold text-sm">Fotos do Carrossel de Galeria</Label>
                <div className="flex gap-2">
                  <Input 
                    placeholder="URL de foto adicional..." 
                    value={newGalleryUrl} 
                    onChange={(e) => setNewGalleryUrl(e.target.value)} 
                    className="flex-1 font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (newGalleryUrl.trim()) {
                        setEditGalleryImages([...editGalleryImages, newGalleryUrl.trim()]);
                        setNewGalleryUrl("");
                        toast.success("Foto adicionada!");
                      }
                    }}
                    className="h-10 text-xs"
                  >
                    Adicionar
                  </Button>
                </div>

                <div className="grid grid-cols-4 gap-2 pt-2 max-h-[220px] overflow-y-auto border p-2 rounded-lg bg-muted/20">
                  {editGalleryImages.length > 0 ? (
                    editGalleryImages.map((img, idx) => (
                      <div key={idx} className="relative group border rounded-lg bg-card overflow-hidden h-24 flex items-center justify-center">
                        <img src={img} alt={`Galeria ${idx}`} className="object-cover h-full w-full" />
                        <Button
                          size="icon"
                          variant="destructive"
                          onClick={() => {
                            setEditGalleryImages(editGalleryImages.filter((_, i) => i !== idx));
                          }}
                          className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash className="h-3 w-3" />
                        </Button>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-4 p-8 text-center text-xs text-muted-foreground italic">
                      Nenhuma imagem adicional de galeria vinculada.
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* ABA 4: ESPECIFICAÇÕES & VARIAÇÕES */}
            <TabsContent value="especificacoes" className="space-y-4 pt-1">
              {/* Grade Especificações */}
              <div className="space-y-2">
                <Label className="font-semibold text-sm">Especificações Técnicas de Impressão (Ficha Técnica)</Label>
                <div className="flex gap-2">
                  <Input 
                    placeholder="Chave (Ex: Acabamento)" 
                    value={newSpecKey} 
                    onChange={(e) => setNewSpecKey(e.target.value)} 
                    className="w-1/3" 
                  />
                  <Input 
                    placeholder="Valor (Ex: Verniz UV Total)" 
                    value={newSpecVal} 
                    onChange={(e) => setNewSpecVal(e.target.value)} 
                    className="flex-1" 
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (newSpecKey.trim() && newSpecVal.trim()) {
                        setEditSpecifications({
                          ...editSpecifications,
                          [newSpecKey.trim()]: newSpecVal.trim()
                        });
                        setNewSpecKey("");
                        setNewSpecVal("");
                      }
                    }}
                    className="h-10 text-xs"
                  >
                    Adicionar
                  </Button>
                </div>

                <div className="border rounded-md max-h-[160px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-1/3">Propriedade</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(editSpecifications).map(([key, val]) => (
                        <TableRow key={key}>
                          <TableCell className="font-semibold text-xs">{key}</TableCell>
                          <TableCell className="text-xs">
                            <Input
                              value={val}
                              onChange={(e) => {
                                setEditSpecifications({
                                  ...editSpecifications,
                                  [key]: e.target.value
                                });
                              }}
                              className="h-7 text-xs p-1"
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                const updated = { ...editSpecifications };
                                delete updated[key];
                                setEditSpecifications(updated);
                              }}
                              className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            >
                              <Trash className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Grade Variações */}
              <div className="space-y-2 border-t pt-4">
                <Label className="font-semibold text-sm">Opções e Variações de Compras (Marketplace)</Label>
                <div className="flex gap-2">
                  <Input 
                    placeholder="Variação (Ex: Cores)" 
                    value={newVarName} 
                    onChange={(e) => setNewVarName(e.target.value)} 
                    className="w-1/3" 
                  />
                  <Input 
                    placeholder="Valores (Ex: 4x0, 4x4 - separado por vírgula)" 
                    value={newVarValues} 
                    onChange={(e) => setNewVarValues(e.target.value)} 
                    className="flex-1" 
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (newVarName.trim() && newVarValues.trim()) {
                        const valuesArray = newVarValues.split(",").map(v => v.trim()).filter(v => v !== "");
                        setEditVariations([
                          ...editVariations,
                          { name: newVarName.trim(), values: valuesArray }
                        ]);
                        setNewVarName("");
                        setNewVarValues("");
                      }
                    }}
                    className="h-10 text-xs"
                  >
                    Adicionar
                  </Button>
                </div>

                <div className="border rounded-md max-h-[160px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-1/3">Variação</TableHead>
                        <TableHead>Valores Disponíveis</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {editVariations.map((v, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-semibold text-xs">{v.name}</TableCell>
                          <TableCell className="text-xs">
                            {v.values.map((val, i) => (
                              <StatusBadge key={i} variant="muted" className="mr-1 mb-1 text-[10px]">
                                {val}
                              </StatusBadge>
                            ))}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setEditVariations(editVariations.filter((_, i) => i !== idx));
                              }}
                              className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            >
                              <Trash className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            {/* ABA 5: SERVIÇOS EXTRAS & GABARITOS */}
            <TabsContent value="acabamentos" className="space-y-4 pt-1">
              {/* Acabamentos extras */}
              <div className="space-y-2">
                <Label className="font-semibold text-sm">Acabamentos Especiais Opcionais (Com Custo Adicional)</Label>
                <div className="flex gap-2">
                  <Input 
                    placeholder="Serviço (Ex: Furo Central)" 
                    value={newExtraName} 
                    onChange={(e) => setNewExtraName(e.target.value)} 
                    className="flex-1" 
                  />
                  <Input 
                    placeholder="Custo (R$)" 
                    type="number" 
                    step="0.01" 
                    value={newExtraPrice || ""} 
                    onChange={(e) => setNewExtraPrice(parseFloat(e.target.value) || 0)} 
                    className="w-1/4" 
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (newExtraName.trim()) {
                        setEditExtraServices([
                          ...editExtraServices,
                          { name: newExtraName.trim(), price: newExtraPrice }
                        ]);
                        setNewExtraName("");
                        setNewExtraPrice(0);
                      }
                    }}
                    className="h-10 text-xs"
                  >
                    Adicionar
                  </Button>
                </div>

                <div className="border rounded-md max-h-[160px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Acabamento Opcional</TableHead>
                        <TableHead className="w-1/3">Custo de Fábrica</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {editExtraServices.map((es, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-semibold text-xs">{es.name}</TableCell>
                          <TableCell className="text-xs">
                            R$ {es.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setEditExtraServices(editExtraServices.filter((_, i) => i !== idx));
                              }}
                              className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            >
                              <Trash className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Gabaritos */}
              <div className="space-y-2 border-t pt-4">
                <Label className="font-semibold text-sm">Arquivos de Gabarito Técnico (Downloads)</Label>
                <div className="flex gap-2">
                  <Input 
                    placeholder="Nome (Ex: CorelDraw)" 
                    value={newTemplateName} 
                    onChange={(e) => setNewTemplateName(e.target.value)} 
                    className="w-1/3" 
                  />
                  <Input 
                    placeholder="URL de download do arquivo" 
                    value={newTemplateUrl} 
                    onChange={(e) => setNewTemplateUrl(e.target.value)} 
                    className="flex-1 font-mono text-xs" 
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (newTemplateName.trim() && newTemplateUrl.trim()) {
                        setEditTemplateLinks([
                          ...editTemplateLinks,
                          { name: newTemplateName.trim(), url: newTemplateUrl.trim() }
                        ]);
                        setNewTemplateName("");
                        setNewTemplateUrl("");
                      }
                    }}
                    className="h-10 text-xs"
                  >
                    Adicionar
                  </Button>
                </div>

                <div className="border rounded-md max-h-[160px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-1/3">Arquivo</TableHead>
                        <TableHead>URL Gabarito</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {editTemplateLinks.map((tl, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-semibold text-xs">{tl.name}</TableCell>
                          <TableCell className="text-xs truncate max-w-sm font-mono text-muted-foreground" title={tl.url}>{tl.url}</TableCell>
                          <TableCell>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setEditTemplateLinks(editTemplateLinks.filter((_, i) => i !== idx));
                              }}
                              className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            >
                              <Trash className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6 border-t pt-3 flex sm:justify-between items-center">
            <span className="text-[10px] text-muted-foreground italic hidden sm:inline">ID CRM: {editingProduct?.id}</span>
            <div className="flex gap-2 w-full sm:w-auto justify-end">
              <Button variant="outline" size="sm" onClick={() => setOpenEditModal(false)}>Cancelar</Button>
              <Button size="sm" disabled={updateProductMutation.isPending} onClick={() => updateProductMutation.mutate()}>
                {updateProductMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />} Salvar Alterações
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE EDIÇÃO EM MASSA */}
      <Dialog open={openBulkEditModal} onOpenChange={setOpenBulkEditModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Layers className="h-5 w-5 text-primary" />
              Edição em Massa
            </DialogTitle>
            <DialogDescription>
              Aplique alterações a <strong>{selectedIds.size}</strong> produto(s) selecionado(s). Marque apenas os campos que deseja sobrescrever — os demais permanecem intactos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {/* Categoria */}
            <div className="flex items-center gap-3 rounded-md border p-3">
              <Checkbox checked={bulkApplyCategory} onCheckedChange={(v) => setBulkApplyCategory(!!v)} />
              <Label className="w-28 shrink-0 text-sm">Categoria</Label>
              <Input value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value)} disabled={!bulkApplyCategory} className="h-8" />
            </div>

            {/* Subcategoria */}
            <div className="flex items-center gap-3 rounded-md border p-3">
              <Checkbox checked={bulkApplySubcategory} onCheckedChange={(v) => setBulkApplySubcategory(!!v)} />
              <Label className="w-28 shrink-0 text-sm">Subcategoria</Label>
              <Input value={bulkSubcategory} onChange={(e) => setBulkSubcategory(e.target.value)} disabled={!bulkApplySubcategory} className="h-8" />
            </div>

            {/* Margem */}
            <div className="flex items-center gap-3 rounded-md border p-3">
              <Checkbox checked={bulkApplyMargin} onCheckedChange={(v) => setBulkApplyMargin(!!v)} />
              <Label className="w-28 shrink-0 text-sm">Margem (%)</Label>
              <Input type="number" value={bulkMargin} onChange={(e) => setBulkMargin(parseInt(e.target.value) || 0)} disabled={!bulkApplyMargin} className="h-8" />
            </div>
            {bulkApplyMargin && (
              <p className="text-[11px] text-muted-foreground -mt-1 pl-3">
                O preço de venda de cada produto será recalculado a partir do seu próprio custo base.
              </p>
            )}

            {/* Prazo */}
            <div className="flex items-center gap-3 rounded-md border p-3">
              <Checkbox checked={bulkApplyDeadline} onCheckedChange={(v) => setBulkApplyDeadline(!!v)} />
              <Label className="w-28 shrink-0 text-sm">Prazo produção</Label>
              <Input value={bulkDeadline} onChange={(e) => setBulkDeadline(e.target.value)} disabled={!bulkApplyDeadline} className="h-8" />
            </div>

            {/* Status */}
            <div className="flex items-center gap-3 rounded-md border p-3">
              <Checkbox checked={bulkApplyStatus} onCheckedChange={(v) => setBulkApplyStatus(!!v)} />
              <Label className="w-28 shrink-0 text-sm">Status</Label>
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value)}
                disabled={!bulkApplyStatus}
                className="h-8 flex-1 rounded-md border border-input bg-card px-2 text-sm disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="Ativo">Ativo</option>
                <option value="Inativo">Inativo</option>
                <option value="Rascunho">Rascunho</option>
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpenBulkEditModal(false)}>Cancelar</Button>
            <Button
              size="sm"
              disabled={
                bulkEditMutation.isPending ||
                !(bulkApplyCategory || bulkApplySubcategory || bulkApplyMargin || bulkApplyDeadline || bulkApplyStatus)
              }
              onClick={() => bulkEditMutation.mutate(selectedProducts)}
            >
              {bulkEditMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
              Aplicar a {selectedIds.size} produto(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE GERAÇÃO DE RASCUNHOS COM VARIAÇÕES */}
      <MarketplaceVariationsModal
        open={!!marketplaceModalProduct}
        onClose={() => setMarketplaceModalProduct(null)}
        product={marketplaceModalProduct}
        onNavigateToDrafts={onNavigateToDrafts}
        onNavigateToProducts={() => navigate({ to: "/produtos" })}
      />
    </Card>
  );
}
