import { Search, Bell, Plus } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function AppHeader({ title }: { title?: string }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-card/80 backdrop-blur px-4 md:px-6">
      <SidebarTrigger />
      {title && <h1 className="hidden md:block text-lg font-semibold tracking-tight">{title}</h1>}
      <div className="flex-1 max-w-xl ml-auto md:ml-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar clientes, pedidos, orçamentos..."
            className="pl-9 bg-background"
          />
        </div>
      </div>
      <Button variant="ghost" size="icon" className="relative">
        <Bell className="h-5 w-5" />
        <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-destructive" />
      </Button>
      <Button size="sm" className="hidden sm:inline-flex">
        <Plus className="h-4 w-4 mr-1" /> Novo
      </Button>
    </header>
  );
}
