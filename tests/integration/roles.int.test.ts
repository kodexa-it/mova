import type { Role } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";

import * as auditRoute from "@/app/api/w/[slug]/audit/route";
import * as invitationsRoute from "@/app/api/w/[slug]/invitations/route";
import * as memberRoute from "@/app/api/w/[slug]/members/[membershipId]/route";
import * as membersRoute from "@/app/api/w/[slug]/members/route";
import * as workspaceRoute from "@/app/api/w/[slug]/route";
import { call } from "@/tests/helpers";
import { createTeamWorkspace, type TeamWorkspace } from "@/tests/integration/fixtures";

// Cada endpoint de la etapa 1 probado con cada rol. El estado esperado sale de
// la matriz de permisos (ADR 0002).
const ROLES: Role[] = ["OWNER", "EDITOR", "APPROVER", "VIEWER"];

let team: TeamWorkspace;

beforeEach(async () => {
  team = await createTeamWorkspace("Equipo");
});

describe.each(ROLES)("rol %s", (role) => {
  const cookie = () => team.members[role].cookie;
  const slug = () => team.slug;

  it("ve el workspace y la lista de integrantes", async () => {
    expect((await call(workspaceRoute.GET, { cookie: cookie(), params: { slug: slug() } })).status).toBe(200);
    expect((await call(membersRoute.GET, { cookie: cookie(), params: { slug: slug() } })).status).toBe(200);
  });

  it("renombrar el workspace", async () => {
    const res = await call(workspaceRoute.PATCH, { method: "PATCH", cookie: cookie(), params: { slug: slug() }, body: { name: "Nuevo nombre" } });
    expect(res.status).toBe(role === "OWNER" ? 200 : 403);
  });

  it("invitar y ver invitaciones pendientes", async () => {
    const invite = await call(invitationsRoute.POST, {
      method: "POST",
      cookie: cookie(),
      params: { slug: slug() },
      body: { email: `nueva-${role.toLowerCase()}@ejemplo.com`, role: "VIEWER" },
    });
    const list = await call(invitationsRoute.GET, { cookie: cookie(), params: { slug: slug() } });
    expect(invite.status).toBe(role === "OWNER" ? 201 : 403);
    expect(list.status).toBe(role === "OWNER" ? 200 : 403);
  });

  it("cambiar el rol de otro integrante", async () => {
    const target = role === "VIEWER" ? team.members.EDITOR : team.members.VIEWER;
    const res = await call(memberRoute.PATCH, {
      method: "PATCH",
      cookie: cookie(),
      params: { slug: slug(), membershipId: target.membershipId },
      body: { role: "APPROVER" },
    });
    expect(res.status).toBe(role === "OWNER" ? 200 : 403);
  });

  it("quitar a otro integrante", async () => {
    const target = role === "VIEWER" ? team.members.EDITOR : team.members.VIEWER;
    const res = await call(memberRoute.DELETE, {
      method: "DELETE",
      cookie: cookie(),
      params: { slug: slug(), membershipId: target.membershipId },
    });
    expect(res.status).toBe(role === "OWNER" ? 200 : 403);
  });

  it("ver la auditoría", async () => {
    const res = await call(auditRoute.GET, { cookie: cookie(), params: { slug: slug() } });
    expect(res.status).toBe(role === "OWNER" ? 200 : 403);
  });

  it("eliminar el workspace", async () => {
    const res = await call(workspaceRoute.DELETE, { method: "DELETE", cookie: cookie(), params: { slug: slug() } });
    expect(res.status).toBe(role === "OWNER" ? 200 : 403);
  });
});

it("informa al cliente los permisos de su rol", async () => {
  const res = await call(workspaceRoute.GET, { cookie: team.members.APPROVER.cookie, params: { slug: team.slug } });
  expect(res.body.role).toBe("APPROVER");
  expect(res.body.permissions).toContain("content.approve");
  expect(res.body.permissions).not.toContain("members.manage");
});
