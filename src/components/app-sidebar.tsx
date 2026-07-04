import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, MapPin, FileText, FileSignature, ShoppingBag,
  Workflow, Package, Calculator, Wallet, FolderOpen, BarChart3, Settings,
  LogOut, Printer, Globe, ShoppingCart,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Clientes", url: "/clientes", icon: Users },
  { title: "Leads Locais", url: "/leads", icon: MapPin },
  { title: "Orçamentos", url: "/orcamentos", icon: FileText },
  { title: "Contratos", url: "/contratos", icon: FileSignature },
  { title: "Pedidos", url: "/pedidos", icon: ShoppingBag },
  { title: "Pedidos de Compra", url: "/pedidos-compra", icon: ShoppingCart },
  { title: "Produção", url: "/producao", icon: Workflow },
  { title: "Produtos & Serviços", url: "/produtos", icon: Package },
  { title: "Hub de Fornecedores", url: "/hub-fornecedores", icon: Globe },
  { title: "Custos & Lucro", url: "/custos", icon: Calculator },
  { title: "Financeiro", url: "/financeiro", icon: Wallet },
  { title: "Arquivos & Artes", url: "/arquivos", icon: FolderOpen },
  { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();

  const initials = (profile?.full_name || user?.email || "U")
    .split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/login" });
  }

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link to="/dashboard" className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: "var(--gradient-brand)" }}>
            <Printer className="h-5 w-5 text-white" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-bold text-sidebar-foreground">PrintFlow</span>
              <span className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60">CRM</span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = pathname === item.url;
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center gap-2 px-1 py-2">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-sidebar-foreground truncate">
                {profile?.full_name || user?.email}
              </p>
              <p className="text-[10px] text-sidebar-foreground/60 truncate">
                {profile?.company_name || "Minha gráfica"}
              </p>
            </div>
          )}
          {!collapsed && (
            <Button size="icon" variant="ghost" onClick={handleSignOut} className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent">
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
