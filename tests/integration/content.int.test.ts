import type { Role } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";

import * as archiveRoute from "@/app/api/w/[slug]/content/[id]/archive/route";
import * as itemRoute from "@/app/api/w/[slug]/content/[id]/route";
import * as versionsRoute from "@/app/api/w/[slug]/content/[id]/versions/route";
import * as contentRoute from "@/app/api/w/[slug]/content/route";
import { getPrisma } from "@/lib/prisma";
import { call } from "@/tests/helpers";
import { createTeamWorkspace, type TeamWorkspace } from "@/tests/integration/fixtures";

const CAROUSEL = {
  caption: "Atendimos 120 consultas en marzo.\n\nGuardá este post.",
  altText: "Tres slides con texto",
  hashtags: ["pymes"],
  slides: [
    { title: "3 errores que te cuestan clientes", body: "" },
    { title: "Responder tarde", body: "Cada hora cuenta." },
    { title: "Cierre", body: "Escribinos." },
  ],
};

let team: TeamWorkspace;
const params = (id: string, slug = team.slug) => ({ slug, id });

async function create(cookie = team.members.OWNER.cookie, slug = team.slug) {
  const res = await call(contentRoute.POST, { method: "POST", cookie, params: { slug }, body: { format: "CAROUSEL", title: "Errores al cotizar" } });
  return res;
}
const save = (id: string, content: unknown, cookie = team.members.OWNER.cookie, slug = team.slug) =>
  call(versionsRoute.POST, { method: "POST", cookie, params: params(id, slug), body: { content } });

beforeEach(async () => {
  team = await createTeamWorkspace("Contenido");
});

