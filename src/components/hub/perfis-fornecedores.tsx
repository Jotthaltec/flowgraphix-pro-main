import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  Tabs, TabsContent, TabsList, TabsTrigger
} from "@/components/ui/tabs";
import { StatusBadge } from "@/components/status-badge";
import {
  Loader2, Building2, Mail, MapPin, KeyRound,
  UserCircle2, Truck, Clipboard, CheckCircle2, CircleDot,
  WifiOff, Copy, Save, ExternalLink, Link2, PlugZap, Trash2
} from "lucide-react";
import { toast } from "sonner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

// ─── Tipos ─────────────────────────────────────────────────────────────────

interface SupplierAccountSafe {
  id: string;
  company_id: string;
  supplier_id: string;
  registration_name: string | null;
  registration_cnpj: string | null;
  registration_email: string | null;
  registration_phone: string | null;
  login_username: string | null;
  has_password: boolean;
  delivery_override: boolean;
  delivery_recipient: string | null;
  delivery_zip: string | null;
  delivery_address: string | null;
  delivery_number: string | null;
  delivery_complement: string | null;
  delivery_neighborhood: string | null;
  delivery_city: string | null;
  delivery_state: string | null;
  delivery_phone: string | null;
  receiving_mode: string | null;
  preferred_pickup_point: string | null;
  notes: string | null;
}

interface Supplier {
  id: string;
  name: string;
  domain: string | null;
  website_url: string | null;
  status: string | null;
}

interface Company {
  name: string;
  cnpj: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  legal_name: string | null;
  zip_code: string | null;
  address: string | null;
  address_number: string | null;
  complement: string | null;
  neighborhood: string | null;
  delivery_zip: string | null;
  delivery_address: string | null;
  delivery_number: string | null;
  delivery_complement: string | null;
  delivery_neighborhood: string | null;
  delivery_city: string | null;
  delivery_state: string | null;
  delivery_recipient: string | null;
  delivery_phone: string | null;
  default_receiving_mode: string | null;
}

// ─── Estado inicial do formulário ──────────────────────────────────────────

const emptyForm = {
  supplier_id: "",
  registration_name: "",
  registration_cnpj: "",
  registration_email: "",
  registration_phone: "",
  login_username: "",
  login_password: "",
  delivery_override: false,
  delivery_recipient: "",
  delivery_zip: "",
  delivery_address: "",
  delivery_number: "",
  delivery_complement: "",
  delivery_neighborhood: "",
  delivery_city: "",
  delivery_state: "",
  delivery_phone: "",
  receiving_mode: "" as string,
  preferred_pickup_point: "",
  notes: "",
};

type FormState = typeof emptyForm;

// ─── Helper: status da conexão ────────────────────────────────────────────

type ConnState = "connected" | "partial" | "none";

function connectionStatus(acc: SupplierAccountSafe | undefined): {
  state: ConnState;
  variant: "success" | "warning" | "muted";
  label: string;
  icon: React.ReactNode;
} {
  // "Conectado" = já dá para logar no site (usuário + senha guardada).
  if (acc && acc.login_username && acc.has_password)
    return { state: "connected", variant: "success", label: "Conectado", icon: <CheckCircle2 className="h-3 w-3" /> };
  // Tem algum dado, mas ainda falta login/senha para conectar de fato.
  if (acc && (acc.login_username || acc.registration_email))
    return { state: "partial", variant: "warning", label: "Conexão incompleta", icon: <CircleDot className="h-3 w-3" /> };
  return { state: "none", variant: "muted", label: "Não conectado", icon: <WifiOff className="h-3 w-3" /> };
}

/** URL de login/site do fornecedor, com fallback para o domínio. */
function supplierSiteUrl(s: Supplier | undefined): string | null {
  if (!s) return null;
  if (s.website_url) return s.website_url;
  if (s.domain) return `https://${s.domain.replace(/^https?:\/\//, "")}`;
  return null;
}

// ─── Componente principal ─────────────────────────────────────────────────

