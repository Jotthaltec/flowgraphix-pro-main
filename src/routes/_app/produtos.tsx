import { createFileRoute } from "@tanstack/react-router";
import { Search, MoreVertical, Loader2, Edit, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_app/produtos")({ component: ProdutosPage });

const CATEGORIAS = ["DTF Têxtil", "DTF UV", "Sublimação", "Offset", "Comunicação visual", "Design", "Acabamento"];

type Product = {
  id: string;
  name: string;
  category: string;
  unit: string | null;
  base_cost: number;
  suggested_price: number;
  desired_margin: number;
  active: boolean;
};

function ProdutosPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCat, setSelectedCat] = useState("Todos");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    category: "",
    unit: "Unidade",
    base_cost: 0,
    desired_margin: 0,
    suggested_price: 0,
    active: true
  });

  // Calculate suggested price dynamically when cost or margin changes
  useEffect(() => {
    const cost = Number(formData.base_cost) || 0;
    const margin = Number(formData.desired_margin) || 0;
    if (margin >= 100) return; // Prevent division by zero or negative prices
    
    if (cost > 0) {
      const calculated = cost / (1 - (margin / 100));
      setFormData(prev => ({ ...prev, suggested_price: Number(calculated.toFixed(2)) }));
    } else {
      setFormData(prev => ({ ...prev, suggested_price: 0 }));
    }
  }, [formData.base_cost, formData.desired_margin]);

  const { data: dbProducts, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, category, unit, base_cost, suggested_price, desired_margin, active")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as Product[];
    },
    enabled: !!profile,
  });

  const filteredData = dbProducts?.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = selectedCat === "Todos" ? true : item.category === selectedCat;
    return matchesSearch && matchesCat;
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: profileData } = await supabase.from('profiles').select('company_id').eq('id', (await supabase.auth.getUser()).data.user?.id).single();
      
      if (editingProduct) {
        const { error } = await supabase.from("products").update(data).eq("id", editingProduct.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert([{ ...data, company_id: profileData?.company_id }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(editingProduct ? "Produto atualizado!" : "Produto criado!");
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err) => {
      toast.error("Erro ao salvar produto: " + err.message);
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

  function resetForm() {
    setEditingProduct(null);
    setFormData({ name: "", category: "", unit: "Unidade", base_cost: 0, desired_margin: 0, suggested_price: 0, active: true });
  }

  function handleEdit(product: Product) {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      category: product.category,
      unit: product.unit || "Unidade",
      base_cost: product.base_cost || 0,
      desired_margin: product.desired_margin || 0,
      suggested_price: product.suggested_price || 0,
      active: product.active
    });
    setIsModalOpen(true);
  }

  return (
    <>
      <PageHeader 
        title="Produtos & Serviços" 
        description="Catálogo de produtos e cálculo de preços" 
        action="Novo produto" 
        onAction={() => { resetForm(); setIsModalOpen(true); }}
      />
      
      <Card className="p-4 mb-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar produto..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9" 
            />
          </div>
        </div>
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

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="hidden md:table-cell">Unidade</TableHead>
              <TableHead>Custo base</TableHead>
              <TableHead>Preço sugerido</TableHead>
              <TableHead className="hidden lg:table-cell">Margem</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : filteredData?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                  Nenhum produto cadastrado.
                </TableCell>
              </TableRow>
            ) : filteredData?.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-semibold">{p.name}</TableCell>
                <TableCell><StatusBadge variant="muted">{p.category}</StatusBadge></TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">{p.unit}</TableCell>
                <TableCell>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.base_cost || 0)}</TableCell>
                <TableCell className="font-bold text-foreground">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.suggested_price || 0)}
                </TableCell>
                <TableCell className="hidden lg:table-cell text-success font-semibold">{p.desired_margin || 0}%</TableCell>
                <TableCell><StatusBadge variant={p.active ? 'success' : 'muted'}>{p.active ? "Ativo" : "Inativo"}</StatusBadge></TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost"><MoreVertical className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(p)}>
                        <Edit className="h-4 w-4 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-destructive focus:text-destructive"
                        onClick={() => {
                          if(confirm("Tem certeza que deseja remover este produto?")) {
                            deleteMutation.mutate(p.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> Remover
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Editar Produto" : "Novo Produto"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nome do produto *</Label>
              <Input 
                id="name" 
                value={formData.name} 
                onChange={(e) => setFormData({...formData, name: e.target.value})} 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="category">Categoria</Label>
                <Select value={formData.category} onValueChange={(val) => setFormData({...formData, category: val})}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="unit">Unidade</Label>
                <Input 
                  id="unit" 
                  value={formData.unit} 
                  onChange={(e) => setFormData({...formData, unit: e.target.value})} 
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="base_cost">Custo Base (R$)</Label>
                <Input 
                  id="base_cost" 
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.base_cost} 
                  onChange={(e) => setFormData({...formData, base_cost: parseFloat(e.target.value)})} 
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="desired_margin">Margem Desejada (%)</Label>
                <Input 
                  id="desired_margin" 
                  type="number"
                  min="0"
                  max="99"
                  value={formData.desired_margin} 
                  onChange={(e) => setFormData({...formData, desired_margin: parseFloat(e.target.value)})} 
                />
              </div>
            </div>
            <div className="p-3 bg-secondary/50 rounded-md">
              <p className="text-sm text-muted-foreground">Preço Sugerido (Calculado)</p>
              <p className="text-xl font-bold mt-1">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(formData.suggested_price || 0)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="active" 
                checked={formData.active}
                onChange={(e) => setFormData({...formData, active: e.target.checked})} 
              />
              <Label htmlFor="active">Produto ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button 
              disabled={!formData.name || !formData.category || saveMutation.isPending} 
              onClick={() => saveMutation.mutate(formData)}
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
