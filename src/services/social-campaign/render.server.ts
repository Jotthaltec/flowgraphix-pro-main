import sharp from "sharp";
import type { CampaignCopy, ProductFacts } from "./openai.server";

export interface RenderInput {
  copy: CampaignCopy;
  product: ProductFacts;
  productImage: Buffer;
  productImageMime: string;
}

function escapeXml(value: string) {
  return value.replace(
    /[<>&"']/g,
    (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[char]!,
  );
}

export function wrapText(text: string, maxCharacters: number, maxLines: number) {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharacters || !current) current = candidate;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[.,;:!?]?$/, "")}…`;
  }
  return lines;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);
}
function linesSvg(lines: string[], x: number, y: number, size: number, height: number) {
  return lines
    .map(
      (line, i) =>
        `<text x="${x}" y="${y + i * height}" class="headline" font-size="${size}">${escapeXml(line)}</text>`,
    )
    .join("");
}
function imageDataUri(buffer: Buffer, mime: string) {
  return `data:${mime};base64,${buffer.toString("base64")}`;
}
function styles() {
  return `<style>.brand,.label,.cta,.chip{font-family:Arial,sans-serif;font-weight:800;letter-spacing:2px}.headline{font-family:Arial,sans-serif;font-weight:900;fill:#07110f}.support,.small{font-family:Arial,sans-serif;fill:#31403c}</style>`;
}
function header() {
  return `<rect width="1080" height="28" fill="#07110f"/><path d="M0 28L28 0h44L44 28zm88 0l28-28h44l-28 28zm88 0l28-28h44l-28 28zm88 0l28-28h44l-28 28zm88 0l28-28h44l-28 28zm88 0l28-28h44l-28 28zm88 0l28-28h44l-28 28zm88 0l28-28h44l-28 28zm88 0l28-28h44l-28 28zm88 0l28-28h44l-28 28zm88 0l28-28h44l-28 28zm88 0l28-28h44l-28 28z" fill="#11d6a2"/>`;
}

function feedSvg(i: RenderInput) {
  const photo = imageDataUri(i.productImage, i.productImageMime);
  const headline = wrapText(i.copy.headline, 24, 3);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">${styles()}<rect width="1080" height="1350" fill="#f5faf8"/><defs><pattern id="g" width="64" height="64" patternUnits="userSpaceOnUse"><path d="M64 0H0V64" fill="none" stroke="#dce7e3" stroke-width="2"/></pattern><clipPath id="p"><rect x="80" y="474" width="920" height="570" rx="38"/></clipPath></defs><rect width="1080" height="1350" fill="url(#g)"/>${header()}<rect x="80" y="72" width="72" height="72" rx="18" fill="#07110f"/><text x="98" y="122" class="brand" font-size="34" fill="#11d6a2">N</text><text x="174" y="118" class="brand" font-size="26" fill="#07110f">NEXUS <tspan fill="#078b70">PRINTI</tspan></text><text x="1000" y="116" text-anchor="end" class="label" font-size="18" fill="#078b70">NOVO PRODUTO</text><text x="80" y="204" class="label" font-size="19" fill="#078b70">${escapeXml(i.copy.eyebrow.toUpperCase())}</text>${linesSvg(headline, 80, 272, 70, 76)}<text x="80" y="440" class="support" font-size="25">${escapeXml(i.copy.supporting_line)}</text><image href="${photo}" x="80" y="474" width="920" height="570" preserveAspectRatio="xMidYMid slice" clip-path="url(#p)"/><rect x="80" y="474" width="920" height="570" rx="38" fill="none" stroke="#fff" stroke-width="8"/><rect x="80" y="1070" width="250" height="56" rx="28" fill="#e4fff6"/><text x="205" y="1106" text-anchor="middle" class="chip" font-size="18" fill="#075c4b">MÍN. ${i.product.minQuantity} ${escapeXml(i.product.priceUnit)}</text><rect x="350" y="1070" width="300" height="56" rx="28" fill="#e4fff6"/><text x="500" y="1106" text-anchor="middle" class="chip" font-size="18" fill="#075c4b">${i.product.productionDays} DIAS DE PRODUÇÃO*</text><text x="80" y="1190" class="label" font-size="17" fill="#52635e">A PARTIR DE</text><text x="80" y="1258" class="headline" font-size="64">${escapeXml(formatMoney(i.product.price))}</text><rect x="615" y="1180" width="385" height="86" rx="32" fill="#11d6a2" transform="translate(10 10)"/><rect x="615" y="1180" width="385" height="86" rx="32" fill="#07110f"/><text x="807" y="1232" text-anchor="middle" class="cta" font-size="19" fill="#fff">${escapeXml(i.copy.cta.toUpperCase())}</text><text x="80" y="1312" class="small" font-size="14">*Preço e prazo sujeitos à configuração e disponibilidade.</text></svg>`;
}

