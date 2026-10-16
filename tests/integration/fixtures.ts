import type { Role } from "@prisma/client";

import * as workspaces from "@/app/api/workspaces/route";
import { getPrisma } from "@/lib/prisma";
import { call, createUser, type TestUser } from "@/tests/helpers";

export interface TeamWorkspace {
  id: string;
  slug: string;
  members: Record<Role, TestUser & { membershipId: string }>;
}

// Workspace con un integrante por rol. Las membresías extra se crean directo
// en la base: lo que se prueba acá es el control de acceso, no la invitación.
export async function createTeamWorkspace(name: string): Promise<TeamWorkspace> {
  const owner = await createUser({ name: `Dueño de ${name}` });
  const res = await call(workspaces.POST, { method: "POST", cookie: owner.cookie, body: { name } });
  const ws = res.body.workspace as { id: string; slug: string };
  const prisma = getPrisma();
  const ownerMembership = await prisma.membership.findFirstOrThrow({ where: { workspaceId: ws.id, userId: owner.id } });
  const members = { OWNER: { ...owner, membershipId: ownerMembership.id } } as TeamWorkspace["members"];
  for (const role of ["EDITOR", "APPROVER", "VIEWER"] as const) {
    const user = await createUser({ name: `${role} de ${name}` });
    const membership = await prisma.membership.create({ data: { workspaceId: ws.id, userId: user.id, role } });
    members[role] = { ...user, membershipId: membership.id };
  }
  return { id: ws.id, slug: ws.slug, members };
}
