import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { 
  Cpu, Search, Trash2, Loader2, Play, ToggleLeft, 
  HelpCircle, Settings, CheckSquare
} from "lucide-react";
import { toast } from "sonner";

export function RegrasMapeamento() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  // Busca regras de mapeamento
  const { data: rules = [], isLoading: isLoadingRules } = useQuery({
    queryKey: ["mapping-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_mapping_rules")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // Mutação para alternar status ativo/inativo
  const toggleMutation = useMutation({
    mutationFn: async (rule: any) => {
      const { error } = await supabase
        .from("supplier_mapping_rules")
        .update({
          active: !rule.active,
          updated_at: new Date().toISOString()
        })
        .eq("id", rule.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status da regra atualizado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["mapping-rules"] });
    },
    onError: (err: any) => {
      toast.error(`Erro ao atualizar regra: ${err.message}`);
    }
  });

  // Mutação para deletar regra
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("supplier_mapping_rules")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Regra de mapeamento excluída!");
      queryClient.invalidateQueries({ queryKey: ["mapping-rules"] });
    },
    onError: (err: any) => {
      toast.error(`Erro ao deletar: ${err.message}`);
    }
  });

  // Filtra regras
  const filteredRules = rules.filter(r => 
    r.supplier_domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.field_key.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card className="border-t-4 border-amber-500">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Cpu className="h-5 w-5 text-amber-500" />
          Regras de Mapeamento Cadastradas
        </CardTitle>
        <CardDescription>
          Gerencie seletores CSS, expressões regulares e regras de extração salvas pelo robô para automatizar novos produtos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* BUSCA */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por domínio (ex: printi.com.br) ou campo alvo (ex: product_name)..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* TABELA DE REGRAS */}
        {isLoadingRules ? (
          <div className="h-32 flex items-center justify-center">
            <Loader2 className="h-6 w-6 text-primary animate-spin" />
          </div>
        ) : filteredRules.length > 0 ? (
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domínio do Fornecedor</TableHead>
                  <TableHead>Campo Alvo</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Seletor / Expressão</TableHead>
                  <TableHead>Atributo / Rótulo</TableHead>
                  <TableHead>Última Amostra</TableHead>
                  <TableHead className="w-24">Ativa</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRules.map((rule) => {
                  let badgeVariant: "default" | "success" | "warning" | "destructive" | "info" | "accent" | "muted" = "default";
                  if (rule.extraction_method === "json_ld") badgeVariant = "accent";
                  if (rule.extraction_method === "meta_tag") badgeVariant = "info";
                  if (rule.extraction_method === "regex") badgeVariant = "warning";
                  if (rule.extraction_method === "css_selector") badgeVariant = "success";

                  return (
                    <TableRow key={rule.id}>
                      <TableCell className="font-semibold text-xs font-mono">{rule.supplier_domain}</TableCell>
                      <TableCell>
                        <StatusBadge variant="default">{rule.field_key}</StatusBadge>
                      </TableCell>
                      <TableCell>
                        <StatusBadge variant={badgeVariant}>{rule.extraction_method}</StatusBadge>
                      </TableCell>
                      <TableCell className="font-mono text-xs max-w-xs truncate" title={rule.selector || rule.regex_pattern || ""}>
                        {rule.selector || rule.regex_pattern || "-"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {rule.attribute_name || rule.label_anchor || "-"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground italic truncate max-w-xxs" title={rule.sample_value || ""}>
                        {rule.sample_value || "-"}
                      </TableCell>
                      <TableCell>
                        <Switch 
                          checked={rule.active} 
                          onCheckedChange={() => toggleMutation.mutate(rule)}
                          disabled={toggleMutation.isPending}
                        />
                      </TableCell>
                      <TableCell>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          onClick={() => {
                            if (window.confirm("Deseja realmente deletar esta regra de extração?")) {
                              deleteMutation.mutate(rule.id);
                            }
                          }}
                          disabled={deleteMutation.isPending}
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
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
            <Cpu className="h-10 w-10 text-muted-foreground/30 mb-3 animate-pulse" />
            <h4 className="font-semibold text-sm">Nenhuma Regra Mapeada</h4>
            <p className="text-xs max-w-sm mt-1">
              As regras de mapeamento são geradas quando você treina o robô na aba "Importar por Link" usando a Sheet de Treinamento.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
