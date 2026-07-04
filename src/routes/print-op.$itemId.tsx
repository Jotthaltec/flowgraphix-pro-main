import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Printer, Loader2, Factory, Package, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

const db = supabase as any;

export const Route = createFileRoute("/print-op/$itemId")({
  component: PrintOpPage,
});

function PrintOpPage() {
  const { itemId } = Route.useParams();

  // Buscar dados da OP, Cliente e Ficha Técnica
  const { data, isLoading, error } = useQuery({
    queryKey: ["print_op", itemId],
    queryFn: async () => {
      // 1. Busca Item, OP, Cliente e Produto
      const { data: itemData, error: itemErr } = await (db)
        .from("production_order_items")
        .select(`
          id, quantity, status,
          products (name, internal_sku),
          production_orders (
            order_number, expected_delivery, notes,
            clients (name, phone, email)
          )
        `)
        .eq("id", itemId)
        .single();
      
      if (itemErr) throw itemErr;

      // 2. Busca Ficha Técnica Preenchida
      const { data: attrData, error: attrErr } = await (db)
        .from("production_item_attributes")
        .select(`
          value,
          technical_attributes (name, code, technical_attribute_groups(name))
        `)
        .eq("production_order_item_id", itemId);
      
      if (attrErr) throw attrErr;

      return { item: itemData, attributes: attrData };
    },
    enabled: !!itemId,
  });

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  if (error || !data) {
    return <div className="p-10 text-center text-destructive">Erro ao carregar os dados de impressão.</div>;
  }

  const { item, attributes } = data;
  const client = item.production_orders?.clients;
  const op = item.production_orders;
  
  // Agrupar atributos para exibição organizada
  const groupedAttributes: Record<string, any[]> = {};
  attributes?.forEach((a: any) => {
    const gName = a.technical_attributes?.technical_attribute_groups?.name || "Geral";
    if (!groupedAttributes[gName]) groupedAttributes[gName] = [];
    groupedAttributes[gName].push({
      name: a.technical_attributes?.name,
      value: a.attribute_value,
    });
  });

  return (
    <div className="min-h-screen bg-neutral-100 print:bg-white text-neutral-900 font-sans">
      
      {/* Barra de controle Flutuante (não aparece na impressão) */}
      <div className="print:hidden sticky top-0 bg-white border-b shadow-sm p-4 flex justify-between items-center z-10">
        <div>
          <h2 className="font-bold text-lg">Visualização de Impressão</h2>
          <p className="text-sm text-muted-foreground">Utilize papel A4 em modo Retrato.</p>
        </div>
        <Button onClick={() => window.print()} className="gap-2">
          <Printer className="h-4 w-4" /> Imprimir Documento
        </Button>
      </div>

      {/* Papel A4 */}
      <div className="w-full max-w-[210mm] min-h-[297mm] mx-auto bg-white shadow-xl print:shadow-none print:w-auto print:max-w-none print:mx-0 p-8 sm:p-12 box-border">
        
        {/* Cabeçalho */}
        <div className="border-b-2 border-neutral-800 pb-6 mb-6 flex justify-between items-start">
          <div className="flex items-center gap-3">
            <Factory className="h-10 w-10 text-neutral-800" />
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight">Ordem de Produção</h1>
              <p className="text-sm font-semibold text-neutral-500 uppercase tracking-widest">
                Via da Fábrica
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-neutral-500 font-bold uppercase mb-1">Número do Pedido</p>
            <p className="text-3xl font-black text-neutral-900 font-mono leading-none">
              {op?.order_number}
            </p>
          </div>
        </div>

        {/* Informações Macro (Cliente e Prazo) */}
        <div className="grid grid-cols-2 gap-8 mb-8 border border-neutral-300 rounded-lg p-5 bg-neutral-50">
          <div>
            <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">Cliente</p>
            <p className="text-base font-bold text-neutral-900">{client?.name || "Não informado"}</p>
            {client?.phone && <p className="text-sm text-neutral-600">Tel: {client.phone}</p>}
          </div>
          <div>
            <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Previsão de Entrega
            </p>
            <p className="text-lg font-black text-neutral-900">
              {op?.expected_delivery ? new Date(op.expected_delivery).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : "Sem prazo"}
            </p>
          </div>
        </div>

        {/* Informações do Item de Produção */}
        <div className="mb-8">
          <h2 className="text-lg font-black border-b border-neutral-300 pb-2 mb-4 uppercase tracking-tight flex items-center gap-2">
            <Package className="h-5 w-5" /> Produto a ser Fabricado
          </h2>
          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-3">
              <p className="text-xs font-bold text-neutral-500 uppercase mb-1">Descrição do Produto</p>
              <p className="text-xl font-bold">{item.products?.name || "Produto Genérico"}</p>
              {item.products?.internal_sku && <p className="text-sm font-mono text-neutral-500 mt-1">SKU: {item.products.internal_sku}</p>}
            </div>
            <div>
              <p className="text-xs font-bold text-neutral-500 uppercase mb-1">Quantidade</p>
              <p className="text-3xl font-black font-mono">{item.quantity}</p>
            </div>
          </div>
        </div>

        {/* Ficha Técnica (Grupos e Atributos) */}
        <div className="mb-8">
          <h2 className="text-lg font-black border-b border-neutral-300 pb-2 mb-4 uppercase tracking-tight">
            Ficha Técnica / Especificações
          </h2>
          
          {Object.keys(groupedAttributes).length === 0 ? (
            <p className="text-sm text-neutral-500 italic">Nenhuma especificação técnica preenchida.</p>
          ) : (
            <div className="space-y-6">
              {Object.keys(groupedAttributes).map((groupName) => (
                <div key={groupName}>
                  <h3 className="text-sm font-bold bg-neutral-200 px-3 py-1.5 uppercase tracking-wider mb-2 rounded-sm text-neutral-800">
                    {groupName}
                  </h3>
                  <div className="grid grid-cols-2 gap-y-3 gap-x-6 px-3">
                    {groupedAttributes[groupName].map((attr: any, i: number) => (
                      <div key={i} className="flex flex-col border-b border-neutral-100 pb-1">
                        <span className="text-[10px] font-bold text-neutral-500 uppercase">{attr.name}</span>
                        <span className="text-base font-medium">{attr.value === "true" ? "Sim" : attr.value === "false" ? "Não" : attr.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Observações Gerais */}
        {op?.notes && (
          <div className="mb-8 p-4 border-l-4 border-neutral-800 bg-neutral-50">
            <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">Observações do Vendedor</p>
            <p className="text-sm text-neutral-800 whitespace-pre-wrap">{op.notes}</p>
          </div>
        )}

        {/* Footer para checklist / carimbos de produção */}
        <div className="mt-12 pt-8 border-t-2 border-neutral-300 flex justify-between gap-4 text-center">
          <div className="flex-1 border-t border-neutral-400 pt-2 mx-4">
            <p className="text-[10px] font-bold uppercase text-neutral-500">Impressão (Visto)</p>
          </div>
          <div className="flex-1 border-t border-neutral-400 pt-2 mx-4">
            <p className="text-[10px] font-bold uppercase text-neutral-500">Acabamento (Visto)</p>
          </div>
          <div className="flex-1 border-t border-neutral-400 pt-2 mx-4">
            <p className="text-[10px] font-bold uppercase text-neutral-500">Qualidade (Visto)</p>
          </div>
        </div>

        <div className="text-center text-[9px] text-neutral-400 mt-8 font-mono">
          Documento gerado pelo Motor PrintFlow CRM — {new Date().toLocaleString('pt-BR')}
        </div>
      </div>
    </div>
  );
}
