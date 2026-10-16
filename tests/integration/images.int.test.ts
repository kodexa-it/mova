import type { Role } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import * as sectionRoute from "@/app/api/w/[slug]/brand/[section]/route";
import * as approveRoute from "@/app/api/w/[slug]/content/[id]/approve/route";
import * as assetRoute from "@/app/api/w/[slug]/content/[id]/art/[assetId]/route";
import * as quoteRoute from "@/app/api/w/[slug]/content/[id]/art/quote/route";
import * as artRoute from "@/app/api/w/[slug]/content/[id]/art/route";
import * as composeRoute from "@/app/api/w/[slug]/content/[id]/compose/route";
import * as renderRoute from "@/app/api/w/[slug]/content/[id]/render/[index]/route";
import * as reviewRoute from "@/app/api/w/[slug]/content/[id]/review/route";
import * as itemRoute from "@/app/api/w/[slug]/content/[id]/route";
import * as submitRoute from "@/app/api/w/[slug]/content/[id]/submit/route";
import * as versionsRoute from "@/app/api/w/[slug]/content/[id]/versions/route";
import * as contentRoute from "@/app/api/w/[slug]/content/route";
import * as imageUsageRoute from "@/app/api/w/[slug]/usage/images/route";
import { getPrisma } from "@/lib/prisma";
import { AiProviderError } from "@/modules/ai/providers/types";
import { setImageProviderForTests } from "@/modules/images/providers/registry";
import type { ImageProvider, ImageRequest } from "@/modules/images/providers/types";
import { call, ORIGIN } from "@/tests/helpers";
import { createTeamWorkspace, type TeamWorkspace } from "@/tests/integration/fixtures";

// PNG real de 4×5 píxeles: el proveedor simulado lo devuelve como "imagen generada".
const PNG = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAQAAAAFCAIAAADtz9qMAAAAEElEQVR4nGP4z8AARwxkcACbwRPtBhPQCgAAAABJRU5ErkJggg==", "base64"));

const CAROUSEL = {
  caption: "Respondé en la primera hora.\n\nGuardá este post.",
  altText: "Slides",
  hashtags: ["pymes"],
  slides: [
    { title: "Tu web pierde consultas", body: "" },
    { title: "Cómo responder rápido", body: "Respondé en menos de una hora\nUsá respuestas guardadas" },
    { title: "Escribinos hoy", body: "Te mostramos cómo lo hacemos." },
  ],
};

let team: TeamWorkspace;
const cookie = (role: Role) => team.members[role].cookie;
const p = (id: string, slug = team.slug) => ({ slug, id });

function fakeProvider(options: { fail?: string; usage?: boolean } = {}) {
  const calls: ImageRequest[] = [];
  const provider: ImageProvider = {
    name: "fake",
    async generate(request) {
      calls.push(request);
      if (options.fail) throw new AiProviderError(options.fail, "detalle");
      // Bytes distintos por llamada (como una imagen nueva): cambia el sha256.
      const bytes = new Uint8Array([...PNG, calls.length]);
      return { bytes, mimeType: "image/png", usage: options.usage === false ? null : { inputTokens: 400, outputTokens: 1680 } };
    },
  };
  return { provider, calls };
}

async function draft(visualMode: "AI" | "STANDARD" = "AI") {
  const res = await call(contentRoute.POST, { method: "POST", cookie: cookie("OWNER"), params: { slug: team.slug }, body: { format: "CAROUSEL", title: "Consultas", visualMode } });
  const id = (res.body.item as { id: string }).id;
  await call(versionsRoute.POST, { method: "POST", cookie: cookie("OWNER"), params: p(id), body: { content: CAROUSEL } });
  return id;
}

const ask = (id: string, body: Record<string, unknown> = {}, role: Role = "EDITOR", slug = team.slug, c = cookie(role)) =>
  call(quoteRoute.POST, { method: "POST", cookie: c, params: p(id, slug), body: { content: CAROUSEL, index: 0, layout: "art-cover", ...body } });

let keys = 0;
const newKey = () => `clave-de-prueba-${Date.now()}-${++keys}`;
async function generate(id: string, body: Record<string, unknown> = {}, role: Role = "EDITOR") {
  const quote = await ask(id, body, role);
  return call(artRoute.POST, { method: "POST", cookie: cookie(role), params: p(id), body: { content: CAROUSEL, index: 0, layout: "art-cover", requestKey: newKey(), confirmMicros: quote.body.estimateMicros, ...body } });
}
const gens = () => getPrisma().imageGeneration.findMany({ where: { workspaceId: team.id }, orderBy: { createdAt: "asc" } });
type Asset = { id: string; sha256: string };
const withArt = (arts: Record<number, { layout: string; asset: Asset }>) => ({
  ...CAROUSEL,
  slides: CAROUSEL.slides.map((s, i) => (arts[i] ? { ...s, design: { layout: arts[i]!.layout, art: { assetId: arts[i]!.asset.id, sha256: arts[i]!.asset.sha256 } } } : s)),
});

