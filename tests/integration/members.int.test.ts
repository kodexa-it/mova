import { beforeEach, describe, expect, it } from "vitest";

import * as memberRoute from "@/app/api/w/[slug]/members/[membershipId]/route";
import * as workspaceRoute from "@/app/api/w/[slug]/route";
import { getPrisma } from "@/lib/prisma";
import { call } from "@/tests/helpers";
import { createTeamWorkspace, type TeamWorkspace } from "@/tests/integration/fixtures";

let team: TeamWorkspace;

beforeEach(async () => {
  team = await createTeamWorkspace("Equipo");
});

describe("integrantes y roles", () => {
  it("nadie cambia su propio rol", async () => {
    const owner = team.members.OWNER;
    const res = await call(memberRoute.PATCH, {
      method: "PATCH",
      cookie: owner.cookie,
      params: { slug: team.slug, membershipId: owner.membershipId },
      body: { role: "VIEWER" },
    });
    expect(res.status).toBe(403);
  });

  it("el último Dueño no puede irse", async () => {
    const owner = team.members.OWNER;
    const res = await call(memberRoute.DELETE, {
      method: "DELETE",
      cookie: owner.cookie,
      params: { slug: team.slug, membershipId: owner.membershipId },
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("last_owner");
  });

  it("con dos Dueños, uno puede degradar al otro, pero no al último", async () => {
    const owner = team.members.OWNER;
    const editor = team.members.EDITOR;
    await call(memberRoute.PATCH, {
      method: "PATCH",
      cookie: owner.cookie,
      params: { slug: team.slug, membershipId: editor.membershipId },
      body: { role: "OWNER" },
    });
    const demote = await call(memberRoute.PATCH, {
      method: "PATCH",
      cookie: editor.cookie,
      params: { slug: team.slug, membershipId: owner.membershipId },
      body: { role: "EDITOR" },
    });
    expect(demote.status).toBe(200);
    const leave = await call(memberRoute.DELETE, {
      method: "DELETE",
      cookie: editor.cookie,
      params: { slug: team.slug, membershipId: editor.membershipId },
    });
    expect(leave.status).toBe(409);
    expect(await getPrisma().membership.count({ where: { workspaceId: team.id, role: "OWNER" } })).toBe(1);
  });

  it("cualquier integrante puede irse por su cuenta", async () => {
    const viewer = team.members.VIEWER;
    const res = await call(memberRoute.DELETE, {
      method: "DELETE",
      cookie: viewer.cookie,
      params: { slug: team.slug, membershipId: viewer.membershipId },
    });
    expect(res.status).toBe(200);
    const audit = await getPrisma().auditLog.findFirst({ where: { workspaceId: team.id, action: "member.left" } });
    expect(audit?.actorUserId).toBe(viewer.id);
  });

  it("quien es quitado pierde el acceso en el request siguiente", async () => {
    const editor = team.members.EDITOR;
    expect((await call(workspaceRoute.GET, { cookie: editor.cookie, params: { slug: team.slug } })).status).toBe(200);
    await call(memberRoute.DELETE, {
      method: "DELETE",
      cookie: team.members.OWNER.cookie,
      params: { slug: team.slug, membershipId: editor.membershipId },
    });
    expect((await call(workspaceRoute.GET, { cookie: editor.cookie, params: { slug: team.slug } })).status).toBe(404);
  });

  it("un cambio de rol aplica de inmediato y queda auditado", async () => {
    const viewer = team.members.VIEWER;
    await call(memberRoute.PATCH, {
      method: "PATCH",
      cookie: team.members.OWNER.cookie,
      params: { slug: team.slug, membershipId: viewer.membershipId },
      body: { role: "OWNER" },
    });
    const rename = await call(workspaceRoute.PATCH, {
      method: "PATCH",
      cookie: viewer.cookie,
      params: { slug: team.slug },
      body: { name: "Renombrado por el nuevo Dueño" },
    });
    expect(rename.status).toBe(200);
    const audit = await getPrisma().auditLog.findFirstOrThrow({ where: { workspaceId: team.id, action: "member.role_changed" } });
    expect(audit.metadata).toMatchObject({ from: "VIEWER", to: "OWNER" });
  });

  it("rechaza roles inválidos", async () => {
    const res = await call(memberRoute.PATCH, {
      method: "PATCH",
      cookie: team.members.OWNER.cookie,
      params: { slug: team.slug, membershipId: team.members.VIEWER.membershipId },
      body: { role: "SUPERADMIN" },
    });
    expect(res.status).toBe(400);
  });
});
