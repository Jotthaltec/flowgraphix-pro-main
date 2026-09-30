// Admin da loja (site :3001) na homologação. Uso: node admin.cjs <etapa> [args]
const { chromium } = require("playwright");
const fs = require("fs");
const SHOTS = __dirname + "/shots";
const STATE = __dirname + "/admin-state.json";
const SITE = "http://localhost:3001";

async function shot(page, name) {
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
  console.log(`[print] ${name} — ${page.url()}`);
}

(async () => {
  const [step, ...args] = process.argv.slice(2);
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    storageState: fs.existsSync(STATE) ? STATE : undefined,
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("[pageerror]", e.message.slice(0, 240)));
  page.on("dialog", async (d) => {
    console.log("[dialog]", d.type(), d.message().slice(0, 200));
    await d.accept(args[1] ?? "");
  });

  await page.goto(`${SITE}/admin`, { waitUntil: "networkidle" });
  if (page.url().includes("/entrar")) {
    await page.fill('input[type="email"]', "dono@homolog.local");
    await page.fill('input[type="password"]', "Homolog#2026");
    await Promise.all([
      page.waitForURL((u) => !u.pathname.startsWith("/entrar"), { timeout: 60000 }),
      page.click('button[type="submit"]'),
    ]);
    await page.goto(`${SITE}/admin`, { waitUntil: "networkidle" });
  }

  if (step === "pedido") {
    // node admin.cjs pedido <order-id> [clicar "Texto do botão"]
    const [orderId, , click] = args;
    await page.goto(`${SITE}/admin/pedidos/${orderId}`, { waitUntil: "networkidle" });
    if (click) {
      await page.click(`button:has-text("${click}")`);
      await page.waitForTimeout(1500);
      const confirm = page
        .locator('[role="dialog"] button, [role="alertdialog"] button')
        .filter({ hasText: new RegExp(click.split(" ")[0], "i") });
      if (await confirm.count()) {
        await confirm.last().click();
      }
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2500);
    }
    await shot(page, `20-admin-pedido${click ? "-" + click.replace(/\W+/g, "-") : ""}`);
    const main = page.locator("main").last();
    console.log((await main.innerText()).slice(0, 2500));
    const botoes = await page.locator("main button").allTextContents();
    console.log("botões:", botoes.map((b) => b.trim()).filter(Boolean));
  }

  if (step === "situacao") {
    // node admin.cjs situacao <order-id> <status>
    const [orderId, status] = args;
    await page.goto(`${SITE}/admin/pedidos/${orderId}`, { waitUntil: "networkidle" });
    await page.selectOption("select#status", status);
    await page.click('button:has-text("Salvar situação")');
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2500);
    const toast = await page.locator("[data-sonner-toast]").allTextContents();
    console.log(`situação -> ${status}:`, toast.join(" | ") || "(sem aviso)");
    await shot(page, `21-admin-situacao-${status}`);
  }

  await context.storageState({ path: STATE });
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