beforeEach(async () => {
  team = await createTeamWorkspace("Imágenes");
  await call(sectionRoute.PUT, { method: "PUT", cookie: cookie("OWNER"), params: { slug: team.slug, section: "visual" }, body: { palette: [{ name: "Grafito", hex: "#1F2023" }, { name: "Naranja", hex: "#FE6A00" }], headingFont: "", bodyFont: "", imageStyle: "luminoso y minimalista" } });
});
afterEach(() => setImageProviderForTests(null));

describe("modo visual y configuración", () => {
  it("con el modo estándar (por defecto) no se puede cotizar ni generar", async () => {
    setImageProviderForTests(fakeProvider().provider);
    const id = await draft("STANDARD");
    expect((await getPrisma().contentItem.findUniqueOrThrow({ where: { id } })).visualMode).toBe("STANDARD");
    expect((await ask(id)).body).toMatchObject({ error: "visual_mode_standard" });
    // Se activa por pieza (sin generar nada).
    expect((await call(itemRoute.PATCH, { method: "PATCH", cookie: cookie("EDITOR"), params: p(id), body: { visualMode: "AI" } })).status).toBe(200);
    expect((await ask(id)).status).toBe(200);
    expect(await getPrisma().imageGeneration.count({ where: { workspaceId: team.id } })).toBe(0);
  });

  it("sin proveedor configurado la cotización lo informa y generar devuelve 503 sin registrar nada", async () => {
    const id = await draft();
    expect((await ask(id)).body).toMatchObject({ configured: false, estimateMicros: null });
    const res = await call(artRoute.POST, { method: "POST", cookie: cookie("EDITOR"), params: p(id), body: { content: CAROUSEL, index: 0, layout: "art-cover", requestKey: newKey(), confirmMicros: 1 } });
    expect(res).toMatchObject({ status: 503, body: { error: "images_not_configured" } });
    expect(await gens()).toHaveLength(0);
  });

  it("la cotización muestra el precio publicado y no llama al proveedor", async () => {
    const fake = fakeProvider();
    setImageProviderForTests(fake.provider);
    const id = await draft();
    const quote = await ask(id);
    expect(quote.body).toMatchObject({ configured: true, model: "Gemini 3.1 Flash Image", imageSize: "2K", aspectRatio: "4:5", blocked: false, reusable: [] });
    expect(quote.body.estimateMicros).toBeGreaterThanOrEqual(101_000);
    expect(String(quote.body.precision)).toMatch(/0\.101 por imagen 2K/);
    expect((await ask(id, { index: 1, layout: "art-panel" })).body).toMatchObject({ imageSize: "1K" });
    expect(fake.calls).toHaveLength(0);
  });

  it("composición que no corresponde a la posición → 400", async () => {
    setImageProviderForTests(fakeProvider().provider);
    const id = await draft();
    expect((await ask(id, { index: 1, layout: "art-cover" })).body).toMatchObject({ error: "layout_not_allowed" });
  });
});

