import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/status-badge";
import { 
  ShoppingCart, ExternalLink, Send, Trash2, Edit3, 
  Loader2, Eye, ShieldCheck, ShoppingBag, Globe, AlertTriangle
} from "lucide-react";
import { toast } from "sonner";

export function RascunhosMarketplace() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activePlatform, setActivePlatform] = useState("mercado_livre");
  
  // Estado para modal de visualização / mockup
  const [viewingDraft, setViewingDraft] = useState<any | null>(null);
  const [editingDraft, setEditingDraft] = useState<any | null>(null);
  
  // Estados para edição
  const [editTitle, setEditTitle] = useState("");
  const [editPrice, setEditPrice] = useState(0);
  const [editDesc, setEditDesc] = useState("");

  // Busca todos os rascunhos de marketplace
  const { data: drafts = [], isLoading: isLoadingDrafts } = useQuery({
    queryKey: ["marketplace_drafts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_drafts")
        .select(`
          *,
          products:product_id (name, main_image_url)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // Busca credenciais configuradas para a empresa do usuário atual
  const { data: credentials = [] } = useQuery({
    queryKey: ["marketplace_credentials_check", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_credentials")
        .select("platform, status");
      if (error) throw error;
      return data;
    },
    enabled: !!user
  });

  // Mutação para Deletar Rascunho
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("marketplace_drafts")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rascunho excluído!");
      queryClient.invalidateQueries({ queryKey: ["marketplace_drafts"] });
    },
    onError: (err: any) => {
      toast.error(`Erro ao deletar: ${err.message}`);
    }
  });

  // Mutação para Atualizar/Editar Rascunho
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingDraft) return;
      const { error } = await supabase
        .from("marketplace_drafts")
        .update({
          title: editTitle,
          price: editPrice,
          description: editDesc,
          updated_at: new Date().toISOString()
        })
        .eq("id", editingDraft.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rascunho atualizado!");
      queryClient.invalidateQueries({ queryKey: ["marketplace_drafts"] });
      setEditingDraft(null);
    },
    onError: (err: any) => {
      toast.error(`Erro ao atualizar: ${err.message}`);
    }
  });

  // Mutação para Publicar Rascunho (Simulado com status real no banco)
  const publishMutation = useMutation({
    mutationFn: async (id: string) => {
      // 1. Encontra o rascunho
      const draft = drafts.find(d => d.id === id);
      if (!draft) throw new Error("Rascunho não encontrado");

      // 2. Verifica credenciais para a plataforma do rascunho
      const cred = credentials.find(c => c.platform === draft.marketplace);
      if (!cred || cred.status !== "connected") {
        throw new Error(`Credencial para ${getPlatformLabel(draft.marketplace)} não está configurada ou conectada. Vá na aba 'Configurações' para configurar.`);
      }

      // 3. Gera um ID externo simulado (em produção, viria da API do marketplace)
      const externalId = `MLB${Math.floor(1e8 + Math.random() * 9e8)}`;

      const { data, error } = await supabase
        .from("marketplace_drafts")
        .update({
          status: "published",
          external_id: externalId,
          error_message: null,
          updated_at: new Date().toISOString()
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Anúncio publicado com sucesso no ${getPlatformLabel(data.marketplace)}! ID Gerado: ${data.external_id}`);
      queryClient.invalidateQueries({ queryKey: ["marketplace_drafts"] });
      setViewingDraft(null);
    },
    onError: (err: any) => {
      toast.error(`Erro ao publicar anúncio: ${err.message}`);
    }
  });

  const getPlatformLabel = (plat: string) => {
    switch (plat) {
      case "mercado_livre": return "Mercado Livre";
      case "shopee": return "Shopee";
      case "nuvemshop": return "Nuvemshop";
      case "woocommerce": return "WooCommerce";
      default: return plat;
    }
  };

  const handleStartEdit = (draft: any) => {
    setEditingDraft(draft);
    setEditTitle(draft.title);
    setEditPrice(draft.price);
    setEditDesc(draft.description || "");
  };

  // Filtra rascunhos por plataforma
  const filteredDrafts = drafts.filter(d => d.marketplace === activePlatform);

  return (
    <div className="space-y-6">
      
      {/* SELETOR DE PLATAFORMA */}
      <Tabs value={activePlatform} onValueChange={setActivePlatform} className="w-full">
        <div className="flex justify-between items-center mb-4 overflow-x-auto border-b pb-2">
          <TabsList className="bg-muted p-1 rounded-lg">
            <TabsTrigger value="mercado_livre" className="flex items-center gap-1.5 text-xs md:text-sm">
              <ShoppingBag className="h-4 w-4 text-yellow-500" /> Mercado Livre
            </TabsTrigger>
            <TabsTrigger value="shopee" className="flex items-center gap-1.5 text-xs md:text-sm">
              <ShoppingCart className="h-4 w-4 text-orange-500" /> Shopee
            </TabsTrigger>
            <TabsTrigger value="nuvemshop" className="flex items-center gap-1.5 text-xs md:text-sm">
              <Globe className="h-4 w-4 text-blue-500" /> Nuvemshop
            </TabsTrigger>
            <TabsTrigger value="woocommerce" className="flex items-center gap-1.5 text-xs md:text-sm">
              <ShoppingCart className="h-4 w-4 text-indigo-500" /> WooCommerce
            </TabsTrigger>
          </TabsList>
        </div>

        {/* TABELA DE RASCUNHOS */}
        <TabsContent value={activePlatform} className="mt-0 outline-none">
          <Card className="border-t-4 border-rose-500">
            <CardHeader>
              <CardTitle className="text-lg">Copys e Rascunhos — {getPlatformLabel(activePlatform)}</CardTitle>
              <CardDescription>
                Revise títulos amigáveis de SEO, copys com tags criadas por inteligência técnica e preços finais de venda.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingDrafts ? (
                <div className="h-32 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 text-primary animate-spin" />
                </div>
              ) : filteredDrafts.length > 0 ? (
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Preview</TableHead>
                        <TableHead>Título SEO Anúncio</TableHead>
                        <TableHead>Produto CRM</TableHead>
                        <TableHead>Preço de Venda</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Cód. Integração</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDrafts.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell>
                            <div className="h-10 w-10 border rounded bg-muted flex items-center justify-center overflow-hidden">
                              {d.products?.main_image_url ? (
                                <img src={d.products.main_image_url} alt={d.title} className="object-cover h-full w-full" />
                              ) : (
                                <ShoppingCart className="h-5 w-5 text-muted-foreground/30" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-bold max-w-sm truncate" title={d.title}>
                            {d.title}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                            {d.products?.name || "Desvinculado"}
                          </TableCell>
                          <TableCell className="font-black text-emerald-500">
                            R$ {d.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell>
                            <StatusBadge variant={d.status === "published" ? "success" : d.status === "error" ? "destructive" : "warning"}>
                              {d.status === "published" ? "Publicado" : d.status === "error" ? "Erro" : "Rascunho"}
                            </StatusBadge>
                          </TableCell>
                          <TableCell className="font-mono text-xs font-semibold">
                            {d.external_id || "-"}
                          </TableCell>
                          <TableCell className="text-right space-x-1 whitespace-nowrap">
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              onClick={() => setViewingDraft(d)}
                              title="Visualizar Mockup / Prévia do Anúncio"
                              className="h-8 w-8 text-primary hover:bg-primary/10"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {d.status !== "published" && (
                              <>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  onClick={() => handleStartEdit(d)}
                                  title="Editar Rascunho"
                                  className="h-8 w-8 text-amber-500 hover:bg-amber-500/10"
                                >
                                  <Edit3 className="h-4 w-4" />
                                </Button>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  onClick={() => publishMutation.mutate(d.id)}
                                  disabled={publishMutation.isPending}
                                  title="Publicar Anúncio Real"
                                  className="h-8 w-8 text-emerald-500 hover:bg-emerald-500/10"
                                >
                                  {publishMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Send className="h-4 w-4" />
                                  )}
                                </Button>
                              </>
                            )}
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              onClick={() => {
                                if (window.confirm("Remover este rascunho de anúncio?")) {
                                  deleteMutation.mutate(d.id);
                                }
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
              ) : (
                <div className="border border-dashed rounded-lg p-12 text-center text-muted-foreground flex flex-col items-center justify-center">
                  <ShoppingCart className="h-12 w-12 text-muted-foreground/30 mb-4 animate-pulse" />
                  <h4 className="font-semibold text-sm">Nenhum Rascunho Encontrado</h4>
                  <p className="text-xs max-w-sm mt-1">
                    Você pode gerar rascunhos para todas as plataformas de marketplaces ao importar produtos por link ou clicando no carrinho na aba "Produtos Importados".
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DIALOG DE EDITAR RASCUNHO */}
      <Dialog open={editingDraft !== null} onOpenChange={(val) => { if(!val) setEditingDraft(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Rascunho de Anúncio</DialogTitle>
            <DialogDescription>Modifique a copy comercial gerada para este marketplace.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="edit-draft-title">Título SEO (Máximo recomendado de caracteres)</Label>
              <Input 
                id="edit-draft-title" 
                value={editTitle} 
                onChange={(e) => setEditTitle(e.target.value)} 
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-draft-price">Preço Final de Venda (R$)</Label>
              <Input 
                id="edit-draft-price" 
                type="number"
                value={editPrice} 
                onChange={(e) => setEditPrice(parseFloat(e.target.value) || 0)} 
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-draft-desc">Descrição Comercial</Label>
              <Textarea 
                id="edit-draft-desc" 
                value={editDesc} 
                onChange={(e) => setEditDesc(e.target.value)} 
                className="h-48 text-xs font-sans"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditingDraft(null)}>Cancelar</Button>
            <Button size="sm" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG DE VISUALIZAÇÃO / MOCKUP PREMIUM DO ANÚNCIO */}
      <Dialog open={viewingDraft !== null} onOpenChange={(val) => { if(!val) setViewingDraft(null); }}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto bg-[#F5F5F5] dark:bg-zinc-950 p-0 rounded-lg border-none shadow-2xl">
          {viewingDraft && (
            <div className="flex flex-col">
              
              {/* MOCKUP MERCADO LIVRE */}
              {viewingDraft.marketplace === "mercado_livre" && (
                <div className="bg-[#FFF159] p-4 flex items-center justify-between shadow-sm sticky top-0 z-10 shrink-0">
                  <span className="font-bold text-lg text-[#333] tracking-tight">MercadoLivre</span>
                  <div className="h-6 w-32 bg-[#FFFFFF]/40 rounded animate-pulse" />
                </div>
              )}

              {/* MOCKUP SHOPEE */}
              {viewingDraft.marketplace === "shopee" && (
                <div className="bg-[#EE4D2D] p-4 flex items-center justify-between shadow-sm sticky top-0 z-10 shrink-0">
                  <span className="font-black text-xl text-white italic tracking-tight">Shopee</span>
                  <div className="h-6 w-32 bg-white/20 rounded animate-pulse" />
                </div>
              )}

              {/* MOCKUP NUVEMSHOP OU WOOCOMMERCE */}
              {(viewingDraft.marketplace === "nuvemshop" || viewingDraft.marketplace === "woocommerce") && (
                <div className="bg-white dark:bg-zinc-900 border-b p-4 flex items-center justify-between shadow-sm sticky top-0 z-10 shrink-0">
                  <span className="font-bold text-lg text-primary tracking-tight">{getPlatformLabel(viewingDraft.marketplace)}</span>
                  <div className="h-6 w-32 bg-secondary rounded animate-pulse" />
                </div>
              )}

              {/* CONTEÚDO DO PRODUTO */}
              <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-5 gap-8 bg-card text-foreground">
                
                {/* COL IMAGEM */}
                <div className="md:col-span-2 space-y-4">
                  <div className="border rounded-lg bg-white dark:bg-zinc-900 flex items-center justify-center overflow-hidden aspect-square border-border">
                    {viewingDraft.products?.main_image_url ? (
                      <img src={viewingDraft.products.main_image_url} alt={viewingDraft.title} className="object-contain h-full w-full max-h-96 p-4" />
                    ) : (
                      <ShoppingCart className="h-16 w-16 text-muted-foreground/30 animate-pulse" />
                    )}
                  </div>
                  <div className="flex gap-2 justify-center">
                    <div className="h-12 w-12 border rounded bg-white p-0.5 cursor-pointer border-primary">
                      {viewingDraft.products?.main_image_url && (
                        <img src={viewingDraft.products.main_image_url} alt="" className="object-cover h-full w-full rounded" />
                      )}
                    </div>
                  </div>
                </div>

                {/* COL DETALHES COMPRA */}
                <div className="md:col-span-3 space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Novo | +100 vendidos</span>
                    <h2 className="text-xl md:text-2xl font-bold leading-tight">{viewingDraft.title}</h2>
                    
                    <div className="flex items-baseline gap-2 py-1">
                      <span className="text-3xl font-black text-foreground">
                        R$ {viewingDraft.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-xs text-emerald-500 font-semibold">em 10x sem juros</span>
                    </div>

                    <div className="border-y py-3 space-y-2 text-sm">
                      <p className="flex items-center gap-2 text-emerald-600 dark:text-emerald-500 font-semibold">
                        <ShieldCheck className="h-4 w-4" /> Frete Grátis pelo Mercado Envios
                      </p>
                      <p className="text-muted-foreground text-xs pl-6">Benefício por pontuação no Mercado Pontos</p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground uppercase font-bold">Atributos Principais:</span>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <StatusBadge variant="info">Categoria: {viewingDraft.category || "Gráfica"}</StatusBadge>
                        <StatusBadge variant="default">Status: {viewingDraft.status === "published" ? "Ativo" : "Rascunho"}</StatusBadge>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 pt-4">
                    {viewingDraft.status !== "published" ? (
                      <Button 
                        onClick={() => publishMutation.mutate(viewingDraft.id)}
                        disabled={publishMutation.isPending}
                        className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base flex items-center justify-center gap-2 rounded-lg"
                      >
                        {publishMutation.isPending ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Send className="h-5 w-5" />
                        )}
                        Confirmar e Publicar Anúncio
                      </Button>
                    ) : (
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-lg flex items-center justify-center gap-2">
                        <ShieldCheck className="h-5 w-5 shrink-0" />
                        <span className="font-bold text-xs uppercase tracking-wider">Publicado no Canal (ID: {viewingDraft.external_id})</span>
                      </div>
                    )}
                    <Button variant="outline" className="w-full h-10 text-xs" onClick={() => setViewingDraft(null)}>
                      Fechar Pré-visualização
                    </Button>
                  </div>
                </div>

              </div>

              {/* DESCRIÇÃO COMPLETA */}
              <div className="p-6 md:p-8 bg-card border-t border-border text-foreground rounded-b-lg">
                <h3 className="text-base font-bold uppercase tracking-wider mb-4 text-muted-foreground">Descrição do Anúncio</h3>
                <pre className="text-xs md:text-sm font-sans whitespace-pre-wrap leading-relaxed text-muted-foreground/80 max-h-96 overflow-y-auto bg-muted/20 p-4 rounded border border-border">
                  {viewingDraft.description}
                </pre>
              </div>

            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
