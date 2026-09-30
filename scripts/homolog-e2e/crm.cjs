// Lado do CRM na homologação local (:8080). Uso: node crm.cjs <etapa> [args]
const { chromium } = require("playwright");
const fs = require("fs");
const SHOTS = __dirname + "/shots";
const STATE = __dirname + "/crm-state.json";
const CRM = "http://localhost:8080";

async function shot(page, name) {
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
  console.log(`[print] ${name} — ${page.url()}`);
}

async function login(page) {
  await page.goto(`${CRM}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', "dono@homolog.local");
  await page.fill('input[type="password"]', "Homolog#2026");
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60000 }),
    page.click('button:has-text("Entrar")'),
  ]);
  await page.waitForLoadState("networkidle");
}

(async () => {
  const [step, ...args] = process.argv.slice(2);
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    storageState: fs.existsSync(STATE) ? STATE : undefined,
  });
  const page = await context.newPage();
  page.on(
    "console",
    (m) => m.type() === "error" && console.log("[console]", m.text().slice(0, 240)),
  );
  page.on("pageerror", (e) => console.log("[pageerror]", e.message.slice(0, 240)));

  await page.goto(`${CRM}/dashboard`, { waitUntil: "networkidle" });
  if (page.url().includes("/login")) await login(page);

  if (step === "ver") {
    // node crm.cjs ver <nome> <rota> — print e texto principal de uma tela
    const [name, route] = args;
    await page.goto(`${CRM}${route}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await shot(page, name);
    console.log((await page.locator("main").last().innerText()).slice(0, 2500));
  }

  await context.storageState({ path: STATE });
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
