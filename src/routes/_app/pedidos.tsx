import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search, MoreVertical, Loader2, Workflow, Wallet, ReceiptText, LockKeyhole, UnlockKeyhole } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { civilDateFromToday, formatCivilDate } from "@/lib/date";

export const Route = createFileRoute("/_app/pedidos")({ component: PedidosPage });

function PedidosPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [prodFilter, setProdFilter] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const posIdempotencyKey = useRef(`pos:${crypto.randomUUID()}`);
  const [openingAmount, setOpeningAmount] = useState("0");
  const [closingAmount, setClosingAmount] = useState("");

  const [formData, setFormData] = useState({
    client_id: "",
    product_id: "",
    product_name: "",
    quantity: 1,
    total_value: 0,
    deadline: civilDateFromToday(7),
    priority: "normal",
    machine: "offset",
    payment_method: "pix",
    payment_status: "pago",
    payment_reference: "",
    notes: "",
  });

  const { data: clients } = useQuery({
    queryKey: ["clients_list_orders"],
    queryFn: async () => {
      const { data, error } = await supabase.schema("store").from("customers").select("id, name").eq("active", true).order("name");
      if (error) throw error;
      return data;
    }
  });

  const { data: catalogProducts } = useQuery({
    queryKey: ["store_products_pos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema("store")
        .from("products")
        .select("id, name, base_price, min_quantity, max_quantity")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: cashSession } = useQuery({
    queryKey: ["open_cash_session"],
    queryFn: async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user?.id) return null;
      const { data, error } = await (supabase as any)
        .schema("store")
        .from("cash_sessions")
        .select("id, opening_amount, opened_at")
        .eq("operator_id", authData.user.id)
        .eq("status", "aberto")
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; opening_amount: number; opened_at: string } | null;
    },
    enabled: !!profile,
  });

  const openCashMutation = useMutation({
    mutationFn: async () => {
      const amount = Number(openingAmount);
      if (!Number.isFinite(amount) || amount < 0) throw new Error("Informe um saldo inicial válido.");
      const { error } = await (supabase as any).schema("store").rpc("open_cash_session", {
        p_opening_amount: amount,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["open_cash_session"] });
      toast.success("Caixa aberto. As próximas vendas serão conciliadas nesta sessão.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const closeCashMutation = useMutation({
    mutationFn: async () => {
      const amount = Number(closingAmount);
      if (!Number.isFinite(amount) || amount < 0) throw new Error("Informe o valor contado no fechamento.");
      const { data, error } = await (supabase as any).schema("store").rpc("close_cash_session", {
        p_closing_amount: amount,
        p_notes: null,
      });
      if (error) throw error;
      return data as { expected_amount: number; difference_amount: number };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["open_cash_session"] });
      setClosingAmount("");
      toast.success(
        `Caixa fechado. Esperado: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(result.expected_amount)} · diferença: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(result.difference_amount)}.`,
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase.schema("store")
        .from("orders")
        .select(`
          id, number, total, payment_status, status, estimated_delivery, priority,
          customer:customers(name),
          items:order_items(product_name)
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return (data || []).map((order) => ({
        id: order.id,
        order_number: order.number,
        total_value: order.total,
        payment_status: order.payment_status,
        production_status: order.status,
        deadline: order.estimated_delivery,
        priority: order.priority,
        product_desc: order.items?.map((item) => item.product_name).join(", ") || "—",
        clients: order.customer,
      }));
    },
    enabled: !!profile,
  });

  const filteredData = orders?.filter(item => {
    const matchesSearch = item.order_number.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.clients?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesProd = prodFilter === "all" ? true : item.production_status === prodFilter;
    return matchesSearch && matchesProd;
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (!userId) throw new Error("Sessão expirada.");
      if (data.total_value <= 0 || data.quantity <= 0) throw new Error("Informe quantidade e valor válidos.");
      if (data.payment_status === "pago" && ["pix", "cartao_credito"].includes(data.payment_method) && !data.payment_reference.trim()) {
        throw new Error("Informe o identificador da transação recebida.");
      }

      const paid = data.payment_status === "pago";
      const { error } = await supabase.schema("store").rpc("create_order", {
        p_order: {
          customer_id: data.client_id || null,
          profile_id: userId,
          status: paid ? "pago" : "aguardando_pagamento",
          payment_status: paid ? "pago" : "pendente",
          payment_method: data.payment_method,
          payment_reference: data.payment_reference || null,
          subtotal: data.total_value,
          discount_total: 0,
          coupon_discount: 0,
          shipping_cost: 0,
          total: data.total_value,
          credit_used: 0,
          shipping_method: "retirada",
          estimated_delivery: data.deadline,
          priority: data.priority,
          assigned_section: data.machine,
          notes: data.notes || null,
          source: "balcao",
          create_production: paid,
        },
        p_items: [{
          product_id: data.product_id || null,
          product_name: data.product_name,
          quantity: data.quantity,
          unit_price: Number((data.total_value / data.quantity).toFixed(4)),
          base_price: Number((data.total_value / data.quantity).toFixed(4)),
          production_days: 1,
          notes: data.notes || `Item avulso de balcão — setor ${data.machine}`,
        }],
        p_idempotency_key: `${posIdempotencyKey.current}:${userId}`,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Venda registrada com pagamento, financeiro e produção integrados.");
      posIdempotencyKey.current = `pos:${crypto.randomUUID()}`;
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err) => {
      toast.error("Erro ao gerar: " + err.message);
    }
  });

  function resetForm() {
    setFormData({ 
      client_id: "", product_id: "", product_name: "", quantity: 1,
      total_value: 0, 
      deadline: civilDateFromToday(7),
      priority: "normal", machine: "offset", payment_method: "pix",
      payment_status: "pago", payment_reference: "", notes: "",
    });
  }

  function getFinVariant(status: string) {
    switch(status) {
      case 'pago': return 'success';
      case 'entrada_paga': return 'warning';
      case 'atrasado':
      case 'cancelado': return 'destructive';
      default: return 'default';
    }
  }

  function getProdVariant(status: string) {
    switch(status) {
      case 'entregue':
      case 'finalizado': return 'muted';
      case 'pronto': return 'success';
      case 'arte_em_criacao':
      case 'em_producao': return 'accent';
      case 'em_acabamento': return 'warning';
      default: return 'default';
    }
  }

  async function printReceipt(orderId: string) {
    const receiptWindow = window.open("", "_blank", "width=760,height=900");
    if (!receiptWindow) {
      toast.error("O navegador bloqueou a janela do recibo. Libere pop-ups e tente novamente.");
      return;
    }
    receiptWindow.opener = null;

    const { data, error } = await supabase
      .schema("store")
      .from("orders")
      .select(`
        number, created_at, total, payment_method, payment_status,
        customer:customers(name, document),
        items:order_items(product_name, quantity, unit_price, total_price),
        payments(method, status, amount, gateway_payment_id, paid_at)
      `)
      .eq("id", orderId)
      .single();
    if (error || !data) {
      receiptWindow.close();
      toast.error("Não foi possível gerar o recibo deste pedido.");
      return;
    }

    const escapeHtml = (value: unknown) =>
      String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    const money = (value: number) =>
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
    const customer = Array.isArray(data.customer) ? data.customer[0] : data.customer;
    const lines = (data.items ?? []).map((item) => `
      <tr>
        <td>${escapeHtml(item.product_name)}</td>
        <td class="number">${Number(item.quantity).toLocaleString("pt-BR")}</td>
        <td class="number">${money(Number(item.unit_price))}</td>
        <td class="number">${money(Number(item.total_price))}</td>
      </tr>`).join("");
    const payments = (data.payments ?? []).map((payment) => `
      <li>${escapeHtml(payment.method)} · ${escapeHtml(payment.status)} · ${money(Number(payment.amount))}${payment.gateway_payment_id ? ` · Ref. ${escapeHtml(payment.gateway_payment_id)}` : ""}</li>`).join("");

    receiptWindow.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
      <title>Recibo ${escapeHtml(data.number)}</title><style>
      body{font:14px Arial,sans-serif;color:#171717;max-width:720px;margin:32px auto;padding:0 20px}
      h1{font-size:24px;margin:0} .muted{color:#666} .header{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid #111;padding-bottom:18px}
      table{width:100%;border-collapse:collapse;margin:24px 0} th,td{padding:9px;border-bottom:1px solid #ddd;text-align:left}.number{text-align:right}
      .total{font-size:22px;font-weight:700;text-align:right}.no-print{margin-top:28px}@media print{.no-print{display:none}body{margin:0}}
      </style></head><body><div class="header"><div><h1>Nexus Printi</h1><p class="muted">Recibo interno de venda</p></div>
      <div><strong>${escapeHtml(data.number)}</strong><br><span class="muted">${new Date(data.created_at).toLocaleString("pt-BR")}</span></div></div>
      <p><strong>Cliente:</strong> ${escapeHtml(customer?.name || "Consumidor balcão")}${customer?.document ? ` · ${escapeHtml(customer.document)}` : ""}</p>
      <table><thead><tr><th>Item</th><th class="number">Qtd.</th><th class="number">Unitário</th><th class="number">Total</th></tr></thead><tbody>${lines}</tbody></table>
      <p class="total">Total: ${money(Number(data.total))}</p><h2>Pagamento</h2><ul>${payments || `<li>${escapeHtml(data.payment_method)} · ${escapeHtml(data.payment_status)}</li>`}</ul>
      <p class="muted">Documento interno, sem valor fiscal.</p><button class="no-print" onclick="window.print()">Imprimir recibo</button></body></html>`);
    receiptWindow.document.close();
  }

  return (
    <>
      <PageHeader 
        title="Pedidos" 
        description="Acompanhe todos os pedidos e gerencie a fila de produção e financeiro" 
        action="Novo pedido manual" 
        onAction={() => {
          if (!cashSession) {
            toast.error("Abra o caixa antes de registrar uma venda recebida.");
            return;
          }
          resetForm();
          setIsModalOpen(true);
        }}
      />
      <Card className="p-4 mb-4">
        {cashSession ? (
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1">
              <p className="flex items-center gap-2 font-semibold text-success">
                <UnlockKeyhole className="h-4 w-4" /> Caixa aberto
              </p>
              <p className="text-sm text-muted-foreground">
                Desde {new Date(cashSession.opened_at).toLocaleString("pt-BR")} · saldo inicial {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(cashSession.opening_amount))}
              </p>
            </div>
            <div className="grid gap-1">
              <Label htmlFor="closing_amount">Valor contado no caixa</Label>
              <Input id="closing_amount" type="number" min="0" step="0.01" value={closingAmount} onChange={(event) => setClosingAmount(event.target.value)} />
            </div>
            <Button variant="outline" disabled={closeCashMutation.isPending || closingAmount === ""} onClick={() => closeCashMutation.mutate()}>
              {closeCashMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
              Fechar caixa
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1">
              <p className="flex items-center gap-2 font-semibold"><LockKeyhole className="h-4 w-4" /> Caixa fechado</p>
              <p className="text-sm text-muted-foreground">Abra uma sessão para registrar e conciliar vendas de balcão.</p>
            </div>
            <div className="grid gap-1">
              <Label htmlFor="opening_amount">Saldo inicial</Label>
              <Input id="opening_amount" type="number" min="0" step="0.01" value={openingAmount} onChange={(event) => setOpeningAmount(event.target.value)} />
            </div>
            <Button disabled={openCashMutation.isPending} onClick={() => openCashMutation.mutate()}>
              {openCashMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UnlockKeyhole className="h-4 w-4" />}
              Abrir caixa
            </Button>
          </div>
        )}
      </Card>
      <Card className="p-4 mb-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar pedido por número ou cliente..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9" 
            />
          </div>
          <Select value={prodFilter} onValueChange={setProdFilter}>
            <SelectTrigger className="w-full md:w-44"><SelectValue placeholder="Status produção" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="pedido_criado">Pedido Criado</SelectItem>
              <SelectItem value="arte_pendente">Arte Pendente</SelectItem>
              <SelectItem value="em_producao">Em Produção</SelectItem>
              <SelectItem value="pronto">Pronto</SelectItem>
              <SelectItem value="entregue">Entregue</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>
      
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="hidden md:table-cell">Produto/Serviço</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Financeiro</TableHead>
              <TableHead>Produção</TableHead>
              <TableHead className="hidden md:table-cell">Prazo</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-6"><Loader2 className="mx-auto animate-spin" /></TableCell></TableRow>
            ) : filteredData?.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">Nenhum pedido encontrado.</TableCell></TableRow>
            ) : filteredData?.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono font-semibold text-primary">{p.order_number}</TableCell>
                <TableCell className="font-medium">{p.clients?.name}</TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">{p.product_desc}</TableCell>
                <TableCell className="font-semibold">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.total_value)}
                </TableCell>
                <TableCell><StatusBadge variant={getFinVariant(p.payment_status || "") as any}>{(p.payment_status || "").replace("_", " ")}</StatusBadge></TableCell>
                <TableCell><StatusBadge variant={getProdVariant(p.production_status || "") as any}>{(p.production_status || "").replace("_", " ")}</StatusBadge></TableCell>
                <TableCell className="hidden md:table-cell text-sm">{p.deadline ? formatCivilDate(p.deadline) : '-'}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost"><MoreVertical className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate({ to: "/producao" })}>
                        <Workflow className="h-4 w-4 mr-2" /> Ver na fila de Produção
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate({ to: "/financeiro" })}>
                        <Wallet className="h-4 w-4 mr-2" /> Ver no Financeiro
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => void printReceipt(p.id)}>
                        <ReceiptText className="h-4 w-4 mr-2" /> Abrir recibo imprimível
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
          <DialogHeader><DialogTitle>Novo Pedido Manual</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Cliente (opcional)</Label>
              <Select value={formData.client_id} onValueChange={(val) => setFormData({...formData, client_id: val})}>
                <SelectTrigger><SelectValue placeholder="Consumidor balcão" /></SelectTrigger>
                <SelectContent>
                  {clients?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Produto do catálogo (opcional)</Label>
              <Select
                value={formData.product_id || "manual"}
                onValueChange={(value) => {
                  if (value === "manual") {
                    setFormData({ ...formData, product_id: "", product_name: "", quantity: 1, total_value: 0 });
                    return;
                  }
                  const product = catalogProducts?.find((item) => item.id === value);
                  const quantity = Number(product?.min_quantity || 1);
                  setFormData({
                    ...formData,
                    product_id: value,
                    product_name: product?.name || "",
                    quantity,
                    total_value: Number(product?.base_price || 0) * quantity,
                  });
                }}
              >
                <SelectTrigger><SelectValue placeholder="Item avulso controlado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Item avulso controlado</SelectItem>
                  {catalogProducts?.map((product) => (
                    <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Descrição do produto / serviço *</Label>
              <Input value={formData.product_name} onChange={(e) => setFormData({...formData, product_name: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Quantidade</Label>
                <Input type="number" min="1" value={formData.quantity} onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value) || 1})} />
              </div>
              <div className="grid gap-2">
                <Label>Valor Total (R$)</Label>
                <Input type="number" min="0" value={formData.total_value} onChange={(e) => setFormData({...formData, total_value: parseFloat(e.target.value) || 0})} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Forma de pagamento</Label>
                <Select value={formData.payment_method} onValueChange={(val) => setFormData({...formData, payment_method: val})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="cartao_credito">Cartão</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="combinado">A combinar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Situação</Label>
                <Select value={formData.payment_status} onValueChange={(val) => setFormData({...formData, payment_status: val})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pago">Recebido</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Identificador da transação</Label>
              <Input
                value={formData.payment_reference}
                onChange={(e) => setFormData({...formData, payment_reference: e.target.value})}
                placeholder="E2E do PIX, NSU ou referência do caixa"
              />
            </div>
            <div className="grid gap-2">
              <Label>Justificativa / observações do item avulso *</Label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                placeholder="Ex.: 50 fotos 10x15, papel fotográfico, retirada no balcão"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Máquina / Setor</Label>
                <Select value={formData.machine} onValueChange={(val) => setFormData({...formData, machine: val})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="offset">Offset</SelectItem>
                    <SelectItem value="dtf_textil">DTF Têxtil</SelectItem>
                    <SelectItem value="dtf_uv">DTF UV</SelectItem>
                    <SelectItem value="sublimacao">Sublimação</SelectItem>
                    <SelectItem value="acabamento">Acabamento</SelectItem>
                    <SelectItem value="design">Design</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Prioridade</Label>
                <Select value={formData.priority} onValueChange={(val) => setFormData({...formData, priority: val})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Prazo de Entrega</Label>
                <Input type="date" value={formData.deadline} onChange={(e) => setFormData({...formData, deadline: e.target.value})} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button 
              disabled={!formData.product_name || !formData.notes || !formData.deadline || saveMutation.isPending}
              onClick={() => saveMutation.mutate(formData)}
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Criar Pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
