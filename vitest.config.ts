import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Configuração de testes do importador (e demais serviços puros).
// Usa vite-tsconfig-paths para resolver o alias "@/...".
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
    globals: true,
  },
});
