import "server-only";

import { conflict, HttpError, notFound } from "@/lib/http";
import { getPrisma } from "@/lib/prisma";
import { requirePermission, type WorkspaceContext } from "@/modules/access/context";
import { markCallOutputInvalid, runAi } from "@/modules/ai/gateway";
import { extractJson } from "@/modules/ai/json";
import { getProvider } from "@/modules/ai/providers/registry";
import { FORMAT_LABELS, type AnyContent, type Format } from "@/modules/content/formats";
import {
  ICONS,
  usesFile,
  LAYOUT_SPECS,
  LAYOUT_USES,
  LAYOUTS,
  lines,
  optionsFor,
  proofMatchesSlot,
  slotsOf,
  suggestDesigns,
  withDesigns,
  withoutDesigns,
  type ProofSnapshot,
  type SlotRef,
} from "@/modules/content/layouts";
import { designsFromAnswer } from "@/modules/content/compose-answer";
import { contentHash } from "@/modules/content/hash";
import { brandRules, saveVersion } from "@/modules/content/service";
import { statusAfterEdit } from "@/modules/content/status";

export const COMPOSE_PROMPT_VERSION = "composicion-2026-10-15";

const COMPOSE_SYSTEM = [
  "Sos director de arte de Mova. Elegís la composición de cada imagen de una pieza de Instagram a partir de un catálogo cerrado.",
  "No escribís ni cambiás textos: solo elegís layout, íconos, dispositivo y, si corresponde, un dato publicable por su id.",
  "Reglas:",
  "1. Para cada imagen elegí solo entre las opciones que se te dan para esa imagen.",
  "2. Buscá variedad y ritmo: no repitas el mismo layout en imágenes seguidas si hay alternativas; como máximo una frase destacada por pieza.",
  "3. stat solo con un proofId de la lista de esa imagen. Nunca inventes datos ni ids.",
  "4. icon-list: un ícono por línea del texto, del catálogo de íconos, el que mejor represente cada línea.",
  "5. cover-device: device browser o laptop si habla de sitios, páginas o sistemas; phone si habla de apps, WhatsApp o celular.",
  'Respondé solo JSON: {"slots":[{"index":0,"layout":"...","icons":["..."],"device":"...","proofId":"..."}]}. Incluí todas las imágenes.',
].join("\n");

function composePrompt(format: Format, refs: SlotRef[], proofs: ProofSnapshot[]) {
  const describe = (r: SlotRef) => {
    const ctx = { proofs };
    const options = optionsFor(r.slot, ctx);
    const matching = proofs.filter((p) => proofMatchesSlot(p, r.slot));
    const items = lines(r.slot.body);
    return [
      `Imagen ${r.index} (${r.slot.role}):`,
      `  título: ${JSON.stringify(r.slot.title)}`,
      `  texto: ${JSON.stringify(r.slot.body)}${items.length > 1 ? ` (${items.length} líneas)` : ""}`,
      `  opciones: ${options.join(", ")}`,
      matching.length ? `  datos publicables para stat: ${matching.map((p) => `${p.id} = ${JSON.stringify(p.statement)}`).join("; ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  };
  return [
    `Pieza: ${FORMAT_LABELS[format]}.`,
    "Catálogo (para qué sirve cada layout):",
    ...LAYOUTS.filter((id) => !usesFile(id)).map((id) => `- ${id}: ${LAYOUT_USES[id]}`),
    `Íconos: ${ICONS.join(", ")}.`,
    "",
    ...refs.map(describe),
  ].join("\n");
}

export type ComposeMode = "ai" | "auto";

// Mejora la composición: cambia solo los diseños de cada imagen y guarda una
// versión nueva (autoría Mova). Nunca toca textos, caption ni hashtags.
export async function composePiece(ctx: WorkspaceContext, itemId: string, mode: ComposeMode) {
  requirePermission(ctx, "content.write");
  const prisma = getPrisma();
  const item = await prisma.contentItem.findFirst({
    where: { id: itemId, workspaceId: ctx.workspace.id },
    select: { id: true, format: true, status: true, currentVersion: { select: { content: true } } },
  });
  if (!item || !item.currentVersion) throw notFound();
  if (statusAfterEdit(item.status) === "locked") throw conflict("content_locked");

  const content = item.currentVersion.content as unknown as AnyContent;
  const { proofs } = await brandRules(prisma, ctx.workspace.id);
  const refs = slotsOf(item.format, content as unknown as Record<string, unknown>);
  const fallback = suggestDesigns(item.format, content as unknown as Record<string, unknown>, { proofs });

  let designs = fallback;
  let replaced = 0;
  let callId: string | undefined;
  if (mode === "ai") {
    if (!getProvider()) throw conflict("ai_unavailable");
    const result = await runAi(ctx, {
      operation: `content.compose.${item.format}`,
      tier: "fast",
      system: `${COMPOSE_SYSTEM}\n(Versión del prompt: ${COMPOSE_PROMPT_VERSION})`,
      messages: [{ role: "user", content: composePrompt(item.format, refs, proofs) }],
      maxTokens: 800,
    });
    callId = result.callId;
    const answer = designsFromAnswer(extractJson(result.text), refs, proofs, fallback);
    if (!answer) {
      await markCallOutputInvalid(result.callId);
      throw new HttpError(502, "ai_invalid_output");
    }
    designs = answer.designs;
    replaced = answer.replaced;
  }

  // Las imágenes generadas con IA las eligió una persona (y se pagaron): la
  // mejora de composición no las toca.
  designs = designs.map((d, i) => (usesFile(refs[i]?.design?.layout) ? refs[i]!.design : d));
  const next = withDesigns(item.format, content as unknown as Record<string, unknown>, designs) as unknown as AnyContent;
  // Garantía: fuera de los diseños, la pieza es idéntica.
  if (contentHash(withoutDesigns(item.format, next as unknown as Record<string, unknown>)) !== contentHash(withoutDesigns(item.format, content as unknown as Record<string, unknown>))) {
    throw new HttpError(500, "internal_error");
  }
  const result = await saveVersion(ctx, item.id, next, { author: "AI", llmCallId: callId });
  return {
    ...result,
    mode,
    replaced,
    layouts: designs.map((d) => LAYOUT_SPECS[d?.layout ?? "classic"].label),
  };
}
