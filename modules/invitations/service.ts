import "server-only";

import type { Role } from "@prisma/client";

import type { SessionUser } from "@/lib/auth/session";
import { invitationEmail } from "@/lib/email/templates";
import { sendEmailSafely } from "@/lib/email/transport";
import { getEnv } from "@/lib/env";
import { conflict, forbidden, notFound } from "@/lib/http";
import { getPrisma } from "@/lib/prisma";
import { requirePermission, type WorkspaceContext } from "@/modules/access/context";
import { recordAudit } from "@/modules/audit/service";
import {
  generateInvitationToken,
  hashInvitationToken,
  INVITATION_TTL_MS,
  isPlausibleToken,
  normalizeEmail,
} from "@/modules/invitations/token";

export async function createInvitation(
  ctx: WorkspaceContext,
  input: { email: string; role: Role },
  ipAddress: string | null,
) {
  requirePermission(ctx, "members.manage");
  const email = normalizeEmail(input.email);
  const prisma = getPrisma();

  const alreadyMember = await prisma.membership.findFirst({
    where: { workspaceId: ctx.workspace.id, user: { email } },
    select: { id: true },
  });
  if (alreadyMember) throw conflict("already_member");

  const token = generateInvitationToken();
  const invitation = await prisma.$transaction(async (tx) => {
    // Una sola invitación vigente por email: la nueva reemplaza a la anterior.
    await tx.invitation.updateMany({
      where: { workspaceId: ctx.workspace.id, email, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    const created = await tx.invitation.create({
      data: {
        workspaceId: ctx.workspace.id,
        email,
        role: input.role,
        tokenHash: hashInvitationToken(token),
        invitedById: ctx.user.id,
        expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
      },
      select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
    });
    await recordAudit(tx, {
      workspaceId: ctx.workspace.id,
      actorUserId: ctx.user.id,
      action: "invitation.created",
      targetType: "invitation",
      targetId: created.id,
      metadata: { email, role: input.role },
      ipAddress,
    });
    return created;
  });

  const url = `${getEnv().APP_URL}/invitacion/${token}`;
  await sendEmailSafely(
    "invitación",
    invitationEmail({ to: email, workspaceName: ctx.workspace.name, inviterName: ctx.user.name, role: input.role, url }),
  );
  return invitation;
}

export async function listPendingInvitations(ctx: WorkspaceContext) {
  requirePermission(ctx, "members.manage");
  return getPrisma().invitation.findMany({
    where: { workspaceId: ctx.workspace.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
  });
}

export async function revokeInvitation(ctx: WorkspaceContext, invitationId: string, ipAddress: string | null) {
  requirePermission(ctx, "members.manage");
  await getPrisma().$transaction(async (tx) => {
    const result = await tx.invitation.updateMany({
      where: { id: invitationId, workspaceId: ctx.workspace.id, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count === 0) throw notFound();
    await recordAudit(tx, {
      workspaceId: ctx.workspace.id,
      actorUserId: ctx.user.id,
      action: "invitation.revoked",
      targetType: "invitation",
      targetId: invitationId,
      ipAddress,
    });
  });
}

type InvitationStatus = "valid" | "expired" | "used" | "revoked" | "not_found";

async function findByToken(token: string) {
  if (!isPlausibleToken(token)) return null;
  return getPrisma().invitation.findUnique({
    where: { tokenHash: hashInvitationToken(token) },
    include: { workspace: { select: { id: true, name: true, slug: true, deletedAt: true } } },
  });
}

function statusOf(invitation: NonNullable<Awaited<ReturnType<typeof findByToken>>>): InvitationStatus {
  if (invitation.workspace.deletedAt) return "not_found";
  if (invitation.acceptedAt) return "used";
  if (invitation.revokedAt) return "revoked";
  if (invitation.expiresAt <= new Date()) return "expired";
  return "valid";
}

// Vista previa para la página de la invitación. Solo la ve una persona con
// sesión iniciada; el email invitado se muestra para que sepa con qué cuenta
// aceptarla.
export async function previewInvitation(token: string) {
  const invitation = await findByToken(token);
  if (!invitation) return { status: "not_found" as const };
  const status = statusOf(invitation);
  if (status === "not_found") return { status };
  return { status, email: invitation.email, role: invitation.role, workspaceName: invitation.workspace.name };
}

// Solo la acepta la cuenta con el mismo email, ya verificado.
export async function acceptInvitation(user: SessionUser, token: string, ipAddress: string | null) {
  if (!user.emailVerified) throw forbidden();
  const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    if (!isPlausibleToken(token)) throw notFound();
    // Bloquea la invitación para que dos aceptaciones simultáneas no la usen dos veces.
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Invitation" WHERE "tokenHash" = ${hashInvitationToken(token)} FOR UPDATE`;
    if (locked.length === 0) throw notFound();
    const invitation = await tx.invitation.findUniqueOrThrow({
      where: { id: locked[0]!.id },
      include: { workspace: { select: { id: true, name: true, slug: true, deletedAt: true } } },
    });
    const status = statusOf(invitation);
    if (status === "not_found") throw notFound();
    if (status !== "valid") throw conflict(`invitation_${status}`);
    if (normalizeEmail(user.email) !== invitation.email) throw forbidden();

    const existing = await tx.membership.findUnique({
      where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId: user.id } },
    });
    if (!existing) {
      await tx.membership.create({ data: { workspaceId: invitation.workspaceId, userId: user.id, role: invitation.role } });
    }
    await tx.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date(), acceptedById: user.id } });
    await recordAudit(tx, {
      workspaceId: invitation.workspaceId,
      actorUserId: user.id,
      action: "invitation.accepted",
      targetType: "invitation",
      targetId: invitation.id,
      metadata: { role: existing ? existing.role : invitation.role, alreadyMember: Boolean(existing) },
      ipAddress,
    });
    return { slug: invitation.workspace.slug, name: invitation.workspace.name };
  });
}
