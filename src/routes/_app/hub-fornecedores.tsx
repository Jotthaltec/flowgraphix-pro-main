import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Link2, PackageOpen, Globe, Cpu, ShoppingCart, Settings } from "lucide-react";
import { ImportarLink } from "@/components/hub/importar-link";
import { ProdutosImportados } from "@/components/hub/produtos-importados";
import { CatalogoFornecedores } from "@/components/hub/catalogo-fornecedores";
import { RegrasMapeamento } from "@/components/hub/regras-mapeamento";
import { RascunhosMarketplace } from "@/components/hub/rascunhos-marketplace";
import { ConfiguracoesHub } from "@/components/hub/configuracoes-hub";

export const Route = createFileRoute("/_app/hub-fornecedores")({
  component: HubFornecedoresPage,
});

function HubFornecedoresPage() {
  const [activeTab, setActiveTab] = useState("importar");

  return (
    <div className="flex flex-col space-y-6">
      <PageHeader
        title="Hub de Fornecedores"
        description="Importe produtos gráficos por link ou catálogo, gerencie regras de extração e publique em múltiplos marketplaces."
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4">
        <div className="flex items-center justify-between border-b pb-2 overflow-x-auto">
          <TabsList className="bg-muted/50 p-1 rounded-lg">
            <TabsTrigger value="importar" className="flex items-center gap-2 text-xs md:text-sm">
              <Link2 className="h-4 w-4 text-primary" />
              <span>Importar por Link</span>
            </TabsTrigger>
            <TabsTrigger value="produtos" className="flex items-center gap-2 text-xs md:text-sm">
              <PackageOpen className="h-4 w-4 text-emerald-500" />
              <span>Produtos Importados</span>
            </TabsTrigger>
            <TabsTrigger value="catalogo" className="flex items-center gap-2 text-xs md:text-sm">
              <Globe className="h-4 w-4 text-purple-500" />
              <span>Catálogo & Fornecedores</span>
            </TabsTrigger>
            <TabsTrigger value="regras" className="flex items-center gap-2 text-xs md:text-sm">
              <Cpu className="h-4 w-4 text-amber-500" />
              <span>Regras de Mapeamento</span>
            </TabsTrigger>
            <TabsTrigger value="rascunhos" className="flex items-center gap-2 text-xs md:text-sm">
              <ShoppingCart className="h-4 w-4 text-rose-500" />
              <span>Rascunhos de Marketplace</span>
            </TabsTrigger>
            <TabsTrigger value="configuracoes" className="flex items-center gap-2 text-xs md:text-sm">
              <Settings className="h-4 w-4 text-slate-500" />
              <span>Configurações</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="importar" className="space-y-4 outline-none">
          <ImportarLink onNavigateToProducts={() => setActiveTab("produtos")} onNavigateToDrafts={() => setActiveTab("rascunhos")} />
        </TabsContent>

        <TabsContent value="produtos" className="space-y-4 outline-none">
          <ProdutosImportados onNavigateToDrafts={() => setActiveTab("rascunhos")} />
        </TabsContent>

        <TabsContent value="catalogo" className="space-y-4 outline-none">
          <CatalogoFornecedores />
        </TabsContent>

        <TabsContent value="regras" className="space-y-4 outline-none">
          <RegrasMapeamento />
        </TabsContent>

        <TabsContent value="rascunhos" className="space-y-4 outline-none">
          <RascunhosMarketplace />
        </TabsContent>

        <TabsContent value="configuracoes" className="space-y-4 outline-none">
          <ConfiguracoesHub />
        </TabsContent>
      </Tabs>
    </div>
  );
}
