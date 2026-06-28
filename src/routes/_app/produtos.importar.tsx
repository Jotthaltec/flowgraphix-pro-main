import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, History, Link2, Loader2, Package, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { ImportadorProdutos } from "@/components/products/importador-produtos";
import { AtualizarPrecos } from "@/components/products/atualizar-precos";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_app/produtos/importar")({
  component: ImportarProdutosPage,
});

const fmtBRL = (n: number | null) =>
  (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function ImportarProdutosPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const { data: history = [], isLoading } = useQuery({
    queryKey: ["product_import_history", profile?.company_id],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_imports")
        .select("id, source_url, product_name, supplier_sku, current_price, extraction_status, created_at")
        .eq("company_id", profile!.company_id!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="flex flex-col space-y-6">
      <PageHeader
        title="Importar produtos por link"
        description="Importe produtos da FuturaIM por link individual, em lote ou por catálogo — com prévia e aprovação."
        action={
          <Button variant="outline" onClick={() => navigate({ to: "/produtos" })}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar a Produtos
          </Button>
        }
      />

      <Tabs defaultValue="importar" className="w-full space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="importar" className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" /> Importar
          </TabsTrigger>
          <TabsTrigger value="precos" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-amber-500" /> Atualizar preços
          </TabsTrigger>
          <TabsTrigger value="historico" className="flex items-center gap-2">
            <History className="h-4 w-4 text-emerald-500" /> Histórico de importações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="importar">
          <ImportadorProdutos />
        </TabsContent>

        <TabsContent value="precos">
          <AtualizarPrecos />
        </TabsContent>

        <TabsContent value="historico">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                </div>
              ) : history.length === 0 ? (
                <div className="p-10 text-center text-muted-foreground">
                  <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  Nenhuma importação registrada ainda.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Custo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell className="font-medium text-sm max-w-[280px] truncate">{h.product_name}</TableCell>
                        <TableCell className="font-mono text-xs">{h.supplier_sku || "—"}</TableCell>
                        <TableCell className="text-sm">{fmtBRL(h.current_price)}</TableCell>
                        <TableCell>
                          <StatusBadge
                            variant={
                              h.extraction_status === "imported"
                                ? "success"
                                : h.extraction_status === "review_required"
                                  ? "warning"
                                  : "info"
                            }
                          >
                            {h.extraction_status}
                          </StatusBadge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(h.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right">
                          {h.source_url && (
                            <a
                              href={h.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary"
                            >
                              abrir
                            </a>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
