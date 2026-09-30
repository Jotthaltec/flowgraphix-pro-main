// Jornada do cliente na homologação local (site em :3001, banco local).
// Uso: node cliente.cjs <etapa>   etapas: cadastro | carrinho
const { chromium } = require("playwright");
const fs = require("fs");
const SHOTS = __dirname + "/shots";
const STATE = __dirname + "/cliente-state.json";
const SITE = "http://localhost:3001";
const SLUG = "cartao-de-visita-em-couche-brilho-21ed9d14";
const CLIENTE = {
  nome: "QA Cliente Homologação",
  cpf: "529.982.247-25", // CPF de teste válido
  telefone: "(11) 90000-0000",
  email: "qa.cliente@homolog.local",
  senha: "Homolog#2026",
};

async function shot(page, name) {
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
  console.log(`[print] ${name} — ${page.url()}`);
}

async function fields(page) {
  return page.evaluate(() => {
    const vis = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    return [...document.querySelectorAll("input, select, textarea")].filter(vis).map((el) => {
      const label = el.id ? document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim() : "";
      return `${el.tagName.toLowerCase()}[name=${el.name || "-"} type=${el.type}] ${label || el.placeholder || ""} = ${el.type === "radio" || el.type === "checkbox" ? el.checked : el.value}`;
    });
  });
}

(async () => {
  const step = process.argv[2];
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    storageState: fs.existsSync(STATE) ? STATE : undefined,
  });
  const page = await context.newPage();
  page.on("console", (m) => m.type() === "error" && console.log("[console]", m.text().slice(0, 200)));

  if (step === "cadastro") {
    await page.goto(`${SITE}/cadastro`, { waitUntil: "networkidle" });
    await page.fill('input[name="full_name"]', CLIENTE.nome);
    await page.fill('input[name="document"]', CLIENTE.cpf);
    await page.fill('input[name="phone"]', CLIENTE.telefone);
    await page.fill('input[name="email"]', CLIENTE.email);
    await page.fill('input[name="password"]', CLIENTE.senha);
    await page.fill('input[name="password_confirm"]', CLIENTE.senha);
    await page.click('button[role="checkbox"]');
    await page.click('button:has-text("Criar conta")');
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await shot(page, "01-cadastro-resultado");
    const erro = await page.locator('[role="alert"], .text-destructive').allTextContents();
    console.log("mensagens:", erro.filter(Boolean));
  }

  if (step === "carrinho") {
    await page.goto(`${SITE}/produtos/${SLUG}`, { waitUntil: "networkidle" });
    await page.click('button:has-text("Adicionar ao carrinho")');
    await page.waitForTimeout(2500);
    await shot(page, "02-apos-adicionar");
    await page.goto(`${SITE}/carrinho`, { waitUntil: "networkidle" });
    await shot(page, "03-carrinho");
    await page.goto(`${SITE}/checkout`, { waitUntil: "networkidle" });
    await shot(page, "04-checkout");
    console.log((await fields(page)).join("\n"));
    const botoes = await page.locator("button").allTextContents();
    console.log("botões:", botoes.map((b) => b.trim()).filter(Boolean).slice(0, 30));
  }

  if (step === "pedido") {
    await page.goto(`${SITE}/checkout`, { waitUntil: "networkidle" });
    await Promise.all([
      page.waitForURL(/\/pedido\/.+\/confirmado/, { timeout: 60000 }),
      page.click('button:has-text("Confirmar pedido")'),
    ]);
    await page.waitForLoadState("networkidle");
    await shot(page, "05-pedido-confirmado");
    console.log("confirmado:", page.url());
    // Repetir o envio não pode duplicar: a chave de idempotência é o carrinho.
    await page.goto(`${SITE}/checkout`, { waitUntil: "networkidle" });
    await shot(page, "06-checkout-depois");
  }

  if (step === "painel") {
    await page.goto(`${SITE}/painel/pedidos`, { waitUntil: "networkidle" });
    await shot(page, process.argv[3] || "07-painel-pedidos");
    const link = page.locator('a[href^="/painel/pedidos/"]').first();
    if (await link.count()) {
      await link.click();
      await page.waitForLoadState("networkidle");
      await shot(page, (process.argv[3] || "07-painel-pedidos") + "-detalhe");
      console.log((await page.locator("main").innerText()).slice(0, 1500));
    }
  }

  await context.storageState({ path: STATE });
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
