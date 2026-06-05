import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Clock, Zap, AlertTriangle, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/producao")({ component: ProducaoPage });

const COLUMNS = [
  { id: "pedido_criado", title: "Novo Pedido", color: "var(--muted-foreground)" },
  { id: "arte_pendente", title: "Arte pendente", color: "var(--muted-foreground)" },
  { id: "arte_em_criacao", title: "Arte em criação", color: "var(--accent)" },
  { id: "arte_aprovada", title: "Arte aprovada", color: "var(--info)" },
  { id: "em_producao", title: "Em produção", color: "var(--primary)" },
  { id: "em_acabamento", title: "Em acabamento", color: "var(--warning)" },
  { id: "pronto", title: "Pronto", color: "var(--success)" },
  { id: "entregue", title: "Entregue", color: "var(--muted-foreground)" },
];

function ProducaoPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const { data: orders, isLoading } = useQuery({
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

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const { error } = await supabase.from("orders").update({ production_status: status }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ["orders_production"] });
      const previousOrders = queryClient.getQueryData(["orders_production"]);
      queryClient.setQueryData(["orders_production"], (old: any) => 
        old?.map((o: any) => o.id === id ? { ...o, production_status: status } : o)
      );
      return { previousOrders };
    },
    onError: (err, newTodo, context) => {
      queryClient.setQueryData(["orders_production"], context?.previousOrders);
      toast.error("Erro ao mover pedido: " + err.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["orders_production"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] }); // invalidate table view too
    }
  });

  const handleDragStart = (e: React.DragEvent, orderId: string) => {
    setDraggingId(orderId);
    e.dataTransfer.setData("orderId", orderId);
  };

  const handleDrop = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    const orderId = e.dataTransfer.getData("orderId");
    if (orderId && draggingId === orderId) {
      updateStatusMutation.mutate({ id: orderId, status: colId });
    }
    setDraggingId(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  function priorityBadge(pri: string, deadline: string | null) {
    // Calcula atraso
    const isLate = deadline && new Date(deadline) < new Date() && new Date(deadline).toDateString() !== new Date().toDateString();
    
    if (isLate) return <StatusBadge variant="destructive"><AlertTriangle className="h-3 w-3" />Atrasado</StatusBadge>;
    if (pri === "urgente") return <StatusBadge variant="warning"><Zap className="h-3 w-3" />Urgente</StatusBadge>;
    return <StatusBadge variant="muted"><Clock className="h-3 w-3" />Normal</StatusBadge>;
  }

  return (
    <>
      <PageHeader title="Produção (Kanban)" description="Arraste os cards para atualizar o status na produção" />
      
      {isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-muted-foreground" /></div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-max">
            {COLUMNS.map((col) => {
              const colOrders = orders?.filter(o => o.production_status === col.id) || [];
              
              return (
                <div 
                  key={col.id} 
                  className="w-72 shrink-0 flex flex-col h-[calc(100vh-220px)]"
                  onDrop={(e) => handleDrop(e, col.id)}
                  onDragOver={handleDragOver}
                >
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: col.color }} />
                      <h3 className="text-sm font-semibold">{col.title}</h3>
                    </div>
                    <span className="text-xs font-bold text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                      {colOrders.length}
                    </span>
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
                          {priorityBadge(order.priority || "normal", order.deadline)}
                        </div>
                        <p className="font-semibold text-sm leading-tight">{order.clients?.name}</p>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{order.product_desc}</p>
                        
                        <div className="flex justify-between items-center mt-3 pt-3 border-t text-xs">
                          <span className="text-muted-foreground">Prazo:</span>
                          <span className="text-muted-foreground font-medium">
                            {order.deadline ? new Date(order.deadline).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Sem prazo'}
                          </span>
                        </div>
                        <div className="mt-2 flex gap-1 flex-wrap">
                          <StatusBadge variant="muted">{order.machine_section || 'Sem setor'}</StatusBadge>
                        </div>
                      </Card>
                    ))}
                    {colOrders.length === 0 && (
                      <div className="rounded-lg border-2 border-dashed border-border h-20 flex items-center justify-center text-xs text-muted-foreground bg-secondary/20">
                        Solte cards aqui
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
