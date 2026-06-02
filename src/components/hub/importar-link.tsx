import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/status-badge";
import { 
  Link2, Loader2, Sparkles, Save, ShoppingCart, Globe, HelpCircle, 
  Trash2, Plus, Check, Play, Settings2, Image as ImageIcon, Eye, ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import { fetchProductHtml } from "@/integrations/supabase/hub-actions";
import { extractProductFromHtml } from "@/lib/supplier-extractor";
import type { ExtractedProductData } from "@/lib/supplier-extractor";
import { generateMarketplaceCopy } from "@/lib/marketplace-copy-generator";
import { MarketplaceVariationsModal } from "@/components/hub/marketplace-variations-modal";

interface ImportarLinkProps {
  onNavigateToProducts: () => void;
  onNavigateToDrafts: () => void;
}

export function ImportarLink({ onNavigateToProducts, onNavigateToDrafts }: ImportarLinkProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [url, setUrl] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [margin, setMargin] = useState(50); // Margem de lucro padrão (%)
  
  // Estado do produto analisado
  const [analysisResult, setAnalysisResult] = useState<ExtractedProductData | null>(null);
  const [editedProduct, setEditedProduct] = useState<ExtractedProductData | null>(null);
  const [originalHtml, setOriginalHtml] = useState("");
  const [domain, setDomain] = useState("");
  const [importId, setImportId] = useState<string | null>(null);

  // Estados para o laboratório de treinamento do importador
  const [labFieldKey, setLabFieldKey] = useState("product_name");
  const [labMethod, setLabMethod] = useState("css_selector");
  const [labSelector, setLabSelector] = useState("");
  const [labRegex, setLabRegex] = useState("");
  const [labLabelAnchor, setLabLabelAnchor] = useState("");
  const [labAttr, setLabAttr] = useState("");
  const [labTestResult, setLabTestResult] = useState<string | null>(null);

  // Estados temporários para a aba de revisão antes de salvar no CRM
  const [reviewNewGalleryUrl, setReviewNewGalleryUrl] = useState("");
  const [reviewNewSpecKey, setReviewNewSpecKey] = useState("");
  const [reviewNewSpecVal, setReviewNewSpecVal] = useState("");
  const [reviewNewVarName, setReviewNewVarName] = useState("");
  const [reviewNewVarValues, setReviewNewVarValues] = useState("");
  const [reviewNewExtraName, setReviewNewExtraName] = useState("");
  const [reviewNewExtraPrice, setReviewNewExtraPrice] = useState(0);
  const [reviewNewTemplateName, setReviewNewTemplateName] = useState("");
  const [reviewNewTemplateUrl, setReviewNewTemplateUrl] = useState("");
  const [enrichingProductId, setEnrichingProductId] = useState<string | null>(null);
  // Produto salvo no CRM após importação — usado para abrir o modal de marketplace
  const [savedCrmProduct, setSavedCrmProduct] = useState<any>(null);

  // Busca fornecedores ativos do banco
  const { data: suppliers = [], isLoading: isLoadingSuppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .eq("status", "Ativo")
        .order("name", { ascending: true });
      if (error) throw error;
      return data;
    }
  });

  // Tenta autodetectar o fornecedor quando a URL muda
  useEffect(() => {
    if (!url) return;
    try {
      const host = new URL(url).hostname.replace("www.", "");
      const matched = suppliers.find(s => s.domain && host.includes(s.domain));
      if (matched) {
        setSelectedSupplierId(matched.id);
        if (matched.default_margin) setMargin(matched.default_margin);
        toast.info(`Fornecedor ${matched.name} detectado automaticamente!`);
      }
    } catch (e) {}
  }, [url, suppliers]);

  // Recalcula preços de venda baseados na margem e preço de custo
  useEffect(() => {
    if (!analysisResult) return;
    const factor = 1 + margin / 100;
    
    // Atualiza tiragens
    const updatedQtyPrices = (analysisResult.quantity_prices || []).map(qp => {
      const sellPrice = parseFloat((qp.price * factor).toFixed(2));
      return {
        ...qp,
        sellPrice: sellPrice,
        unitSellPrice: parseFloat((sellPrice / qp.quantity).toFixed(4))
      };
    });

    setEditedProduct(prev => {
      if (!prev) return null;
      return {
        ...prev,
        current_price: analysisResult.current_price,
        original_price: analysisResult.original_price,
        quantity_prices: updatedQtyPrices
      };
    });
  }, [margin, analysisResult]);

  // Mutação para Analisar Link
  const analyzeMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Usuário não autenticado.");
      // Busca a company_id do usuário logado
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();
      
      if (!profile?.company_id) throw new Error("Empresa do usuário não identificada.");

      // 1. Fetch do HTML
      const htmlRes = await fetchProductHtml({ data: { url } });
      if (!htmlRes.success || !htmlRes.html) {
        throw new Error(htmlRes.error || "Não foi possível obter o HTML da página.");
      }
      
      const domain = htmlRes.domain || "";
      
      // 2. Busca regras de mapeamento no Supabase
      const { data: rules } = await supabase
        .from("supplier_mapping_rules")
        .select("*")
        .eq("company_id", profile.company_id)
        .eq("supplier_domain", domain);

      // 3. Executa extrator
      const extracted = extractProductFromHtml(htmlRes.html, rules || []);

      // 4. Salva snapshot da página
      await supabase.from("supplier_page_snapshots").insert({
        company_id: profile.company_id,
        url,
        html_content: htmlRes.html
      });

      // 5. Salva histórico em supplier_imports (com campos corretos do schema)
      const { data: importRec, error: importErr } = await supabase
        .from("supplier_imports")
        .insert({
          company_id: profile.company_id,
          supplier_id: selectedSupplierId || null,
          source_url: url,
          supplier_domain: domain,
          extraction_status: "success",
          product_name: extracted.product_name,
          current_price: extracted.current_price,
          original_price: extracted.original_price,
          supplier_sku: extracted.supplier_sku,
          main_image_url: extracted.main_image_url,
          gallery_images: extracted.gallery_images,
          specifications: extracted.specifications,
          quantity_prices: extracted.quantity_prices,
          production_deadline: extracted.production_deadline
        })
        .select("id")
        .single();

      if (importErr) throw importErr;

      return {
        extracted,
        domain,
        importId: importRec.id,
        html: htmlRes.html
      };
    },
    onSuccess: (res) => {
      toast.success("Produto analisado com sucesso!");
      setAnalysisResult(res.extracted);
      setEditedProduct(res.extracted);
      setDomain(res.domain);
      setImportId(res.importId);
      setOriginalHtml(res.html);
    },
    onError: (err: any) => {
      toast.error(`Erro na análise: ${err.message}`);
    }
  });

  // Mutação para Salvar no CRM
  const saveCrmMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Usuário não autenticado.");
      if (!editedProduct) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();
      
      if (!profile?.company_id) throw new Error("Empresa do usuário não identificada.");

      // Calcula custos e preços sugeridos
      const baseCost = editedProduct.current_price || 0;
      const suggestedPrice = parseFloat((baseCost * (1 + margin / 100)).toFixed(2));

      const productData = {
        company_id: profile.company_id,
        name: editedProduct.product_name,
        category: editedProduct.category,
        subcategory: editedProduct.subcategory,
        description: editedProduct.specifications["Descrição"] || editedProduct.product_name,
        unit_measure: "Unidade",
        base_cost: baseCost,
        min_price: suggestedPrice * 0.9,
        suggested_price: suggestedPrice,
        target_margin: margin,
        avg_production_time: editedProduct.production_deadline,
        notes: `Importado de: ${url}`,
        status: "Ativo",
        // Campos de fornecedor
        supplier_id: selectedSupplierId || null,
        source_url: url,
        supplier_sku: editedProduct.supplier_sku,
        cost_price: baseCost,
        sale_price: suggestedPrice,
        margin_percent: margin,
        main_image_url: editedProduct.main_image_url,
        gallery_images: editedProduct.gallery_images,
        specifications: editedProduct.specifications,
        variations: editedProduct.variations,
        quantity_prices: editedProduct.quantity_prices,
        extra_services: editedProduct.extra_services,
        template_links: editedProduct.template_links,
        imported_from_supplier: true,
        import_status: "imported"
      };

      const { data, error } = await supabase
        .from("products")
        .insert(productData)
        .select()
        .single();

      if (error) throw error;

      // Atualiza o registro em supplier_imports com status de concluído
      if (importId) {
        await supabase
          .from("supplier_imports")
          .update({ extraction_status: "imported" })
          .eq("id", importId);
      }

      return data;
    },
    onSuccess: (data) => {
      toast.success("Produto cadastrado com sucesso no catálogo do CRM!");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      onNavigateToProducts();
    },
    onError: (err: any) => {
      toast.error(`Erro ao salvar no CRM: ${err.message}`);
    }
  });

  // Geração de rascunhos agora é feita pelo MarketplaceVariationsModal
  // (acessado após salvar o produto no CRM)

  // Mutação para Testar Regra de Mapeamento no laboratório
  const testRule = () => {
    if (!originalHtml) {
      toast.error("Nenhum snapshot HTML carregado para testes.");
      return;
    }
    try {
      let found: string | null = null;
      let doc: Document | null = null;
      if (typeof window !== "undefined" && typeof DOMParser !== "undefined") {
        const parser = new DOMParser();
        doc = parser.parseFromString(originalHtml, "text/html");
      }

      if (labMethod === "meta_tag" && labSelector) {
        if (doc) {
          const meta = doc.querySelector(`meta[name="${labSelector}"], meta[property="${labSelector}"]`);
          found = meta ? meta.getAttribute("content") : null;
        }
        if (!found) {
          const metaRegex = new RegExp(`<meta\\s+[^>]*(?:name|property)=["']${escapeRegex(labSelector)}["']\\s+content=["']([^"']+)["']`, "i");
          const match = originalHtml.match(metaRegex);
          found = match ? match[1] : "Não encontrado";
        }
      } else if (labMethod === "regex" && labRegex) {
        const match = originalHtml.match(new RegExp(labRegex, "i"));
        found = match ? (match[1] || match[0]) : "Não encontrado";
      } else if (labMethod === "text_after_label" && labLabelAnchor) {
        const labelRegex = new RegExp(`${escapeRegex(labLabelAnchor)}\\s*[:\\-]?\\s*([^<\\n\\r]+)`, "i");
        const match = originalHtml.match(labelRegex);
        found = match ? match[1].trim() : "Não encontrado";
      } else if (labMethod === "css_selector" && labSelector) {
        if (doc) {
          const el = doc.querySelector(labSelector);
          found = el ? el.textContent : "Não encontrado";
        } else {
          found = "DOMParser não disponível no navegador";
        }
      } else if (labMethod === "css_attribute" && labSelector && labAttr) {
        if (doc) {
          const el = doc.querySelector(labSelector);
          found = el ? el.getAttribute(labAttr) : "Não encontrado";
        } else {
          found = "DOMParser não disponível no navegador";
        }
      } else {
        found = "Parâmetros insuficientes para o teste.";
      }
      setLabTestResult(found);
      toast.success("Teste de extração executado!");
    } catch (e: any) {
      setLabTestResult(`Erro de Teste: ${e.message}`);
    }
  };

  // Mutação para Salvar Regra de Mapeamento
  const saveRuleMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Usuário não autenticado.");
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();
      
      if (!profile?.company_id) throw new Error("Empresa do usuário não identificada.");

      const ruleData = {
        company_id: profile.company_id,
        supplier_domain: domain,
        field_key: labFieldKey,
        extraction_method: labMethod,
        selector: labSelector || null,
        regex_pattern: labRegex || null,
        label_anchor: labLabelAnchor || null,
        attribute_name: labAttr || null,
        sample_value: labTestResult || null,
        active: true
      };

      // Verifica se já existe uma regra para este domínio+campo
      const { data: existing } = await supabase
        .from("supplier_mapping_rules")
        .select("id")
        .eq("company_id", profile.company_id)
        .eq("supplier_domain", domain)
        .eq("field_key", labFieldKey)
        .maybeSingle();

      let res;
      if (existing?.id) {
        res = await supabase
          .from("supplier_mapping_rules")
          .update({
            extraction_method: ruleData.extraction_method,
            selector: ruleData.selector,
            regex_pattern: ruleData.regex_pattern,
            label_anchor: ruleData.label_anchor,
            attribute_name: ruleData.attribute_name,
            sample_value: ruleData.sample_value,
            active: true
          })
          .eq("id", existing.id)
          .select()
          .single();
      } else {
        res = await supabase
          .from("supplier_mapping_rules")
          .insert(ruleData)
          .select()
          .single();
      }

      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      toast.success("Regra de mapeamento salva e registrada para este domínio!");
      queryClient.invalidateQueries({ queryKey: ["supplier_mapping_rules"] });
    },
    onError: (err: any) => {
      toast.error(`Erro ao salvar regra: ${err.message}`);
    }
  });

  // Salva no CRM e depois abre o modal de variações de marketplace
  const handleSaveAndOpenMarketplace = async () => {
    try {
      const product = await saveCrmMutation.mutateAsync();
      if (product?.id) {
        setSavedCrmProduct(product);
      }
    } catch (e) {}
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* PAINEL DE ENTRADA DO LINK */}
      <Card className="lg:col-span-1 border-t-4 border-primary">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Análise de Link do Fornecedor
          </CardTitle>
          <CardDescription>
            Cole o link do produto público de qualquer fornecedor gráfico.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="product-url">Link do Produto</Label>
            <Input 
              id="product-url"
              placeholder="https://www.printi.com.br/cartao-de-visita..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="bg-card"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="supplier-select">Fornecedor Vinculado</Label>
            <select
              id="supplier-select"
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className="w-full h-10 px-3 py-2 rounded-md border border-input bg-card text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">-- Selecione um Fornecedor (Opcional) --</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.domain || "Sem domínio"})</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <Label htmlFor="margin-slider">Margem de Lucro Interna</Label>
              <span className="text-xs font-semibold text-primary">{margin}%</span>
            </div>
            <div className="flex items-center gap-3">
              <Input 
                id="margin-slider"
                type="range" 
                min="10" 
                max="300"
                step="5"
                value={margin}
                onChange={(e) => setMargin(parseInt(e.target.value))}
                className="flex-1 accent-primary h-2 bg-secondary rounded-lg appearance-none cursor-pointer"
              />
              <Input 
                type="number" 
                value={margin} 
                onChange={(e) => setMargin(parseInt(e.target.value) || 0)}
                className="w-16 h-8 text-xs text-center"
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              O CRM recalculará automaticamente os preços de venda sugeridos com base no custo extraído e nesta margem.
            </p>
          </div>

          <Button 
            className="w-full mt-2" 
            disabled={!url || analyzeMutation.isPending}
            onClick={() => analyzeMutation.mutate()}
          >
            {analyzeMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Extraindo Dados Públicos...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2 text-warning-foreground" />
                Analisar Produto
              </>
            )}
          </Button>

          {analysisResult && (
            <div className="border-t pt-4 mt-2 flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Domínio: <strong className="text-foreground">{domain}</strong></span>
              
              {/* SHEET: TREINAR IMPORTADOR */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs flex items-center gap-1.5 border-amber-500/30 hover:border-amber-500/50 hover:bg-amber-500/5 text-amber-500">
                    <Settings2 className="h-3.5 w-3.5" />
                    Treinar Importador
                  </Button>
                </SheetTrigger>
                <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Treinar Robô Importador</SheetTitle>
                    <SheetDescription>
                      Crie seletores de extração personalizados para o domínio <strong className="text-amber-500">{domain}</strong>. O robô utilizará estas regras automaticamente para todos os novos links deste domínio.
                    </SheetDescription>
                  </SheetHeader>

                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Campo Alvo</Label>
                        <select 
                          value={labFieldKey} 
                          onChange={(e) => setLabFieldKey(e.target.value)}
                          className="w-full h-8 px-2 py-1 text-xs rounded border bg-card"
                        >
                          <option value="product_name">Nome do Produto</option>
                          <option value="supplier_sku">Código/SKU Fornecedor</option>
                          <option value="current_price">Preço de Custo</option>
                          <option value="production_deadline">Prazo de Produção</option>
                          <option value="main_image_url">Imagem Principal</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Método de Extração</Label>
                        <select 
                          value={labMethod} 
                          onChange={(e) => setLabMethod(e.target.value)}
                          className="w-full h-8 px-2 py-1 text-xs rounded border bg-card"
                        >
                          <option value="meta_tag">Meta-tag (Name ou Property)</option>
                          <option value="regex">Expressão Regular (Regex)</option>
                          <option value="text_after_label">Texto após Rótulo (Label)</option>
                          <option value="css_selector">Seletor CSS (Texto)</option>
                          <option value="css_attribute">Atributo de Seletor CSS</option>
                        </select>
                      </div>
                    </div>

                    {labMethod === "meta_tag" && (
                      <div className="space-y-2">
                        <Label>Nome do Atributo Meta Tag (ex: og:title, description, price)</Label>
                        <Input value={labSelector} onChange={(e) => setLabSelector(e.target.value)} placeholder="og:title" className="h-8 text-xs" />
                      </div>
                    )}

                    {labMethod === "regex" && (
                      <div className="space-y-2">
                        <Label>Expressão Regular com grupo de captura (ex: /sku\s*:\s*(\w+)/i)</Label>
                        <Input value={labRegex} onChange={(e) => setLabRegex(e.target.value)} placeholder="sku\s*:\s*([a-zA-Z0-9\-]+)" className="h-8 text-xs" />
                      </div>
                    )}

                    {labMethod === "text_after_label" && (
                      <div className="space-y-2">
                        <Label>Texto de Rótulo / Âncora (ex: Código do Produto, Prazo:)</Label>
                        <Input value={labLabelAnchor} onChange={(e) => setLabLabelAnchor(e.target.value)} placeholder="Código:" className="h-8 text-xs" />
                      </div>
                    )}

                    {labMethod === "css_selector" && (
                      <div className="space-y-2">
                        <Label>Classe ou Seletor CSS (ex: .product-title-main, #sku-id)</Label>
                        <Input value={labSelector} onChange={(e) => setLabSelector(e.target.value)} placeholder=".product-title" className="h-8 text-xs" />
                      </div>
                    )}

                    {labMethod === "css_attribute" && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Seletor CSS</Label>
                          <Input value={labSelector} onChange={(e) => setLabSelector(e.target.value)} placeholder=".product-image" className="h-8 text-xs" />
                        </div>
                        <div className="space-y-2">
                          <Label>Atributo</Label>
                          <Input value={labAttr} onChange={(e) => setLabAttr(e.target.value)} placeholder="src" className="h-8 text-xs" />
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={testRule}>
                        <Play className="h-3 w-3 mr-1 text-emerald-500" /> Testar Regra
                      </Button>
                      <Button size="sm" className="flex-1 text-xs bg-amber-500 hover:bg-amber-600 text-white" disabled={saveRuleMutation.isPending} onClick={() => saveRuleMutation.mutate()}>
                        <Save className="h-3 w-3 mr-1" /> Salvar Regra
                      </Button>
                    </div>

                    {labTestResult !== null && (
                      <div className="p-3 bg-muted rounded border border-border space-y-1">
                        <span className="text-[10px] text-muted-foreground uppercase font-semibold">Resultado do Teste:</span>
                        <p className="text-xs font-mono break-all">{labTestResult}</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Amostra do Código-Fonte Capturado (Snapshots):</Label>
                      <Textarea 
                        readOnly 
                        value={originalHtml ? originalHtml.substring(0, 1000) + "\n\n[TRUNCADO...]" : "Nenhum link analisado ainda."} 
                        className="h-32 text-[10px] font-mono bg-secondary" 
                      />
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          )}
        </CardContent>
      </Card>

      {/* PAINEL DE REVIEW & PREVIEW */}
      <Card className="lg:col-span-2">
        {editedProduct ? (
          <>
            <CardHeader className="flex flex-row items-center justify-between gap-4 border-b pb-4">
              <div>
                <CardTitle className="text-lg">Revisão de Dados Capturados</CardTitle>
                <CardDescription>
                  Verifique e edite os dados extraídos antes de aprovar e salvar.
                </CardDescription>
              </div>
              <StatusBadge variant="success">Análise Concluída</StatusBadge>
            </CardHeader>
            <CardContent className="p-0">
              <Tabs defaultValue="geral" className="w-full">
                <div className="border-b px-6 py-2 bg-muted/20">
                  <TabsList className="bg-transparent border-none p-0 gap-4 flex flex-wrap">
                    <TabsTrigger value="geral" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-xs py-1.5 px-4 rounded-full">Geral</TabsTrigger>
                    <TabsTrigger value="comercial" className="data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-500 text-xs py-1.5 px-4 rounded-full">Preços & Tiragens</TabsTrigger>
                    <TabsTrigger value="midia" className="data-[state=active]:bg-rose-500/10 data-[state=active]:text-rose-500 text-xs py-1.5 px-4 rounded-full">Galeria & Mídia</TabsTrigger>
                    <TabsTrigger value="especificacoes" className="data-[state=active]:bg-purple-500/10 data-[state=active]:text-purple-500 text-xs py-1.5 px-4 rounded-full">Especificações</TabsTrigger>
                    <TabsTrigger value="acabamentos" className="data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-500 text-xs py-1.5 px-4 rounded-full">Acabamentos</TabsTrigger>
                  </TabsList>
                </div>

                {/* TAB 1: INFORMAÇÕES GERAIS */}
                <TabsContent value="geral" className="p-6 space-y-4 outline-none">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2 col-span-1 md:col-span-2">
                      <Label htmlFor="edit-name">Nome Comercial do Produto</Label>
                      <Input 
                        id="edit-name" 
                        value={editedProduct.product_name} 
                        onChange={(e) => setEditedProduct({ ...editedProduct, product_name: e.target.value })} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-sku">Código/SKU Fornecedor</Label>
                      <Input 
                        id="edit-sku" 
                        value={editedProduct.supplier_sku} 
                        onChange={(e) => setEditedProduct({ ...editedProduct, supplier_sku: e.target.value })} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-deadline">Prazo de Produção do Fornecedor</Label>
                      <Input 
                        id="edit-deadline" 
                        value={editedProduct.production_deadline} 
                        onChange={(e) => setEditedProduct({ ...editedProduct, production_deadline: e.target.value })} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-category">Categoria do Produto</Label>
                      <Input 
                        id="edit-category" 
                        value={editedProduct.category} 
                        onChange={(e) => setEditedProduct({ ...editedProduct, category: e.target.value })} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-subcategory">Subcategoria</Label>
                      <Input 
                        id="edit-subcategory" 
                        value={editedProduct.subcategory} 
                        onChange={(e) => setEditedProduct({ ...editedProduct, subcategory: e.target.value })} 
                      />
                    </div>
                    <div className="space-y-2 col-span-1 md:col-span-2">
                      <Label htmlFor="edit-source-url">Link de Origem no Fornecedor</Label>
                      <div className="flex gap-2">
                        <Input 
                          id="edit-source-url" 
                          value={url} 
                          disabled 
                          className="bg-muted text-muted-foreground font-mono text-xs flex-1 truncate" 
                        />
                        {url && (
                          <a 
                            href={url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center px-3 rounded-md border bg-card hover:bg-muted text-xs font-semibold gap-1"
                          >
                            <ExternalLink className="h-3.5 w-3.5" /> Abrir
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-desc">Descrição Rica / Detalhes de Impressão</Label>
                    <Textarea 
                      id="edit-desc" 
                      value={editedProduct.specifications["Descrição"] || ""} 
                      onChange={(e) => {
                        const updatedSpecs = { ...editedProduct.specifications, "Descrição": e.target.value };
                        setEditedProduct({ ...editedProduct, specifications: updatedSpecs });
                      }} 
                      rows={4}
                      placeholder="Instruções de gabarito, tipo de papel, acabamento incluso e restrições de montagem da arte..."
                    />
                  </div>

                  <div className="flex gap-4 p-4 rounded-lg bg-primary/5 border border-primary/10">
                    <ImageIcon className="h-10 w-10 text-primary rounded border bg-card object-cover shrink-0" />
                    <div>
                      <h4 className="text-xs font-semibold uppercase text-primary">Preço de Custo Extraído da Página:</h4>
                      <p className="text-2xl font-black text-foreground mt-1">
                        R$ {editedProduct.current_price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        {editedProduct.discount_percent > 0 && (
                          <span className="text-xs font-semibold text-emerald-500 ml-2">-{editedProduct.discount_percent}% de desconto</span>
                        )}
                      </p>
                    </div>
                  </div>
                </TabsContent>

                {/* TAB 2: PREÇOS & TIRAGENS */}
                <TabsContent value="comercial" className="p-6 space-y-4 outline-none">
                  <div className="grid grid-cols-2 gap-3 p-3 bg-muted/40 rounded-lg border">
                    <div className="space-y-1.5">
                      <Label htmlFor="comercial-cost">Custo Base de Fábrica (R$)</Label>
                      <Input 
                        id="comercial-cost" 
                        type="number" 
                        step="0.01"
                        value={editedProduct.current_price} 
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setAnalysisResult(prev => prev ? { ...prev, current_price: val } : null);
                        }} 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="comercial-margin">Margem Geral Sugerida (%)</Label>
                      <Input 
                        id="comercial-margin" 
                        type="number" 
                        value={margin} 
                        onChange={(e) => setMargin(parseInt(e.target.value) || 0)} 
                      />
                    </div>
                    <div className="col-span-2 pt-1 text-xs text-muted-foreground flex justify-between font-semibold">
                      <span>Preço Unitário Geral Estimado:</span>
                      <span className="text-emerald-500 font-bold text-sm">
                        R$ {(editedProduct.current_price * (1 + margin / 100)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center mb-2">
                    <div>
                      <h3 className="text-sm font-semibold">Tabela de Preços por Quantidade (Tiragem)</h3>
                      <p className="text-xs text-muted-foreground">Preço final de venda calculado com a margem de {margin}%</p>
                    </div>
                    <Button 
                      size="sm" 
                      type="button"
                      variant="outline" 
                      onClick={() => {
                        const newQty = editedProduct.quantity_prices.length > 0 
                          ? editedProduct.quantity_prices[editedProduct.quantity_prices.length - 1].quantity * 2
                          : 100;
                        const newCost = editedProduct.current_price;
                        const factor = 1 + margin / 100;
                        const newSell = parseFloat((newCost * factor).toFixed(2));
                        setEditedProduct({
                          ...editedProduct,
                          quantity_prices: [
                            ...editedProduct.quantity_prices,
                            { quantity: newQty, price: newCost, unitPrice: newCost / newQty, sellPrice: newSell, unitSellPrice: newSell / newQty }
                          ]
                        });
                      }}
                      className="text-xs flex items-center gap-1 h-8"
                    >
                      <Plus className="h-3 w-3" /> Nova Tiragem
                    </Button>
                  </div>

                  <div className="border rounded-md max-h-[280px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-24">Qtd/Tiragem</TableHead>
                          <TableHead>Custo Fornecedor (Total)</TableHead>
                          <TableHead>Custo Unitário</TableHead>
                          <TableHead className="text-emerald-500">Preço de Venda (Sugerido)</TableHead>
                          <TableHead className="text-emerald-500">Venda Unitário</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(editedProduct.quantity_prices || []).map((qp, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-semibold">
                              <Input 
                                type="number" 
                                value={qp.quantity} 
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 0;
                                  const updated = [...editedProduct.quantity_prices];
                                  updated[idx] = { 
                                    ...updated[idx], 
                                    quantity: val,
                                    unitPrice: qp.price / val,
                                    unitSellPrice: (qp.sellPrice || (qp.price * (1 + margin/100))) / val
                                  };
                                  setEditedProduct({ ...editedProduct, quantity_prices: updated });
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
                                  const factor = 1 + margin / 100;
                                  const sellVal = parseFloat((val * factor).toFixed(2));
                                  const updated = [...editedProduct.quantity_prices];
                                  updated[idx] = { 
                                    ...updated[idx], 
                                    price: val, 
                                    unitPrice: val / qp.quantity,
                                    sellPrice: sellVal,
                                    unitSellPrice: sellVal / qp.quantity
                                  };
                                  setEditedProduct({ ...editedProduct, quantity_prices: updated });
                                }}
                                className="h-8 text-xs p-1"
                              />
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs font-mono">
                              R$ {(qp.price / qp.quantity || 0).toLocaleString("pt-BR", { minimumFractionDigits: 4 })}
                            </TableCell>
                            <TableCell className="font-bold text-emerald-500">
                              <Input 
                                type="number" 
                                step="0.01"
                                value={qp.sellPrice || parseFloat((qp.price * (1 + margin / 100)).toFixed(2))} 
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  const updated = [...editedProduct.quantity_prices];
                                  updated[idx] = { 
                                    ...updated[idx], 
                                    sellPrice: val,
                                    unitSellPrice: val / qp.quantity
                                  };
                                  setEditedProduct({ ...editedProduct, quantity_prices: updated });
                                }}
                                className="h-8 text-xs font-bold text-emerald-500 p-1 bg-emerald-500/5 border-emerald-500/20"
                              />
                            </TableCell>
                            <TableCell className="text-emerald-500/80 text-xs font-mono">
                              R$ {((qp.sellPrice || (qp.price * (1 + margin/100))) / qp.quantity || 0).toLocaleString("pt-BR", { minimumFractionDigits: 4 })}
                            </TableCell>
                            <TableCell>
                              <Button 
                                size="icon" 
                                type="button"
                                variant="ghost" 
                                onClick={() => {
                                  const updated = editedProduct.quantity_prices.filter((_, i) => i !== idx);
                                  setEditedProduct({ ...editedProduct, quantity_prices: updated });
                                }}
                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                {/* TAB 3: GALERIA & MÍDIA */}
                <TabsContent value="midia" className="p-6 space-y-4 outline-none">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-main-img">URL da Imagem Principal (Capa)</Label>
                    <div className="flex gap-2">
                      <Input 
                        id="edit-main-img" 
                        value={editedProduct.main_image_url} 
                        onChange={(e) => setEditedProduct({ ...editedProduct, main_image_url: e.target.value })} 
                        placeholder="Cole o link da foto de capa"
                        className="flex-1 font-mono text-xs" 
                      />
                      {editedProduct.main_image_url && (
                        <div className="h-10 w-10 border rounded bg-muted overflow-hidden flex-shrink-0 flex items-center justify-center">
                          <img src={editedProduct.main_image_url} alt="Preview" className="object-cover h-full w-full" />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="font-semibold text-sm">Fotos do Carrossel de Galeria</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="URL de imagem adicional..."
                        value={reviewNewGalleryUrl}
                        onChange={(e) => setReviewNewGalleryUrl(e.target.value)}
                        className="flex-1 font-mono text-xs"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          if (reviewNewGalleryUrl.trim()) {
                            setEditedProduct({
                              ...editedProduct,
                              gallery_images: [...editedProduct.gallery_images, reviewNewGalleryUrl.trim()]
                            });
                            setReviewNewGalleryUrl("");
                            toast.success("Imagem adicionada à galeria!");
                          }
                        }}
                        className="h-10 text-xs"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 max-h-[280px] overflow-y-auto border p-2 rounded-lg bg-muted/20">
                      {editedProduct.gallery_images.length === 0 ? (
                        <div className="col-span-4 p-8 text-center text-xs text-muted-foreground italic">
                          Nenhuma imagem de galeria extraída. Adicione manualmente usando o campo acima.
                        </div>
                      ) : (
                        editedProduct.gallery_images.map((img: string, idx: number) => {
                          const isMain = editedProduct.main_image_url === img;
                          return (
                            <div key={idx} className={`relative group border rounded-lg overflow-hidden bg-card shadow-sm aspect-video flex items-center justify-center ${isMain ? "ring-2 ring-primary border-primary" : "border-border hover:border-foreground/20"}`}>
                              <img 
                                src={img} 
                                alt={`Galeria ${idx}`}
                                className="object-contain h-full w-full max-h-32 p-1"
                              />
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <Button 
                                  size="sm" 
                                  type="button"
                                  variant={isMain ? "default" : "outline"} 
                                  onClick={() => setEditedProduct({ ...editedProduct, main_image_url: img })}
                                  className="text-[10px] h-7 px-2"
                                >
                                  {isMain ? "Principal" : "Tornar Principal"}
                                </Button>
                                <Button 
                                  size="icon" 
                                  type="button"
                                  variant="destructive" 
                                  onClick={() => {
                                    const updated = editedProduct.gallery_images.filter((g: string) => g !== img);
                                    setEditedProduct({ 
                                      ...editedProduct, 
                                      gallery_images: updated,
                                      main_image_url: isMain ? (updated[0] || "") : editedProduct.main_image_url
                                    });
                                  }}
                                  className="h-7 w-7"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                              {isMain && (
                                <span className="absolute top-2 left-2 text-[10px] bg-primary text-primary-foreground font-black px-1.5 py-0.5 rounded shadow">
                                  MAIN
                                </span>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </TabsContent>

                {/* TAB 4: ESPECIFICAÇÕES */}
                <TabsContent value="especificacoes" className="p-6 space-y-4 outline-none">
                  {/* Grade Especificações */}
                  <div className="space-y-2">
                    <Label className="font-semibold text-sm">Especificações Técnicas de Impressão (Ficha Técnica)</Label>
                    <div className="flex gap-2">
                      <Input 
                        placeholder="Chave (Ex: Acabamento)" 
                        value={reviewNewSpecKey} 
                        onChange={(e) => setReviewNewSpecKey(e.target.value)} 
                        className="w-1/3 text-xs" 
                      />
                      <Input 
                        placeholder="Valor (Ex: Verniz UV Total)" 
                        value={reviewNewSpecVal} 
                        onChange={(e) => setReviewNewSpecVal(e.target.value)} 
                        className="flex-1 text-xs" 
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          if (reviewNewSpecKey.trim() && reviewNewSpecVal.trim()) {
                            setEditedProduct({
                              ...editedProduct,
                              specifications: {
                                ...editedProduct.specifications,
                                [reviewNewSpecKey.trim()]: reviewNewSpecVal.trim()
                              }
                            });
                            setReviewNewSpecKey("");
                            setReviewNewSpecVal("");
                            toast.success("Especificação adicionada!");
                          }
                        }}
                        className="h-10 text-xs"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
                      </Button>
                    </div>

                    <div className="border rounded-md max-h-[180px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-1/3">Propriedade</TableHead>
                            <TableHead>Valor</TableHead>
                            <TableHead className="w-10"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Object.entries(editedProduct.specifications || {}).map(([key, val]) => (
                            <TableRow key={key}>
                              <TableCell className="font-semibold text-xs">{key}</TableCell>
                              <TableCell className="text-xs">
                                <Input
                                  value={val}
                                  onChange={(e) => {
                                    setEditedProduct({
                                      ...editedProduct,
                                      specifications: {
                                        ...editedProduct.specifications,
                                        [key]: e.target.value
                                      }
                                    });
                                  }}
                                  className="h-7 text-xs p-1"
                                />
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="icon"
                                  type="button"
                                  variant="ghost"
                                  onClick={() => {
                                    const updated = { ...editedProduct.specifications };
                                    delete updated[key];
                                    setEditedProduct({ ...editedProduct, specifications: updated });
                                  }}
                                  className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
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
                        value={reviewNewVarName} 
                        onChange={(e) => setReviewNewVarName(e.target.value)} 
                        className="w-1/3 text-xs" 
                      />
                      <Input 
                        placeholder="Valores (Ex: 4x0, 4x4 - separado por vírgula)" 
                        value={reviewNewVarValues} 
                        onChange={(e) => setReviewNewVarValues(e.target.value)} 
                        className="flex-1 text-xs" 
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          if (reviewNewVarName.trim() && reviewNewVarValues.trim()) {
                            const valuesArray = reviewNewVarValues.split(",").map(v => v.trim()).filter(v => v !== "");
                            setEditedProduct({
                              ...editedProduct,
                              variations: [
                                ...(editedProduct.variations || []),
                                { name: reviewNewVarName.trim(), values: valuesArray }
                              ]
                            });
                            setReviewNewVarName("");
                            setReviewNewVarValues("");
                            toast.success("Variação adicionada!");
                          }
                        }}
                        className="h-10 text-xs"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
                      </Button>
                    </div>

                    <div className="border rounded-md max-h-[180px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-1/3">Variação</TableHead>
                            <TableHead>Valores Disponíveis</TableHead>
                            <TableHead className="w-10"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(editedProduct.variations || []).length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-6">
                                Nenhuma variação de compra configurada.
                              </TableCell>
                            </TableRow>
                          ) : (
                            editedProduct.variations.map((v, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="font-semibold text-xs">{v.name}</TableCell>
                                <TableCell className="text-xs">
                                  {v.values.map((val: string, i: number) => (
                                    <span key={i} className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground ring-1 ring-inset ring-gray-500/10 mr-1 mb-1">
                                      {val}
                                    </span>
                                  ))}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    size="icon"
                                    type="button"
                                    variant="ghost"
                                    onClick={() => {
                                      const updated = editedProduct.variations.filter((_, i) => i !== idx);
                                      setEditedProduct({ ...editedProduct, variations: updated });
                                    }}
                                    className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </TabsContent>

                {/* TAB 5: ACABAMENTOS & GABARITOS */}
                <TabsContent value="acabamentos" className="p-6 space-y-4 outline-none">
                  {/* Acabamentos extras */}
                  <div className="space-y-2">
                    <Label className="font-semibold text-sm">Acabamentos Especiais Opcionais (Com Custo Adicional)</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Nome do acabamento (Ex: Verniz UV)"
                        value={reviewNewExtraName}
                        onChange={(e) => setReviewNewExtraName(e.target.value)}
                        className="flex-1 text-xs"
                      />
                      <Input
                        placeholder="Custo (R$)"
                        type="number"
                        step="0.01"
                        value={reviewNewExtraPrice || ""}
                        onChange={(e) => setReviewNewExtraPrice(parseFloat(e.target.value) || 0)}
                        className="w-1/4 text-xs"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          if (reviewNewExtraName.trim()) {
                            setEditedProduct({
                              ...editedProduct,
                              extra_services: [
                                ...(editedProduct.extra_services || []),
                                { name: reviewNewExtraName.trim(), price: reviewNewExtraPrice }
                              ]
                            });
                            setReviewNewExtraName("");
                            setReviewNewExtraPrice(0);
                            toast.success("Acabamento adicionado!");
                          }
                        }}
                        className="h-10 text-xs"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
                      </Button>
                    </div>

                    <div className="border rounded-md max-h-[180px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Acabamento / Serviço</TableHead>
                            <TableHead className="w-1/3">Custo de Fábrica</TableHead>
                            <TableHead className="w-10"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(editedProduct.extra_services || []).length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-6">
                                Nenhum acabamento opcional extraído. Adicione manualmente acima.
                              </TableCell>
                            </TableRow>
                          ) : (
                            (editedProduct.extra_services || []).map((es: any, idx: number) => (
                              <TableRow key={idx}>
                                <TableCell className="font-semibold text-xs">{es.name}</TableCell>
                                <TableCell className="text-xs text-emerald-500 font-bold">
                                  R$ {(es.price || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    size="icon"
                                    type="button"
                                    variant="ghost"
                                    onClick={() => {
                                      const updated = (editedProduct.extra_services || []).filter((_: any, i: number) => i !== idx);
                                      setEditedProduct({ ...editedProduct, extra_services: updated });
                                    }}
                                    className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Gabaritos */}
                  <div className="space-y-2 border-t pt-4">
                    <Label className="font-semibold text-sm">Arquivos de Gabarito Técnico (Downloads)</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Nome (Ex: CorelDraw X6)"
                        value={reviewNewTemplateName}
                        onChange={(e) => setReviewNewTemplateName(e.target.value)}
                        className="w-1/3 text-xs"
                      />
                      <Input
                        placeholder="URL do arquivo (pdf, cdr, ai, psd...)"
                        value={reviewNewTemplateUrl}
                        onChange={(e) => setReviewNewTemplateUrl(e.target.value)}
                        className="flex-1 font-mono text-xs"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          if (reviewNewTemplateName.trim() && reviewNewTemplateUrl.trim()) {
                            setEditedProduct({
                              ...editedProduct,
                              template_links: [
                                ...(editedProduct.template_links || []),
                                { name: reviewNewTemplateName.trim(), url: reviewNewTemplateUrl.trim() }
                              ]
                            });
                            setReviewNewTemplateName("");
                            setReviewNewTemplateUrl("");
                            toast.success("Gabarito adicionado!");
                          }
                        }}
                        className="h-10 text-xs"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
                      </Button>
                    </div>

                    <div className="border rounded-md max-h-[180px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-1/3">Formato / Nome</TableHead>
                            <TableHead>URL de Download</TableHead>
                            <TableHead className="w-10"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(editedProduct.template_links || []).length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-6">
                                Nenhum gabarito extraído automaticamente. Adicione manualmente acima.
                              </TableCell>
                            </TableRow>
                          ) : (
                            (editedProduct.template_links || []).map((tl: any, idx: number) => (
                              <TableRow key={idx}>
                                <TableCell className="font-semibold text-xs">{tl.name}</TableCell>
                                <TableCell className="text-xs truncate max-w-sm font-mono text-muted-foreground" title={tl.url}>
                                  <a href={tl.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                                    {tl.url}
                                  </a>
                                </TableCell>
                                <TableCell>
                                  <Button
                                    size="icon"
                                    type="button"
                                    variant="ghost"
                                    onClick={() => {
                                      const updated = (editedProduct.template_links || []).filter((_: any, i: number) => i !== idx);
                                      setEditedProduct({ ...editedProduct, template_links: updated });
                                    }}
                                    className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>

              {/* BOTÕES DE AÇÕES PRINCIPAIS */}
              <div className="border-t p-6 flex flex-col sm:flex-row justify-end gap-3 bg-muted/10 rounded-b-lg">
                <Button 
                  variant="outline" 
                  disabled={saveCrmMutation.isPending}
                  onClick={() => saveCrmMutation.mutate()}
                  className="flex items-center gap-2"
                >
                  {saveCrmMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Apenas Salvar no CRM
                </Button>
                <Button 
                  className="bg-emerald-500 hover:bg-emerald-600 text-white flex items-center gap-2"
                  disabled={saveCrmMutation.isPending}
                  onClick={handleSaveAndOpenMarketplace}
                >
                  {saveCrmMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShoppingCart className="h-4 w-4" />
                  )}
                  Salvar + Publicar no Marketplace
                </Button>
              </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
            <Link2 className="h-12 w-12 text-muted-foreground/30 mb-4 animate-pulse" />
            <h3 className="font-semibold text-lg">Aguardando Link</h3>
            <p className="text-sm max-w-sm mt-1">
              Insira uma URL do produto do fornecedor e clique em analisar para visualizar, revisar e mapear os dados aqui.
            </p>
          </div>
        )}
      </Card>

      {/* MODAL DE VARIAÇÕES DE MARKETPLACE (aberto após salvar no CRM) */}
      <MarketplaceVariationsModal
        open={!!savedCrmProduct}
        onClose={() => setSavedCrmProduct(null)}
        product={savedCrmProduct}
        onNavigateToDrafts={onNavigateToDrafts}
      />
    </div>
  );
}

function escapeRegex(str: string): string {
  return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
}
