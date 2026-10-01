import { createFileRoute } from "@tanstack/react-router";
import { Plus, Search, MoreVertical, Loader2, Edit, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_app/clientes")({ component: ClientesPage });

type Client = {
  id: string;
  name: string;
  company_name: string | null;
  whatsapp: string | null;
  email: string | null;
  status: string;
  total_spent: number;
  last_purchase_at: string | null;
};

function ClientesPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    company_name: "",
    whatsapp: "",
    email: "",
  });

  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, company_name, whatsapp, email")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // public.clients não guarda totais: o gasto e a última compra vêm de
      // store.customers (mesmo id, mantidos pelas automações de pedido).
      // Cliente só do CRM, sem cadastro na loja, fica com zero.
      const ids = (data || []).map((c) => c.id);
      const { data: totals, error: totalsError } = ids.length
        ? await supabase
            .schema("store")
            .from("customers")
            .select("id, total_spent, last_order_at")
            .in("id", ids)
        : { data: [], error: null };
      if (totalsError) throw totalsError;
      const totalsById = new Map((totals || []).map((t) => [t.id, t]));

      return (data || []).map((c) => {
        const total = totalsById.get(c.id);
        let computedStatus = "novo";
        const spent = Number(total?.total_spent) || 0;
        if (spent >= 1000) {
          computedStatus = "vip";
        } else if (spent > 0) {
          computedStatus = "recorrente";
        }
        return {
          ...c,
          status: computedStatus,
          total_spent: spent,
          last_purchase_at: total?.last_order_at ?? null,
        };
      });
    },
    enabled: !!profile,
  });

  const filteredClients = clients?.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.company_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === "all" ? true : c.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id || "")
        .single();

      if (!profileData?.company_id) throw new Error("Empresa não identificada.");
      const companyId = profileData.company_id;

      if (editingClient) {
        const { error } = await supabase.from("clients").update(data).eq("id", editingClient.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("clients")
          .insert([{ ...data, company_id: companyId }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success(editingClient ? "Cliente atualizado!" : "Cliente criado!");
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err) => {
      toast.error("Erro ao salvar cliente: " + err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Cliente removido!");
    },
    onError: (err) => {
      toast.error("Erro ao remover cliente: " + err.message);
    },
  });

  function resetForm() {
    setEditingClient(null);
    setFormData({ name: "", company_name: "", whatsapp: "", email: "" });
  }

  function handleEdit(client: Client) {
    setEditingClient(client);
    setFormData({
      name: client.name,
      company_name: client.company_name || "",
      whatsapp: client.whatsapp || "",
      email: client.email || "",
    });
    setIsModalOpen(true);
  }

  function getStatusVariant(status: string) {
    switch (status) {
      case "vip":
        return "accent";
      case "recorrente":
        return "info";
      case "novo":
        return "success";
      case "inativo":
        return "muted";
      default:
        return "default";
    }
  }

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Gerencie sua base de clientes"
        action="Novo cliente"
        onAction={() => {
          resetForm();
          setIsModalOpen(true);
        }}
      />
      <Card className="p-4 mb-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, empresa, e-mail..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="vip">VIP</SelectItem>
              <SelectItem value="recorrente">Recorrente</SelectItem>
              <SelectItem value="novo">Novo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead className="hidden lg:table-cell">E-mail</TableHead>
              <TableHead>Total gasto</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filteredClients?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Nenhum cliente encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filteredClients?.map((c) => (
                <TableRow key={c.id} className="cursor-pointer">
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.company_name || "-"}</TableCell>
                  <TableCell className="text-muted-foreground">{c.whatsapp || "-"}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    {c.email || "-"}
                  </TableCell>
                  <TableCell className="font-semibold">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                      c.total_spent || 0,
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge variant={getStatusVariant(c.status)}>{c.status}</StatusBadge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(c)}>
                          <Edit className="h-4 w-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => {
                            if (confirm("Tem certeza que deseja remover este cliente?")) {
                              deleteMutation.mutate(c.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Remover
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingClient ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nome completo *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="company">Empresa</Label>
              <Input
                id="company"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input
                id="whatsapp"
                placeholder="(00) 00000-0000"
                value={formData.whatsapp}
                onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!formData.name || saveMutation.isPending}
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