describe("piezas y versiones", () => {
  it("crear una pieza deja un borrador con la versión 1 y su revisión", async () => {
    const res = await create();
    expect(res.status).toBe(201);
    const id = (res.body.item as { id: string }).id;
    const item = await getPrisma().contentItem.findUniqueOrThrow({ where: { id }, include: { currentVersion: true } });
    expect(item.status).toBe("DRAFT");
    expect(item.currentVersion?.number).toBe(1);
    expect(item.currentVersion?.verdict).toBe("fix");
  });

  it("cada guardado crea una versión inmutable con hash y revisión; guardar lo mismo no crea nada", async () => {
    const id = ((await create()).body.item as { id: string }).id;
    expect((await save(id, CAROUSEL)).status).toBe(201);
    expect((await save(id, CAROUSEL)).body).toMatchObject({ changed: false });
    const versions = await getPrisma().contentVersion.findMany({ where: { itemId: id }, orderBy: { number: "asc" } });
    expect(versions.map((v) => v.number)).toEqual([1, 2]);
    expect(versions[1]!.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(versions[1]!.verdict).not.toBe("fix");
  });

  it("una versión con datos por completar queda marcada para corregir", async () => {
    const id = ((await create()).body.item as { id: string }).id;
    await save(id, { ...CAROUSEL, caption: "Ayudamos a {{cantidad}} empresas.\nGuardá este post." });
    const item = await getPrisma().contentItem.findUniqueOrThrow({ where: { id }, include: { currentVersion: true } });
    expect(item.currentVersion?.verdict).toBe("fix");
  });

  it("las palabras que la marca evita se marcan en la revisión", async () => {
    await getPrisma().brand.create({
      data: { workspaceId: team.id, name: "Marca", voice: { create: { workspaceId: team.id, wordsToAvoid: ["barato"] } } },
    });
    const id = ((await create()).body.item as { id: string }).id;
    await save(id, { ...CAROUSEL, caption: "Un servicio barato para 120 pymes.\nGuardá este post." });
    const version = await getPrisma().contentVersion.findFirstOrThrow({ where: { itemId: id, number: 2 } });
    expect((version.validation as { checks: { id: string; status: string }[] }).checks).toContainEqual(expect.objectContaining({ id: "brand.avoid", status: "fail" }));
  });

  it("rechaza contenido que no cumple el formato", async () => {
    const id = ((await create()).body.item as { id: string }).id;
    expect((await save(id, { ...CAROUSEL, slides: CAROUSEL.slides.slice(0, 2) })).status).toBe(400);
    expect((await save(id, { ...CAROUSEL, hashtags: ["a", "b", "c", "d", "e", "f"] })).status).toBe(400);
  });

  it("editar una pieza aprobada la devuelve a borrador", async () => {
    const id = ((await create()).body.item as { id: string }).id;
    await save(id, CAROUSEL);
    await getPrisma().contentItem.update({ where: { id }, data: { status: "APPROVED" } });
    const res = await save(id, { ...CAROUSEL, caption: `${CAROUSEL.caption} Más texto.` });
    expect(res.body).toMatchObject({ changed: true, status: "DRAFT" });
  });

  it("una pieza publicada no se puede editar", async () => {
    const id = ((await create()).body.item as { id: string }).id;
    await getPrisma().contentItem.update({ where: { id }, data: { status: "PUBLISHED" } });
    expect((await save(id, CAROUSEL)).status).toBe(409);
  });

  it("guardados simultáneos no repiten el número de versión", async () => {
    const id = ((await create()).body.item as { id: string }).id;
    const results = await Promise.all([1, 2, 3].map((n) => save(id, { ...CAROUSEL, caption: `${CAROUSEL.caption} ${n}` })));
    expect(results.every((r) => r.status === 201)).toBe(true);
    const numbers = (await getPrisma().contentVersion.findMany({ where: { itemId: id } })).map((v) => v.number).sort();
    expect(numbers).toEqual([1, 2, 3, 4]);
  });

  it("archivar y restaurar queda en la auditoría", async () => {
    const id = ((await create()).body.item as { id: string }).id;
    expect((await call(archiveRoute.POST, { method: "POST", cookie: team.members.OWNER.cookie, params: params(id), body: { archived: true } })).body).toMatchObject({ status: "ARCHIVED" });
    expect((await save(id, CAROUSEL)).status).toBe(409);
    expect((await call(archiveRoute.POST, { method: "POST", cookie: team.members.OWNER.cookie, params: params(id), body: { archived: false } })).body).toMatchObject({ status: "DRAFT" });
    const actions = (await getPrisma().auditLog.findMany({ where: { workspaceId: team.id, action: { startsWith: "content." } }, orderBy: { createdAt: "asc" } })).map((a) => a.action);
    expect(actions).toEqual(["content.created", "content.archived", "content.restored"]);
  });
});

describe.each<[Role, boolean]>([
  ["OWNER", true],
  ["EDITOR", true],
  ["APPROVER", false],
  ["VIEWER", false],
])("rol %s", (role, canWrite) => {
  it(`${canWrite ? "puede" : "no puede"} crear y editar, y siempre puede ver`, async () => {
    const id = ((await create()).body.item as { id: string }).id;
    const cookie = team.members[role].cookie;
    expect((await call(itemRoute.GET, { cookie, params: params(id) })).status).toBe(200);
    expect((await call(contentRoute.GET, { cookie, params: { slug: team.slug } })).status).toBe(200);
    expect((await create(cookie)).status).toBe(canWrite ? 201 : 403);
    expect((await save(id, CAROUSEL, cookie)).status).toBe(canWrite ? 201 : 403);
  });
});

describe("aislamiento", () => {
  it("las piezas de un workspace no se ven ni se editan desde otro", async () => {
    const id = ((await create()).body.item as { id: string }).id;
    const other = await createTeamWorkspace("Otra");
    const cookie = other.members.OWNER.cookie;
    // Con el slug propio y el id ajeno: no existe para ese workspace.
    expect((await call(itemRoute.GET, { cookie, params: params(id, other.slug) })).status).toBe(404);
    expect((await save(id, CAROUSEL, cookie, other.slug)).status).toBe(404);
    // Con el slug ajeno: no es integrante.
    expect((await call(itemRoute.GET, { cookie, params: params(id) })).status).toBe(404);
    const list = await call(contentRoute.GET, { cookie, params: { slug: other.slug } });
    expect(list.body.items).toEqual([]);
  });
});

describe("imágenes de la pieza", () => {
  it("renderiza cada imagen como PNG para quien integra el workspace y 404 para el resto", async () => {
    const renderRoute = await import("@/app/api/w/[slug]/content/[id]/render/[index]/route");
    const id = ((await create()).body.item as { id: string }).id;
    await save(id, CAROUSEL);
    const request = (cookie: string | undefined, index: string, slug = team.slug) =>
      renderRoute.GET(new Request(`http://localhost:3000/api/w/${slug}/content/${id}/render/${index}`, { headers: cookie ? { cookie } : {} }), {
        params: Promise.resolve({ slug, id, index }),
      });
    const ok = await request(team.members.VIEWER.cookie, "0");
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("image/png");
    const bytes = new Uint8Array(await ok.arrayBuffer());
    expect([...bytes.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect((await request(team.members.VIEWER.cookie, "3")).status).toBe(404);
    expect((await request(team.members.VIEWER.cookie, "x")).status).toBe(400);
    const other = await createTeamWorkspace("Ajena");
    expect((await request(other.members.OWNER.cookie, "0")).status).toBe(404);
    expect((await request(other.members.OWNER.cookie, "0", other.slug)).status).toBe(404);
    expect((await request(undefined, "0")).status).toBe(401);
  });
});
