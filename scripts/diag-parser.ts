import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseFuturaImProduct } from "@/services/futuraImParser";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dir = join(__dirname, "..", "src", "services", "__tests__", "fixtures");

for (const f of readdirSync(dir).filter((f) => f.endsWith(".html"))) {
  const html = readFileSync(join(dir, f), "utf8");
  const p = parseFuturaImProduct(html, `https://www.futuraim.com.br/produto/${f.replace(/\.html$/, "")}?id=1`);
  console.log("\n=====", f, "=====");
  console.log("name:", JSON.stringify(p.original_name));
  console.log("external_id:", p.external_id, "| available:", p.available);
  const tiers = p.variants[0]?.price_tiers || [];
  console.log("price_tiers:", tiers.length, "->", tiers.map((t) => `${t.quantity}=R$${t.total_price}`).join(", "));
  console.log("variant_axes:", p.variant_axes.length, "scan_status:", p.variant_scan_status);
  for (const a of p.variant_axes) {
    console.log(
      `  - ${a.name} (${a.options.length}): ` +
        a.options
          .map((o) => `${o.value}${o.external_id ? "#" + o.external_id : ""}${o.selected ? "*" : ""}`)
          .slice(0, 10)
          .join(" | ") +
        (a.options.length > 10 ? " ..." : ""),
    );
  }
  console.log("extras:", p.extras.length, "| images:", p.images.length, "| templates:", p.templates.length);
  console.log("warnings:", p.warnings.length ? p.warnings.join(" ;; ") : "(none)");
  console.log("errors:", p.errors.length ? p.errors.join(" ;; ") : "(none)");
}