describe("confirmación explícita y costos", () => {
  it("genera solo con la confirmación del costo vigente y registra proveedor, modelo, consumo y costo real", async () => {
    const fake = fakeProvider();
    setImageProviderForTests(fake.provider);
    const id = await draft();
    // Sin confirmación, o con un costo distinto al vigente: no llama.
    expect((await call(artRoute.POST, { method: "POST", cookie: cookie("EDITOR"), params: p(id), body: { content: CAROUSEL, index: 0, layout: "art-cover", requestKey: newKey() } })).status).toBe(400);
    expect((await call(artRoute.POST, { method: "POST", cookie: cookie("EDITOR"), params: p(id), body: { content: CAROUSEL, index: 0, layout: "art-cover", requestKey: newKey(), confirmMicros: 5 } })).body).toMatchObject({ error: "estimate_changed" });
    expect(fake.calls).toHaveLength(0);

    const res = await generate(id);
    expect(res.status).toBe(201);
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]).toMatchObject({ model: "gemini-3.1-flash-image", aspectRatio: "4:5", imageSize: "2K" });
    expect(fake.calls[0]!.prompt).toMatch(/No text of any kind/);
    const [gen] = await gens();
    // 400 tokens de entrada a USD 0,50/M + 1680 de imagen a USD 60/M.
    expect(gen).toMatchObject({ status: "SUCCEEDED", provider: "fake", model: "gemini-3.1-flash-image", inputTokens: 400, outputTokens: 1680, costMicros: 200 + 100_800, costSource: "usage", reservedMicros: Math.ceil(gen!.estimatedMicros * 1.25) });
    expect(res.body).toMatchObject({ costMicros: 101_000, costSource: "usage", reused: false });
    const asset = await getPrisma().imageAsset.findUniqueOrThrow({ where: { id: gen!.assetId! } });
    expect(asset).toMatchObject({ workspaceId: team.id, itemId: id, slotIndex: 0, width: 4, height: 5, mimeType: "image/png" });
    expect(await getPrisma().auditLog.count({ where: { workspaceId: team.id, action: "content.art_generated" } })).toBe(1);
    // Generar no cambia la pieza: no hay versión nueva hasta guardar.
    expect(await getPrisma().contentVersion.count({ where: { itemId: id } })).toBe(2);
  });

  it("la misma confirmación (doble clic o reintento) no genera ni cobra dos veces", async () => {
    const fake = fakeProvider();
    setImageProviderForTests(fake.provider);
    const id = await draft();
    const quote = await ask(id);
    const body = { content: CAROUSEL, index: 0, layout: "art-cover", requestKey: newKey(), confirmMicros: quote.body.estimateMicros };
    const first = await call(artRoute.POST, { method: "POST", cookie: cookie("EDITOR"), params: p(id), body });
    const again = await call(artRoute.POST, { method: "POST", cookie: cookie("EDITOR"), params: p(id), body });
    expect(again.body).toMatchObject({ reused: true, asset: (first.body as { asset: unknown }).asset });
    expect(fake.calls).toHaveLength(1);
    expect(await gens()).toHaveLength(1);
  });

  it("ofrece reutilizar sin costo una imagen del mismo pedido", async () => {
    setImageProviderForTests(fakeProvider().provider);
    const id = await draft();
    const res = await generate(id);
    const quote = await ask(id);
    expect(quote.body.reusable).toEqual([expect.objectContaining({ assetId: (res.body.asset as Asset).id })]);
    // Otra dirección de arte es otro pedido.
    expect((await ask(id, { brief: "tonos fríos" })).body.reusable).toEqual([]);
  });

  it("sin consumo informado, registra la estimación como costo", async () => {
    setImageProviderForTests(fakeProvider({ usage: false }).provider);
    const id = await draft();
    await generate(id);
    const [gen] = await gens();
    expect(gen).toMatchObject({ costSource: "estimate", costMicros: gen!.estimatedMicros });
  });

  it("límite mensual: si no alcanza, registra el bloqueo y no llama al proveedor", async () => {
    const fake = fakeProvider();
    setImageProviderForTests(fake.provider);
    await getPrisma().workspace.update({ where: { id: team.id }, data: { imageMonthlyBudgetMicros: 50_000 } });
    const id = await draft();
    expect((await ask(id)).body).toMatchObject({ blocked: true });
    const res = await generate(id);
    expect(res).toMatchObject({ status: 402, body: { error: "images_budget_exhausted" } });
    expect(fake.calls).toHaveLength(0);
    expect((await gens()).map((g) => g.status)).toEqual(["BLOCKED"]);
  });

  it("el límite cuenta lo gastado en el mes y se puede subir (solo Dueño, con auditoría)", async () => {
    setImageProviderForTests(fakeProvider().provider);
    await getPrisma().workspace.update({ where: { id: team.id }, data: { imageMonthlyBudgetMicros: 200_000 } });
    const id = await draft();
    expect((await generate(id)).status).toBe(201);
    expect((await generate(id, { brief: "otra" })).status).toBe(402);
    expect((await call(imageUsageRoute.PUT, { method: "PUT", cookie: cookie("EDITOR"), params: { slug: team.slug }, body: { usd: 5 } })).status).toBe(403);
    expect((await call(imageUsageRoute.PUT, { method: "PUT", cookie: cookie("OWNER"), params: { slug: team.slug }, body: { usd: 5 } })).status).toBe(200);
    expect((await generate(id, { brief: "otra" })).status).toBe(201);
    const usage = await call(imageUsageRoute.GET, { cookie: cookie("OWNER"), params: { slug: team.slug } });
    expect(usage.body).toMatchObject({ limitMicros: 5_000_000, spentMicros: 202_000 });
    expect(await getPrisma().auditLog.count({ where: { workspaceId: team.id, action: "usage.image_budget_updated" } })).toBe(1);
  });
});

