import "server-only";

import type { Role } from "@prisma/client";

import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { forbidden, notFound, unauthorized } from "@/lib/http";
import { getPrisma } from "@/lib/prisma";
import { can, type Permission } from "@/modules/access/permissions";

export interface WorkspaceContext {
  user: SessionUser;
  workspace: { id: string; name: string; slug: string };
  membershipId: string;
  role: Role;
}

export async function requireUser(headers: Headers): Promise<SessionUser> {
  const user = await getSessionUser(headers);
  if (!user) throw unauthorized();
  return user;
}

// Único punto que resuelve sesión → workspace (por slug de la URL) →
// membresía → rol. El rol se lee de la base en cada request. Si la persona no
// pertenece al workspace se responde 404, para no revelar que existe.
export async function resolveWorkspaceContext(headers: Headers, slug: string): Promise<WorkspaceContext> {
  const user = await requireUser(headers);
  const membership = await getPrisma().membership.findFirst({
    where: { userId: user.id, workspace: { slug, deletedAt: null } },
    select: { id: true, role: true, workspace: { select: { id: true, name: true, slug: true } } },
  });
  if (!membership) throw notFound();
  return { user, workspace: membership.workspace, membershipId: membership.id, role: membership.role };
}

export function requirePermission(ctx: WorkspaceContext, permission: Permission): void {
  if (!can(ctx.role, permission)) throw forbidden();
}

// Contexto para tareas en segundo plano: la persona que las pidió, con el rol
// que tiene HOY en el workspace (se vuelve a leer al ejecutar). Si ya no es
// integrante, la tarea no se ejecuta en su nombre.
export async function backgroundContext(workspaceId: string, userId: string): Promise<WorkspaceContext | null> {
  const membership = await getPrisma().membership.findFirst({
    where: { userId, workspaceId, workspace: { deletedAt: null } },
    select: { id: true, role: true, workspace: { select: { id: true, name: true, slug: true } }, user: { select: { id: true, name: true, email: true, emailVerified: true } } },
  });
  if (!membership) return null;
  return { user: membership.user, workspace: membership.workspace, membershipId: membership.id, role: membership.role };
}
