import { deflateSync } from "node:zlib";

import type { Role } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";

import * as refRoute from "@/app/api/w/[slug]/brand/references/[refId]/route";
import * as refsRoute from "@/app/api/w/[slug]/brand/references/route";
import * as approveRoute from "@/app/api/w/[slug]/content/[id]/approve/route";
import * as uploadRoute from "@/app/api/w/[slug]/content/[id]/art/upload/route";
import * as renderRoute from "@/app/api/w/[slug]/content/[id]/render/[index]/route";
import * as reviewRoute from "@/app/api/w/[slug]/content/[id]/review/route";
import * as submitRoute from "@/app/api/w/[slug]/content/[id]/submit/route";
import * as versionsRoute from "@/app/api/w/[slug]/content/[id]/versions/route";
import * as contentRoute from "@/app/api/w/[slug]/content/route";
import { getPrisma } from "@/lib/prisma";
import { call, ORIGIN } from "@/tests/helpers";
import { createTeamWorkspace, type TeamWorkspace } from "@/tests/integration/fixtures";

// PNG real de color liso con la medida pedida.
function png(width: number, height: number, rgb: [number, number, number] = [254, 106, 0]) {
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: width }, () => rgb).flat())]);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

const CAROUSEL = {
  caption: "Tu web trabaja cuando Instagram no.\n\nEscribinos por WhatsApp.",
  altText: "Carrusel",
  hashtags: ["pymes"],
  slides: [
    { title: "Instagram es alquilado", body: "" },
    { title: "Qué te da una web", body: "Aparecés en Google" },
    { title: "Escribinos hoy", body: "Te contamos qué necesita la tuya." },
  ],
};

let team: TeamWorkspace;
const cookie = (role: Role) => team.members[role].cookie;

type Handler = (r: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;
async function multipart(handler: unknown, params: Record<string, string>, fields: Record<string, string | Blob>, role: Role = "EDITOR", c = cookie(role)) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  const res = await (handler as Handler)(new Request(`${ORIGIN}/x`, { method: "POST", headers: { cookie: c, origin: ORIGIN }, body: form }), { params: Promise.resolve(params) });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}
const file = (bytes: Buffer, name = "slide.png", type = "image/png") => new File([new Uint8Array(bytes)], name, { type });

async function draft() {
  const res = await call(contentRoute.POST, { method: "POST", cookie: cookie("OWNER"), params: { slug: team.slug }, body: { format: "CAROUSEL", title: "Diseño propio" } });
  const id = (res.body.item as { id: string }).id;
  await call(versionsRoute.POST, { method: "POST", cookie: cookie("OWNER"), params: { slug: team.slug, id }, body: { content: CAROUSEL } });
  return id;
}
const upload = (id: string, index: number, f: Blob, role: Role = "EDITOR") => multipart(uploadRoute.POST, { slug: team.slug, id }, { file: f, index: String(index) }, role);
const withUpload = (assets: Record<number, { id: string; sha256: string }>) => ({
  ...CAROUSEL,
  slides: CAROUSEL.slides.map((s, i) => (assets[i] ? { ...s, design: { layout: "upload", art: { assetId: assets[i]!.id, sha256: assets[i]!.sha256 } } } : s)),
});

beforeEach(async () => {
  team = await createTeamWorkspace("Diseños");
});

