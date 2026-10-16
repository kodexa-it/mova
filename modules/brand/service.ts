import "server-only";

import type { Prisma } from "@prisma/client";

import { getPrisma } from "@/lib/prisma";
import { requirePermission, type WorkspaceContext } from "@/modules/access/context";
import { recordAudit } from "@/modules/audit/service";
import { brandProgress, type BrandShape } from "@/modules/brand/completeness";
import { SECTIONS, type SectionInput, type SectionKey } from "@/modules/brand/sections";
import { invalidateForProofChange, invalidateForVisualChange } from "@/modules/review/invalidate";

const ordered = { orderBy: { position: "asc" as const } };

const brandInclude = {
  visual: true,
  voice: true,
  offerings: ordered,
  audiences: ordered,
  goals: ordered,
  pillars: ordered,
  proofs: ordered,
  rules: ordered,
} satisfies Prisma.BrandInclude;

export type BrandProfile = Prisma.BrandGetPayload<{ include: typeof brandInclude }>;

export interface PaletteColor {
  name: string;
  hex: string;
}

export function paletteOf(brand: BrandProfile | null): PaletteColor[] {
  const raw = brand?.visual?.palette;
  return Array.isArray(raw) ? (raw as unknown as PaletteColor[]) : [];
}

export function shapeOf(brand: BrandProfile | null): BrandShape | null {
  if (!brand) return null;
  return {
    name: brand.name,
    industry: brand.industry,
    description: brand.description,
    hasVoice: Boolean(brand.voice),
    paletteCount: paletteOf(brand).length,
    offerings: brand.offerings.length,
    audiences: brand.audiences.length,
    goals: brand.goals.length,
    pillarWeights: brand.pillars.map((p) => p.weight),
    proofs: brand.proofs.length,
    rules: brand.rules.length,
  };
}

// Todos los integrantes ven la marca: es el contexto de todo lo que producen.
export async function getBrand(ctx: WorkspaceContext): Promise<BrandProfile | null> {
  requirePermission(ctx, "workspace.read");
  return getPrisma().brand.findUnique({ where: { workspaceId: ctx.workspace.id }, include: brandInclude });
}

type Tx = Prisma.TransactionClient;

// Crea la marca la primera vez que se guarda cualquier sección. El nombre por
// defecto es el del workspace; la sección Identidad lo reemplaza.
async function ensureBrand(tx: Tx, ctx: WorkspaceContext) {
  return tx.brand.upsert({
    where: { workspaceId: ctx.workspace.id },
    update: {},
    create: { workspaceId: ctx.workspace.id, name: ctx.workspace.name },
    select: { id: true },
  });
}

async function writeSection<K extends SectionKey>(tx: Tx, ctx: WorkspaceContext, brandId: string, key: K, input: SectionInput<K>) {
  const workspaceId = ctx.workspace.id;
  const base = { workspaceId, brandId };
  const withPosition = <T extends object>(items: T[]) => items.map((item, position) => ({ ...base, position, ...item }));

  switch (key) {
    case "identidad": {
      const data = input as SectionInput<"identidad">;
      await tx.brand.update({
        where: { id: brandId },
        data: { ...data, website: data.website || null },
      });
      return;
    }
    case "servicios":
      await tx.offering.deleteMany({ where: { brandId } });
      await tx.offering.createMany({ data: withPosition((input as SectionInput<"servicios">).items) });
      return;
    case "publico":
      await tx.audienceSegment.deleteMany({ where: { brandId } });
      await tx.audienceSegment.createMany({ data: withPosition((input as SectionInput<"publico">).items) });
      return;
    case "objetivos":
      await tx.businessGoal.deleteMany({ where: { brandId } });
      await tx.businessGoal.createMany({ data: withPosition((input as SectionInput<"objetivos">).items) });
      return;
    case "pilares":
      await tx.contentPillar.deleteMany({ where: { brandId } });
      await tx.contentPillar.createMany({ data: withPosition((input as SectionInput<"pilares">).items) });
      return;
    case "datos":
      await tx.proofItem.deleteMany({ where: { brandId } });
      await tx.proofItem.createMany({ data: withPosition((input as SectionInput<"datos">).items) });
      return;
    case "reglas":
      await tx.brandRule.deleteMany({ where: { brandId } });
      await tx.brandRule.createMany({ data: withPosition((input as SectionInput<"reglas">).items) });
      return;
    case "voz": {
      const data = input as SectionInput<"voz">;
      await tx.brandVoice.upsert({ where: { brandId }, update: data, create: { ...base, ...data } });
      return;
    }
    case "visual": {
      const data = input as SectionInput<"visual">;
      const values = { ...data, palette: data.palette as unknown as Prisma.InputJsonValue };
      await tx.brandVisual.upsert({ where: { brandId }, update: values, create: { ...base, ...values } });
      return;
    }
  }
}

// Guarda una sección completa (reemplaza su contenido) y, si con eso la marca
// queda completa por primera vez, registra cuándo. Todo en una transacción.
export async function saveBrandSection<K extends SectionKey>(
  ctx: WorkspaceContext,
  key: K,
  input: SectionInput<K>,
  ipAddress: string | null,
): Promise<BrandProfile> {
  requirePermission(ctx, "brand.update");
  return getPrisma().$transaction(async (tx) => {
    const { id: brandId } = await ensureBrand(tx, ctx);
    await writeSection(tx, ctx, brandId, key, input);
    let brand = await tx.brand.findUniqueOrThrow({ where: { id: brandId }, include: brandInclude });
    if (!brand.completedAt && brandProgress(shapeOf(brand)).isComplete) {
      brand = await tx.brand.update({ where: { id: brandId }, data: { completedAt: new Date() }, include: brandInclude });
    }
    // El nombre y la paleta se dibujan en las imágenes: lo aprobado con otra
    // apariencia vuelve a revisión.
    if (key === "identidad" || key === "visual" || key === "datos") {
      const reopened = key === "datos" ? await invalidateForProofChange(tx, ctx.workspace.id) : await invalidateForVisualChange(tx, ctx.workspace.id);
      if (reopened.length) {
        await recordAudit(tx, {
          workspaceId: ctx.workspace.id,
          actorUserId: ctx.user.id,
          action: "approval.invalidated",
          targetType: "brand",
          targetId: brandId,
          metadata: { reason: key === "datos" ? "proof_changed" : "visual_changed", items: reopened.length },
          ipAddress,
        });
      }
    }
    await recordAudit(tx, {
      workspaceId: ctx.workspace.id,
      actorUserId: ctx.user.id,
      action: "brand.updated",
      targetType: "brand",
      targetId: brandId,
      metadata: { section: key, title: SECTIONS[key].title },
      ipAddress,
    });
    return brand;
  });
}
