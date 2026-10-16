import "server-only";

import { badRequest, notFound } from "@/lib/http";
import { getPrisma } from "@/lib/prisma";
import { requirePermission, type WorkspaceContext } from "@/modules/access/context";
import { readImageFile } from "@/modules/images/uploads";

// Imágenes de referencia de la marca: lo que el brief de diseño pide usar
// como única referencia visual.
export const MAX_REFERENCES = 12;

export async function listReferences(ctx: WorkspaceContext) {
  requirePermission(ctx, "workspace.read");
  return getPrisma().brandReference.findMany({ where: { workspaceId: ctx.workspace.id }, orderBy: { createdAt: "asc" }, select: { id: true, label: true, width: true, height: true, createdAt: true } });
}

export async function addReference(ctx: WorkspaceContext, file: unknown, label: string) {
  requirePermission(ctx, "brand.update");
  const prisma = getPrisma();
  if ((await prisma.brandReference.count({ where: { workspaceId: ctx.workspace.id } })) >= MAX_REFERENCES) throw badRequest("too_many_references");
  const image = await readImageFile(file);
  return prisma.brandReference.create({
    data: { workspaceId: ctx.workspace.id, label: label.trim().slice(0, 80), sha256: image.sha256, mimeType: image.mimeType, width: image.width, height: image.height, bytes: Buffer.from(image.bytes), uploadedById: ctx.user.id },
    select: { id: true, label: true, width: true, height: true, createdAt: true },
  });
}

export async function removeReference(ctx: WorkspaceContext, id: string) {
  requirePermission(ctx, "brand.update");
  const result = await getPrisma().brandReference.deleteMany({ where: { id, workspaceId: ctx.workspace.id } });
  if (!result.count) throw notFound();
}

export async function readReference(ctx: WorkspaceContext, id: string) {
  requirePermission(ctx, "workspace.read");
  const ref = await getPrisma().brandReference.findFirst({ where: { id, workspaceId: ctx.workspace.id }, select: { bytes: true, mimeType: true, label: true } });
  if (!ref) throw notFound();
  return ref;
}
