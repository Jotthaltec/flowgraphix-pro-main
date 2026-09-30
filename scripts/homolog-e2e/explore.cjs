// Exploração: abre páginas, tira print e lista campos/botões visíveis.
const { chromium } = require("playwright");
const SHOTS = __dirname + "/shots";
require("fs").mkdirSync(SHOTS, { recursive: true });

async function describe(page, name) {
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
  const info = await page.evaluate(() => {
    const vis = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    const fields = [...document.querySelectorAll("input, select, textarea")]
      .filter(vis)
      .map((el) => {
        const label = el.id
          ? document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim()
          : "";
        return `${el.tagName.toLowerCase()}[name=${el.name || "-"} type=${el.type || "-"}] ${label || el.placeholder || el.getAttribute("aria-label") || ""}`;
      });
    const buttons = [...document.querySelectorAll("button, a[role=button]")]
      .filter(vis)
      .map((b) => b.textContent.trim().replace(/\s+/g, " "))
      .filter(Boolean)
      .slice(0, 25);
    return {
      title: document.title,
      h1: document.querySelector("h1")?.textContent?.trim(),
      fields,
      buttons,
    };
  });
  console.log(`\n=== ${name}: ${page.url()}\n${JSON.stringify(info, null, 1)}`);
}

(async () => {
  const [, , ...targets] = process.argv;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  for (const t of targets) {
    const [name, url] = t.split("=");
    await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
    await describe(page, name);
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