describe("diseño propio subido", () => {
  it("valida tipo real, proporción y tamaño", async () => {
    const id = await draft();
    expect((await upload(id, 0, file(Buffer.from("no soy una imagen"), "x.png"))).body).toMatchObject({ error: "upload_not_image" });
    expect((await upload(id, 0, file(png(1080, 1080)))).body).toMatchObject({ error: "upload_wrong_ratio" });
    expect((await upload(id, 0, file(png(800, 1000)))).body).toMatchObject({ error: "upload_too_small" });
    const ok = await upload(id, 0, file(png(1080, 1350), "portada.jpg", "image/jpeg"));
    expect(ok.status).toBe(201);
    expect(ok.body.asset).toMatchObject({ width: 1080, height: 1350 });
    const asset = await getPrisma().imageAsset.findFirstOrThrow({ where: { itemId: id } });
    expect(asset).toMatchObject({ source: "UPLOAD", mimeType: "image/png", uploadedById: team.members.EDITOR.id });
  });

  it.each<Role>(["APPROVER", "VIEWER"])("%s no puede subir diseños", async (role) => {
    const id = await draft();
    expect((await upload(id, 0, file(png(1080, 1350)), role)).status).toBe(403);
  });

  it("se publica tal cual, se aprueba atado al archivo y reemplazarlo invalida la aprobación", async () => {
    const id = await draft();
    const a = (await upload(id, 0, file(png(1080, 1350)))).body.asset as { id: string; sha256: string };
    expect((await call(versionsRoute.POST, { method: "POST", cookie: cookie("EDITOR"), params: { slug: team.slug, id }, body: { content: withUpload({ 0: a }) } })).status).toBe(201);
    const render = await (renderRoute.GET as unknown as Handler)(new Request(`${ORIGIN}/x`, { headers: { cookie: cookie("VIEWER") } }), { params: Promise.resolve({ slug: team.slug, id, index: "0" }) });
    expect(render.status).toBe(200);
    expect((await call(submitRoute.POST, { method: "POST", cookie: cookie("EDITOR"), params: { slug: team.slug, id } })).status).toBe(200);
    const versionId = (await getPrisma().contentItem.findUniqueOrThrow({ where: { id } })).currentVersionId;
    expect((await call(approveRoute.POST, { method: "POST", cookie: cookie("APPROVER"), params: { slug: team.slug, id }, body: { versionId } })).status).toBe(200);
    const decision = await getPrisma().approvalDecision.findFirstOrThrow({ where: { itemId: id } });
    expect(decision.visual).toMatchObject({ layouts: { upload: 1 }, art: [{ index: 0, assetId: a.id, sha256: a.sha256 }] });

    const b = (await upload(id, 0, file(png(1080, 1350, [10, 10, 10])))).body.asset as { id: string; sha256: string };
    expect(b.sha256).not.toBe(a.sha256);
    expect((await call(versionsRoute.POST, { method: "POST", cookie: cookie("EDITOR"), params: { slug: team.slug, id }, body: { content: withUpload({ 0: b }) } })).status).toBe(201);
    const review = await call(reviewRoute.GET, { cookie: cookie("VIEWER"), params: { slug: team.slug, id } });
    expect((review.body.review as { approval: unknown }).approval).toMatchObject({ kind: "stale", reason: "art_changed" });
  });

  it("un diseño de otra pieza no se puede usar", async () => {
    const id = await draft();
    const other = await draft();
    const a = (await upload(other, 0, file(png(1080, 1350)))).body.asset as { id: string; sha256: string };
    expect((await call(versionsRoute.POST, { method: "POST", cookie: cookie("EDITOR"), params: { slug: team.slug, id }, body: { content: withUpload({ 0: a }) } })).body).toMatchObject({ error: "art_not_found" });
  });
});

describe("referencias de la marca", () => {
  it("solo el Dueño las carga y quita; todo el equipo las ve; no salen del workspace", async () => {
    const add = (role: Role) => multipart(refsRoute.POST, { slug: team.slug }, { file: file(png(1080, 1350)), label: "Carrusel de octubre" }, role);
    expect((await add("EDITOR")).status).toBe(403);
    const res = await add("OWNER");
    expect(res.status).toBe(201);
    const ref = res.body.reference as { id: string; label: string };
    expect(ref.label).toBe("Carrusel de octubre");
    expect((await call(refsRoute.GET, { cookie: cookie("VIEWER"), params: { slug: team.slug } })).body.references).toHaveLength(1);
    const get = async (slug: string, c: string) => (refRoute.GET as unknown as Handler)(new Request(`${ORIGIN}/x?descargar`, { headers: { cookie: c } }), { params: Promise.resolve({ slug, refId: ref.id }) });
    const ok = await get(team.slug, cookie("VIEWER"));
    expect(ok.headers.get("content-disposition")).toMatch(/attachment; filename="referencia-/);
    const other = await createTeamWorkspace("Otra");
    expect((await get(other.slug, other.members.OWNER.cookie)).status).toBe(404);
    expect((await call(refRoute.DELETE, { method: "DELETE", cookie: cookie("EDITOR"), params: { slug: team.slug, refId: ref.id } })).status).toBe(403);
    expect((await call(refRoute.DELETE, { method: "DELETE", cookie: cookie("OWNER"), params: { slug: team.slug, refId: ref.id } })).status).toBe(200);
  });
});
