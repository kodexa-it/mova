import "server-only";

import type { Prisma } from "@prisma/client";

import { getPrisma } from "@/lib/prisma";
import { requirePermission, type WorkspaceContext } from "@/modules/access/context";

export type AuditAction =
  | "workspace.created"
  | "workspace.updated"
  | "workspace.deleted"
  | "member.role_changed"
  | "member.removed"
  | "member.left"
  | "invitation.created"
  | "invitation.revoked"
  | "invitation.accepted"
  | "brand.updated"
  | "content.created"
  | "content.archived"
  | "content.restored"
  | "content.scheduled"
  | "content.submitted"
  | "content.approved"
  | "content.changes_requested"
  | "approval.invalidated"
  | "content.art_generated"
  | "content.published"
  | "plan.strategy_proposed"
  | "plan.strategy_approved"
  | "usage.image_budget_updated"
  | "plan.updated";

type Tx = Prisma.TransactionClient;

// Se escribe dentro de la misma transacción que la acción: si la acción falla,
// no queda un registro de algo que no pasó, y viceversa.
export async function recordAudit(
  tx: Tx,
  entry: {
    workspaceId: string;
    actorUserId: string | null;
    action: AuditAction;
    targetType?: string;
    targetId?: string;
    metadata?: Prisma.InputJsonValue;
    ipAddress?: string | null;
  },
): Promise<void> {
  await tx.auditLog.create({
    data: {
      workspaceId: entry.workspaceId,
      actorUserId: entry.actorUserId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      metadata: entry.metadata,
      ipAddress: entry.ipAddress ?? null,
    },
  });
}

export async function listAudit(ctx: WorkspaceContext, limit = 100) {
  requirePermission(ctx, "audit.read");
  return getPrisma().auditLog.findMany({
    where: { workspaceId: ctx.workspace.id },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 500),
    select: { id: true, actorUserId: true, action: true, targetType: true, targetId: true, metadata: true, createdAt: true },
  });
}
