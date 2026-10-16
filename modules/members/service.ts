import "server-only";

import type { Prisma, Role } from "@prisma/client";

import { conflict, forbidden, notFound } from "@/lib/http";
import { getPrisma } from "@/lib/prisma";
import { requirePermission, type WorkspaceContext } from "@/modules/access/context";
import { recordAudit } from "@/modules/audit/service";

export async function listMembers(ctx: WorkspaceContext) {
  requirePermission(ctx, "members.read");
  const members = await getPrisma().membership.findMany({
    where: { workspaceId: ctx.workspace.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, role: true, createdAt: true, user: { select: { id: true, name: true, email: true } } },
  });
  return members.map((m) => ({
    membershipId: m.id,
    role: m.role,
    joinedAt: m.createdAt,
    userId: m.user.id,
    name: m.user.name,
    email: m.user.email,
  }));
}

// Bloquea la fila de cada Dueño del workspace dentro de la transacción, para
// que dos cambios simultáneos no dejen el workspace sin Dueño.
async function lockOwners(tx: Prisma.TransactionClient, workspaceId: string): Promise<string[]> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Membership" WHERE "workspaceId" = ${workspaceId} AND "role" = 'OWNER' FOR UPDATE`;
  return rows.map((row) => row.id);
}

export async function changeMemberRole(
  ctx: WorkspaceContext,
  membershipId: string,
  role: Role,
  ipAddress: string | null,
) {
  requirePermission(ctx, "members.manage");
  if (membershipId === ctx.membershipId) throw forbidden(); // nadie cambia su propio rol
  return getPrisma().$transaction(async (tx) => {
    const target = await tx.membership.findFirst({ where: { id: membershipId, workspaceId: ctx.workspace.id } });
    if (!target) throw notFound();
    if (target.role === role) return { membershipId, role };
    if (target.role === "OWNER") {
      const owners = await lockOwners(tx, ctx.workspace.id);
      if (owners.length <= 1) throw conflict("last_owner");
    }
    await tx.membership.update({ where: { id: membershipId }, data: { role } });
    await recordAudit(tx, {
      workspaceId: ctx.workspace.id,
      actorUserId: ctx.user.id,
      action: "member.role_changed",
      targetType: "membership",
      targetId: membershipId,
      metadata: { userId: target.userId, from: target.role, to: role },
      ipAddress,
    });
    return { membershipId, role };
  });
}

// Quitar a otro integrante requiere members.manage. Cualquier integrante puede
// irse por su cuenta, salvo el último Dueño.
export async function removeMember(ctx: WorkspaceContext, membershipId: string, ipAddress: string | null) {
  const leaving = membershipId === ctx.membershipId;
  if (!leaving) requirePermission(ctx, "members.manage");
  await getPrisma().$transaction(async (tx) => {
    const target = await tx.membership.findFirst({ where: { id: membershipId, workspaceId: ctx.workspace.id } });
    if (!target) throw notFound();
    if (target.role === "OWNER") {
      const owners = await lockOwners(tx, ctx.workspace.id);
      if (owners.length <= 1) throw conflict("last_owner");
    }
    await tx.membership.delete({ where: { id: membershipId } });
    await recordAudit(tx, {
      workspaceId: ctx.workspace.id,
      actorUserId: ctx.user.id,
      action: leaving ? "member.left" : "member.removed",
      targetType: "membership",
      targetId: membershipId,
      metadata: { userId: target.userId, role: target.role },
      ipAddress,
    });
  });
}