function storySvg(i: RenderInput) {
  const photo = imageDataUri(i.productImage, i.productImageMime);
  const headline = wrapText(i.copy.headline, 20, 4);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">${styles()}<rect width="1080" height="1920" fill="#f5faf8"/><defs><pattern id="g" width="64" height="64" patternUnits="userSpaceOnUse"><path d="M64 0H0V64" fill="none" stroke="#dce7e3" stroke-width="2"/></pattern><clipPath id="p"><rect x="86" y="620" width="908" height="700" rx="44"/></clipPath></defs><rect width="1080" height="1920" fill="url(#g)"/>${header()}<rect x="86" y="110" width="76" height="76" rx="19" fill="#07110f"/><text x="105" y="163" class="brand" font-size="36" fill="#11d6a2">N</text><text x="188" y="160" class="brand" font-size="28" fill="#07110f">NEXUS <tspan fill="#078b70">PRINTI</tspan></text><text x="994" y="158" text-anchor="end" class="label" font-size="18" fill="#078b70">NOVO PRODUTO</text><text x="86" y="266" class="label" font-size="20" fill="#078b70">${escapeXml(i.copy.eyebrow.toUpperCase())}</text>${linesSvg(headline, 86, 350, 76, 80)}<text x="86" y="584" class="support" font-size="26">${escapeXml(i.copy.supporting_line)}</text><image href="${photo}" x="86" y="620" width="908" height="700" preserveAspectRatio="xMidYMid slice" clip-path="url(#p)"/><rect x="86" y="620" width="908" height="700" rx="44" fill="none" stroke="#fff" stroke-width="9"/><rect x="86" y="1352" width="250" height="62" rx="31" fill="#e4fff6"/><text x="211" y="1391" text-anchor="middle" class="chip" font-size="18" fill="#075c4b">MÍN. ${i.product.minQuantity} ${escapeXml(i.product.priceUnit)}</text><rect x="356" y="1352" width="300" height="62" rx="31" fill="#e4fff6"/><text x="506" y="1391" text-anchor="middle" class="chip" font-size="18" fill="#075c4b">${i.product.productionDays} DIAS DE PRODUÇÃO*</text><text x="86" y="1535" class="label" font-size="18" fill="#52635e">A PARTIR DE</text><text x="86" y="1610" class="headline" font-size="68">${escapeXml(formatMoney(i.product.price))}</text><rect x="86" y="1680" width="908" height="108" rx="38" fill="#11d6a2"/><rect x="76" y="1670" width="908" height="108" rx="38" fill="#07110f"/><text x="530" y="1736" text-anchor="middle" class="cta" font-size="22" fill="#fff">${escapeXml(i.copy.cta.toUpperCase())}</text><text x="86" y="1840" class="small" font-size="15">*Preço e prazo sujeitos à configuração e disponibilidade.</text></svg>`;
}

async function render(svg: string, width: number, height: number) {
  const output = await sharp(Buffer.from(svg))
    .png({ compressionLevel: 9 })
    .toBuffer({ resolveWithObject: true });
  if (output.info.width !== width || output.info.height !== height)
    throw new Error(
      `Arte gerada em ${output.info.width}x${output.info.height}; esperado ${width}x${height}.`,
    );
  return output.data;
}
export async function renderCampaign(input: RenderInput) {
  const [feed, story] = await Promise.all([
    render(feedSvg(input), 1080, 1350),
    render(storySvg(input), 1080, 1920),
  ]);
  return { feed, story };
}
