import type { Role } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import * as sectionRoute from "@/app/api/w/[slug]/brand/[section]/route";
import * as composeRoute from "@/app/api/w/[slug]/content/[id]/compose/route";
import * as fixRoute from "@/app/api/w/[slug]/content/[id]/fix/route";
import * as generateRoute from "@/app/api/w/[slug]/content/[id]/generate/route";
import * as previewRoute from "@/app/api/w/[slug]/content/[id]/preview/route";
import * as versionsRoute from "@/app/api/w/[slug]/content/[id]/versions/route";
import * as contentRoute from "@/app/api/w/[slug]/content/route";
import { getPrisma } from "@/lib/prisma";
import { setProviderForTests } from "@/modules/ai/providers/registry";
import type { AiProvider } from "@/modules/ai/providers/types";
import { call, ORIGIN } from "@/tests/helpers";
import { createTeamWorkspace, type TeamWorkspace } from "@/tests/integration/fixtures";

const BRAND = {
  identidad: { name: "Kodexa", industry: "Software", description: "Desarrollamos productos digitales para pymes.", website: "https://kodexa.ar", audienceTimezone: "America/Argentina/Buenos_Aires" },
  servicios: { items: [{ name: "Sitios web", description: "" }] },
  publico: { items: [{ name: "Pymes", description: "", painPoints: ["Pocas consultas"] }] },
  objetivos: { items: [{ title: "Conseguir consultas", kpi: "WhatsApp", target: "" }] },
  voz: { formality: 2, humor: 2, technicality: 2, enthusiasm: 3, wordsToUse: [], wordsToAvoid: [], emojiPolicy: "FEW", examples: [] },
  pilares: { items: [{ name: "Casos", description: "", weight: 50 }, { name: "Consejos", description: "", weight: 50 }] },
  visual: { palette: [{ name: "Grafito", hex: "#1F2023" }, { name: "Naranja", hex: "#FE6A00" }], headingFont: "", bodyFont: "", imageStyle: "" },
  datos: { items: [{ statement: "120 consultas atendidas en marzo de 2026", source: "CRM interno" }] },
} as const;

type Slide = { title: string; body: string; design?: { layout: string; proof?: { statement: string } } };
const SLIDES: Slide[] = [
  { title: "Tu web pierde consultas", body: "" },
  { title: "Cómo responder rápido", body: "Respondé en menos de una hora\nUsá respuestas guardadas\nAvisá cuándo volvés" },
  { title: "En marzo", body: "Atendimos 120 consultas de clientes nuevos." },
  { title: "Escribinos hoy", body: "Te mostramos cómo lo hacemos." },
];
const CAROUSEL = { caption: "Respondé en la primera hora.\n\nGuardá este post.", altText: "Slides", hashtags: ["pymes"], slides: SLIDES };

let team: TeamWorkspace;
const cookie = (role: Role) => team.members[role].cookie;
const p = (id: string, slug = team.slug) => ({ slug, id });
const current = async (id: string) => (await getPrisma().contentItem.findUniqueOrThrow({ where: { id }, include: { currentVersion: true } })).currentVersion!;
const slidesOf = async (id: string) => ((await current(id)).content as { slides: Slide[] }).slides;

function scripted(reply: unknown) {
  const prompts: string[] = [];
  const provider: AiProvider = {
    name: "scripted",
    async complete(request) {
      prompts.push(request.messages[0]!.content);
      return { text: JSON.stringify(reply), model: request.model, inputTokens: 1500, outputTokens: 500, truncated: false };
    },
  };
  return { provider, prompts };
}

async function draft(content: unknown = CAROUSEL) {
  const res = await call(contentRoute.POST, { method: "POST", cookie: cookie("OWNER"), params: { slug: team.slug }, body: { format: "CAROUSEL", title: "Consultas" } });
  const id = (res.body.item as { id: string }).id;
  if (content) await call(versionsRoute.POST, { method: "POST", cookie: cookie("OWNER"), params: p(id), body: { content } });
  return id;
}

beforeEach(async () => {
  team = await createTeamWorkspace("Editor");
  for (const [section, body] of Object.entries(BRAND)) {
    await call(sectionRoute.PUT, { method: "PUT", cookie: cookie("OWNER"), params: { slug: team.slug, section }, body });
  }
});
afterEach(() => setProviderForTests(null));

describe("la generación de texto conserva la composición", () => {
  it("un primer borrador llega con composición sugerida (sin costo extra)", async () => {
    setProviderForTests(scripted(CAROUSEL).provider);
    const id = await draft(null);
    expect((await call(generateRoute.POST, { method: "POST", cookie: cookie("OWNER"), params: p(id), body: {} })).status).toBe(201);
    expect((await slidesOf(id)).map((s) => s.design?.layout)).toEqual(["cover-device", "steps", "stat", "cta"]);
    expect(await getPrisma().llmCall.count({ where: { workspaceId: team.id } })).toBe(1);
  });

  it("«Mejorar» mantiene las composiciones que siguen entrando y reemplaza solo las que no", async () => {
    const id = await draft();
    await call(composeRoute.POST, { method: "POST", cookie: cookie("OWNER"), params: p(id), body: { mode: "auto" } });
    // El texto nuevo deja la slide 2 con una sola línea: los pasos ya no entran.
    const improved = { ...CAROUSEL, slides: SLIDES.map((s, i) => (i === 1 ? { ...s, body: "Respondé siempre en la primera hora." } : s)) };
    setProviderForTests(scripted(improved).provider);
    expect((await call(generateRoute.POST, { method: "POST", cookie: cookie("OWNER"), params: p(id), body: { instructions: "Más corto" } })).status).toBe(201);
    const layouts = (await slidesOf(id)).map((s) => s.design?.layout);
    expect(layouts[0]).toBe("cover-device");
    expect(layouts[1]).not.toBe("steps");
    expect(layouts.slice(2)).toEqual(["stat", "cta"]);
  });

  it("la IA nunca ve ni devuelve composiciones: un 'dato grande' inventado se descarta", async () => {
    const id = await draft();
    await call(composeRoute.POST, { method: "POST", cookie: cookie("OWNER"), params: p(id), body: { mode: "auto" } });
    const fake = { ...CAROUSEL, slides: SLIDES.map((s, i) => (i === 2 ? { ...s, design: { layout: "stat", proof: { id: "x", statement: "999 clientes felices", source: "inventado" } } } : s)) };
    const ai = scripted(fake);
    setProviderForTests(ai.provider);
    await call(generateRoute.POST, { method: "POST", cookie: cookie("OWNER"), params: p(id), body: {} });
    expect(ai.prompts[0]).not.toContain('"design"');
    const slides = await slidesOf(id);
    expect(slides[2]!.design?.proof?.statement).toBe("120 consultas atendidas en marzo de 2026");
    expect(JSON.stringify(slides)).not.toContain("999");
  });
});

