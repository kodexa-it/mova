import type { Role } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";

import * as sectionRoute from "@/app/api/w/[slug]/brand/[section]/route";
import * as approveRoute from "@/app/api/w/[slug]/content/[id]/approve/route";
import * as archiveRoute from "@/app/api/w/[slug]/content/[id]/archive/route";
import * as commentsRoute from "@/app/api/w/[slug]/content/[id]/comments/route";
import * as changesRoute from "@/app/api/w/[slug]/content/[id]/request-changes/route";
import * as reviewRoute from "@/app/api/w/[slug]/content/[id]/review/route";
import * as submitRoute from "@/app/api/w/[slug]/content/[id]/submit/route";
import * as versionsRoute from "@/app/api/w/[slug]/content/[id]/versions/route";
import * as contentRoute from "@/app/api/w/[slug]/content/route";
import { getPrisma } from "@/lib/prisma";
import type { AnyContent } from "@/modules/content/formats";
import { bytesHash, RENDER_VERSION } from "@/modules/content/render/fingerprint";
import { renderFrameBytes } from "@/modules/content/render/render";
import { visualContextOf } from "@/modules/content/render/visual";
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
const cookie = (role: Role) => team.members[role].cookie;
const p = (id: string, slug = team.slug) => ({ slug, id });

async function draft(content: unknown = CAROUSEL) {
  const res = await call(contentRoute.POST, { method: "POST", cookie: cookie("OWNER"), params: { slug: team.slug }, body: { format: "CAROUSEL", title: "Errores" } });
  const id = (res.body.item as { id: string }).id;
  await call(versionsRoute.POST, { method: "POST", cookie: cookie("OWNER"), params: p(id), body: { content } });
  return id;
}
const current = async (id: string) => getPrisma().contentItem.findUniqueOrThrow({ where: { id }, select: { status: true, currentVersionId: true } });
const submit = (id: string, role: Role = "EDITOR", slug = team.slug, c = cookie(role)) => call(submitRoute.POST, { method: "POST", cookie: c, params: p(id, slug) });
const approve = async (id: string, role: Role = "APPROVER", versionId?: string, slug = team.slug, c = cookie(role)) =>
  call(approveRoute.POST, { method: "POST", cookie: c, params: p(id, slug), body: { versionId: versionId ?? (await current(id)).currentVersionId } });
const requestChanges = async (id: string, note: string, role: Role = "APPROVER") =>
  call(changesRoute.POST, { method: "POST", cookie: cookie(role), params: p(id), body: { versionId: (await current(id)).currentVersionId, note } });
const save = (id: string, content: unknown) => call(versionsRoute.POST, { method: "POST", cookie: cookie("OWNER"), params: p(id), body: { content } });
const review = async (id: string, role: Role = "VIEWER") =>
  (await call(reviewRoute.GET, { cookie: cookie(role), params: p(id) })).body.review as { approval: { kind: string; reason?: string }; blockers: unknown[]; comments: { kind: string; body: string }[] };
const putBrand = (section: string, body: unknown) => call(sectionRoute.PUT, { method: "PUT", cookie: cookie("OWNER"), params: { slug: team.slug, section }, body });

async function approved() {
  const id = await draft();
  expect((await submit(id)).status).toBe(200);
  expect((await approve(id)).status).toBe(200);
  return id;
}

beforeEach(async () => {
  team = await createTeamWorkspace("Revisión");
});

