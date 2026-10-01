import { z } from "zod";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

export const campaignCopySchema = z.object({
  eyebrow: z.string().min(1).max(40),
  headline: z.string().min(1).max(90),
  supporting_line: z.string().min(1).max(110),
  cta: z.string().min(1).max(45),
  caption: z.string().min(1).max(1800),
  hashtags: z
    .array(z.string().regex(/^#[\p{L}\p{N}_]+$/u))
    .min(3)
    .max(12),
});

export type CampaignCopy = z.infer<typeof campaignCopySchema>;

export interface ProductFacts {
  name: string;
  shortDescription: string | null;
  description: string | null;
  benefits: string[];
  materials: string[];
  applications: string[];
  price: number;
  priceUnit: string;
  minQuantity: number;
  productionDays: number;
  onSale: boolean;
}

interface OpenAIConfig {
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
}

const outputSchema = {
  type: "object",
  properties: {
    eyebrow: { type: "string", minLength: 1, maxLength: 40 },
    headline: { type: "string", minLength: 1, maxLength: 90 },
    supporting_line: { type: "string", minLength: 1, maxLength: 110 },
    cta: { type: "string", minLength: 1, maxLength: 45 },
    caption: { type: "string", minLength: 1, maxLength: 1800 },
    hashtags: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 12 },
  },
  required: ["eyebrow", "headline", "supporting_line", "cta", "caption", "hashtags"],
  additionalProperties: false,
} as const;

function extractOutputText(payload: unknown): string {
  const parsed = z
    .object({
      output: z.array(
        z
          .object({
            content: z
              .array(z.object({ type: z.string(), text: z.string().optional() }).passthrough())
              .optional(),
          })
          .passthrough(),
      ),
    })
    .parse(payload);

  for (const item of parsed.output) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && content.text) return content.text;
    }
  }
  throw new Error("A OpenAI respondeu sem o texto estruturado da campanha.");
}

export function createCampaignCopyGenerator(config: OpenAIConfig) {
  const doFetch = config.fetchImpl ?? fetch;
  return async function generate(facts: ProductFacts): Promise<CampaignCopy> {
    const response = await doFetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${config.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: config.model ?? "gpt-5.4-mini",
        input: [
          {
            role: "developer",
            content:
              "Você cria campanhas da Nexus Printi em português do Brasil. Use somente os fatos enviados. Nunca invente material, preço, prazo, desconto, acabamento ou benefício. Escreva com clareza comercial, sem promessas absolutas. O CTA deve pedir orçamento.",
          },
          {
            role: "user",
            content: `Crie o texto de uma campanha de lançamento para este cadastro real:\n${JSON.stringify(facts)}`,
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "nexus_social_campaign",
            strict: true,
            schema: outputSchema,
          },
        },
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `OpenAI recusou a geração (HTTP ${response.status}): ${detail.slice(0, 500)}`,
      );
    }
    return campaignCopySchema.parse(JSON.parse(extractOutputText(await response.json())));
  };
}

export function generateCampaignCopy(facts: ProductFacts) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY não está configurada na Vercel.");
  return createCampaignCopyGenerator({
    apiKey,
    model: process.env.OPENAI_SOCIAL_MODEL || "gpt-5.4-mini",
  })(facts);
}
