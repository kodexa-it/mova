import "server-only";

import { randomBytes } from "node:crypto";

import type { SessionUser } from "@/lib/auth/session";
import { forbidden } from "@/lib/http";
import { getPrisma } from "@/lib/prisma";
import { requirePermission, type WorkspaceContext } from "@/modules/access/context";
import { recordAudit } from "@/modules/audit/service";
import { RESERVED_SLUGS, slugify, withSuffix } from "@/modules/workspaces/slug";

export const WORKSPACE_NAME_MAX = 80;

async function availableSlug(name: string): Promise<string> {
  const base = slugify(name);
  const prisma = getPrisma();
  if (!RESERVED_SLUGS.has(base) && !(await prisma.workspace.findUnique({ where: { slug: base } }))) return base;
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = withSuffix(base, randomBytes(3).toString("hex"));
    if (!(await prisma.workspace.findUnique({ where: { slug: candidate } }))) return candidate;
  }
  throw new Error("No se pudo generar un slug único");
}

// Crear un workspace exige email verificado (ADR 0002). Quien lo crea queda
// como Dueño.
export async function createWorkspace(user: SessionUser, name: string, ipAddress: string | null) {
  if (!user.emailVerified) throw forbidden();
  const slug = await availableSlug(name);
  return getPrisma().$transaction(async (tx) => {
    const workspace = await tx.workspace.create({ data: { name, slug } });
    await tx.membership.create({ data: { workspaceId: workspace.id, userId: user.id, role: "OWNER" } });
    await recordAudit(tx, {
      workspaceId: workspace.id,
      actorUserId: user.id,
      action: "workspace.created",
      targetType: "workspace",
      targetId: workspace.id,
      ipAddress,
    });
    return { id: workspace.id, name: workspace.name, slug: workspace.slug };
  });
}

export async function listWorkspacesForUser(userId: string) {
  const memberships = await getPrisma().membership.findMany({
    where: { userId, workspace: { deletedAt: null } },
    orderBy: { createdAt: "asc" },
    select: { role: true, workspace: { select: { id: true, name: true, slug: true } } },
  });
  return memberships.map((m) => ({ ...m.workspace, role: m.role }));
}

export async function renameWorkspace(ctx: WorkspaceContext, name: string, ipAddress: string | null) {
  requirePermission(ctx, "workspace.update");
  return getPrisma().$transaction(async (tx) => {
    const updated = await tx.workspace.update({
      where: { id: ctx.workspace.id },
      data: { name },
      select: { id: true, name: true, slug: true },
    });
    await recordAudit(tx, {
      workspaceId: ctx.workspace.id,
      actorUserId: ctx.user.id,
      action: "workspace.updated",
      targetType: "workspace",
      targetId: ctx.workspace.id,
      metadata: { from: ctx.workspace.name, to: name },
      ipAddress,
    });
    return updated;
  });
}

// Borrado lógico: el workspace deja de ser accesible y se revocan las
// invitaciones pendientes; la auditoría se conserva.
export async function deleteWorkspace(ctx: WorkspaceContext, ipAddress: string | null) {
  requirePermission(ctx, "workspace.delete");
  await getPrisma().$transaction(async (tx) => {
    const now = new Date();
    await tx.workspace.update({ where: { id: ctx.workspace.id }, data: { deletedAt: now } });
    await tx.invitation.updateMany({
      where: { workspaceId: ctx.workspace.id, acceptedAt: null, revokedAt: null },
      data: { revokedAt: now },
    });
    await recordAudit(tx, {
      workspaceId: ctx.workspace.id,
      actorUserId: ctx.user.id,
      action: "workspace.deleted",
      targetType: "workspace",
      targetId: ctx.workspace.id,
      ipAddress,
    });
  });
}
