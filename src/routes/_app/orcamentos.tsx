import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search, MoreVertical, Loader2, FilePlus2, CheckCircle2, XCircle, FileSignature, Package, Truck, Tag, ChevronDown, X } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useState, useEffect, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_app/orcamentos")({
  component: OrcamentosPage,
  validateSearch: (search: Record<string, unknown>) => ({
    selectProductId: (search.selectProductId as string) || undefined,
  }),
});

type CatalogProduct = {
  id: string;
  name: string;
  commercial_name: string | null;
  type: string | null;
  origin: string | null;
  supplier_name: string | null;
  internal_sku: string | null;
  supplier_sku: string | null;
  category: string | null;
  cost_price: number | null;
  base_cost: number | null;
  sale_price: number | null;
  suggested_price: number | null;
  margin_percent: number | null;
  unit_measure: string | null;
  image_url: string | null;
  main_image_url: string | null;
  description: string | null;
  technical_description: string | null;
  supplier_id: string | null;
  production_deadline: string | null;
  imported_from_supplier: boolean | null;
};

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function getOriginLabel(origin: string | null, type: string | null, imported_from_supplier?: boolean | null) {
  if (type === "service") return { label: "Serviço", variant: "accent" as const };
  if (origin === "supplier_import" || imported_from_supplier) return { label: "Fornecedor", variant: "info" as const };
  return { label: "Manual", variant: "muted" as const };
}

function OrcamentosPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const selectProductId = search.selectProductId;

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const autoOpenedRef = useRef(false);

  // Estado do formulário
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [productFilterOrigin, setProductFilterOrigin] = useState("all");
  const [showProductList, setShowProductList] = useState(false);

  const [formData, setFormData] = useState({
    client_id: "",
    service_desc: "",
    quantity: 1,
    cost_value: 0,
    sale_price: 0,
    discount: 0,
    final_value: 0,
    estimated_profit: 0,
    margin_percentage: 0,
    notes: "",
    status: "rascunho"
  });

  // Calculate final values when cost, sale, or discount changes
  useEffect(() => {
    const sale = Number(formData.sale_price) || 0;
    const discount = Number(formData.discount) || 0;
    const cost = Number(formData.cost_value) || 0;
    const qty = Number(formData.quantity) || 1;

    const totalSale = sale * qty;
    const final_value = totalSale - discount;
    const totalCost = cost * qty;
    const profit = final_value - totalCost;
    const margin = final_value > 0 ? (profit / final_value) * 100 : 0;

    setFormData(prev => ({
      ...prev,
      final_value: Number(final_value.toFixed(2)),
      estimated_profit: Number(profit.toFixed(2)),
      margin_percentage: Number(margin.toFixed(2))
    }));
  }, [formData.sale_price, formData.discount, formData.cost_value, formData.quantity]);

  // Busca clientes
  const { data: clients } = useQuery({
    queryKey: ["clients_list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!profile,
  });

  // Busca catálogo de produtos (tabela unificada)
  const { data: catalogProducts } = useQuery({
    queryKey: ["products_catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(`
          id, name, commercial_name, type, origin, supplier_name,
          internal_sku, supplier_sku, category, cost_price, base_cost,
          sale_price, suggested_price, margin_percent, unit_measure, image_url,
          main_image_url, description, technical_description, supplier_id,
          production_deadline, imported_from_supplier
        `)
        .eq("status", "Ativo")
        .order("name");
      if (error) throw error;
      return data as CatalogProduct[];
    },
    enabled: !!profile,
  });

  // Busca orçamentos
  const { data: quotes, isLoading } = useQuery({
    queryKey: ["quotes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select(`
          *,
          clients:client_id (name)
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile,
  });

  // Busca items de orçamento para exibir badge de origem
  const { data: quoteItemsMap } = useQuery({
    queryKey: ["quote_items_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quote_items")
        .select("quote_id, source_origin, item_name");
      if (error) throw error;
      const map: Record<string, { source_origin: string; item_name: string }[]> = {};
      data?.forEach(item => {
        if (!map[item.quote_id]) map[item.quote_id] = [];
        map[item.quote_id].push(item);
      });
      return map;
    },
    enabled: !!profile,
  });

  // Pré-selecionar produto via URL e abrir modal
  useEffect(() => {
    if (selectProductId && catalogProducts && !autoOpenedRef.current) {
      const product = catalogProducts.find(p => p.id === selectProductId);
      if (product) {
        handleSelectProduct(product);
        setIsModalOpen(true);
        autoOpenedRef.current = true;
      }
    }
  }, [selectProductId, catalogProducts]);

  // Filtra produtos no seletor
  const filteredCatalogProducts = useMemo(() => {
    return catalogProducts?.filter(p => {
      const matchesSearch = productSearch === "" ||
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        (p.commercial_name && p.commercial_name.toLowerCase().includes(productSearch.toLowerCase())) ||
        (p.internal_sku && p.internal_sku.toLowerCase().includes(productSearch.toLowerCase())) ||
        (p.supplier_sku && p.supplier_sku.toLowerCase().includes(productSearch.toLowerCase()));

      let matchesOrigin = true;
      if (productFilterOrigin === "manual") matchesOrigin = (p.origin === "manual" || p.origin === null) && !p.imported_from_supplier;
      if (productFilterOrigin === "supplier") matchesOrigin = p.origin === "supplier_import" || p.imported_from_supplier === true;
      if (productFilterOrigin === "service") matchesOrigin = p.type === "service";

      return matchesSearch && matchesOrigin;
    }) || [];
  }, [catalogProducts, productSearch, productFilterOrigin]);

  // Filtra orçamentos
  const filteredData = quotes?.filter(item => {
    const matchesSearch = item.quote_number.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.clients?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.service_desc?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" ? true : item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Selecionar produto do catálogo e auto-preencher
  function handleSelectProduct(product: CatalogProduct) {
    setSelectedProduct(product);
    setShowProductList(false);
    setProductSearch("");

    const costVal = product.cost_price || product.base_cost || 0;
    const saleVal = product.sale_price || product.suggested_price || 0;

    setFormData(prev => ({
      ...prev,
      service_desc: product.name,
      cost_value: costVal,
      sale_price: saleVal,
      notes: product.technical_description || product.description || ""
    }));
  }

  // Remover seleção de produto
  function clearSelectedProduct() {
    setSelectedProduct(null);
    setFormData(prev => ({
      ...prev,
      service_desc: "",
      cost_value: 0,
      sale_price: 0,
      notes: ""
    }));
  }

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: profileData } = await supabase.from('profiles').select('company_id').eq('id', (await supabase.auth.getUser()).data.user?.id || "").single();
      
      if (!profileData?.company_id) throw new Error("Empresa não identificada.");

      // Gerar número do orçamento
      const { count } = await supabase.from("quotes").select("*", { count: "exact", head: true });
      const qNum = `ORC-${String((count || 0) + 1).padStart(6, '0')}`;

      // 1. Insere o orçamento na tabela quotes
      const { data: insertedQuote, error: quoteError } = await supabase.from("quotes").insert([{ 
        company_id: profileData.company_id,
        client_id: data.client_id || null,
        quote_number: qNum,
        service_desc: data.service_desc,
        quantity: data.quantity,
        cost_value: data.cost_value * data.quantity,
        sale_price: data.sale_price * data.quantity,
        margin_percentage: data.margin_percentage,
        discount: data.discount,
        final_value: data.final_value,
        notes: data.notes || null,
        status: data.status
      }]).select("id").single();

      if (quoteError) throw quoteError;

      // 2. Insere o item do orçamento na tabela quote_items (snapshot do produto)
      if (insertedQuote) {
        const totalPrice = (data.sale_price || 0) * (data.quantity || 1);
        const { error: itemError } = await supabase.from("quote_items").insert([{
          quote_id: insertedQuote.id,
          product_service_id: selectedProduct?.id || null,
          item_name: data.service_desc,
          description: data.notes || null,
          quantity: data.quantity,
          unit_price: data.sale_price,
          total_price: totalPrice,
          cost_price: data.cost_value,
          margin_percent: data.margin_percentage,
          supplier_id: selectedProduct?.supplier_id || null,
          source_origin: selectedProduct?.origin || "manual",
          notes: selectedProduct ? `SKU: ${selectedProduct.internal_sku || selectedProduct.supplier_sku || "N/A"}` : null,
        }]);
        if (itemError) {
          console.error("Erro ao criar item do orçamento:", itemError);
          // Não lança exceção para não bloquear o fluxo principal
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["quote_items_all"] });
      toast.success("Orçamento gerado com sucesso!");
      setIsModalOpen(false);
      resetForm();
      // Limpa o query param
      navigate({ to: "/orcamentos", search: { selectProductId: undefined } });
    },
    onError: (err) => {
      toast.error("Erro ao gerar: " + err.message);
    }
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const { error } = await supabase.from("quotes").update({ status }).eq("id", id);
      if (error) throw error;
      
      if (status === 'convertido_pedido') {
        toast.info("Em breve: Criação de pedido automático e redirecionamento.");
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast.success(`Orçamento marcado como ${variables.status.replace("_", " ")}`);
    },
    onError: (err) => toast.error("Erro ao alterar: " + err.message)
  });

  function resetForm() {
    setSelectedProduct(null);
    setProductSearch("");
    setShowProductList(false);
    setFormData({ 
      client_id: "", service_desc: "", quantity: 1, cost_value: 0, 
      sale_price: 0, discount: 0, final_value: 0, 
      estimated_profit: 0, margin_percentage: 0, notes: "", status: "rascunho" 
    });
  }

  function getStatusVariant(status: string) {
    switch(status) {
      case 'aprovado': return 'success';
      case 'convertido_pedido': return 'info';
      case 'aguardando_cliente':
      case 'enviado': return 'warning';
      case 'recusado':
      case 'vencido': return 'destructive';
      default: return 'default';
    }
  }

  function getQuoteOriginBadge(quoteId: string) {
    const items = quoteItemsMap?.[quoteId];
    if (!items || items.length === 0) return null;
    const origin = items[0].source_origin;
    const { label, variant } = getOriginLabel(origin, origin === "service" ? "service" : null);
    return <StatusBadge variant={variant}>{label}</StatusBadge>;
  }

  return (
    <>
      <PageHeader 
        title="Orçamentos" 
        description="Crie, envie e acompanhe orçamentos integrados ao catálogo" 
        action="Novo orçamento" 
        onAction={() => { resetForm(); setIsModalOpen(true); }}
      />
      
      <Card className="p-4 mb-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por número, cliente ou produto..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9" 
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-44"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="rascunho">Rascunho</SelectItem>
              <SelectItem value="enviado">Enviado</SelectItem>
              <SelectItem value="aguardando_cliente">Aguardando cliente</SelectItem>
              <SelectItem value="aprovado">Aprovado</SelectItem>
              <SelectItem value="recusado">Recusado</SelectItem>
              <SelectItem value="convertido_pedido">Convertido</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="hidden md:table-cell">Produto/Serviço</TableHead>
              <TableHead className="hidden md:table-cell">Origem</TableHead>
              <TableHead>Valor Final</TableHead>
              <TableHead className="hidden lg:table-cell">Lucro</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-6"><Loader2 className="mx-auto animate-spin" /></TableCell></TableRow>
            ) : filteredData?.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">Nenhum orçamento encontrado.</TableCell></TableRow>
            ) : filteredData?.map((q) => (
              <TableRow key={q.id}>
                <TableCell className="font-mono font-semibold text-primary">{q.quote_number}</TableCell>
                <TableCell className="font-medium">{q.clients?.name || "—"}</TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{q.service_desc}</TableCell>
                <TableCell className="hidden md:table-cell">{getQuoteOriginBadge(q.id)}</TableCell>
                <TableCell className="font-semibold">
                  {fmt.format(q.final_value)}
                </TableCell>
                <TableCell className="hidden lg:table-cell text-success font-medium">
                  {fmt.format((q.final_value || 0) - (q.cost_value || 0))}
                </TableCell>
                <TableCell><StatusBadge variant={getStatusVariant(q.status || "") as any}>{(q.status || "").replace("_", " ")}</StatusBadge></TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost"><MoreVertical className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => statusMutation.mutate({ id: q.id, status: 'aprovado' })}>
                        <CheckCircle2 className="h-4 w-4 mr-2 text-success" /> Aprovar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => statusMutation.mutate({ id: q.id, status: 'recusado' })}>
                        <XCircle className="h-4 w-4 mr-2 text-destructive" /> Recusar
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        disabled={q.status !== 'aprovado'}
                        onClick={() => statusMutation.mutate({ id: q.id, status: 'convertido_pedido' })}
                      >
                        <FilePlus2 className="h-4 w-4 mr-2" /> Converter p/ Pedido
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        disabled={q.status !== 'aprovado'}
                        onClick={() => toast.info("Geração de contrato será implementada no módulo Contratos.")}
                      >
                        <FileSignature className="h-4 w-4 mr-2" /> Gerar Contrato
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Modal: Novo Orçamento */}
      <Dialog open={isModalOpen} onOpenChange={(open) => {
        setIsModalOpen(open);
        if (!open) {
          resetForm();
          navigate({ to: "/orcamentos", search: { selectProductId: undefined } });
        }
      }}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo Orçamento</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Seletor de Cliente */}
            <div className="grid gap-2">
              <Label>Cliente *</Label>
              <Select value={formData.client_id} onValueChange={(val) => setFormData({...formData, client_id: val})}>
                <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                <SelectContent>
                  {clients?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Seletor de Produto do Catálogo */}
            <div className="grid gap-2">
              <Label>Produto / Serviço do Catálogo</Label>
              {selectedProduct ? (
                <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-md border">
                  {(selectedProduct.image_url || selectedProduct.main_image_url) ? (
                    <img src={selectedProduct.image_url || selectedProduct.main_image_url || ""} alt="" className="h-10 w-10 rounded object-cover border" />
                  ) : (
                    <div className="h-10 w-10 rounded bg-secondary flex items-center justify-center">
                      <Package className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{selectedProduct.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <StatusBadge variant={getOriginLabel(selectedProduct.origin, selectedProduct.type, selectedProduct.imported_from_supplier).variant}>
                        {getOriginLabel(selectedProduct.origin, selectedProduct.type, selectedProduct.imported_from_supplier).label}
                      </StatusBadge>
                      {selectedProduct.internal_sku && (
                        <span className="text-[10px] font-mono text-muted-foreground">{selectedProduct.internal_sku}</span>
                      )}
                      <span className="text-xs font-semibold ml-auto">{fmt.format(selectedProduct.sale_price || selectedProduct.suggested_price || 0)}</span>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={clearSelectedProduct}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <div 
                    className="flex items-center gap-2 p-2.5 border rounded-md cursor-pointer hover:bg-secondary/30 transition-colors"
                    onClick={() => setShowProductList(!showProductList)}
                  >
                    <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                    <input
                      type="text"
                      placeholder="Buscar no catálogo por nome ou SKU..."
                      value={productSearch}
                      onChange={(e) => {
                        setProductSearch(e.target.value);
                        setShowProductList(true);
                      }}
                      onFocus={() => setShowProductList(true)}
                      className="flex-1 bg-transparent text-sm outline-none"
                    />
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>

                  {showProductList && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg max-h-64 overflow-y-auto">
                      {/* Filtros rápidos dentro do seletor */}
                      <div className="sticky top-0 bg-background border-b p-2 flex gap-1">
                        {[
                          { value: "all", label: "Todos" },
                          { value: "manual", label: "Manual" },
                          { value: "supplier", label: "Fornecedor" },
                          { value: "service", label: "Serviço" },
                        ].map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => setProductFilterOrigin(opt.value)}
                            className={`text-[10px] px-2 py-1 rounded-full transition-colors ${productFilterOrigin === opt.value 
                              ? "bg-primary text-primary-foreground font-semibold" 
                              : "bg-secondary hover:bg-primary/20"}`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      {filteredCatalogProducts.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          Nenhum produto encontrado no catálogo.
                        </div>
                      ) : (
                        filteredCatalogProducts.map(p => {
                          const imgSrc = p.image_url || p.main_image_url;
                          const { label, variant } = getOriginLabel(p.origin, p.type, p.imported_from_supplier);
                          return (
                            <div
                              key={p.id}
                              className="flex items-center gap-3 p-2.5 hover:bg-secondary/50 cursor-pointer transition-colors border-b last:border-b-0"
                              onClick={() => handleSelectProduct(p)}
                            >
                              {imgSrc ? (
                                <img src={imgSrc} alt="" className="h-8 w-8 rounded object-cover border shrink-0" />
                              ) : (
                                <div className="h-8 w-8 rounded bg-secondary flex items-center justify-center shrink-0">
                                  <Package className="h-3 w-3 text-muted-foreground" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{p.name}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <StatusBadge variant={variant}>{label}</StatusBadge>
                                  {p.internal_sku && (
                                    <span className="text-[9px] font-mono text-muted-foreground">{p.internal_sku}</span>
                                  )}
                                  {p.supplier_name && (
                                    <span className="text-[9px] text-info flex items-center gap-0.5">
                                      <Truck className="h-2 w-2" /> {p.supplier_name}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-xs font-bold">{fmt.format(p.sale_price || p.suggested_price || 0)}</p>
                                <p className="text-[9px] text-muted-foreground">Custo: {fmt.format(p.cost_price || p.base_cost || 0)}</p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Nome manual (editável, pré-preenchido pelo produto) */}
            <div className="grid gap-2">
              <Label>Descrição do Serviço/Produto *</Label>
              <Input value={formData.service_desc} onChange={(e) => setFormData({...formData, service_desc: e.target.value})} />
            </div>

            {/* Quantidade */}
            <div className="grid gap-2">
              <Label>Quantidade</Label>
              <Input 
                type="number" 
                min="1" 
                value={formData.quantity} 
                onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value) || 1})} 
              />
            </div>

            {/* Custo e Venda */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Custo Unitário (R$)</Label>
                <Input 
                  type="number" 
                  min="0" 
                  step="0.01"
                  value={formData.cost_value} 
                  onChange={(e) => setFormData({...formData, cost_value: parseFloat(e.target.value) || 0})} 
                />
              </div>
              <div className="grid gap-2">
                <Label>Preço de Venda Unitário (R$)</Label>
                <Input 
                  type="number" 
                  min="0" 
                  step="0.01"
                  value={formData.sale_price} 
                  onChange={(e) => setFormData({...formData, sale_price: parseFloat(e.target.value) || 0})} 
                />
              </div>
            </div>

            {/* Desconto */}
            <div className="grid gap-2">
              <Label>Desconto Total (R$)</Label>
              <Input 
                type="number" 
                min="0" 
                step="0.01"
                value={formData.discount} 
                onChange={(e) => setFormData({...formData, discount: parseFloat(e.target.value) || 0})} 
              />
            </div>

            {/* Resumo financeiro */}
            <div className="p-3 bg-secondary/50 rounded-md grid grid-cols-3 gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Valor Final</p>
                <p className="font-bold text-sm">{fmt.format(formData.final_value)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Lucro Esperado</p>
                <p className={`font-bold text-sm ${formData.estimated_profit >= 0 ? "text-success" : "text-destructive"}`}>
                  {fmt.format(formData.estimated_profit)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Margem</p>
                <p className={`font-bold text-sm ${formData.margin_percentage >= 30 ? "text-success" : formData.margin_percentage >= 15 ? "text-warning" : "text-destructive"}`}>
                  {formData.margin_percentage.toFixed(1)}%
                </p>
              </div>
            </div>

            {/* Observações */}
            <div className="grid gap-2">
              <Label>Observações / Descrição Técnica</Label>
              <Textarea 
                rows={3}
                value={formData.notes} 
                onChange={(e) => setFormData({...formData, notes: e.target.value})} 
                placeholder="Detalhes técnicos, especificações, instruções..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button 
              disabled={!formData.client_id || !formData.service_desc || saveMutation.isPending} 
              onClick={() => saveMutation.mutate(formData)}
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} 
              Gerar Orçamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
