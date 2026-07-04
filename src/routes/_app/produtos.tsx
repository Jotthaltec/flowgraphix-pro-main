import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search, MoreVertical, Loader2, Edit, Trash2, Copy, FilePlus2, Tag, Package, Store, Truck, Hand, Layers, Plus, Sparkles, Settings2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useState, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MarketplaceVariationsModal } from "@/components/hub/marketplace-variations-modal";
import { DialogDescription } from "@/components/ui/dialog";
import { ProductEditor } from "@/components/products/product-editor";

export const Route = createFileRoute("/_app/produtos")({ component: ProdutosPage });

const CATEGORIAS = ["DTF Têxtil", "DTF UV", "Sublimação", "Offset", "Comunicação visual", "Design", "Acabamento"];

const FILTER_OPTIONS = [
  { value: "all", label: "Todos", icon: Layers },
  { value: "manual", label: "Cadastrados", icon: Hand },
  { value: "supplier", label: "Importados", icon: Truck },
  { value: "services", label: "Serviços", icon: Tag },
  { value: "products", label: "Produtos", icon: Package },
  { value: "marketplace", label: "Marketplace", icon: Store },
];

type Product = {
  id: string;
  name: string;
  commercial_name: string | null;
  type: string | null;
  origin: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  source_url: string | null;
  supplier_sku: string | null;
  internal_sku: string | null;
  category: string;
  subcategory: string | null;
  description: string | null;
  technical_description: string | null;
  image_url: string | null;
  main_image_url: string | null;
  cost_price: number | null;
  base_cost: number | null;
  margin_percent: number | null;
  target_margin: number | null;
  sale_price: number | null;
  suggested_price: number | null;
  unit_measure: string | null;
  status: string | null;
  marketplace_title: string | null;
  imported_from_supplier: boolean | null;
  active: boolean | null;
};

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function getOriginBadge(origin: string | null, type: string | null, imported_from_supplier?: boolean | null) {
  if (type === "service") return <StatusBadge variant="accent">Serviço</StatusBadge>;
  if (origin === "supplier_import" || imported_from_supplier) return <StatusBadge variant="info">Fornecedor</StatusBadge>;
  return <StatusBadge variant="muted">Manual</StatusBadge>;
}

function ProdutosPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCat, setSelectedCat] = useState("Todos");
  const [filterType, setFilterType] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [marketplaceProduct, setMarketplaceProduct] = useState<Product | null>(null);
  const [deleteConfirmProduct, setDeleteConfirmProduct] = useState<Product | null>(null);

  const { data: dbProducts, isLoading, isError, error } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      console.log("Iniciando busca de produtos no Supabase...");
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) {
        console.error("Erro na busca de produtos no Supabase:", error);
        throw error;
      }
      
      console.log("Produtos recebidos do Supabase:", data);
      const mapped = (data || []).map(p => ({
        ...p,
        active: p.status === 'Ativo' || p.status === null
      })) as Product[];
      console.log("Produtos mapeados:", mapped);
      return mapped;
    },
    enabled: !!profile,
  });

  // Busca itens do Hub de Fornecedores (supplier_imports)
  const { data: hubCatalogItems, isLoading: isHubLoading } = useQuery({
    queryKey: ["hub_supplier_imports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_imports")
        .select(`*, suppliers:supplier_id (name)`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isImportModalOpen,
  });

  const importFromHubMutation = useMutation({
    mutationFn: async ({ item, type }: { item: any; type: "product" | "service" }) => {
      const { data: profileData } = await supabase.from('profiles').select('company_id').eq('user_id', (await supabase.auth.getUser()).data.user?.id || "").single();
      if (!profileData?.company_id) throw new Error("Empresa não identificada.");

      // Verifica se já foi importado (evita duplicar)
      const { data: existing } = await supabase
        .from("products")
        .select("id")
        .eq("company_id", profileData.company_id)
        .eq("supplier_sku", item.supplier_sku)
        .eq("origin", "supplier_import")
        .maybeSingle();

      if (existing?.id) throw new Error("Este produto já foi importado anteriormente.");

      const margin = 50;
      const cost = Number(item.current_price) || 0;
      const suggested = parseFloat((cost * (1 + (margin/100))).toFixed(2));

      const payload = {
        company_id: profileData.company_id,
        name: item.product_name,
        commercial_name: item.product_name,
        type: type,
        origin: "supplier_import",
        supplier_id: item.supplier_id,
        supplier_name: item.suppliers?.name,
        supplier_sku: item.supplier_sku,
        source_url: item.source_url,
        internal_sku: `HUB-${item.supplier_sku || Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        category: item.category || "Impressos",
        subcategory: item.subcategory || "Geral",
        unit_measure: "Unidade",
        base_cost: cost,
        cost_price: cost,
        target_margin: margin,
        margin_percent: margin,
        suggested_price: suggested,
        sale_price: suggested,
        min_price: parseFloat((suggested * 0.9).toFixed(2)),
        description: item.product_name,
        main_image_url: item.main_image_url || null,
        image_url: item.main_image_url || null,
        gallery_images: item.gallery_images || null,
        specifications: item.specifications || null,
        variations: item.variations || null,
        quantity_prices: item.quantity_prices || null,
        extra_services: item.extra_services || null,
        template_links: item.template_links || null,
        production_deadline: item.production_deadline || null,
        // false: vai direto para Produtos & Serviços. origin "supplier_import" mantém o selo "Fornecedor".
        imported_from_supplier: false,
        status: "Ativo"
      };

      const { error } = await supabase.from("products").insert([payload]);
      if (error) throw error;

      // Marca o registro de supplier_imports como importado
      await supabase
        .from("supplier_imports")
        .update({ extraction_status: "imported" })
        .eq("id", item.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["hub_supplier_imports"] });
      queryClient.invalidateQueries({ queryKey: ["imported-products"] });
      toast.success("Produto importado com sucesso para Produtos & Serviços!");
    },
    onError: (err) => {
      toast.error("Erro ao importar produto: " + err.message);
    }
  });

  const filteredData = useMemo(() => {
    console.log("Calculando filteredData. dbProducts:", dbProducts, "searchTerm:", searchTerm, "selectedCat:", selectedCat, "filterType:", filterType);
    const result = dbProducts?.filter(item => {
      const name = item.name || "";
      const matchesSearch = 
        name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (item.commercial_name && item.commercial_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.internal_sku && item.internal_sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.supplier_sku && item.supplier_sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.supplier_name && item.supplier_name.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesCat = selectedCat === "Todos" ? true : item.category === selectedCat;

      let matchesFilter = true;
      if (filterType === "manual") {
        matchesFilter = (item.origin === "manual" || item.origin === null) && !item.imported_from_supplier;
      } else if (filterType === "supplier") {
        matchesFilter = item.origin === "supplier_import" || item.imported_from_supplier === true;
      } else if (filterType === "services") {
        matchesFilter = item.type === "service";
      } else if (filterType === "products") {
        matchesFilter = item.type === "product" || item.type === null;
      } else if (filterType === "marketplace") {
        matchesFilter = !!item.marketplace_title;
      }

      const match = matchesSearch && matchesCat && matchesFilter;
      console.log(`Produto "${item.name}": matchesSearch=${matchesSearch}, matchesCat=${matchesCat}, matchesFilter=${matchesFilter} -> match=${match}`);
      return match;
    });
    console.log("Resultado final filteredData:", result);
    return result;
  }, [dbProducts, searchTerm, selectedCat, filterType]);

  // Identificadores dos produtos que JÁ existem de fato no catálogo (vindos de fornecedor).
  // Usamos a tabela real `products` em vez do flag `extraction_status` do supplier_imports,
  // que pode dessincronizar (ex.: produto excluído mas registro do Hub ainda marcado como "imported").
  const importedKeys = useMemo(() => {
    const urls = new Set<string>();
    const skus = new Set<string>();
    (dbProducts || []).forEach(p => {
      if (p.origin === "supplier_import") {
        if (p.source_url) urls.add(p.source_url);
        if (p.supplier_sku) skus.add(p.supplier_sku);
      }
    });
    return { urls, skus };
  }, [dbProducts]);

  // Contadores para os filtros
  const filterCounts = useMemo(() => {
    if (!dbProducts) return {};
    return {
      all: dbProducts.length,
      manual: dbProducts.filter(p => (p.origin === "manual" || p.origin === null) && !p.imported_from_supplier).length,
      supplier: dbProducts.filter(p => p.origin === "supplier_import" || p.imported_from_supplier === true).length,
      services: dbProducts.filter(p => p.type === "service").length,
      products: dbProducts.filter(p => p.type === "product" || p.type === null).length,
      marketplace: dbProducts.filter(p => !!p.marketplace_title).length,
    };
  }, [dbProducts]);

  // Lista de fornecedores ativos para o vínculo no editor
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name")
        .order("name", { ascending: true });
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
    enabled: !!profile,
  });

  const duplicateMutation = useMutation({
    mutationFn: async (product: Product) => {
      const { data: profileData } = await supabase.from('profiles').select('company_id').eq('user_id', (await supabase.auth.getUser()).data.user?.id || "").single();
      
      if (!profileData?.company_id) throw new Error("Empresa não identificada.");
      
      const payload = {
        company_id: profileData.company_id,
        name: `${product.name} (Cópia)`,
        commercial_name: product.commercial_name ? `${product.commercial_name} (Cópia)` : `${product.name} (Cópia)`,
        type: product.type || "product",
        origin: "manual",
        internal_sku: `PRD-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        category: product.category,
        unit_measure: product.unit_measure || "Unidade",
        base_cost: product.cost_price || product.base_cost || 0,
        cost_price: product.cost_price || product.base_cost || 0,
        margin_percent: product.margin_percent || product.target_margin || 45,
        target_margin: product.margin_percent || product.target_margin || 45,
        suggested_price: product.sale_price || product.suggested_price || 0,
        sale_price: product.sale_price || product.suggested_price || 0,
        min_price: (product.sale_price || product.suggested_price || 0) * 0.9,
        description: product.description,
        technical_description: product.technical_description,
        image_url: product.image_url,
        main_image_url: product.image_url,
        status: product.status || "Ativo"
      };

      const { error } = await supabase.from("products").insert([payload]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produto duplicado com sucesso!");
    },
    onError: (err) => {
      toast.error("Erro ao duplicar produto: " + err.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produto removido!");
    },
    onError: (err) => {
      toast.error("Erro ao remover produto: " + err.message);
    }
  });

  function handleEdit(product: Product) {
    setEditingProduct(product);
    setIsModalOpen(true);
  }

  function handleNew() {
    setEditingProduct(null);
    setIsModalOpen(true);
  }

  function handleGenerateQuote(product: Product) {
    navigate({ to: "/orcamentos", search: { selectProductId: product.id } });
  }

  return (
    <>
      <PageHeader 
        title="Produtos & Serviços" 
        description="Catálogo unificado — manuais e importados de fornecedores" 
        action={
          <div className="flex gap-3 items-center">
            <Button
              onClick={() => navigate({ to: "/produtos/importar" })}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white border-0 shadow-lg shadow-indigo-500/20 transition-all hover:scale-105"
            >
              <Sparkles className="h-4 w-4 mr-2 animate-pulse" />
              Importar por link
            </Button>

            <div className="h-6 w-[1px] bg-border mx-1 hidden sm:block"></div>
            
            <Button variant="outline" onClick={() => setIsImportModalOpen(true)} className="border-dashed border-2 hover:bg-secondary/80 transition-all">
              <Truck className="h-4 w-4 mr-2 text-muted-foreground" /> Hub
            </Button>
            
            <Button variant="outline" onClick={() => navigate({ to: "/motor-produtos" })} className="shadow-sm hover:shadow-md transition-all">
              <Settings2 className="h-4 w-4 mr-2 text-muted-foreground" /> Motor Técnico
            </Button>
            
            <Button onClick={handleNew} className="shadow-md hover:shadow-lg transition-all hover:scale-105">
              <Plus className="h-4 w-4 mr-2" /> Novo Produto
            </Button>
          </div>
        }
      />
      
      {/* Filtros superiores */}
      <Card className="p-4 mb-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por nome, SKU ou fornecedor..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9" 
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-full md:w-52">
              <SelectValue placeholder="Filtrar por tipo" />
            </SelectTrigger>
            <SelectContent>
              {FILTER_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  <span className="flex items-center gap-2">
                    <opt.icon className="h-3.5 w-3.5" />
                    {opt.label}
                    {filterCounts[opt.value as keyof typeof filterCounts] !== undefined && (
                      <span className="text-muted-foreground text-[10px] ml-1">({filterCounts[opt.value as keyof typeof filterCounts]})</span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {/* Chips de categoria */}
        <div className="flex flex-wrap gap-2 mt-4">
          <button 
            onClick={() => setSelectedCat("Todos")}
            className={`text-xs px-3 py-1.5 rounded-full transition-colors ${selectedCat === "Todos" ? "bg-primary text-primary-foreground font-semibold" : "bg-secondary hover:bg-primary hover:text-primary-foreground"}`}
          >
            Todos
          </button>
          {CATEGORIAS.map((c) => (
            <button 
              key={c} 
              onClick={() => setSelectedCat(c)}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${selectedCat === c ? "bg-primary text-primary-foreground font-semibold" : "bg-secondary hover:bg-primary hover:text-primary-foreground"}`}
            >
              {c}
            </button>
          ))}
        </div>
      </Card>

      {/* Tabela */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Produto</TableHead>
              <TableHead className="hidden md:table-cell">Origem</TableHead>
              <TableHead className="hidden lg:table-cell">SKU</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="hidden md:table-cell">Unidade</TableHead>
              <TableHead>Custo</TableHead>
              <TableHead>Preço Venda</TableHead>
              <TableHead className="hidden lg:table-cell">Margem</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-6 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-6 text-destructive font-semibold">
                  Erro ao carregar produtos: {error instanceof Error ? error.message : String(error)}
                </TableCell>
              </TableRow>
            ) : filteredData?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-6 text-muted-foreground">
                  Nenhum produto encontrado.
                </TableCell>
              </TableRow>
            ) : filteredData?.map((p) => {
              try {
                const imgSrc = p.image_url || p.main_image_url;
                const costVal = Number(p.cost_price || p.base_cost || 0);
                const saleVal = Number(p.sale_price || p.suggested_price || 0);
                const marginVal = Number(p.margin_percent || p.target_margin || 0);
                const skuDisplay = p.internal_sku || p.supplier_sku || "—";
                const isMarginValid = !isNaN(marginVal);

                let formattedCost = "R$ 0,00";
                try {
                  formattedCost = fmt.format(costVal);
                } catch (e) {
                  console.error("Erro ao formatar custo:", e);
                }

                let formattedSale = "R$ 0,00";
                try {
                  formattedSale = fmt.format(saleVal);
                } catch (e) {
                  console.error("Erro ao formatar preço de venda:", e);
                }

                return (
                  <TableRow key={p.id}>
                    {/* Imagem */}
                    <TableCell>
                      {imgSrc ? (
                        <img src={imgSrc} alt={p.name || "Sem nome"} className="h-10 w-10 rounded-md object-cover border" />
                      ) : (
                        <div className="h-10 w-10 rounded-md bg-secondary flex items-center justify-center">
                          <Package className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    {/* Nome + nome comercial + fornecedor */}
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm leading-tight">{p.name || "Sem nome"}</span>
                        {p.commercial_name && p.commercial_name !== p.name && (
                          <span className="text-xs text-muted-foreground">{p.commercial_name}</span>
                        )}
                        {p.supplier_name && (
                          <span className="text-[10px] text-info flex items-center gap-1 mt-0.5">
                            <Truck className="h-2.5 w-2.5" /> {p.supplier_name}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    {/* Origem */}
                    <TableCell className="hidden md:table-cell">
                      {getOriginBadge(p.origin, p.type, p.imported_from_supplier)}
                    </TableCell>
                    {/* SKU */}
                    <TableCell className="hidden lg:table-cell">
                      <span className="font-mono text-xs text-muted-foreground">{skuDisplay}</span>
                    </TableCell>
                    {/* Categoria */}
                    <TableCell><StatusBadge variant="muted">{p.category || "Geral"}</StatusBadge></TableCell>
                    {/* Unidade */}
                    <TableCell className="hidden md:table-cell text-muted-foreground">{p.unit_measure || "—"}</TableCell>
                    {/* Custo */}
                    <TableCell className="text-sm">{formattedCost}</TableCell>
                    {/* Preço venda */}
                    <TableCell className="font-bold text-foreground text-sm">{formattedSale}</TableCell>
                    {/* Margem */}
                    <TableCell className="hidden lg:table-cell">
                      <span className={`font-semibold text-sm ${marginVal >= 30 ? "text-success" : marginVal >= 15 ? "text-warning" : "text-destructive"}`}>
                        {isMarginValid ? `${marginVal.toFixed(0)}%` : "—%"}
                      </span>
                    </TableCell>
                    {/* Status */}
                    <TableCell><StatusBadge variant={p.status === 'Ativo' ? 'success' : 'muted'}>{p.status || "Ativo"}</StatusBadge></TableCell>
                    {/* Ações */}
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost"><MoreVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(p)}>
                            <Edit className="h-4 w-4 mr-2" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => duplicateMutation.mutate(p)}>
                            <Copy className="h-4 w-4 mr-2" /> Duplicar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleGenerateQuote(p)}>
                            <FilePlus2 className="h-4 w-4 mr-2" /> Gerar Orçamento
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setMarketplaceProduct(p)}>
                            <Store className="h-4 w-4 mr-2" /> Rascunho Marketplace
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteConfirmProduct(p)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Remover
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              } catch (err) {
                console.error("Erro renderizando produto na tabela:", p, err);
                return (
                  <TableRow key={p?.id || Math.random().toString()}>
                    <TableCell colSpan={11} className="text-destructive text-xs py-2 text-center">
                      Erro ao exibir produto "{p?.name || 'Sem nome'}". Verifique o console de desenvolvedor.
                    </TableCell>
                  </TableRow>
                );
              }
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Editor Avançado de Produto (drawer) */}
      <ProductEditor
        open={isModalOpen}
        onOpenChange={(open) => { setIsModalOpen(open); if (!open) setEditingProduct(null); }}
        product={editingProduct}
        suppliers={suppliers}
        onRequestQuote={(id) => navigate({ to: "/orcamentos", search: { selectProductId: id } })}
        onRequestMarketplace={(p) => { setIsModalOpen(false); setMarketplaceProduct(p); }}
        onRequestDuplicate={(p) => duplicateMutation.mutate(p)}
      />

      {/* Modal de Importação do Hub */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-info" />
              Importar do Hub de Fornecedores
            </DialogTitle>
            <DialogDescription>
              Selecione produtos capturados pelo Hub para incluí-los em Produtos & Serviços.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto mt-2 pr-2">
            {isHubLoading ? (
              <div className="h-32 flex items-center justify-center">
                <Loader2 className="h-6 w-6 text-primary animate-spin" />
              </div>
            ) : hubCatalogItems && hubCatalogItems.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Custo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hubCatalogItems.map((item: any) => {
                      // "Já no catálogo" é decidido pela existência real em `products`,
                      // não pelo flag extraction_status (que pode estar dessincronizado).
                      const isAlreadyImported =
                        (!!item.source_url && importedKeys.urls.has(item.source_url)) ||
                        (!!item.supplier_sku && importedKeys.skus.has(item.supplier_sku));
                      const cost = Number(item.current_price) || 0;
                      return (
                        <TableRow key={item.id} className={isAlreadyImported ? "opacity-60" : ""}>
                          <TableCell>
                            {item.main_image_url ? (
                              <img src={item.main_image_url} alt={item.product_name} className="h-9 w-9 rounded-md object-cover border" />
                            ) : (
                              <div className="h-9 w-9 rounded-md bg-secondary flex items-center justify-center">
                                <Package className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-semibold text-sm max-w-[200px] truncate">{item.product_name}</TableCell>
                          <TableCell>
                            <StatusBadge variant="info">{item.suppliers?.name || "Parceiro"}</StatusBadge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{item.supplier_sku || "—"}</TableCell>
                          <TableCell className="text-sm font-medium">
                            {fmt.format(cost)}
                          </TableCell>
                          <TableCell>
                            {isAlreadyImported ? (
                              <StatusBadge variant="success">Importado</StatusBadge>
                            ) : (
                              <StatusBadge variant="warning">Pendente</StatusBadge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {isAlreadyImported ? (
                              <span className="text-xs text-muted-foreground">Já no catálogo</span>
                            ) : (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    disabled={importFromHubMutation.isPending}
                                  >
                                    {importFromHubMutation.isPending ? (
                                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    ) : (
                                      <Plus className="h-3 w-3 mr-1" />
                                    )}
                                    Importar...
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => importFromHubMutation.mutate({ item, type: 'product' })}>
                                    <Package className="h-4 w-4 mr-2" /> Como Produto
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => importFromHubMutation.mutate({ item, type: 'service' })}>
                                    <Tag className="h-4 w-4 mr-2" /> Como Serviço
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center p-8 border border-dashed rounded-lg">
                <Package className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-muted-foreground mb-2 font-semibold">Nenhum produto capturado ainda.</p>
                <p className="text-xs text-muted-foreground mb-4">Use o Importador por Link para trazer produtos do fornecedor.</p>
                <Button onClick={() => navigate({ to: "/produtos/importar" })}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Ir para o Importador por Link
                </Button>
              </div>
            )}
          </div>
          <DialogFooter className="mt-4 pt-4 border-t">
            <Button variant="ghost" onClick={() => navigate({ to: "/produtos/importar" })} className="mr-auto text-muted-foreground">
              Não achou o que procurava? Importar por link
            </Button>
            <Button onClick={() => setIsImportModalOpen(false)}>Concluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de exclusão */}
      <Dialog open={!!deleteConfirmProduct} onOpenChange={(open) => !open && setDeleteConfirmProduct(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Tem certeza que deseja remover o produto <strong>{deleteConfirmProduct?.name}</strong>? Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmProduct(null)}>Cancelar</Button>
            <Button 
              variant="destructive" 
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (deleteConfirmProduct) {
                  deleteMutation.mutate(deleteConfirmProduct.id, {
                    onSuccess: () => setDeleteConfirmProduct(null)
                  });
                }
              }}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Marketplace (do Hub) */}
      {marketplaceProduct && (
        <MarketplaceVariationsModal
          open={!!marketplaceProduct}
          onClose={() => setMarketplaceProduct(null)}
          product={marketplaceProduct}
          onNavigateToDrafts={() => navigate({ to: "/hub-fornecedores" })}
        />
      )}

    </>
  );
}
