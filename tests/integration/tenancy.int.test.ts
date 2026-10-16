import { beforeEach, describe, expect, it } from "vitest";

import * as auditRoute from "@/app/api/w/[slug]/audit/route";
import * as invitationRoute from "@/app/api/w/[slug]/invitations/[invitationId]/route";
import * as invitationsRoute from "@/app/api/w/[slug]/invitations/route";
import * as memberRoute from "@/app/api/w/[slug]/members/[membershipId]/route";
import * as membersRoute from "@/app/api/w/[slug]/members/route";
import * as workspaceRoute from "@/app/api/w/[slug]/route";
import { getPrisma } from "@/lib/prisma";
import { call } from "@/tests/helpers";
import { createTeamWorkspace, type TeamWorkspace } from "@/tests/integration/fixtures";

let a: TeamWorkspace;
let b: TeamWorkspace;

beforeEach(async () => {
  a = await createTeamWorkspace("Empresa A");
  b = await createTeamWorkspace("Empresa B");
});

describe("aislamiento entre workspaces", () => {
  it("el Dueño de B no puede ver ni modificar A (404, sin revelar que existe)", async () => {
    const cookie = b.members.OWNER.cookie;
    const slug = a.slug;
    expect((await call(workspaceRoute.GET, { cookie, params: { slug } })).status).toBe(404);
    expect((await call(membersRoute.GET, { cookie, params: { slug } })).status).toBe(404);
    expect((await call(auditRoute.GET, { cookie, params: { slug } })).status).toBe(404);
    expect((await call(workspaceRoute.PATCH, { method: "PATCH", cookie, params: { slug }, body: { name: "Hackeado" } })).status).toBe(404);
    expect((await call(workspaceRoute.DELETE, { method: "DELETE", cookie, params: { slug } })).status).toBe(404);
    expect(
      (await call(invitationsRoute.POST, { method: "POST", cookie, params: { slug }, body: { email: "x@y.com", role: "OWNER" } })).status,
    ).toBe(404);
    const workspace = await getPrisma().workspace.findUniqueOrThrow({ where: { id: a.id } });
    expect(workspace).toMatchObject({ name: "Empresa A", deletedAt: null });
  });

  it("no se puede operar sobre una membresía de A usando el slug de B, aun conociendo el ID", async () => {
    const cookie = b.members.OWNER.cookie;
    const target = a.members.VIEWER.membershipId;
    const patch = await call(memberRoute.PATCH, {
      method: "PATCH",
      cookie,
      params: { slug: b.slug, membershipId: target },
      body: { role: "OWNER" },
    });
    const del = await call(memberRoute.DELETE, { method: "DELETE", cookie, params: { slug: b.slug, membershipId: target } });
    expect(patch.status).toBe(404);
    expect(del.status).toBe(404);
    expect(await getPrisma().membership.findUniqueOrThrow({ where: { id: target } })).toMatchObject({ role: "VIEWER" });
  });

  it("no se puede revocar una invitación de A usando el slug de B", async () => {
    const created = await call(invitationsRoute.POST, {
      method: "POST",
      cookie: a.members.OWNER.cookie,
      params: { slug: a.slug },
      body: { email: "invitada@ejemplo.com", role: "EDITOR" },
    });
    const invitationId = (created.body.invitation as { id: string }).id;
    const res = await call(invitationRoute.DELETE, {
      method: "DELETE",
      cookie: b.members.OWNER.cookie,
      params: { slug: b.slug, invitationId },
    });
    expect(res.status).toBe(404);
    expect(await getPrisma().invitation.findUniqueOrThrow({ where: { id: invitationId } })).toMatchObject({ revokedAt: null });
  });

  it("la lista de integrantes solo trae personas del propio workspace", async () => {
    const res = await call(membersRoute.GET, { cookie: a.members.VIEWER.cookie, params: { slug: a.slug } });
    const emails = (res.body.members as { email: string }[]).map((m) => m.email);
    expect(emails).toHaveLength(4);
    for (const member of Object.values(b.members)) expect(emails).not.toContain(member.email);
  });

  it("una persona en dos workspaces tiene permisos distintos en cada uno", async () => {
    const person = a.members.OWNER;
    await getPrisma().membership.create({ data: { workspaceId: b.id, userId: person.id, role: "VIEWER" } });
    const renameA = await call(workspaceRoute.PATCH, {
      method: "PATCH",
      cookie: person.cookie,
      params: { slug: a.slug },
      body: { name: "A renombrada" },
    });
    const renameB = await call(workspaceRoute.PATCH, {
      method: "PATCH",
      cookie: person.cookie,
      params: { slug: b.slug },
      body: { name: "B renombrada" },
    });
    expect(renameA.status).toBe(200);
    expect(renameB.status).toBe(403);
  });

  it("un workspace eliminado deja de ser accesible", async () => {
    await call(workspaceRoute.DELETE, { method: "DELETE", cookie: a.members.OWNER.cookie, params: { slug: a.slug } });
    const res = await call(workspaceRoute.GET, { cookie: a.members.OWNER.cookie, params: { slug: a.slug } });
    expect(res.status).toBe(404);
  });
});