describe("aprobación atada a la versión", () => {
  it("borrador → revisión → aprobada, con la huella del contenido y de cada imagen", async () => {
    const id = await draft();
    expect((await submit(id)).body).toMatchObject({ status: "PENDING_APPROVAL" });
    const res = await approve(id);
    expect(res.status).toBe(200);
    const item = await getPrisma().contentItem.findUniqueOrThrow({ where: { id }, include: { currentVersion: true } });
    expect(item.status).toBe("APPROVED");
    const decision = await getPrisma().approvalDecision.findFirstOrThrow({ where: { itemId: id } });
    expect(decision).toMatchObject({ outcome: "APPROVED", versionId: item.currentVersionId, contentHash: item.currentVersion!.contentHash, renderVersion: RENDER_VERSION, invalidatedAt: null });
    expect(decision.frameHashes).toHaveLength(3);
    expect(decision.frameHashes.every((h) => /^[0-9a-f]{64}$/.test(h))).toBe(true);
    expect((await review(id)).approval.kind).toBe("valid");
    const actions = (await getPrisma().auditLog.findMany({ where: { workspaceId: team.id, action: { in: ["content.submitted", "content.approved"] } }, orderBy: { createdAt: "asc" } })).map((a) => a.action);
    expect(actions).toEqual(["content.submitted", "content.approved"]);
  });

  it("las imágenes son reproducibles: renderizar de nuevo da exactamente la huella aprobada", async () => {
    const id = await approved();
    const decision = await getPrisma().approvalDecision.findFirstOrThrow({ where: { itemId: id }, include: { version: true } });
    const visual = await visualContextOf(getPrisma(), team.id);
    for (const [index, hash] of decision.frameHashes.entries()) {
      const bytes = await renderFrameBytes({ format: "CAROUSEL", content: decision.version.content as unknown as AnyContent, index, ...visual });
      expect(bytesHash(bytes!)).toBe(hash);
    }
  });

  it("editar después de aprobar invalida la aprobación y exige aprobar la versión nueva", async () => {
    const id = await approved();
    const res = await save(id, { ...CAROUSEL, caption: `${CAROUSEL.caption} Más texto.` });
    expect(res.body).toMatchObject({ changed: true, status: "DRAFT" });
    const old = await getPrisma().approvalDecision.findFirstOrThrow({ where: { itemId: id } });
    expect(old.invalidatedAt).not.toBeNull();
    expect(old.invalidReason).toBe("content_changed");
    expect(await review(id)).toMatchObject({ approval: { kind: "stale", reason: "content_changed" } });

    // La versión vieja ya no se puede aprobar.
    await submit(id);
    expect((await approve(id, "APPROVER", old.versionId)).body).toMatchObject({ error: "version_changed" });
    expect((await approve(id)).status).toBe(200);
    const decisions = await getPrisma().approvalDecision.findMany({ where: { itemId: id }, orderBy: { createdAt: "asc" } });
    expect(decisions).toHaveLength(2);
    expect(decisions[1]!.invalidatedAt).toBeNull();
    expect(decisions[1]!.versionId).not.toBe(old.versionId);
  });

  it("cambiar la paleta devuelve lo aprobado a revisión; cambiar otras secciones no", async () => {
    await putBrand("visual", { palette: [{ name: "Índigo", hex: "#3D3AD8" }], headingFont: "", bodyFont: "", imageStyle: "" });
    const id = await approved();
    expect((await putBrand("voz", { formality: 2, humor: 2, technicality: 2, enthusiasm: 3, wordsToUse: [], wordsToAvoid: [], emojiPolicy: "FEW", examples: [] })).status).toBe(200);
    // Renombrar un color no cambia las imágenes.
    expect((await putBrand("visual", { palette: [{ name: "Azul", hex: "#3d3ad8" }], headingFont: "", bodyFont: "", imageStyle: "" })).status).toBe(200);
    expect((await current(id)).status).toBe("APPROVED");

    expect((await putBrand("visual", { palette: [{ name: "Naranja", hex: "#FE6A00" }], headingFont: "", bodyFont: "", imageStyle: "" })).status).toBe(200);
    expect((await current(id)).status).toBe("PENDING_APPROVAL");
    expect(await review(id)).toMatchObject({ approval: { kind: "stale", reason: "visual_changed" } });
    expect(await getPrisma().auditLog.count({ where: { workspaceId: team.id, action: "approval.invalidated" } })).toBe(1);
    // Se vuelve a aprobar el mismo texto con las imágenes nuevas.
    expect((await approve(id)).status).toBe(200);
    expect((await review(id)).approval.kind).toBe("valid");
  });

  it("archivar invalida la aprobación", async () => {
    const id = await approved();
    await call(archiveRoute.POST, { method: "POST", cookie: cookie("OWNER"), params: p(id), body: { archived: true } });
    expect(await review(id)).toMatchObject({ approval: { kind: "stale", reason: "archived" } });
  });

  it("no se aprueba dos veces la misma versión", async () => {
    const id = await approved();
    expect((await approve(id)).body).toMatchObject({ error: "already_approved" });
  });
});

describe("bloqueos", () => {
  it("con datos por completar no se envía a revisión ni se aprueba", async () => {
    const id = await draft({ ...CAROUSEL, caption: "Ayudamos a {{cantidad}} empresas.\nGuardá este post." });
    expect((await submit(id)).body).toMatchObject({ error: "review_blocked" });
    await getPrisma().contentItem.update({ where: { id }, data: { status: "PENDING_APPROVAL" } });
    expect((await approve(id)).body).toMatchObject({ error: "review_blocked" });
    expect(await getPrisma().approvalDecision.count({ where: { itemId: id } })).toBe(0);
  });

  it("una imagen sin texto bloquea la aprobación", async () => {
    const id = await draft({ ...CAROUSEL, slides: [CAROUSEL.slides[0], { title: "", body: "" }, CAROUSEL.slides[2]] });
    expect((await submit(id)).body).toMatchObject({ error: "review_blocked" });
    expect((await review(id)).blockers).toContainEqual(expect.objectContaining({ label: "Imágenes" }));
  });

  it("el servidor revalida con las reglas vigentes: una palabra prohibida después del envío bloquea la aprobación", async () => {
    const id = await draft();
    await submit(id);
    await getPrisma().brand.create({ data: { workspaceId: team.id, name: "Marca", voice: { create: { workspaceId: team.id, wordsToAvoid: ["consultas"] } } } });
    expect((await approve(id)).body).toMatchObject({ error: "review_blocked" });
  });

  it("solo se aprueba lo que está en revisión", async () => {
    const id = await draft();
    expect((await approve(id)).body).toMatchObject({ error: "invalid_transition" });
  });
});