export function PerfisForncedores() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);

  // ── Queries ────────────────────────────────────────────────────────────

  const { data: suppliers = [], isLoading: loadingSuppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name, domain, website_url, status")
        .order("name");
      if (error) throw error;
      return (data || []) as Supplier[];
    },
  });

  const { data: accounts = [], isLoading: loadingAccounts } = useQuery({
    queryKey: ["supplier_accounts_safe", profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data, error } = await supabase
        .from("supplier_accounts_safe")
        .select("*")
        .eq("company_id", profile.company_id);
      if (error) throw error;
      return (data || []) as SupplierAccountSafe[];
    },
    enabled: !!profile?.company_id,
  });

  const { data: company } = useQuery({
    queryKey: ["company", profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return null;
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("id", profile.company_id)
        .single();
      if (error) throw error;
      return data as Company;
    },
    enabled: !!profile?.company_id,
  });

  // ── Acções ─────────────────────────────────────────────────────────────

  /** Abre o site de login do fornecedor em nova aba. */
  const openSupplierSite = (supplier?: Supplier) => {
    const url = supplierSiteUrl(supplier);
    if (!url) {
      toast.error("Este fornecedor não tem site cadastrado. Adicione o link em Fornecedores Vinculados.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const openNew = (supplierId?: string) => {
    setEditingAccountId(null);
    setForm({ ...emptyForm, supplier_id: supplierId || "" });
    setOpen(true);
  };

  const openEdit = (acc: SupplierAccountSafe) => {
    setEditingAccountId(acc.id);
    setForm({
      supplier_id: acc.supplier_id,
      registration_name: acc.registration_name || "",
      registration_cnpj: acc.registration_cnpj || "",
      registration_email: acc.registration_email || "",
      registration_phone: acc.registration_phone || "",
      login_username: acc.login_username || "",
      login_password: "", // nunca pré-preenchida
      delivery_override: acc.delivery_override,
      delivery_recipient: acc.delivery_recipient || "",
      delivery_zip: acc.delivery_zip || "",
      delivery_address: acc.delivery_address || "",
      delivery_number: acc.delivery_number || "",
      delivery_complement: acc.delivery_complement || "",
      delivery_neighborhood: acc.delivery_neighborhood || "",
      delivery_city: acc.delivery_city || "",
      delivery_state: acc.delivery_state || "",
      delivery_phone: acc.delivery_phone || "",
      receiving_mode: acc.receiving_mode || "",
      preferred_pickup_point: acc.preferred_pickup_point || "",
      notes: acc.notes || "",
    });
    setOpen(true);
  };

  /** Preenche os dados de cadastro com os dados da empresa */
  const fillFromCompany = () => {
    if (!company) {
      toast.error("Dados da empresa não carregados ainda.");
      return;
    }
    setForm(prev => ({
      ...prev,
      registration_name: company.legal_name || company.name || "",
      registration_cnpj: company.cnpj || "",
      registration_email: company.email || "",
      registration_phone: company.whatsapp || company.phone || "",
      // Se delivery_override, preenche também o endereço de entrega padrão da empresa
      ...(prev.delivery_override ? {
        delivery_recipient: company.delivery_recipient || company.name || "",
        delivery_zip: company.delivery_zip || company.zip_code || "",
        delivery_address: company.delivery_address || company.address || "",
        delivery_number: company.delivery_number || company.address_number || "",
        delivery_complement: company.delivery_complement || company.complement || "",
        delivery_neighborhood: company.delivery_neighborhood || company.neighborhood || "",
        delivery_city: company.delivery_city || "",
        delivery_state: company.delivery_state || "",
        delivery_phone: company.delivery_phone || company.phone || company.whatsapp || "",
      } : {}),
    }));
    toast.success("Dados da gráfica aplicados ao formulário!");
  };

  /** Preenche o endereço de entrega com os dados da empresa */
  const fillDeliveryFromCompany = () => {
    if (!company) return;
    setForm(prev => ({
      ...prev,
      delivery_recipient: company.delivery_recipient || company.name || "",
      delivery_zip: company.delivery_zip || company.zip_code || "",
      delivery_address: company.delivery_address || company.address || "",
      delivery_number: company.delivery_number || company.address_number || "",
      delivery_complement: company.delivery_complement || company.complement || "",
      delivery_neighborhood: company.delivery_neighborhood || company.neighborhood || "",
      delivery_city: company.delivery_city || "",
      delivery_state: company.delivery_state || "",
      delivery_phone: company.delivery_phone || company.phone || company.whatsapp || "",
    }));
    toast.success("Endereço de entrega preenchido com os dados da gráfica!");
  };

  const handleSave = async (openSiteAfter = false) => {
    if (!profile?.company_id || !form.supplier_id) {
      toast.error("Selecione um fornecedor.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.rpc("upsert_supplier_account", {
        p_company_id: profile.company_id,
        p_supplier_id: form.supplier_id,
        p_registration_name: form.registration_name || undefined,
        p_registration_cnpj: form.registration_cnpj || undefined,
        p_registration_email: form.registration_email || undefined,
        p_registration_phone: form.registration_phone || undefined,
        p_login_username: form.login_username || undefined,
        p_login_password: form.login_password || undefined,
        p_delivery_override: form.delivery_override,
        p_delivery_recipient: form.delivery_recipient || undefined,
        p_delivery_zip: form.delivery_zip || undefined,
        p_delivery_address: form.delivery_address || undefined,
        p_delivery_number: form.delivery_number || undefined,
        p_delivery_complement: form.delivery_complement || undefined,
        p_delivery_neighborhood: form.delivery_neighborhood || undefined,
        p_delivery_city: form.delivery_city || undefined,
        p_delivery_state: form.delivery_state || undefined,
        p_delivery_phone: form.delivery_phone || undefined,
        p_receiving_mode: form.receiving_mode || undefined,
        p_preferred_pickup_point: form.preferred_pickup_point || undefined,
        p_notes: form.notes || undefined,
      });
      if (error) throw error;

      const supplierToOpen = suppliers.find(s => s.id === form.supplier_id);
      toast.success(editingAccountId ? "Conexão atualizada!" : "Conta conectada!");
      queryClient.invalidateQueries({ queryKey: ["supplier_accounts_safe"] });
      setOpen(false);
      setForm(emptyForm);
      setEditingAccountId(null);
      if (openSiteAfter) openSupplierSite(supplierToOpen);
    } catch (err: any) {
      toast.error(`Erro ao salvar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (acc: SupplierAccountSafe) => {
    if (!window.confirm("Deseja remover o perfil deste fornecedor? As credenciais serão apagadas.")) return;
    const { error } = await supabase
      .from("supplier_accounts")
      .delete()
      .eq("id", acc.id);
    if (error) {
      toast.error(`Erro ao remover: ${error.message}`);
    } else {
      toast.success("Perfil removido.");
      queryClient.invalidateQueries({ queryKey: ["supplier_accounts_safe"] });
    }
  };

  const accountOf = (supplierId: string) =>
    accounts.find(a => a.supplier_id === supplierId);

  const isLoading = loadingSuppliers || loadingAccounts;
  const selectedSupplier = suppliers.find(s => s.id === form.supplier_id);

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-1.5">
            <Link2 className="h-4 w-4 text-violet-500" /> Conexão com Fornecedores
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">
            Conecte a conta da sua gráfica em cada fornecedor. Depois de conectado, você abre o site
            já com o login à mão e envia o pedido de compra em poucos cliques.
          </p>
        </div>
        <Button size="sm" onClick={() => openNew()} className="flex items-center gap-1.5 shrink-0">
          <PlugZap className="h-4 w-4" /> Conectar conta
        </Button>
      </div>

      {/* Grid de cartões de conexão */}
      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 text-primary animate-spin" />
        </div>
      ) : suppliers.length === 0 ? (
        <div className="border border-dashed rounded-lg p-10 text-center text-muted-foreground">
          <Building2 className="h-10 w-10 mx-auto mb-3 opacity-20 animate-pulse" />
          <p className="text-sm font-semibold">Nenhum fornecedor vinculado</p>
          <p className="text-xs mt-1">Cadastre fornecedores na aba "Fornecedores Vinculados" primeiro.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {suppliers.map(supplier => {
            const acc = accountOf(supplier.id);
            const st = connectionStatus(acc);
            const hasSite = !!supplierSiteUrl(supplier);
            const borderColor =
              st.state === "connected" ? "border-t-emerald-500"
              : st.state === "partial" ? "border-t-amber-500"
              : "border-t-slate-300 dark:border-t-slate-700";
            return (
              <Card key={supplier.id} className={`border-t-4 ${borderColor} flex flex-col`}>
                <CardContent className="pt-4 flex flex-col gap-3 flex-1">
                  {/* Cabeçalho do cartão */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{supplier.name}</div>
                      {supplier.domain && (
                        <div className="text-xs text-muted-foreground font-mono truncate">{supplier.domain}</div>
                      )}
                    </div>
                    <StatusBadge variant={st.variant}>
                      <span className="flex items-center gap-1 whitespace-nowrap">{st.icon} {st.label}</span>
                    </StatusBadge>
                  </div>

                  {/* Corpo: dados da conexão ou chamada para conectar */}
                  {acc && (acc.login_username || acc.registration_email) ? (
                    <div className="text-xs space-y-1.5 flex-1">
                      {acc.login_username && (
                        <div className="flex items-center gap-1.5 font-mono">
                          <UserCircle2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{acc.login_username}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <KeyRound className="h-3.5 w-3.5 shrink-0" />
                        {acc.has_password ? "Senha salva ✓" : "Senha não cadastrada"}
                      </div>
                      {acc.registration_email && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Mail className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{acc.registration_email}</span>
                        </div>
                      )}
                      <StatusBadge variant={acc.receiving_mode === "delivery" ? "info" : acc.receiving_mode === "pickup" ? "warning" : "muted"}>
                        {acc.receiving_mode === "delivery" ? "Entrega na gráfica"
                          : acc.receiving_mode === "pickup" ? "Retirar no balcão"
                          : "Recebimento padrão"}
                      </StatusBadge>
                      {acc.delivery_override && acc.delivery_address && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">
                            {acc.delivery_address}{acc.delivery_number ? `, ${acc.delivery_number}` : ""}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground flex-1">
                      Conta ainda não conectada. Conecte para comprar direto no site deste fornecedor.
                    </p>
                  )}

                  {/* Ações do cartão */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t mt-auto">
                    {st.state === "none" ? (
                      <Button
                        size="sm"
                        className="h-8 text-xs flex-1"
                        onClick={() => openNew(supplier.id)}
                      >
                        <PlugZap className="h-3.5 w-3.5 mr-1" /> Conectar conta
                      </Button>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-8 text-xs flex-1"
                          disabled={!hasSite}
                          onClick={() => openSupplierSite(supplier)}
                          title={hasSite ? "Abrir o site do fornecedor para login" : "Fornecedor sem site cadastrado"}
                        >
                          <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir site
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={() => acc && openEdit(acc)}
                        >
                          Gerenciar
                        </Button>
                      </>
                    )}
                    {acc && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 shrink-0"
                        onClick={() => handleDelete(acc)}
                        title="Desconectar / remover conta"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Modal de Edição ──────────────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm(emptyForm); setEditingAccountId(null); } }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlugZap className="h-5 w-5 text-violet-500" />
              {editingAccountId ? "Gerenciar conexão" : "Conectar conta no fornecedor"}
            </DialogTitle>
            <DialogDescription>
              {selectedSupplier
                ? `Conectando a conta da sua gráfica em: ${selectedSupplier.name}`
                : "Informe o login do site do fornecedor para conectar. Os dados de cadastro e entrega são opcionais."}
            </DialogDescription>
          </DialogHeader>

          {/* Seleção do fornecedor (só em criação) */}
          {!editingAccountId && (
            <div className="space-y-1.5 px-1">
              <Label>Fornecedor *</Label>
              <Select
                value={form.supplier_id}
                onValueChange={v => setForm(prev => ({ ...prev, supplier_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o fornecedor..." />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}{s.domain ? ` — ${s.domain}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Abas do formulário — conexão (login) em primeiro plano */}
          <Tabs defaultValue="login" className="mt-1">
            <TabsList className="w-full">
              <TabsTrigger value="login" className="flex-1 flex items-center gap-1.5 text-xs">
                <KeyRound className="h-3.5 w-3.5" /> Conexão (Login)
              </TabsTrigger>
              <TabsTrigger value="cadastro" className="flex-1 flex items-center gap-1.5 text-xs">
                <Clipboard className="h-3.5 w-3.5" /> Dados de Cadastro
              </TabsTrigger>
              <TabsTrigger value="entrega" className="flex-1 flex items-center gap-1.5 text-xs">
                <Truck className="h-3.5 w-3.5" /> Entrega & Recebimento
              </TabsTrigger>
            </TabsList>

            {/* ── ABA: DADOS DE CADASTRO ────────────────────────────── */}
            <TabsContent value="cadastro" className="space-y-4 pt-3">
              {/* Botão principal */}
              <div className="flex items-center justify-between p-3 rounded-lg border bg-violet-500/5 border-violet-500/20">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold flex items-center gap-1.5">
                    <Copy className="h-4 w-4 text-violet-500" />
                    Usar meus dados da gráfica
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Preenche automaticamente com os dados cadastrais da sua empresa (nome, CNPJ, e-mail, telefone).
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-violet-500/40 text-violet-600 hover:bg-violet-500/10 shrink-0"
                  onClick={fillFromCompany}
                  disabled={!company}
                >
                  <Copy className="h-3.5 w-3.5 mr-1.5" /> Aplicar
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label>Nome / Razão Social para Cadastro</Label>
                  <Input
                    value={form.registration_name}
                    onChange={e => setForm(p => ({ ...p, registration_name: e.target.value }))}
                    placeholder="Nome que será usado no cadastro do fornecedor"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>CNPJ</Label>
                  <Input
                    value={form.registration_cnpj}
                    onChange={e => setForm(p => ({ ...p, registration_cnpj: e.target.value }))}
                    placeholder="00.000.000/0000-00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Telefone / WhatsApp</Label>
                  <Input
                    value={form.registration_phone}
                    onChange={e => setForm(p => ({ ...p, registration_phone: e.target.value }))}
                    placeholder="(00) 90000-0000"
                  />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>E-mail de Cadastro</Label>
                  <Input
                    type="email"
                    value={form.registration_email}
                    onChange={e => setForm(p => ({ ...p, registration_email: e.target.value }))}
                    placeholder="contato@suagrafica.com.br"
                  />
                </div>
              </div>
            </TabsContent>

            {/* ── ABA: LOGIN ────────────────────────────────────────── */}
            <TabsContent value="login" className="space-y-4 pt-3">
              <div className="flex items-start gap-2.5 p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
                <KeyRound className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <div className="text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground mb-0.5">Credenciais protegidas</p>
                  A senha é cifrada no servidor antes de ser armazenada e <strong>nunca é retornada</strong> em consultas normais. Ela poderá ser usada futuramente para preenchimento automático de formulários nos sites dos fornecedores.
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1.5">
                  <Label>Usuário / E-mail de Login</Label>
                  <div className="relative">
                    <UserCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={form.login_username}
                      onChange={e => setForm(p => ({ ...p, login_username: e.target.value }))}
                      placeholder="seuemail@grafica.com.br ou usuário"
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>
                    Senha{" "}
                    {editingAccountId && (
                      <span className="text-xs text-muted-foreground font-normal">
                        (deixe em branco para manter a senha atual)
                      </span>
                    )}
                  </Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="password"
                      value={form.login_password}
                      onChange={e => setForm(p => ({ ...p, login_password: e.target.value }))}
                      placeholder={editingAccountId ? "••••••••• (inalterada)" : "Nova senha..."}
                      className="pl-9"
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Observações sobre o acesso</Label>
                  <Textarea
                    value={form.notes}
                    onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                    placeholder="Ex: conta vinculada ao CNPJ filial, perfil empresarial ativado..."
                    rows={3}
                  />
                </div>
              </div>
            </TabsContent>

            {/* ── ABA: ENTREGA & RECEBIMENTO ───────────────────────── */}
            <TabsContent value="entrega" className="space-y-4 pt-3">
              {/* Modo de recebimento */}
              <div className="space-y-2">
                <Label>Modo de Recebimento (específico para este fornecedor)</Label>
                <Select
                  value={form.receiving_mode || "__default"}
                  onValueChange={v => setForm(p => ({ ...p, receiving_mode: v === "__default" ? "" : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Usar padrão da empresa..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__default">Usar padrão da empresa</SelectItem>
                    <SelectItem value="delivery">Entrega na Gráfica</SelectItem>
                    <SelectItem value="pickup">Retirar no Balcão do Fornecedor</SelectItem>
                  </SelectContent>
                </Select>
                {form.receiving_mode === "pickup" && (
                  <div className="space-y-1.5 mt-2">
                    <Label>Ponto de Retirada Preferido</Label>
                    <Input
                      value={form.preferred_pickup_point}
                      onChange={e => setForm(p => ({ ...p, preferred_pickup_point: e.target.value }))}
                      placeholder="Ex: balcão central, filial SP..."
                    />
                  </div>
                )}
              </div>

              {/* Endereço de entrega */}
              <div className="border rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-semibold">Endereço de Entrega Personalizado</Label>
                    <p className="text-xs text-muted-foreground">
                      Ative para usar um endereço diferente do padrão da empresa neste fornecedor.
                    </p>
                  </div>
                  <Switch
                    checked={form.delivery_override}
                    onCheckedChange={v => setForm(p => ({ ...p, delivery_override: v }))}
                    id="delivery-override"
                  />
                </div>

                {form.delivery_override && (
                  <>
                    {/* Botão para copiar dados da empresa */}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full border-violet-500/30 text-violet-600 hover:bg-violet-500/10 text-xs"
                      onClick={fillDeliveryFromCompany}
                      disabled={!company}
                    >
                      <Copy className="h-3.5 w-3.5 mr-1.5" />
                      Usar endereço de entrega da empresa
                    </Button>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5 col-span-2">
                        <Label>Destinatário / Nome para recebimento</Label>
                        <Input
                          value={form.delivery_recipient}
                          onChange={e => setForm(p => ({ ...p, delivery_recipient: e.target.value }))}
                          placeholder="Nome do responsável pelo recebimento"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>CEP</Label>
                        <Input
                          value={form.delivery_zip}
                          onChange={e => setForm(p => ({ ...p, delivery_zip: e.target.value }))}
                          placeholder="00000-000"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Telefone para entrega</Label>
                        <Input
                          value={form.delivery_phone}
                          onChange={e => setForm(p => ({ ...p, delivery_phone: e.target.value }))}
                          placeholder="(00) 90000-0000"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Logradouro</Label>
                        <Input
                          value={form.delivery_address}
                          onChange={e => setForm(p => ({ ...p, delivery_address: e.target.value }))}
                          placeholder="Rua, Av., etc."
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Número</Label>
                        <Input
                          value={form.delivery_number}
                          onChange={e => setForm(p => ({ ...p, delivery_number: e.target.value }))}
                          placeholder="123"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Complemento</Label>
                        <Input
                          value={form.delivery_complement}
                          onChange={e => setForm(p => ({ ...p, delivery_complement: e.target.value }))}
                          placeholder="Sala, apto, bloco..."
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Bairro</Label>
                        <Input
                          value={form.delivery_neighborhood}
                          onChange={e => setForm(p => ({ ...p, delivery_neighborhood: e.target.value }))}
                          placeholder="Bairro"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Cidade</Label>
                        <Input
                          value={form.delivery_city}
                          onChange={e => setForm(p => ({ ...p, delivery_city: e.target.value }))}
                          placeholder="São Paulo"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>UF</Label>
                        <Input
                          value={form.delivery_state}
                          onChange={e => setForm(p => ({ ...p, delivery_state: e.target.value }))}
                          placeholder="SP"
                          maxLength={2}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="pt-2 gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleSave(true)}
              disabled={saving || !form.supplier_id || !supplierSiteUrl(selectedSupplier)}
              className="flex items-center gap-1.5"
              title={supplierSiteUrl(selectedSupplier) ? "Salva e abre o site do fornecedor para login" : "Fornecedor sem site cadastrado"}
            >
              <ExternalLink className="h-4 w-4" />
              Conectar e abrir site
            </Button>
            <Button
              onClick={() => handleSave(false)}
              disabled={saving || !form.supplier_id}
              className="flex items-center gap-1.5"
            >
              {saving
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Save className="h-4 w-4" />}
              {editingAccountId ? "Salvar conexão" : "Conectar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
