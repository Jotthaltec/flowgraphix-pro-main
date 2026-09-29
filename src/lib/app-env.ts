/**
 * Qual banco o CRM está usando, deduzido da URL do Supabase.
 *
 * Existe porque o Vite carrega `.env.local` em todos os modos, inclusive no
 * `vite build`: um arquivo local apontando para 127.0.0.1 já gerou builds de
 * produção que só funcionariam na máquina de quem compilou. O mesmo
 * classificador alimenta a trava do `vite.config.ts` e o selo do cabeçalho.
 *
 * Sem dependências de propósito: é importado pelo `vite.config.ts`.
 */

/** Projeto Supabase compartilhado pela loja e pelo CRM em produção. */
export const PRODUCTION_PROJECT_REF = "gkbbzypdakjrvxwvfjlc";

export type AppEnvironment = "local" | "homologacao" | "producao" | "desconhecido";

const LOCAL_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
  "host.docker.internal",
]);

export function classifySupabaseUrl(url: string | undefined | null): AppEnvironment {
  const raw = url?.trim();
  if (!raw) return "desconhecido";

  let host: string;
  try {
    host = new URL(raw).hostname.toLowerCase();
  } catch {
    return "desconhecido";
  }

  if (LOCAL_HOSTS.has(host) || host.endsWith(".localhost")) return "local";
  if (host === `${PRODUCTION_PROJECT_REF}.supabase.co`) return "producao";
  if (host.endsWith(".supabase.co")) return "homologacao";
  return "desconhecido";
}

/**
 * Motivo para recusar uma build de produção, ou `null` se ela pode seguir.
 *
 * Só a produção é aceita: um projeto de homologação publicado como produção
 * seria o mesmo erro silencioso, com outro endereço.
 */
export function productionBuildProblem(urls: Record<string, string | undefined>): string | null {
  const problems = Object.entries(urls)
    .filter(([, value]) => value !== undefined && value.trim() !== "")
    .map(([name, value]) => [name, value!, classifySupabaseUrl(value)] as const)
    .filter(([, , env]) => env !== "producao")
    .map(([name, value, env]) => `${name}=${value} (${env})`);

  const configured = Object.values(urls).some((value) => value?.trim());
  if (!configured) return "nenhuma URL do Supabase configurada (VITE_SUPABASE_URL / SUPABASE_URL)";
  return problems.length ? problems.join(", ") : null;
}

export const APP_ENVIRONMENT_LABEL: Record<AppEnvironment, string> = {
  local: "Banco local",
  homologacao: "Homologação",
  producao: "Produção",
  desconhecido: "Banco desconhecido",
};
