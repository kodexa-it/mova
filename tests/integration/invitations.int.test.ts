import { beforeEach, describe, expect, it } from "vitest";

import * as acceptRoute from "@/app/api/invitations/accept/route";
import * as invitationRoute from "@/app/api/w/[slug]/invitations/[invitationId]/route";
import * as invitationsRoute from "@/app/api/w/[slug]/invitations/route";
import { getMemoryOutbox } from "@/lib/email/transport";
import { getPrisma } from "@/lib/prisma";
import { call, createUser } from "@/tests/helpers";
import { createTeamWorkspace, type TeamWorkspace } from "@/tests/integration/fixtures";

let team: TeamWorkspace;

beforeEach(async () => {
  team = await createTeamWorkspace("Kodexa");
});

async function invite(email: string, role = "EDITOR") {
  const res = await call(invitationsRoute.POST, {
    method: "POST",
    cookie: team.members.OWNER.cookie,
    params: { slug: team.slug },
    body: { email, role },
  });
  const mail = getMemoryOutbox().filter((m) => m.to === email.toLowerCase()).at(-1);
  const token = mail?.text.match(/\/invitacion\/([A-Za-z0-9_-]+)/)?.[1];
  return { res, token: token ?? "" };
}

const accept = (cookie: string, token: string) => call(acceptRoute.POST, { method: "POST", cookie, body: { token } });

describe("invitaciones", () => {
  it("el flujo completo crea la membresía con el rol invitado", async () => {
    const { res, token } = await invite("Nueva@Ejemplo.com", "APPROVER");
    expect(res.status).toBe(201);
    expect(token).not.toBe("");
    const invited = await createUser({ email: "nueva@ejemplo.com" });
    const accepted = await accept(invited.cookie, token);
    expect(accepted.status).toBe(200);
    expect(accepted.body.workspace).toMatchObject({ slug: team.slug });
    const membership = await getPrisma().membership.findFirstOrThrow({ where: { workspaceId: team.id, userId: invited.id } });
    expect(membership.role).toBe("APPROVER");
  });

  it("la base guarda el hash, nunca el token", async () => {
    const { token } = await invite("hash@ejemplo.com");
    const stored = await getPrisma().invitation.findFirstOrThrow({ where: { email: "hash@ejemplo.com" } });
    expect(stored.tokenHash).not.toBe(token);
    expect(JSON.stringify(stored)).not.toContain(token);
  });

  it("solo la acepta la cuenta con el email invitado", async () => {
    const { token } = await invite("correcta@ejemplo.com");
    const other = await createUser({ email: "otra@ejemplo.com" });
    expect((await accept(other.cookie, token)).status).toBe(403);
    expect(await getPrisma().membership.count({ where: { workspaceId: team.id, userId: other.id } })).toBe(0);
  });

  it("sin email verificado no se puede aceptar", async () => {
    const { token } = await invite("sinverificar@ejemplo.com");
    const user = await createUser({ email: "sinverificar@ejemplo.com", verified: false });
    expect((await accept(user.cookie, token)).status).toBe(403);
  });

  it("no se puede usar dos veces", async () => {
    const { token } = await invite("dos@ejemplo.com");
    const user = await createUser({ email: "dos@ejemplo.com" });
    expect((await accept(user.cookie, token)).status).toBe(200);
    const second = await accept(user.cookie, token);
    expect(second.status).toBe(409);
    expect(second.body.error).toBe("invitation_used");
  });

  it("una invitación vencida no se acepta", async () => {
    const { token } = await invite("vencida@ejemplo.com");
    await getPrisma().invitation.updateMany({ where: { email: "vencida@ejemplo.com" }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const user = await createUser({ email: "vencida@ejemplo.com" });
    const res = await accept(user.cookie, token);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("invitation_expired");
  });

  it("una invitación revocada no se acepta", async () => {
    const { res, token } = await invite("revocada@ejemplo.com");
    const id = (res.body.invitation as { id: string }).id;
    const revoke = await call(invitationRoute.DELETE, {
      method: "DELETE",
      cookie: team.members.OWNER.cookie,
      params: { slug: team.slug, invitationId: id },
    });
    expect(revoke.status).toBe(200);
    const user = await createUser({ email: "revocada@ejemplo.com" });
    expect((await accept(user.cookie, token)).body.error).toBe("invitation_revoked");
  });

  it("reinvitar al mismo email invalida la invitación anterior", async () => {
    const first = await invite("repetida@ejemplo.com");
    const second = await invite("repetida@ejemplo.com");
    const user = await createUser({ email: "repetida@ejemplo.com" });
    expect((await accept(user.cookie, first.token)).body.error).toBe("invitation_revoked");
    expect((await accept(user.cookie, second.token)).status).toBe(200);
  });

  it("no se invita a quien ya es integrante", async () => {
    const { res } = await invite(team.members.VIEWER.email);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("already_member");
  });

  it("un token inexistente o mal formado responde 404", async () => {
    const user = await createUser();
    expect((await accept(user.cookie, "a".repeat(43))).status).toBe(404);
    expect((await accept(user.cookie, "token-invalido-!!")).status).toBe(404);
  });

  it("queda auditado quién invitó y quién aceptó", async () => {
    const { token } = await invite("audit@ejemplo.com");
    const user = await createUser({ email: "audit@ejemplo.com" });
    await accept(user.cookie, token);
    const actions = (await getPrisma().auditLog.findMany({ where: { workspaceId: team.id } })).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(["invitation.created", "invitation.accepted"]));
  });
});
