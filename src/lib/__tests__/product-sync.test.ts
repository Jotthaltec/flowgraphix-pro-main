import { describe, expect, it } from "vitest";
import { SYNC_STATUS_DISPLAY, syncStatusDisplay } from "@/lib/product-sync";

describe("syncStatusDisplay", () => {
  it("cobre os oito status do modelo", () => {
    expect(Object.keys(SYNC_STATUS_DISPLAY).sort()).toEqual([
      "archived",
      "attention",
      "error",
      "native",
      "pending",
      "stale",
      "synced",
      "syncing",
    ]);
  });

  it("só 'synced' aparece como sucesso", () => {
    const green = Object.entries(SYNC_STATUS_DISPLAY).filter(([, d]) => d.variant === "success");
    expect(green.map(([s]) => s)).toEqual(["synced"]);
  });

  it("desatualizado e erro nunca parecem sincronizados", () => {
    expect(syncStatusDisplay("stale").variant).toBe("warning");
    expect(syncStatusDisplay("error").variant).toBe("destructive");
  });

  it("status inesperado é sinalizado, não escondido", () => {
    expect(syncStatusDisplay("removed")).toEqual({
      label: "Status desconhecido",
      variant: "destructive",
    });
    expect(syncStatusDisplay(undefined).variant).toBe("destructive");
  });
});
