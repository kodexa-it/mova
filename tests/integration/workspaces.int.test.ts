import { describe, expect, it } from "vitest";

import * as workspaces from "@/app/api/workspaces/route";
import { getPrisma } from "@/lib/prisma";
import { call, createUser } from "@/tests/helpers";

describe("crear y listar workspaces", () => {
  it("sin sesión responde 401", async () => {
    const res = await call(workspaces.POST, { method: "POST", body: { name: "Kodexa" } });
    expect(res.status).toBe(401);
  });

  it("sin email verificado no se puede crear un workspace", async () => {
    const user = await createUser({ verified: false });
    const res = await call(workspaces.POST, { method: "POST", cookie: user.cookie, body: { name: "Kodexa" } });
    expect(res.status).toBe(403);
    expect(await getPrisma().workspace.count()).toBe(0);
  });

  it("con email verificado crea el workspace y deja a quien lo crea como Dueño", async () => {
    const user = await createUser();
    const res = await call(workspaces.POST, { method: "POST", cookie: user.cookie, body: { name: "Kodexa Comunicación" } });
    expect(res.status).toBe(201);
    const ws = res.body.workspace as { id: string; slug: string };
    expect(ws.slug).toBe("kodexa-comunicacion");
    const membership = await getPrisma().membership.findFirstOrThrow({ where: { workspaceId: ws.id } });
    expect(membership).toMatchObject({ userId: user.id, role: "OWNER" });
    expect(await getPrisma().auditLog.count({ where: { workspaceId: ws.id, action: "workspace.created" } })).toBe(1);
  });

  it("genera slugs únicos para nombres repetidos", async () => {
    const user = await createUser();
    const a = await call(workspaces.POST, { method: "POST", cookie: user.cookie, body: { name: "Kodexa" } });
    const b = await call(workspaces.POST, { method: "POST", cookie: user.cookie, body: { name: "Kodexa" } });
    expect((a.body.workspace as { slug: string }).slug).not.toBe((b.body.workspace as { slug: string }).slug);
  });

  it("rechaza mutaciones sin Origin o con otra origin", async () => {
    const user = await createUser();
    const sinOrigin = await call(workspaces.POST, { method: "POST", cookie: user.cookie, origin: null, body: { name: "X1" } });
    const otraOrigin = await call(workspaces.POST, {
      method: "POST",
      cookie: user.cookie,
      origin: "https://sitio-malicioso.com",
      body: { name: "X2" },
    });
    expect(sinOrigin.status).toBe(403);
    expect(otraOrigin.status).toBe(403);
  });

  it("valida la entrada", async () => {
    const user = await createUser();
    const res = await call(workspaces.POST, { method: "POST", cookie: user.cookie, body: { name: "" } });
    expect(res.status).toBe(400);
  });

  it("cada persona solo ve sus workspaces", async () => {
    const ana = await createUser();
    const beto = await createUser();
    await call(workspaces.POST, { method: "POST", cookie: ana.cookie, body: { name: "De Ana" } });
    await call(workspaces.POST, { method: "POST", cookie: beto.cookie, body: { name: "De Beto" } });
    const res = await call(workspaces.GET, { cookie: ana.cookie });
    const list = res.body.workspaces as { name: string; role: string }[];
    expect(list.map((w) => w.name)).toEqual(["De Ana"]);
    expect(list[0]?.role).toBe("OWNER");
  });
});
