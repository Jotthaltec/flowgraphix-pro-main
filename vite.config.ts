import { defineConfig, loadEnv, type UserConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { productionBuildProblem } from "./src/lib/app-env";

/**
 * O Vite carrega `.env.local` também no `vite build`, então um arquivo local
 * apontando para 127.0.0.1 virava, em silêncio, um bundle de produção que só
 * funciona na máquina de quem compilou. Aqui essa build falha na hora.
 * Para compilar contra o banco local de propósito, use `npm run build:dev`.
 */
function assertProductionSupabase(mode: string) {
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  const problem = productionBuildProblem({
    VITE_SUPABASE_URL: env.VITE_SUPABASE_URL,
    SUPABASE_URL: env.SUPABASE_URL,
  });
  if (problem) {
    throw new Error(
      `[build] Build de produção recusada: o Supabase não é o de produção — ${problem}.\n` +
        "Remova a URL local do .env.local (use .env.development.local, que só vale no `vite dev`) " +
        "ou rode `npm run build:dev` para uma build local intencional.",
    );
  }
}

const config = {
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      server: { entry: "server" },
    }),
    react(),
  ],
  resolve: {
    alias: {
      "@": "/src",
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  server: {
    host: "::",
    port: 8080,
  },
} satisfies UserConfig;

export default defineConfig(({ command, mode }) => {
  if (command === "build" && mode === "production") assertProductionSupabase(mode);
  return config;
});
