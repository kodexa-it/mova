import "server-only";

import { createHash } from "node:crypto";

import { Prisma } from "@prisma/client";
import { z } from "zod";

import { badRequest, conflict, HttpError, notFound } from "@/lib/http";
import { getPrisma } from "@/lib/prisma";
import { requirePermission, type WorkspaceContext } from "@/modules/access/context";
import { monthStart } from "@/modules/ai/gateway";
import { AiProviderError } from "@/modules/ai/providers/types";
import { recordAudit } from "@/modules/audit/service";
import { FORMAT_SCHEMAS, type AnyContent } from "@/modules/content/formats";
import { ART_LAYOUTS, LAYOUT_SPECS, slotsOf, type ArtLayoutId } from "@/modules/content/layouts";
import { framesOf, sizeOf } from "@/modules/content/render/frames";
import { statusAfterEdit } from "@/modules/content/status";
import { estimateImageMicros, IMAGE_PRICES, IMAGE_PRICES_CHECKED, imageCostMicros, reserveImageMicros, type AspectRatio, type ImageSize } from "@/modules/images/pricing";
import { buildArtPrompt, imageDimensions, promptHash } from "@/modules/images/prompt";
import { getImageProvider } from "@/modules/images/providers/registry";

// Generación de imágenes con IA (modo premium). Garantías:
// - Nunca se llama al proveedor sin una confirmación explícita de esta
//   operación: el pedido trae el costo estimado que la persona vio (si cambió,
//   409) y una clave única (un doble clic no cobra dos veces).
// - Antes de llamar se reserva el costo bajo un lock por workspace y se
//   compara con el límite mensual de imágenes; si no alcanza, se registra el
//   bloqueo y no se llama.
// - Se registra proveedor, modelo, consumo, costo estimado y costo real.
// - La imagen no cambia la pieza: queda disponible para elegirla y guardar una
//   versión nueva (lo que invalida la aprobación anterior).

export const artInputSchema = z.object({
  content: z.unknown(),
  index: z.number().int().min(0).max(20),
  layout: z.enum(ART_LAYOUTS),
  brief: z.string().trim().max(300).default(""),
});
export type ArtInput = z.infer<typeof artInputSchema>;

export const generateSchema = artInputSchema.extend({
  requestKey: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/),
  confirmMicros: z.number().int().positive(),
});

const PUBLIC_CODES: Record<string, string> = {
  provider_auth: "images_auth",
  provider_no_credits: "images_no_credits",
  provider_rejected: "images_rejected",
  provider_model_not_found: "images_rejected",
  provider_rate_limited: "images_rate_limited",
};

export function sizeForLayout(layout: ArtLayoutId): ImageSize {
  // A sangre se ve a pantalla completa: 2K. En un panel alcanza con 1K.
  return layout === "art-cover" ? "2K" : "1K";
}

