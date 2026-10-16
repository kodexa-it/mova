import "server-only";

import type { Role } from "@prisma/client";

import { getEnv } from "@/lib/env";
import { reviewReadyEmail } from "@/lib/email/templates";
import { getEmailTransport } from "@/lib/email/transport";
import { getPrisma } from "@/lib/prisma";
import { requirePermission, type WorkspaceContext } from "@/modules/access/context";
import { PERMISSIONS, type Permission } from "@/modules/access/permissions";

export interface NotificationInput {
  kind: string;
  title: string;
  body: string;
  // Ruta dentro de la app (sin dominio): /w/<slug>/...
  href: string;
}

// Avisa a todas las personas del workspace que tienen un permiso (por
// ejemplo, content.approve: Aprobadores y Dueños). Crea el aviso en la app y,
// si se pide, manda un email. El email es lo último y nunca rompe la operación:
// si falla, el aviso en la app ya quedó.
export async function notifyPermission(workspaceId: string, permission: Permission, input: NotificationInput, options: { email?: boolean; also?: string[] } = {}) {
  const roles = PERMISSIONS[permission] as readonly Role[];
  const prisma = getPrisma();
  const members = await prisma.membership.findMany({
    where: { workspaceId, OR: [{ role: { in: [...roles] } }, ...(options.also?.length ? [{ userId: { in: options.also } }] : [])] },
    select: { userId: true, user: { select: { email: true, name: true } }, workspace: { select: { name: true } } },
  });
  if (!members.length) return [];
  await prisma.notification.createMany({ data: members.map((m) => ({ workspaceId, userId: m.userId, ...input })) });
  if (options.email) {
    const base = getEnv().APP_URL.replace(/\/$/, "");
    const transport = getEmailTransport();
    for (const m of members) {
      try {
        await transport.send(reviewReadyEmail({ to: m.user.email, name: m.user.name, workspaceName: m.workspace.name, title: input.title, body: input.body, url: `${base}${input.href}` }));
      } catch (error) {
        console.error(`[avisos] no se pudo enviar el email a ${m.userId}: ${error instanceof Error ? error.message : "error"}`);
      }
    }
  }
  return members.map((m) => m.userId);
}

export async function listNotifications(ctx: WorkspaceContext) {
  requirePermission(ctx, "workspace.read");
  const prisma = getPrisma();
  const where = { userId: ctx.user.id, workspaceId: ctx.workspace.id };
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: 30, select: { id: true, kind: true, title: true, body: true, href: true, readAt: true, createdAt: true } }),
    prisma.notification.count({ where: { ...where, readAt: null } }),
  ]);
  return { items, unread };
}

export async function unreadCount(ctx: WorkspaceContext) {
  return getPrisma().notification.count({ where: { userId: ctx.user.id, workspaceId: ctx.workspace.id, readAt: null } });
}

// Marca como leídos los avisos propios (todos o los indicados).
export async function markRead(ctx: WorkspaceContext, ids: string[] | "all") {
  requirePermission(ctx, "workspace.read");
  const result = await getPrisma().notification.updateMany({
    where: { userId: ctx.user.id, workspaceId: ctx.workspace.id, readAt: null, ...(ids === "all" ? {} : { id: { in: ids } }) },
    data: { readAt: new Date() },
  });
  return result.count;
}
