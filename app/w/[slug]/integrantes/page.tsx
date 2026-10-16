import type { Metadata } from "next";

import { initials } from "@/components/app/initials";
import { RoleBadge } from "@/components/app/role-badge";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { requirePageWorkspace } from "@/lib/page-context";
import { can, ROLE_LABELS } from "@/modules/access/permissions";
import { listPendingInvitations } from "@/modules/invitations/service";
import { listMembers } from "@/modules/members/service";

import { InviteForm, LeaveButton, MemberActions, RevokeInvitationButton } from "./member-actions";

export const metadata: Metadata = { title: "Integrantes" };

const dateFormat = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", year: "numeric" });

function Initials({ name }: { name: string }) {
  return (
    <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-pearl text-caption font-semibold uppercase text-ink-2">
      {initials(name)}
    </span>
  );
}

export default async function MembersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requirePageWorkspace(slug, "members.read");
  const canManage = can(ctx.role, "members.manage");
  const [members, invitations] = await Promise.all([listMembers(ctx), canManage ? listPendingInvitations(ctx) : []]);

  return (
    <>
      <PageHeader
        title="Integrantes"
        description={canManage ? "Invitá personas y elegí qué puede hacer cada una." : "Personas que trabajan en este workspace."}
      />

      <div className="flex flex-col gap-8">
        {canManage ? (
          <Card className="p-6">
            <CardHeader title="Invitar a alguien" description="La persona recibe un enlace que solo puede aceptar con ese email." />
            <InviteForm slug={slug} />
          </Card>
        ) : null}

        <section aria-labelledby="members-title">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 id="members-title" className="text-lead font-semibold text-ink">
              Equipo
            </h2>
            <span className="tabular text-small text-ink-2">
              {members.length} {members.length === 1 ? "persona" : "personas"}
            </span>
          </div>
          <Card as="div" className="overflow-hidden">
            <ul className="divide-y divide-line">
              {members.map((member) => {
                const isSelf = member.membershipId === ctx.membershipId;
                return (
                  <li key={member.membershipId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <Initials name={member.name} />
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 font-medium text-ink">
                          <span className="truncate">{member.name}</span>
                          {isSelf ? <Badge>Vos</Badge> : null}
                        </p>
                        <p className="truncate text-small text-ink-2">{member.email}</p>
                      </div>
                    </div>
                    {canManage && !isSelf ? (
                      <MemberActions slug={slug} membershipId={member.membershipId} role={member.role} name={member.name} />
                    ) : (
                      <div className="flex items-center gap-3">
                        <RoleBadge role={member.role} />
                        {isSelf ? <LeaveButton slug={slug} membershipId={member.membershipId} /> : null}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        </section>

        {canManage && invitations.length > 0 ? (
          <section aria-labelledby="invitations-title">
            <h2 id="invitations-title" className="mb-3 text-lead font-semibold text-ink">
              Invitaciones pendientes
            </h2>
            <Card as="div" className="overflow-hidden">
              <ul className="divide-y divide-line">
                {invitations.map((invitation) => (
                  <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">{invitation.email}</p>
                      <p className="text-small text-ink-2">
                        {ROLE_LABELS[invitation.role]} · vence el <span className="tabular">{dateFormat.format(invitation.expiresAt)}</span>
                      </p>
                    </div>
                    <RevokeInvitationButton slug={slug} invitationId={invitation.id} email={invitation.email} />
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        ) : null}
      </div>
    </>
  );
}