async function prepare(ctx: WorkspaceContext, itemId: string, input: ArtInput) {
  requirePermission(ctx, "content.write");
  const prisma = getPrisma();
  const item = await prisma.contentItem.findFirst({ where: { id: itemId, workspaceId: ctx.workspace.id }, select: { id: true, format: true, status: true, visualMode: true } });
  if (!item) throw notFound();
  if (item.visualMode !== "AI") throw conflict("visual_mode_standard");
  if (statusAfterEdit(item.status) === "locked") throw conflict("content_locked");
  // El texto de la imagen es el que se está editando (puede no estar guardado).
  const parsed = FORMAT_SCHEMAS[item.format].safeParse(input.content);
  if (!parsed.success) throw badRequest();
  const content = parsed.data as AnyContent;
  const ref = slotsOf(item.format, content as unknown as Record<string, unknown>)[input.index];
  const frame = framesOf(item.format, content)[input.index];
  if (!ref || !frame) throw badRequest();
  if (!LAYOUT_SPECS[input.layout].roles.includes(ref.slot.role)) throw badRequest("layout_not_allowed");

  const brand = await prisma.brand.findUnique({
    where: { workspaceId: ctx.workspace.id },
    select: { industry: true, description: true, visual: { select: { palette: true, imageStyle: true } }, audiences: { orderBy: { position: "asc" }, select: { name: true } } },
  });
  const aspectRatio: AspectRatio = sizeOf(frame).height > 1500 ? "9:16" : "4:5";
  const imageSize = sizeForLayout(input.layout);
  const prompt = buildArtPrompt({
    brand: {
      industry: brand?.industry ?? "",
      description: brand?.description ?? "",
      imageStyle: brand?.visual?.imageStyle ?? "",
      palette: Array.isArray(brand?.visual?.palette) ? (brand!.visual!.palette as unknown as { name: string; hex: string }[]) : [],
      audiences: brand?.audiences.map((a) => a.name) ?? [],
    },
    slot: ref.slot,
    layout: input.layout,
    aspectRatio,
    brief: input.brief,
  });
  const configured = getImageProvider();
  const model = configured?.model ?? null;
  const estimate = model ? estimateImageMicros(model, prompt.length, imageSize) : null;
  return { item, prompt, aspectRatio, imageSize, configured, model, estimate, hash: model ? promptHash(model, aspectRatio, imageSize, prompt) : null };
}

export async function imageSpendMicros(workspaceId: string, db: Pick<Prisma.TransactionClient, "imageGeneration"> = getPrisma()) {
  const rows = await db.imageGeneration.groupBy({
    by: ["status"],
    where: { workspaceId, createdAt: { gte: monthStart() } },
    _sum: { costMicros: true, reservedMicros: true },
  });
  return rows.reduce((total, row) => total + (row.status === "PENDING" ? row._sum.reservedMicros ?? 0 : row._sum.costMicros ?? 0), 0);
}

async function budgetOf(workspaceId: string) {
  const [workspace, spent] = await Promise.all([
    getPrisma().workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { imageMonthlyBudgetMicros: true } }),
    imageSpendMicros(workspaceId),
  ]);
  return { limitMicros: workspace.imageMonthlyBudgetMicros, spentMicros: spent, remainingMicros: Math.max(0, workspace.imageMonthlyBudgetMicros - spent) };
}

