import "server-only";

import { conflict, HttpError, notFound } from "@/lib/http";
import { getPrisma } from "@/lib/prisma";
import { requirePermission, type WorkspaceContext } from "@/modules/access/context";
import { markCallOutputInvalid, runAi } from "@/modules/ai/gateway";
import { extractJson } from "@/modules/ai/json";
import { getProvider } from "@/modules/ai/providers/registry";
import { brandProgress } from "@/modules/brand/completeness";
import { getBrand, shapeOf } from "@/modules/brand/service";
import { allText, FORMAT_SCHEMAS, type AnyContent, type Format, type FormatContent } from "@/modules/content/formats";
import { isFixable, mergeScopes, scopesFor, type FixScope } from "@/modules/content/fixes";
import { carryDesigns, cleanStyle, styleOf, suggestStyle, withoutDesigns } from "@/modules/content/layouts";
import { piecePrompt, PROMPT_VERSION, SYSTEM_PROMPT } from "@/modules/content/prompts";
import { brandRules, saveVersion } from "@/modules/content/service";
import { statusAfterEdit } from "@/modules/content/status";
import { validateContent } from "@/modules/content/validators";

// Tope de propuestas de la IA por pieza: controla el costo y obliga a decidir.
export const MAX_GENERATIONS = 5;

function fixReel(content: AnyContent): AnyContent {
  const reel = content as FormatContent<"REEL">;
  if (reel.selectedHook >= reel.hooks.length) return { ...reel, selectedHook: 0 };
  return reel;
}

type Plain = Record<string, unknown>;

async function loadForAi(ctx: WorkspaceContext, itemId: string) {
  requirePermission(ctx, "content.write");
  const item = await getPrisma().contentItem.findFirst({
    where: { id: itemId, workspaceId: ctx.workspace.id },
    select: { id: true, format: true, title: true, pillar: true, goal: true, angle: true, status: true, regenerations: true, currentVersion: { select: { content: true } } },
  });
  if (!item) throw notFound();
  if (statusAfterEdit(item.status) === "locked") throw conflict("content_locked");
  const brand = await getBrand(ctx);
  if (!brand || !brandProgress(shapeOf(brand)).isComplete) throw conflict("brand_incomplete");
  return { item, brand, current: (item.currentVersion?.content as AnyContent | undefined) ?? null };
}

// Pide a la IA el contenido completo de la pieza. La IA nunca ve ni devuelve
// composiciones: se le manda el texto sin diseños y lo que devuelva en ese
// campo se descarta (un "dato grande" no puede salir de la IA).
async function askForContent(
  ctx: WorkspaceContext,
  loaded: Awaited<ReturnType<typeof loadForAi>>,
  instructions: string,
  operation: string,
) {
  const { item, brand, current } = loaded;
  const plainCurrent = current ? (withoutDesigns(item.format, current as unknown as Plain) as unknown as AnyContent) : null;
  const currentText = plainCurrent ? allText(item.format, plainCurrent).trim() : "";
  const prompt = piecePrompt(
    {
      name: brand.name,
      industry: brand.industry,
      description: brand.description,
      website: brand.website,
      offerings: brand.offerings,
      audiences: brand.audiences,
      goals: brand.goals,
      pillars: brand.pillars,
      proofs: brand.proofs,
      rules: brand.rules,
      voice: brand.voice,
    },
    {
      format: item.format,
      title: item.title,
      pillar: item.pillar,
      goal: item.goal,
      angle: item.angle,
      instructions,
      currentContent: currentText ? JSON.stringify(plainCurrent) : null,
    },
  );

  const { text, callId } = await runAi(ctx, {
    operation,
    tier: "fast",
    system: `${SYSTEM_PROMPT}\n(Versión del prompt: ${PROMPT_VERSION})`,
    messages: [{ role: "user", content: prompt }],
    maxTokens: 2500,
  });

  const parsed = FORMAT_SCHEMAS[item.format].safeParse(extractJson(text));
  if (!parsed.success) {
    await markCallOutputInvalid(callId);
    throw new HttpError(502, "ai_invalid_output");
  }
  const raw = withoutDesigns(item.format, parsed.data as unknown as Plain) as unknown as AnyContent;
  return { content: item.format === "REEL" ? fixReel(raw) : raw, callId };
}

function proofsOf(brand: Awaited<ReturnType<typeof loadForAi>>["brand"]) {
  return brand.proofs.map((p) => ({ id: p.id, statement: p.statement, source: p.source }));
}

