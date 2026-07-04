import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Clock, Zap, AlertTriangle, Loader2, Factory, Package, Edit, CheckSquare, Printer, BarChart3 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { ProductionDashboard } from "@/components/production/production-dashboard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TechnicalSheetEditor } from "@/components/production/technical-sheet-editor";

export const Route = createFileRoute("/_app/producao")({ component: ProducaoPage });

const COLUMNS_ORDERS = [
  { id: "pedido_criado", title: "Novo Pedido", color: "var(--muted-foreground)" },
  { id: "arte_pendente", title: "Arte pendente", color: "var(--muted-foreground)" },
  { id: "arte_em_criacao", title: "Arte em criação", color: "var(--accent)" },
  { id: "arte_aprovada", title: "Arte aprovada", color: "var(--info)" },
  { id: "em_producao", title: "Em produção", color: "var(--primary)" },
  { id: "em_acabamento", title: "Em acabamento", color: "var(--warning)" },
  { id: "pronto", title: "Pronto", color: "var(--success)" },
  { id: "entregue", title: "Entregue", color: "var(--muted-foreground)" },
];

const COLUMNS_FACTORY = [
  { id: "aguardando", title: "Aguardando", color: "var(--muted-foreground)" },
  { id: "pre_impressao", title: "Pré-impressão", color: "var(--warning)" },
  { id: "impressao", title: "Impressão", color: "var(--info)" },
  { id: "acabamento", title: "Acabamento", color: "var(--accent)" },
  { id: "finalizado", title: "Finalizado", color: "var(--success)" },
];

function ProducaoPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  
  // States para Ficha Técnica
  const [selectedProductionItemId, setSelectedProductionItemId] = useState<string | null>(null);

  // QUERY: Pedidos de Venda
  const { data: orders, isLoading: loadingOrders } = useQuery({
    queryKey: ["orders_production"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(`id, order_number, product_desc, machine_section, deadline, priority, production_status, clients(name)`)
        .order("priority", { ascending: false })
        .order("deadline", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!profile,
  });

  // QUERY: Ordens de Produção (Chão de Fábrica)
  const { data: factoryItems, isLoading: loadingFactory } = useQuery({
    queryKey: ["factory_production_items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_order_items")
        .select(`
          id, quantity, status, product_id,
          production_orders(order_number, expected_delivery, clients(name)),
          products(name)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!profile,
  });

  const updateOrderStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const { error } = await supabase.from("orders").update({ production_status: status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders_production"] }),
    onError: (err) => toast.error("Erro: " + err.message)
  });

  const updateFactoryStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      // Busca status atual para registrar histórico
      const { data: currentItem } = await supabase.from("production_order_items").select("status, production_order_id").eq("id", id).single();
      const oldStatus = currentItem?.status || 'aguardando';

      const { error } = await supabase.from("production_order_items").update({ status }).eq("id", id);
      if (error) throw error;

      // Registrar no histórico de produção
      const { data: userData } = await supabase.auth.getUser();
      await supabase.from("production_history").insert([{
        production_order_id: currentItem?.production_order_id,
        production_order_item_id: id,
        action: `Movido de "${oldStatus}" para "${status}"`,
        old_status: oldStatus,
        new_status: status,
        actor_id: userData.user?.id
      }]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["factory_production_items"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_production_items"] });
    },
    onError: (err) => toast.error("Erro: " + err.message)
  });

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggingId(id);
    e.dataTransfer.setData("itemId", id);
  };

  const handleDropOrder = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("itemId");
    if (id && draggingId === id) updateOrderStatus.mutate({ id, status: colId });
    setDraggingId(null);
  };

  const handleDropFactory = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("itemId");
    if (id && draggingId === id) updateFactoryStatus.mutate({ id, status: colId });
    setDraggingId(null);
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  return (
    <>
      <PageHeader 
        title="Painel de Produção e PCP" 
        description="Controle e rastreabilidade visual" 
      />
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
        <TabsList className="grid grid-cols-3 max-w-[560px] mb-4">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="pcp" className="flex items-center gap-2">
            <Factory className="h-4 w-4" /> PCP / Chão de Fábrica
          </TabsTrigger>
          <TabsTrigger value="pedidos" className="flex items-center gap-2">
            <Package className="h-4 w-4" /> Visão de Pedidos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <ProductionDashboard />
        </TabsContent>

        <TabsContent value="pcp">
          {loadingFactory ? (
            <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-muted-foreground" /></div>
          ) : (
            <div className="overflow-x-auto pb-4">
              <div className="flex gap-3 min-w-max">
                {COLUMNS_FACTORY.map((col) => {
                  const colItems = factoryItems?.filter(i => (i.status || "aguardando") === col.id) || [];
                  return (
                    <div 
                      key={col.id} 
                      className="w-72 shrink-0 flex flex-col h-[calc(100vh-220px)]"
                      onDrop={(e) => handleDropFactory(e, col.id)}
                      onDragOver={handleDragOver}
                    >
                      <div className="flex items-center justify-between mb-3 px-1">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ background: col.color }} />
                          <h3 className="text-sm font-semibold">{col.title}</h3>
                        </div>
                        <span className="text-xs font-bold text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                          {colItems.length}
                        </span>
                      </div>
                      
                      <div className="space-y-2 flex-1 overflow-y-auto pr-1 pb-4">
                        {colItems.map((item: any) => (
                          <Card 
                            key={item.id} 
                            draggable 
                            onDragStart={(e) => handleDragStart(e, item.id)}
                            className="p-3 hover:shadow-md cursor-grab active:cursor-grabbing transition-shadow group relative"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <span className="font-mono text-xs font-bold text-primary">{item.production_orders?.order_number}</span>
                              <StatusBadge variant="muted">Qtd: {item.quantity}</StatusBadge>
                            </div>
                            <p className="font-semibold text-sm leading-tight text-foreground/90">{item.products?.name || "Produto Genérico"}</p>
                            <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">{item.production_orders?.clients?.name}</p>
                            
                            <div className="flex justify-between items-center mt-3 pt-3 border-t border-secondary/50 text-[10px]">
                              <span className="text-muted-foreground">Prazo: {item.production_orders?.expected_delivery ? new Date(item.production_orders.expected_delivery).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'N/D'}</span>
                              
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <span 
                                  onClick={(e) => { e.stopPropagation(); setSelectedProductionItemId(item.id); }}
                                  className="bg-primary/10 text-primary px-2 py-1 rounded flex items-center gap-1 cursor-pointer hover:bg-primary/20"
                                >
                                  <Edit className="h-3 w-3" /> Ficha
                                </span>
                                <Link
                                  to="/print-op/$itemId"
                                  params={{ itemId: item.id }}
                                  target="_blank"
                                  className="bg-secondary text-secondary-foreground px-2 py-1 rounded flex items-center gap-1 cursor-pointer hover:bg-secondary/80"
                                >
                                  <Printer className="h-3 w-3" /> Imprimir
                                </Link>
                              </div>
                            </div>
                          </Card>
                        ))}
                        {colItems.length === 0 && (
                          <div className="rounded-lg border-2 border-dashed border-border h-20 flex items-center justify-center text-xs text-muted-foreground bg-secondary/20">
                            Solte itens aqui
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="pedidos">
          {loadingOrders ? (
            <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-muted-foreground" /></div>
          ) : (
            <div className="overflow-x-auto pb-4">
              <div className="flex gap-3 min-w-max">
                {COLUMNS_ORDERS.map((col) => {
                  const colOrders = orders?.filter(o => o.production_status === col.id) || [];
                  return (
                    <div 
                      key={col.id} 
                      className="w-72 shrink-0 flex flex-col h-[calc(100vh-220px)]"
                      onDrop={(e) => handleDropOrder(e, col.id)}
                      onDragOver={handleDragOver}
                    >
                      <div className="flex items-center justify-between mb-3 px-1">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ background: col.color }} />
                          <h3 className="text-sm font-semibold">{col.title}</h3>
                        </div>
                        <span className="text-xs font-bold text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{colOrders.length}</span>
                      </div>
                      <div className="space-y-2 flex-1 overflow-y-auto pr-1 pb-4">
                        {colOrders.map((order) => (
                          <Card 
                            key={order.id} 
                            draggable 
                            onDragStart={(e) => handleDragStart(e, order.id)}
                            className="p-3 hover:shadow-md cursor-grab active:cursor-grabbing transition-shadow"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <span className="font-mono text-xs font-bold text-primary">{order.order_number}</span>
                            </div>
                            <p className="font-semibold text-sm leading-tight">{order.clients?.name}</p>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{order.product_desc}</p>
                          </Card>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedProductionItemId} onOpenChange={(open) => !open && setSelectedProductionItemId(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto bg-background/95 backdrop-blur">
          {selectedProductionItemId && (
            <TechnicalSheetEditor 
              productionOrderItemId={selectedProductionItemId} 
              onSaved={() => setSelectedProductionItemId(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