// Costo estimado y estado antes de confirmar. No llama al proveedor.
export async function quoteArt(ctx: WorkspaceContext, itemId: string, input: ArtInput) {
  const prep = await prepare(ctx, itemId, input);
  const budget = await budgetOf(ctx.workspace.id);
  // Imágenes ya generadas para este mismo pedido: se pueden reutilizar gratis.
  const reusable = prep.hash
    ? await getPrisma().imageGeneration.findMany({
        where: { workspaceId: ctx.workspace.id, itemId, promptHash: prep.hash, status: "SUCCEEDED", assetId: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { createdAt: true, asset: { select: { id: true, sha256: true } } },
      })
    : [];
  const price = prep.model ? IMAGE_PRICES[prep.model]! : null;
  return {
    configured: Boolean(prep.configured),
    provider: price ? "Google Gemini API" : null,
    model: price?.label ?? null,
    aspectRatio: prep.aspectRatio,
    imageSize: prep.imageSize,
    estimateMicros: prep.estimate,
    reserveMicros: prep.estimate ? reserveImageMicros(prep.estimate) : null,
    // La estimación sale del precio publicado por imagen; el costo final se
    // calcula con los tokens que informe el proveedor.
    precision: price
      ? `Precio publicado por Google (consultado el ${IMAGE_PRICES_CHECKED}): USD ${price.perImage[prep.imageSize].toFixed(3)} por imagen ${prep.imageSize}, más el texto del pedido. El costo final se calcula con el consumo que informe Google; puede variar levemente.`
      : null,
    budget,
    blocked: prep.estimate !== null && budget.spentMicros + reserveImageMicros(prep.estimate) > budget.limitMicros,
    reusable: reusable.flatMap((r) => (r.asset ? [{ assetId: r.asset.id, sha256: r.asset.sha256, createdAt: r.createdAt }] : [])),
  };
}

// Genera una imagen (llamada paga) después de la confirmación explícita.
export async function generateArt(ctx: WorkspaceContext, itemId: string, input: z.infer<typeof generateSchema>, ipAddress: string | null) {
  const prep = await prepare(ctx, itemId, input);
  if (!prep.configured || !prep.model || prep.estimate === null || !prep.hash) throw new HttpError(503, "images_not_configured");
  if (input.confirmMicros !== prep.estimate) throw conflict("estimate_changed");
  const prisma = getPrisma();

  // Idempotencia: la misma confirmación nunca genera (ni cobra) dos veces.
  const previous = await prisma.imageGeneration.findUnique({
    where: { workspaceId_requestKey: { workspaceId: ctx.workspace.id, requestKey: input.requestKey } },
    select: { status: true, itemId: true, costMicros: true, costSource: true, estimatedMicros: true, asset: { select: { id: true, sha256: true, width: true, height: true } } },
  });
  if (previous) {
    if (previous.status === "SUCCEEDED" && previous.asset && previous.itemId === itemId) return { asset: previous.asset, costMicros: previous.costMicros, costSource: previous.costSource, estimateMicros: previous.estimatedMicros, reused: true };
    throw conflict(previous.status === "PENDING" ? "generation_in_progress" : "request_used");
  }

  const { provider } = prep.configured;
  const reserve = reserveImageMicros(prep.estimate);
  const base = {
    workspaceId: ctx.workspace.id,
    itemId,
    userId: ctx.user.id,
    slotIndex: input.index,
    layout: input.layout,
    requestKey: input.requestKey,
    promptHash: prep.hash,
    prompt: prep.prompt,
    provider: provider.name,
    model: prep.model,
    aspectRatio: prep.aspectRatio,
    imageSize: prep.imageSize,
    estimatedMicros: prep.estimate,
  };

  let reservation: { id: string } | null;
  try {
    reservation = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`image-budget:${ctx.workspace.id}`}))`;
      const workspace = await tx.workspace.findUniqueOrThrow({ where: { id: ctx.workspace.id }, select: { imageMonthlyBudgetMicros: true } });
      const spent = await imageSpendMicros(ctx.workspace.id, tx);
      if (spent + reserve > workspace.imageMonthlyBudgetMicros) {
        await tx.imageGeneration.create({ data: { ...base, status: "BLOCKED", errorCode: "budget_exhausted", finishedAt: new Date() } });
        return null;
      }
      return tx.imageGeneration.create({ data: { ...base, status: "PENDING", reservedMicros: reserve }, select: { id: true } });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw conflict("generation_in_progress");
    throw error;
  }
  if (!reservation) throw new HttpError(402, "images_budget_exhausted");

  const started = Date.now();
  let result: Awaited<ReturnType<typeof provider.generate>>;
  try {
    result = await provider.generate({ model: prep.model, prompt: prep.prompt, aspectRatio: prep.aspectRatio, imageSize: prep.imageSize });
  } catch (error) {
    const code = error instanceof AiProviderError ? error.code : "unexpected";
    console.error(`[imagenes] ${prep.model} falló: ${code}${error instanceof AiProviderError && error.detail ? ` (${error.detail})` : ""}`);
    await prisma.imageGeneration.update({ where: { id: reservation.id }, data: { status: "FAILED", errorCode: code, durationMs: Date.now() - started, finishedAt: new Date() } });
    throw new HttpError(502, PUBLIC_CODES[code] ?? "images_failed");
  }

  const size = imageDimensions(result.bytes);
  const sha256 = createHash("sha256").update(result.bytes).digest("hex");
  const costMicros = result.usage ? imageCostMicros(prep.model, result.usage.inputTokens, result.usage.outputTokens) : prep.estimate;
  const costSource = result.usage ? "usage" : "estimate";
  const asset = await prisma.$transaction(async (tx) => {
    const created = await tx.imageAsset.create({
      data: { workspaceId: ctx.workspace.id, itemId, slotIndex: input.index, sha256, mimeType: result.mimeType, width: size?.width ?? 0, height: size?.height ?? 0, bytes: Buffer.from(result.bytes) },
      select: { id: true, sha256: true, width: true, height: true },
    });
    await tx.imageGeneration.update({
      where: { id: reservation.id },
      data: {
        status: "SUCCEEDED",
        assetId: created.id,
        inputTokens: result.usage?.inputTokens ?? 0,
        outputTokens: result.usage?.outputTokens ?? 0,
        costMicros,
        costSource,
        durationMs: Date.now() - started,
        finishedAt: new Date(),
      },
    });
    await recordAudit(tx, {
      workspaceId: ctx.workspace.id,
      actorUserId: ctx.user.id,
      action: "content.art_generated",
      targetType: "content",
      targetId: itemId,
      metadata: { slot: input.index, layout: input.layout, model: prep.model, costMicros, costSource },
      ipAddress,
    });
    return created;
  });
  if (!size) console.warn(`[imagenes] no se pudo leer el tamaño de la imagen ${asset.id}`);
  return { asset, costMicros, costSource, estimateMicros: prep.estimate, reused: false };
}

// Imágenes generadas de una pieza (para volver a elegir una sin costo).
export async function listArt(ctx: WorkspaceContext, itemId: string) {
  requirePermission(ctx, "workspace.read");
  const prisma = getPrisma();
  const item = await prisma.contentItem.findFirst({ where: { id: itemId, workspaceId: ctx.workspace.id }, select: { id: true } });
  if (!item) throw notFound();
  return prisma.imageAsset.findMany({
    where: { workspaceId: ctx.workspace.id, itemId },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: { id: true, sha256: true, slotIndex: true, width: true, height: true, createdAt: true, generation: { select: { layout: true, costMicros: true, model: true } } },
  });
}

export async function readArt(ctx: WorkspaceContext, itemId: string, assetId: string) {
  requirePermission(ctx, "workspace.read");
  const asset = await getPrisma().imageAsset.findFirst({ where: { id: assetId, itemId, workspaceId: ctx.workspace.id }, select: { bytes: true, mimeType: true } });
  if (!asset) throw notFound();
  return asset;
}

// ─── Uso y límite mensual ───────────────────────────────────────────────────

export async function getImageUsage(ctx: WorkspaceContext) {
  requirePermission(ctx, "usage.read");
  const [budget, generations] = await Promise.all([
    budgetOf(ctx.workspace.id),
    getPrisma().imageGeneration.findMany({
      where: { workspaceId: ctx.workspace.id, createdAt: { gte: monthStart() } },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, model: true, status: true, aspectRatio: true, imageSize: true, estimatedMicros: true, costMicros: true, costSource: true, inputTokens: true, outputTokens: true, durationMs: true, errorCode: true, createdAt: true, itemId: true },
    }),
  ]);
  return { ...budget, configured: Boolean(getImageProvider()), generations };
}

export const MAX_IMAGE_BUDGET_USD = 500;

export async function setImageBudget(ctx: WorkspaceContext, usd: number, ipAddress: string | null) {
  requirePermission(ctx, "workspace.update");
  if (!Number.isFinite(usd) || usd < 0 || usd > MAX_IMAGE_BUDGET_USD) throw badRequest();
  const micros = Math.round(usd * 1_000_000);
  await getPrisma().$transaction(async (tx) => {
    const before = await tx.workspace.findUniqueOrThrow({ where: { id: ctx.workspace.id }, select: { imageMonthlyBudgetMicros: true } });
    await tx.workspace.update({ where: { id: ctx.workspace.id }, data: { imageMonthlyBudgetMicros: micros } });
    await recordAudit(tx, { workspaceId: ctx.workspace.id, actorUserId: ctx.user.id, action: "usage.image_budget_updated", metadata: { fromMicros: before.imageMonthlyBudgetMicros, toMicros: micros }, ipAddress });
  });
  return { limitMicros: micros };
}