describe("comentarios y pedidos de cambio", () => {
  it("pedir cambios exige un motivo, devuelve a borrador y deja el pedido como comentario de esa versión", async () => {
    const id = await draft();
    await submit(id);
    expect((await requestChanges(id, "")).status).toBe(400);
    const res = await requestChanges(id, "La portada promete un dato que no tenemos.");
    expect(res.body).toMatchObject({ status: "DRAFT" });
    const { currentVersionId } = await current(id);
    const comment = await getPrisma().comment.findFirstOrThrow({ where: { itemId: id } });
    expect(comment).toMatchObject({ kind: "CHANGE_REQUEST", versionId: currentVersionId });
    expect(await getPrisma().approvalDecision.findFirst({ where: { itemId: id } })).toMatchObject({ outcome: "CHANGES_REQUESTED" });
  });

  it("los comentarios quedan con su versión y se leen en la revisión", async () => {
    const id = await draft();
    expect((await call(commentsRoute.POST, { method: "POST", cookie: cookie("APPROVER"), params: p(id), body: { body: "  ¿Podemos sumar el caso de la clínica?  " } })).status).toBe(201);
    expect((await call(commentsRoute.POST, { method: "POST", cookie: cookie("APPROVER"), params: p(id), body: { body: "   " } })).status).toBe(400);
    expect((await review(id)).comments).toEqual([expect.objectContaining({ kind: "COMMENT", body: "¿Podemos sumar el caso de la clínica?" })]);
  });
});

describe("permisos por rol", () => {
  it.each<[Role, { submit: boolean; approve: boolean; changes: boolean; comment: boolean }]>([
    ["OWNER", { submit: true, approve: true, changes: true, comment: true }],
    ["EDITOR", { submit: true, approve: false, changes: false, comment: true }],
    ["APPROVER", { submit: false, approve: true, changes: true, comment: true }],
    ["VIEWER", { submit: false, approve: false, changes: false, comment: false }],
  ])("%s", async (role, allowed) => {
    const id = await draft();
    expect((await submit(id, role)).status).toBe(allowed.submit ? 200 : 403);
    if (!allowed.submit) await submit(id, "OWNER");
    expect((await approve(id, role)).status).toBe(allowed.approve ? 200 : 403);

    const other = await draft();
    await submit(other, "OWNER");
    expect((await requestChanges(other, "Cambiar la portada.", role)).status).toBe(allowed.changes ? 200 : 403);
    expect((await call(commentsRoute.POST, { method: "POST", cookie: cookie(role), params: p(other), body: { body: "Hola" } })).status).toBe(allowed.comment ? 201 : 403);
    expect((await call(reviewRoute.GET, { cookie: cookie(role), params: p(other) })).status).toBe(200);
  });
});

describe("aislamiento entre workspaces", () => {
  it("otra empresa no puede revisar, aprobar ni comentar piezas ajenas", async () => {
    const outsiderTeam = await createTeamWorkspace("Otra");
    const outsider = outsiderTeam.members.OWNER.cookie;
    const id = await draft();
    await submit(id);
    for (const slug of [team.slug, outsiderTeam.slug]) {
      expect((await submit(id, "OWNER", slug, outsider)).status).toBe(404);
      expect((await approve(id, "OWNER", undefined, slug, outsider)).status).toBe(404);
      expect((await call(commentsRoute.POST, { method: "POST", cookie: outsider, params: p(id, slug), body: { body: "Hola" } })).status).toBe(404);
      expect((await call(reviewRoute.GET, { cookie: outsider, params: p(id, slug) })).status).toBe(404);
      expect((await call(changesRoute.POST, { method: "POST", cookie: outsider, params: p(id, slug), body: { versionId: "x", note: "Cambiar algo" } })).status).toBe(404);
    }
    expect((await current(id)).status).toBe("PENDING_APPROVAL");
    expect(await getPrisma().comment.count({ where: { itemId: id } })).toBe(0);
  });
});