describe("errores del proveedor", () => {
  it.each([
    ["provider_no_credits", "images_no_credits"],
    ["provider_auth", "images_auth"],
    ["provider_rejected", "images_rejected"],
    ["provider_rate_limited", "images_rate_limited"],
    ["provider_timeout", "images_failed"],
  ])("%s → 502 %s, sin costo y sin imagen", async (code, publicCode) => {
    setImageProviderForTests(fakeProvider({ fail: code }).provider);
    const id = await draft();
    const res = await generate(id);
    expect(res).toMatchObject({ status: 502, body: { error: publicCode } });
    const [gen] = await gens();
    expect(gen).toMatchObject({ status: "FAILED", errorCode: code, costMicros: 0, assetId: null });
    expect(await getPrisma().imageAsset.count({ where: { workspaceId: team.id } })).toBe(0);
    // La reserva se libera: el gasto del mes sigue en cero.
    expect((await call(imageUsageRoute.GET, { cookie: cookie("OWNER"), params: { slug: team.slug } })).body).toMatchObject({ spentMicros: 0 });
  });
});

describe("permisos y aislamiento", () => {
  it.each<Role>(["APPROVER", "VIEWER"])("%s no puede cotizar ni generar", async (role) => {
    const fake = fakeProvider();
    setImageProviderForTests(fake.provider);
    const id = await draft();
    expect((await ask(id, {}, role)).status).toBe(403);
    expect((await call(artRoute.POST, { method: "POST", cookie: cookie(role), params: p(id), body: { content: CAROUSEL, index: 0, layout: "art-cover", requestKey: newKey(), confirmMicros: 1 } })).status).toBe(403);
    expect(fake.calls).toHaveLength(0);
  });

  it("las imágenes no salen de su workspace", async () => {
    setImageProviderForTests(fakeProvider().provider);
    const id = await draft();
    const asset = (await generate(id)).body.asset as Asset;
    const get = (slug: string, c: string, itemId = id) =>
      (assetRoute.GET as unknown as (r: Request, ctx: { params: Promise<{ slug: string; id: string; assetId: string }> }) => Promise<Response>)(new Request(`${ORIGIN}/x`, { headers: { cookie: c, origin: ORIGIN } }), { params: Promise.resolve({ slug, id: itemId, assetId: asset.id }) });
    const ok = await get(team.slug, cookie("VIEWER"));
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("image/png");
    const other = await createTeamWorkspace("Otra");
    expect((await get(other.slug, other.members.OWNER.cookie)).status).toBe(404);
    expect((await ask(id, {}, "OWNER", other.slug, other.members.OWNER.cookie)).status).toBe(404);
    // Tampoco se puede usar en una pieza de otro workspace ni en otra pieza.
    const res = await call(contentRoute.POST, { method: "POST", cookie: other.members.OWNER.cookie, params: { slug: other.slug }, body: { format: "CAROUSEL", title: "Ajena" } });
    const foreign = (res.body.item as { id: string }).id;
    expect((await call(versionsRoute.POST, { method: "POST", cookie: other.members.OWNER.cookie, params: { slug: other.slug, id: foreign }, body: { content: withArt({ 0: { layout: "art-cover", asset } }) } })).body).toMatchObject({ error: "art_not_found" });
    const sibling = await draft();
    expect((await call(versionsRoute.POST, { method: "POST", cookie: cookie("OWNER"), params: p(sibling), body: { content: withArt({ 0: { layout: "art-cover", asset } }) } })).body).toMatchObject({ error: "art_not_found" });
    // Una huella que no coincide tampoco.
    expect((await call(versionsRoute.POST, { method: "POST", cookie: cookie("OWNER"), params: p(id), body: { content: withArt({ 0: { layout: "art-cover", asset: { ...asset, sha256: "0".repeat(64) } } }) } })).body).toMatchObject({ error: "art_not_found" });
  });
});