// Pide a la IA una versión de la pieza (nueva o mejorada) y la guarda como
// versión de autoría "IA". La composición de las imágenes se conserva donde
// sigue entrando con el texto nuevo (y si la pieza no tenía, se sugiere sin
// costo). Nunca aprueba ni publica nada.
export async function generatePiece(ctx: WorkspaceContext, itemId: string, instructions: string) {
  const loaded = await loadForAi(ctx, itemId);
  const { item, brand, current } = loaded;
  if (item.regenerations >= MAX_GENERATIONS) throw conflict("generation_limit");

  const { content, callId } = await askForContent(ctx, loaded, instructions, `content.generate.${item.format}`);
  let designed = carryDesigns(item.format, current as unknown as Plain | null, content as unknown as Plain, { proofs: proofsOf(brand) }) as unknown as AnyContent;
  // Primer borrador: toma el estilo que sugiere la marca (por ejemplo, Impacto
  // si su estilo visual lo pide). Después lo decide la persona.
  const firstDraft = !current || !allText(item.format, withoutDesigns(item.format, current as unknown as Plain) as unknown as AnyContent).replace(/\s/g, "");
  if (firstDraft && !styleOf(designed as unknown as Plain)) {
    const style = cleanStyle(suggestStyle({ headingFont: brand.visual?.headingFont, imageStyle: brand.visual?.imageStyle }));
    if (style) designed = { ...designed, style } as AnyContent;
  }

  // Cuenta la propuesta aunque coincida con la versión vigente: el costo ya existió.
  await getPrisma().contentItem.update({ where: { id: item.id }, data: { regenerations: { increment: 1 } } });
  const result = await saveVersion(ctx, item.id, designed, { author: "AI", llmCallId: callId });
  return { ...result, remaining: MAX_GENERATIONS - item.regenerations - 1 };
}

// Corrige sugerencias concretas de la revisión automática. La IA reescribe,
// pero de su respuesta solo se toman los campos que corresponden a cada
// sugerencia (fixes.ts): el resto de la pieza no cambia. No consume una de las
// 5 propuestas; sí presupuesto de IA.
export async function fixPiece(ctx: WorkspaceContext, itemId: string, checkIds: string[]) {
  if (!getProvider()) throw conflict("ai_unavailable");
  const loaded = await loadForAi(ctx, itemId);
  const { item, brand, current } = loaded;
  if (!current) throw conflict("nothing_to_fix");
  const rules = await brandRules(getPrisma(), ctx.workspace.id);
  const report = validateContent(item.format, current, rules);
  const wanted = new Set(checkIds);
  const targets = report.checks.filter((c) => isFixable(c, item.format) && (!wanted.size || wanted.has(c.id)));
  if (!targets.length) throw conflict("nothing_to_fix");

  const scopes = [...new Set(targets.flatMap((c) => scopesFor(c, item.format) ?? []))] as FixScope[];
  const instructions = [
    "Corregí SOLO estos puntos de la revisión automática y dejá todo lo demás exactamente igual:",
    ...targets.map((c) => `- ${c.label}: ${c.detail}`),
    `Solo vas a poder cambiar: ${describeScopes(item.format, scopes)}.`,
    "Si para corregir algo hace falta un dato que no está en los datos reales, usá un {{marcador}}.",
  ].join("\n");
  const { content: proposal, callId } = await askForContent(ctx, loaded, instructions, `content.fix.${item.format}`);
  const merged = mergeScopes(item.format, current, proposal, scopes);
  const designed = carryDesigns(item.format, current as unknown as Plain, merged as unknown as Plain, { proofs: proofsOf(brand) }) as unknown as AnyContent;
  const result = await saveVersion(ctx, item.id, designed, { author: "AI", llmCallId: callId });
  return { ...result, fixed: targets.map((c) => c.label) };
}

function describeScopes(format: Format, scopes: FixScope[]) {
  if (scopes.includes("text")) return "los textos (sin cambiar la cantidad de slides o frames)";
  const names: Record<FixScope, string> = {
    caption: "el caption",
    hashtags: "los hashtags",
    cover: format === "CAROUSEL" ? "el título de la portada" : format === "FEED_IMAGE" ? "el titular" : "los hooks y el texto de portada",
    altText: "el texto alternativo",
    script: "el guion",
    text: "los textos",
  };
  return scopes.map((s) => names[s]).join(", ");
}
