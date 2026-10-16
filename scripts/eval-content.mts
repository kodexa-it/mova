// Corre el set de evaluación de la etapa 3 contra el modelo real.
//
//   npm run eval:content -- --kodexa=<slug-del-workspace-de-kodexa> [--only=cafe] [--limit=5]
//
// Necesita ANTHROPIC_API_KEY en .env. Cada caso genera una pieza con los mismos
// prompts de producción, corre los validadores y anota tokens y costo. El
// resultado queda en eval/results/<fecha>.json y un resumen en .md para que una
// persona de Kodexa marque cuáles aprobaría sin editar. No escribe en la base.
import "dotenv/config";

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { getPrisma } from "../lib/prisma";
import { extractJson } from "../modules/ai/json";
import { costMicros, formatUsd } from "../modules/ai/pricing";
import { createAnthropicProvider } from "../modules/ai/providers/anthropic";
import { FORMAT_SCHEMAS, type AnyContent, type Format } from "../modules/content/formats";
import { piecePrompt, PROMPT_VERSION, SYSTEM_PROMPT, type BrandContext } from "../modules/content/prompts";
import { validateContent } from "../modules/content/validators";

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=") as [string, string]));
const key = process.env.ANTHROPIC_API_KEY;
if (!key) {
  console.error("Falta ANTHROPIC_API_KEY en .env.");
  process.exit(1);
}
const model = process.env.AI_MODEL_FAST ?? "claude-haiku-5-5";
const provider = createAnthropicProvider(key);

const testBrands = JSON.parse(readFileSync("eval/brands.json", "utf8")) as Record<string, BrandContext>;
const { cases } = JSON.parse(readFileSync("eval/cases.json", "utf8")) as {
  cases: { id: string; brand: string; format: Format; title: string; pillar: string; angle: string }[];
};

async function kodexaBrand(slug: string | undefined): Promise<BrandContext | null> {
  if (!slug) return null;
  const prisma = getPrisma();
  const order = { orderBy: { position: "asc" as const } };
  const brand = await prisma.brand.findFirst({
    where: { workspace: { slug } },
    include: { voice: true, offerings: order, audiences: order, goals: order, pillars: order, proofs: order, rules: order },
  });
  await prisma.$disconnect();
  return brand;
}

const kodexa = await kodexaBrand(args.kodexa);
const selected = cases.filter((c) => (!args.only || c.brand === args.only) && (c.brand !== "kodexa" || kodexa)).slice(0, Number(args.limit ?? cases.length));
if (!kodexa) console.warn("Sin --kodexa=<slug>: se omiten los casos de Kodexa.");

interface EvalResult {
  id: string;
  format: Format;
  title: string;
  verdict: string;
  costMicros?: number;
  [key: string]: unknown;
}

const results: EvalResult[] = [];
let total = 0;
for (const c of selected) {
  const brand = c.brand === "kodexa" ? kodexa! : testBrands[c.brand]!;
  const prompt = piecePrompt(brand, { format: c.format, title: c.title, pillar: c.pillar, goal: null, angle: c.angle, instructions: "", currentContent: null });
  const started = Date.now();
  try {
    const res = await provider.complete({ model, system: SYSTEM_PROMPT, messages: [{ role: "user", content: prompt }], maxTokens: 2500 });
    const cost = costMicros(model, res.inputTokens, res.outputTokens);
    total += cost;
    const parsed = FORMAT_SCHEMAS[c.format].safeParse(extractJson(res.text));
    const report = parsed.success ? validateContent(c.format, parsed.data as AnyContent, { wordsToAvoid: brand.voice?.wordsToAvoid ?? [] }) : null;
    results.push({ ...c, ok: parsed.success, verdict: report?.verdict ?? "invalid", checks: report?.checks ?? [], content: parsed.success ? parsed.data : res.text, inputTokens: res.inputTokens, outputTokens: res.outputTokens, costMicros: cost, ms: Date.now() - started });
    console.info(`${c.id.padEnd(12)} ${c.format.padEnd(10)} ${report?.verdict ?? "inválida"}  ${formatUsd(cost)}`);
  } catch (error) {
    results.push({ ...c, ok: false, verdict: "error", error: error instanceof Error ? error.message : String(error) });
    console.info(`${c.id.padEnd(12)} error`);
  }
}

mkdirSync("eval/results", { recursive: true });
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
writeFileSync(`eval/results/${stamp}.json`, JSON.stringify({ model, promptVersion: PROMPT_VERSION, totalMicros: total, results }, null, 2));

const byVerdict = (v: string) => results.filter((r) => r.verdict === v).length;
const md = [
  `# Evaluación de piezas ${stamp}`,
  "",
  `Modelo: ${model}. Prompt: ${PROMPT_VERSION}. Casos: ${results.length}. Costo total: ${formatUsd(total)} (promedio ${formatUsd(Math.round(total / Math.max(results.length, 1)))} por pieza).`,
  "",
  `Revisión automática: ${byVerdict("ready")} listas, ${byVerdict("review")} con sugerencias, ${byVerdict("fix")} para corregir, ${byVerdict("invalid") + byVerdict("error")} inválidas o con error.`,
  "",
  "Marcá en la última columna si la aprobarías sin editar (sí/no).",
  "",
  "| Caso | Formato | Tema | Revisión | Costo | ¿Aprobada sin editar? |",
  "|---|---|---|---|---|---|",
  ...results.map((r) => `| ${r.id} | ${r.format} | ${r.title} | ${r.verdict} | ${r.costMicros === undefined ? "-" : formatUsd(r.costMicros)} |  |`),
].join("\n");
writeFileSync(`eval/results/${stamp}.md`, md);
console.info(`\nResultados en eval/results/${stamp}.json y .md. Costo total: ${formatUsd(total)}.`);