describe("corregir sugerencias", () => {
  it("toma de la respuesta solo el campo de la sugerencia; el resto queda igual", async () => {
    const id = await draft({ ...CAROUSEL, caption: `${"Una primera línea muy larga que sigue y sigue sin cortar ".repeat(3)}\n\nGuardá este post.` });
    const before = await current(id);
    const reply = { ...CAROUSEL, caption: "Respondé en la primera hora.\n\nGuardá este post.", altText: "OTRO", slides: SLIDES.map((s) => ({ ...s, title: "CAMBIADO" })) };
    const ai = scripted(reply);
    setProviderForTests(ai.provider);
    const res = await call(fixRoute.POST, { method: "POST", cookie: cookie("EDITOR"), params: p(id), body: { checks: ["caption.first-line"] } });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ changed: true });
    const after = (await current(id)).content as typeof CAROUSEL;
    expect(after.caption).toBe("Respondé en la primera hora.\n\nGuardá este post.");
    expect(after.altText).toBe((before.content as typeof CAROUSEL).altText);
    expect(after.slides.map((s) => s.title)).toEqual(SLIDES.map((s) => s.title));
    expect(ai.prompts[0]).toContain("Corregí SOLO estos puntos");
    const llm = await getPrisma().llmCall.findFirstOrThrow({ where: { workspaceId: team.id } });
    expect(llm.operation).toBe("content.fix.CAROUSEL");
    // No consume una de las 5 propuestas.
    expect((await getPrisma().contentItem.findUniqueOrThrow({ where: { id } })).regenerations).toBe(0);
  });

  it("sin nada para corregir no llama a la IA", async () => {
    const id = await draft();
    setProviderForTests(scripted(CAROUSEL).provider);
    const res = await call(fixRoute.POST, { method: "POST", cookie: cookie("OWNER"), params: p(id), body: { checks: ["alt-text"] } });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("nothing_to_fix");
    expect(await getPrisma().llmCall.count({ where: { workspaceId: team.id } })).toBe(0);
  });

  it("los datos por completar no se corrigen con IA (los completa una persona)", async () => {
    const id = await draft({ ...CAROUSEL, caption: "Ayudamos a {{cantidad}} pymes.\n\nGuardá este post." });
    setProviderForTests(scripted(CAROUSEL).provider);
    expect((await call(fixRoute.POST, { method: "POST", cookie: cookie("OWNER"), params: p(id), body: { checks: ["brand.placeholders"] } })).body).toMatchObject({ error: "nothing_to_fix" });
  });

  it.each<[Role, number]>([
    ["APPROVER", 403],
    ["VIEWER", 403],
  ])("%s no puede corregir", async (role, status) => {
    const id = await draft();
    setProviderForTests(scripted(CAROUSEL).provider);
    expect((await call(fixRoute.POST, { method: "POST", cookie: cookie(role), params: p(id), body: {} })).status).toBe(status);
  });
});

describe("vista previa en vivo", () => {
  async function preview(id: string, content: unknown, role: Role = "EDITOR", slug = team.slug, c = cookie(role)) {
    const handler = previewRoute.POST as unknown as (r: Request, ctx: { params: Promise<{ slug: string; id: string }> }) => Promise<Response>;
    const request = new Request(`${ORIGIN}/api/preview`, { method: "POST", headers: { "content-type": "application/json", cookie: c, origin: ORIGIN }, body: JSON.stringify({ content, index: 0 }) });
    return handler(request, { params: Promise.resolve({ slug, id }) });
  }

  it("renderiza el contenido sin guardar y no crea versiones", async () => {
    const id = await draft();
    const versions = await getPrisma().contentVersion.count({ where: { itemId: id } });
    const res = await preview(id, { ...CAROUSEL, slides: SLIDES.map((s, i) => (i === 0 ? { ...s, title: "Otro título", design: { layout: "cover-editorial" } } : s)) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(await getPrisma().contentVersion.count({ where: { itemId: id } })).toBe(versions);
  });

  it("contenido incompleto → 400; lectores → 403; otra empresa → 404", async () => {
    const id = await draft();
    expect((await preview(id, { ...CAROUSEL, slides: [] })).status).toBe(400);
    expect((await preview(id, CAROUSEL, "VIEWER")).status).toBe(403);
    const other = await createTeamWorkspace("Otra");
    expect((await preview(id, CAROUSEL, "OWNER", other.slug, other.members.OWNER.cookie)).status).toBe(404);
  });
});
