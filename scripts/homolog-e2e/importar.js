// Importação pelo CRM na homologação: link do fornecedor -> analisar ->
// "Salvar e publicar na Nexus". Uso: node importar.js <url do fornecedor>
const { chromium } = require("playwright");
const SHOTS = __dirname + "/shots";

(async () => {
  const url = process.argv[2];
  const browser = await chromium.launch();
  const context = await browser.newContext({ storageState: __dirname + "/crm-state.json", viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("[pageerror]", e.message.slice(0, 200)));
  page.on("dialog", async (d) => {
    console.log("[pergunta]", d.message().replace(/\s+/g, " ").slice(0, 200), "-> OK");
    await d.accept();
  });

  await page.goto("http://localhost:8080/produtos/importar", { waitUntil: "networkidle" });
  const link = page.getByPlaceholder(/futuraim|https/i).first();
  await link.fill(url);
  const t0 = Date.now();
  await page.click('button:has-text("Analisar")');
  // Análise terminada: o item sai de "Analisando" e o botão de salvar aparece.
  await page.waitForFunction(() => document.body.innerText.includes("Analisado"), null, { timeout: 600000 });
  console.log(`análise: ${Math.round((Date.now() - t0) / 1000)} s`);
  await page.screenshot({ path: `${SHOTS}/71-importador-analisado.png`, fullPage: true });

  await page.click('button[aria-label="Destino dos produtos"]');
  await page.click('[role="option"]:has-text("Salvar e publicar na Nexus")');
  // O seletor também mostra o rótulo: clicar pelo papel e nome exatos do botão.
  await page.getByRole("button", { name: "Salvar e publicar na Nexus", exact: true }).click();
  await page.waitForFunction(
    () => /Publicado|publicação falhou|Erro/.test(document.body.innerText) && !/Salvando|Publicando/.test(document.body.innerText),
    null,
    { timeout: 600000 },
  );
  await page.waitForTimeout(1500);
  const toasts = await page.locator("[data-sonner-toast]").allTextContents();
  console.log("avisos:", toasts.map((t) => t.replace(/\s+/g, " ")).join(" | "));
  const status = await page.locator("text=/Publicado|Salvo, publicação falhou|Erro/").first().textContent();
  console.log("status do item:", status);
  const loja = await page.locator('a:has-text("Abrir na loja")').first().getAttribute("href").catch(() => null);
  console.log("link da loja:", loja);
  await page.screenshot({ path: `${SHOTS}/72-importador-publicado.png`, fullPage: true });
  await browser.close();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