describe("regeneración individual, versiones y aprobación", () => {
  it("regenerar una imagen solo cambia esa posición; la aprobación cae con motivo explícito", async () => {
    const fake = fakeProvider();
    setImageProviderForTests(fake.provider);
    const id = await draft();
    const cover = (await generate(id)).body.asset as Asset;
    const panel = (await generate(id, { index: 2, layout: "art-panel" })).body.asset as Asset;
    expect(fake.calls.map((c) => c.imageSize)).toEqual(["2K", "1K"]);
    const content = withArt({ 0: { layout: "art-cover", asset: cover }, 2: { layout: "art-panel", asset: panel } });
    expect((await call(versionsRoute.POST, { method: "POST", cookie: cookie("OWNER"), params: p(id), body: { content } })).status).toBe(201);

    // Se renderiza con la imagen (PNG real) y se aprueba.
    const render = await (renderRoute.GET as unknown as (r: Request, ctx: { params: Promise<{ slug: string; id: string; index: string }> }) => Promise<Response>)(new Request(`${ORIGIN}/x`, { headers: { cookie: cookie("VIEWER") } }), { params: Promise.resolve({ slug: team.slug, id, index: "0" }) });
    expect(render.status).toBe(200);
    expect((await call(submitRoute.POST, { method: "POST", cookie: cookie("EDITOR"), params: p(id) })).status).toBe(200);
    const versionId = (await getPrisma().contentItem.findUniqueOrThrow({ where: { id } })).currentVersionId;
    expect((await call(approveRoute.POST, { method: "POST", cookie: cookie("APPROVER"), params: p(id), body: { versionId } })).status).toBe(200);
    const decision = await getPrisma().approvalDecision.findFirstOrThrow({ where: { itemId: id } });
    expect(decision.visual).toMatchObject({ layouts: { "art-cover": 1, "art-panel": 1 }, art: [{ index: 0, assetId: cover.id, sha256: cover.sha256 }, { index: 2, assetId: panel.id, sha256: panel.sha256 }] });

    // Regenerar solo la portada: una llamada más, la del panel no se repite.
    const again = (await generate(id, { brief: "más luz" })).body.asset as Asset;
    expect(fake.calls).toHaveLength(3);
    expect(again.sha256).not.toBe(cover.sha256);
    const next = withArt({ 0: { layout: "art-cover", asset: again }, 2: { layout: "art-panel", asset: panel } });
    expect((await call(versionsRoute.POST, { method: "POST", cookie: cookie("OWNER"), params: p(id), body: { content: next } })).status).toBe(201);
    const saved = (await getPrisma().contentItem.findUniqueOrThrow({ where: { id }, include: { currentVersion: true } })).currentVersion!.content as typeof next;
    expect(saved.slides[2]).toEqual(content.slides[2]);
    expect(saved.slides[1]).toEqual(content.slides[1]);
    const review = await call(reviewRoute.GET, { cookie: cookie("VIEWER"), params: p(id) });
    expect((review.body.review as { approval: unknown }).approval).toMatchObject({ kind: "stale", reason: "art_changed" });
    expect((await getPrisma().approvalDecision.findFirstOrThrow({ where: { itemId: id } })).invalidReason).toBe("art_changed");
  });

  it("«Mejorar composición» no toca las imágenes generadas", async () => {
    setImageProviderForTests(fakeProvider().provider);
    const id = await draft();
    const cover = (await generate(id)).body.asset as Asset;
    await call(versionsRoute.POST, { method: "POST", cookie: cookie("OWNER"), params: p(id), body: { content: withArt({ 0: { layout: "art-cover", asset: cover } }) } });
    expect((await call(composeRoute.POST, { method: "POST", cookie: cookie("OWNER"), params: p(id), body: { mode: "auto" } })).status).toBe(200);
    const slides = ((await getPrisma().contentItem.findUniqueOrThrow({ where: { id }, include: { currentVersion: true } })).currentVersion!.content as { slides: { design?: { layout: string; art?: { assetId: string } } }[] }).slides;
    expect(slides[0]!.design).toEqual({ layout: "art-cover", art: { assetId: cover.id, sha256: cover.sha256 } });
    expect(slides[2]!.design?.layout).toBe("cta");
  });

  it("una composición con imagen sin imagen elegida no se puede enviar a revisión", async () => {
    const id = await draft();
    const content = { ...CAROUSEL, slides: CAROUSEL.slides.map((s, i) => (i === 0 ? { ...s, design: { layout: "art-cover" } } : s)) };
    await call(versionsRoute.POST, { method: "POST", cookie: cookie("OWNER"), params: p(id), body: { content } });
    expect((await call(submitRoute.POST, { method: "POST", cookie: cookie("EDITOR"), params: p(id) })).body).toMatchObject({ error: "review_blocked" });
  });
});
