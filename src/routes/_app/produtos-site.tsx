import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, ExternalLink, PackageSearch } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/produtos-site")({ component: ProdutosSitePage });

/** Espelha a view public.site_products. */
type SiteProduct = {
  id: string;
  sku: string;
  name: string;
  slug: string;
  categoria: string | null;
  unidade_preco: string;
  preco_base: number;
  preco_promocional: number | null;
  preco_revenda: number | null;
  quantidade_minima: number;
  prazo_producao_dias: number;
  destaque: boolean;
  novidade: boolean;
  em_promocao: boolean;
  exclusivo_revenda: boolean;
  updated_at: string;
  imagem: string | null;
};

const LOJA_URL = import.meta.env.VITE_LOJA_URL ?? "http://localhost:3000";

const UNIDADE_LABEL: Record<string, string> = {
  unidade: "un.",
  milheiro: "milheiro",
  m2: "m²",
  pacote: "pacote",
  metro_linear: "m linear",
};

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v ?? 0);

function ProdutosSitePage() {
  const [search, setSearch] = useState("");
  const [categoria, setCategoria] = useState("all");

  const { data, isLoading, error } = useQuery({
    queryKey: ["site_products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("site_products").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as SiteProduct[];
    },
  });

  const produtos = data ?? [];

  // As categorias saem do próprio resultado: não há tabela de apoio a consultar
  // e a lista acompanha o que está publicado de fato.
  const categorias = Array.from(
    new Set(produtos.map((p) => p.categoria).filter(Boolean) as string[]),
  ).sort();

  const termo = search.trim().toLowerCase();
  const filtrados = produtos.filter((p) => {
    const casaBusca =
      !termo ||
      p.name.toLowerCase().includes(termo) ||
      p.sku.toLowerCase().includes(termo) ||
      (p.categoria ?? "").toLowerCase().includes(termo);
    const casaCategoria = categoria === "all" || p.categoria === categoria;
    return casaBusca && casaCategoria;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Catálogo do site"
        description="Produtos publicados na loja Nexus Printi. Somente leitura — a edição acontece no painel da loja."
      />

      {error ? (
        <Card className="p-6">
          <p className="text-sm text-destructive">
            Não foi possível carregar o catálogo: {(error as Error).message}
          </p>
        </Card>
      ) : null}

      <Card className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, SKU ou categoria..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={categoria} onValueChange={setCategoria}>
            <SelectTrigger className="w-full md:w-56">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {categorias.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="whitespace-nowrap text-sm text-muted-foreground">
            {filtrados.length} de {produtos.length}
          </span>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filtrados.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <PackageSearch className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">
                {produtos.length === 0
                  ? "Nenhum produto publicado na loja"
                  : "Nenhum produto encontrado com esse filtro"}
              </p>
              <p className="text-sm text-muted-foreground">
                {produtos.length === 0
                  ? "Cadastre produtos no painel da loja e marque-os como ativos para vê-los aqui."
                  : "Ajuste a busca ou a categoria."}
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14"></TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="hidden md:table-cell">Categoria</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead className="hidden lg:table-cell">Revenda</TableHead>
                  <TableHead className="hidden lg:table-cell">Prazo</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      {p.imagem ? (
                        <img
                          src={p.imagem}
                          alt=""
                          className="h-10 w-10 rounded object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded bg-muted" />
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-xs text-muted-foreground">{p.sku}</span>
                        {p.destaque ? <StatusBadge variant="info">Destaque</StatusBadge> : null}
                        {p.novidade ? <StatusBadge variant="success">Novo</StatusBadge> : null}
                        {p.em_promocao ? (
                          <StatusBadge variant="warning">Promoção</StatusBadge>
                        ) : null}
                        {p.exclusivo_revenda ? (
                          <StatusBadge variant="muted">Só revenda</StatusBadge>
                        ) : null}
                      </div>
                    </TableCell>

                    <TableCell className="hidden md:table-cell text-sm">
                      {p.categoria ?? "—"}
                    </TableCell>

                    <TableCell>
                      <div className="font-semibold">
                        {brl(p.preco_promocional ?? p.preco_base)}
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          /{UNIDADE_LABEL[p.unidade_preco] ?? p.unidade_preco}
                        </span>
                      </div>
                      {p.preco_promocional ? (
                        <div className="text-xs text-muted-foreground line-through">
                          {brl(p.preco_base)}
                        </div>
                      ) : null}
                      {p.quantidade_minima > 1 ? (
                        <div className="text-xs text-muted-foreground">
                          mín. {p.quantidade_minima}
                        </div>
                      ) : null}
                    </TableCell>

                    <TableCell className="hidden lg:table-cell text-sm">
                      {p.preco_revenda != null ? brl(p.preco_revenda) : "—"}
                    </TableCell>

                    <TableCell className="hidden lg:table-cell text-sm">
                      {p.prazo_producao_dias} {p.prazo_producao_dias === 1 ? "dia" : "dias"}
                    </TableCell>

                    <TableCell>
                      <Button asChild size="icon" variant="ghost" title="Ver na loja">
                        <a
                          href={`${LOJA_URL}/produtos/${p.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
