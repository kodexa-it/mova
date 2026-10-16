import type { Role } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as jobsRoute from "@/app/api/jobs/run/route";
import * as sectionRoute from "@/app/api/w/[slug]/brand/[section]/route";
import * as approveContentRoute from "@/app/api/w/[slug]/content/[id]/approve/route";
import * as publicationRoute from "@/app/api/w/[slug]/content/[id]/publication/route";
import * as submitRoute from "@/app/api/w/[slug]/content/[id]/submit/route";
import * as versionsRoute from "@/app/api/w/[slug]/content/[id]/versions/route";
import * as contentRoute from "@/app/api/w/[slug]/content/route";
import * as notificationsRoute from "@/app/api/w/[slug]/notifications/route";
import * as readRoute from "@/app/api/w/[slug]/notifications/read/route";
import * as planRoute from "@/app/api/w/[slug]/plans/[week]/route";
import * as approveRoute from "@/app/api/w/[slug]/plans/[week]/strategy/approve/route";
import * as strategyRoute from "@/app/api/w/[slug]/plans/[week]/strategy/route";
import * as metricsRoute from "@/app/api/w/[slug]/publications/[pubId]/metrics/route";
import * as publicMetricsRoute from "@/app/api/w/[slug]/publications/[pubId]/metrics/public/route";
import { clearMemoryOutbox, getMemoryOutbox } from "@/lib/email/transport";
import { resetEnvCache } from "@/lib/env";
import { getPrisma } from "@/lib/prisma";
import { addDays, todayIn, weekStartOf } from "@/lib/time";
import { setProviderForTests } from "@/modules/ai/providers/registry";
import type { AiProvider } from "@/modules/ai/providers/types";
import { runPendingJobs } from "@/modules/jobs/run";
import { call } from "@/tests/helpers";
import { createTeamWorkspace, type TeamWorkspace } from "@/tests/integration/fixtures";

const BRAND = {
  identidad: { name: "Kodexa", industry: "Software", description: "Desarrollamos sitios y sistemas para pymes.", website: "https://kodexa.ar", audienceTimezone: "America/Argentina/Buenos_Aires" },
  servicios: { items: [{ name: "Sitios web", description: "" }] },
  publico: { items: [{ name: "Pymes", description: "", painPoints: ["Dependen de Instagram"] }] },
  objetivos: { items: [{ title: "Conseguir consultas", kpi: "WhatsApp", target: "" }] },
  voz: { formality: 2, humor: 2, technicality: 2, enthusiasm: 3, wordsToUse: [], wordsToAvoid: [], emojiPolicy: "FEW", examples: [] },
  pilares: { items: [{ name: "Casos", description: "", weight: 50 }, { name: "Consejos", description: "", weight: 50 }] },
  visual: { palette: [{ name: "Grafito", hex: "#1F2023" }, { name: "Naranja", hex: "#FE6A00" }], headingFont: "", bodyFont: "", imageStyle: "" },
} as const;

const CAROUSEL = {
  caption: "Tu web trabaja cuando Instagram no.\n\nEscribinos por WhatsApp.",
  altText: "Carrusel sobre tener web propia",
  hashtags: ["pymes"],
  slides: [
    { title: "Instagram es alquilado", body: "" },
    { title: "Qué te da una web", body: "Aparecés en Google\nOrdenás tus servicios" },
    { title: "Escribinos hoy", body: "Te contamos qué necesita la tuya." },
  ],
};

let team: TeamWorkspace;
let week: string;
let today: string;
const cookie = (role: Role) => team.members[role].cookie;
const wp = (slug = team.slug) => ({ slug, week });

// Proveedor programado: responde la estrategia o la pieza según el pedido.
function scripted(options: { strategy?: unknown; piece?: unknown; failPieces?: boolean } = {}) {
  const calls: string[] = [];
  const provider: AiProvider = {
    name: "scripted",
    async complete(request) {
      const kind = request.system.includes("estratega") ? "strategy" : "piece";
      calls.push(kind);
      if (kind === "piece" && options.failPieces) throw new Error("caído");
      const reply = kind === "strategy" ? options.strategy : (options.piece ?? CAROUSEL);
      return { text: JSON.stringify(reply), model: request.model, inputTokens: 2000, outputTokens: 600, truncated: false };
    },
  };
  return { provider, calls };
}

function strategyAnswer() {
  return {
    summary: "Mostrar por qué depender solo de Instagram es un riesgo.",
    slots: [
      { date: week, time: "10:00", format: "CAROUSEL", pillar: "consejos", goal: "Conseguir consultas", title: "Instagram es alquilado", angle: "Qué pasa si te cierran la cuenta", rationale: "Abre la semana con la pregunta incómoda." },
      { date: addDays(week, 2), time: "19:30", format: "CAROUSEL", pillar: "Casos", goal: "Otro objetivo inventado", title: "La web ordena todo", angle: "Servicios y precios en un lugar", rationale: "Muestra la solución." },
      { date: addDays(week, 9), time: "10:00", format: "REEL", pillar: "Casos", goal: null, title: "Fuera de la semana", angle: "", rationale: "" },
      { date: addDays(week, 3), time: "10:00", format: "PODCAST", pillar: null, goal: null, title: "Formato inválido", angle: "", rationale: "" },
    ],
  };
}

async function setFocus(focus = "Que las pymes entiendan por qué necesitan web propia.") {
  expect((await call(planRoute.PUT, { method: "PUT", cookie: cookie("EDITOR"), params: wp(), body: { focus } })).status).toBe(200);
}
const propose = (role: Role = "EDITOR", body: unknown = { count: 4 }) => call(strategyRoute.POST, { method: "POST", cookie: cookie(role), params: wp(), body });
const status = async (role: Role = "VIEWER") => (await call(strategyRoute.GET, { cookie: cookie(role), params: wp() })).body as { status: string; strategy: { summary: string; slots: { key: string; date: string; title: string; pillar: string | null; goal: string | null; format: string }[] } | null; progress: { total: number; queued: number; done: number; failed: number } | null };
const approve = (role: Role = "EDITOR") => call(approveRoute.POST, { method: "POST", cookie: cookie(role), params: wp(), body: {} });

beforeEach(async () => {
  team = await createTeamWorkspace("Estrategia");
  for (const [section, body] of Object.entries(BRAND)) await call(sectionRoute.PUT, { method: "PUT", cookie: cookie("OWNER"), params: { slug: team.slug, section }, body });
  today = todayIn("America/Argentina/Buenos_Aires");
  week = addDays(weekStartOf(today), 7);
  clearMemoryOutbox();
});
afterEach(() => {
  setProviderForTests(null);
  vi.unstubAllGlobals();
});

describe("propuesta de estrategia semanal", () => {
  it("sin foco guardado no se propone nada (ni se llama a la IA)", async () => {
    const ai = scripted({ strategy: strategyAnswer() });
    setProviderForTests(ai.provider);
    expect((await propose()).body).toMatchObject({ error: "focus_required" });
    expect(ai.calls).toHaveLength(0);
  });

  it("propone con la IA y descarta lo que no cumple las reglas", async () => {
    const ai = scripted({ strategy: strategyAnswer() });
    setProviderForTests(ai.provider);
    await setFocus();
    const res = await propose();
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ dropped: 2 });
    const s = await status();
    expect(s.status).toBe("PROPOSED");
    expect(s.strategy!.slots.map((x) => x.title)).toEqual(["Instagram es alquilado", "La web ordena todo"]);
    // Pilar normalizado al de la marca; objetivo inexistente queda vacío.
    expect(s.strategy!.slots[0]).toMatchObject({ pillar: "Consejos", goal: "Conseguir consultas" });
    expect(s.strategy!.slots[1]).toMatchObject({ pillar: "Casos", goal: null });
    const llm = await getPrisma().llmCall.findFirstOrThrow({ where: { workspaceId: team.id, operation: "plan.strategy" } });
    expect(llm.status).toBe("SUCCEEDED");
    // No se crean piezas hasta aprobar.
    expect(await getPrisma().contentItem.count({ where: { workspaceId: team.id } })).toBe(0);
  });

  it.each<Role>(["APPROVER", "VIEWER"])("%s no puede pedir ni aprobar la estrategia", async (role) => {
    setProviderForTests(scripted({ strategy: strategyAnswer() }).provider);
    await setFocus();
    expect((await propose(role)).status).toBe(403);
    expect((await approve(role)).status).toBe(403);
  });

  it("la persona la edita antes de aprobar; fechas fuera de la semana se rechazan", async () => {
    setProviderForTests(scripted({ strategy: strategyAnswer() }).provider);
    await setFocus();
    await propose();
    const s = await status();
    const edited = { summary: s.strategy!.summary, slots: [{ ...s.strategy!.slots[0]!, title: "Si mañana te cierran Instagram", format: "STORY" }] };
    expect((await call(strategyRoute.PUT, { method: "PUT", cookie: cookie("EDITOR"), params: wp(), body: edited })).status).toBe(200);
    expect((await status()).strategy!.slots).toEqual([expect.objectContaining({ title: "Si mañana te cierran Instagram", format: "STORY" })]);
    const outside = { summary: "", slots: [{ ...edited.slots[0]!, date: addDays(week, 8) }] };
    expect((await call(strategyRoute.PUT, { method: "PUT", cookie: cookie("EDITOR"), params: wp(), body: outside })).status).toBe(400);
  });
});

describe("aprobación y generación en segundo plano", () => {
  async function approved() {
    await setFocus();
    await propose();
    const res = await approve();
    expect(res.status).toBe(201);
    return (res.body.items as { id: string }[]).map((i) => i.id);
  }

  it("crea las piezas con su fecha, las genera y avisa una sola vez a quienes aprueban", async () => {
    const ai = scripted({ strategy: strategyAnswer() });
    setProviderForTests(ai.provider);
    const ids = await approved();
    expect(ids).toHaveLength(2);
    const items = await getPrisma().contentItem.findMany({ where: { id: { in: ids } }, orderBy: { scheduledFor: "asc" }, select: { title: true, status: true, pillar: true, planId: true, scheduledFor: true } });
    expect(items.map((i) => i.status)).toEqual(["DRAFT", "DRAFT"]);
    expect(items.every((i) => i.planId && i.scheduledFor)).toBe(true);
    expect((await status()).progress).toMatchObject({ total: 2, queued: 2 });
    // Aprobar de nuevo no duplica.
    expect((await approve()).body).toMatchObject({ error: "strategy_not_proposed" });

    expect(await runPendingJobs()).toBe(2);
    expect(ai.calls.filter((c) => c === "piece")).toHaveLength(2);
    const after = await getPrisma().contentItem.findMany({ where: { id: { in: ids } }, select: { status: true, currentVersion: { select: { author: true } } } });
    expect(after.map((i) => [i.status, i.currentVersion!.author])).toEqual([
      ["PENDING_APPROVAL", "AI"],
      ["PENDING_APPROVAL", "AI"],
    ]);
    expect((await status()).progress).toMatchObject({ total: 2, queued: 0, done: 2, failed: 0 });

    // Avisos: Dueño y Aprobador (pueden aprobar) y el Editor que aprobó la estrategia; el Lector no.
    const notified = await getPrisma().notification.findMany({ where: { workspaceId: team.id }, select: { userId: true, kind: true, body: true } });
    expect(new Set(notified.map((n) => n.userId))).toEqual(new Set([team.members.OWNER.id, team.members.APPROVER.id, team.members.EDITOR.id]));
    expect(notified[0]!.body).toMatch(/2 piezas están listas para revisar/);
    expect(getMemoryOutbox().map((m) => m.to).sort()).toEqual([team.members.OWNER.email, team.members.APPROVER.email, team.members.EDITOR.email].sort());
    // Volver a correr la cola no repite el aviso.
    await runPendingJobs();
    expect(await getPrisma().notification.count({ where: { workspaceId: team.id } })).toBe(3);
  });

  it("si la IA falla, reintenta y después deja la pieza en borrador y lo avisa", async () => {
    setProviderForTests(scripted({ strategy: strategyAnswer(), failPieces: true }).provider);
    const ids = await approved();
    await runPendingJobs();
    // Los reintentos esperan: se adelantan para el test.
    await getPrisma().job.updateMany({ where: { workspaceId: team.id, status: "QUEUED" }, data: { runAfter: new Date(0) } });
    await runPendingJobs();
    const jobs = await getPrisma().job.findMany({ where: { workspaceId: team.id }, select: { status: true, attempts: true } });
    expect(jobs).toEqual([
      { status: "FAILED", attempts: 2 },
      { status: "FAILED", attempts: 2 },
    ]);
    expect((await getPrisma().contentItem.findMany({ where: { id: { in: ids } }, select: { status: true } })).map((i) => i.status)).toEqual(["DRAFT", "DRAFT"]);
    const note = await getPrisma().notification.findFirstOrThrow({ where: { workspaceId: team.id, userId: team.members.EDITOR.id } });
    expect(note.body).toMatch(/2 necesitan correcciones/);
  });

  it("una pieza con datos por completar queda en borrador (no pasa a revisión)", async () => {
    const piece = { ...CAROUSEL, caption: "Ayudamos a {{cantidad}} pymes.\n\nEscribinos." };
    setProviderForTests(scripted({ strategy: strategyAnswer(), piece }).provider);
    const ids = await approved();
    await runPendingJobs();
    expect((await getPrisma().contentItem.findMany({ where: { id: { in: ids } }, select: { status: true } })).map((i) => i.status)).toEqual(["DRAFT", "DRAFT"]);
  });

  it("si quien aprobó ya no es integrante, la tarea no corre en su nombre", async () => {
    setProviderForTests(scripted({ strategy: strategyAnswer() }).provider);
    await approved();
    await getPrisma().membership.delete({ where: { id: team.members.EDITOR.membershipId } });
    await runPendingJobs();
    expect((await getPrisma().job.findMany({ where: { workspaceId: team.id } })).map((j) => [j.status, j.lastError])).toEqual([
      ["FAILED", "requester_removed"],
      ["FAILED", "requester_removed"],
    ]);
  });

  it("el endpoint del programador exige el secreto", async () => {
    expect((await call(jobsRoute.POST, { method: "POST" })).status).toBe(401);
  });
});

describe("avisos", () => {
  it("cada persona ve y marca solo los suyos", async () => {
    const prisma = getPrisma();
    await prisma.notification.create({ data: { workspaceId: team.id, userId: team.members.APPROVER.id, kind: "x", title: "Para revisar", href: `/w/${team.slug}` } });
    const mine = await call(notificationsRoute.GET, { cookie: cookie("APPROVER"), params: { slug: team.slug } });
    expect(mine.body).toMatchObject({ unread: 1 });
    expect((await call(notificationsRoute.GET, { cookie: cookie("VIEWER"), params: { slug: team.slug } })).body).toMatchObject({ unread: 0, items: [] });
    expect((await call(readRoute.POST, { method: "POST", cookie: cookie("VIEWER"), params: { slug: team.slug }, body: { ids: "all" } })).body).toMatchObject({ marked: 0 });
    expect((await call(readRoute.POST, { method: "POST", cookie: cookie("APPROVER"), params: { slug: team.slug }, body: { ids: "all" } })).body).toMatchObject({ marked: 1 });
    const other = await createTeamWorkspace("Otra");
    expect((await call(notificationsRoute.GET, { cookie: other.members.OWNER.cookie, params: { slug: team.slug } })).status).toBe(404);
  });
});

async function draftPiece() {
  const res = await call(contentRoute.POST, { method: "POST", cookie: cookie("OWNER"), params: { slug: team.slug }, body: { format: "CAROUSEL", title: "Pieza" } });
  const id = (res.body.item as { id: string }).id;
  await call(versionsRoute.POST, { method: "POST", cookie: cookie("OWNER"), params: { slug: team.slug, id }, body: { content: CAROUSEL } });
  return id;
}

describe("publicación y métricas", () => {
  async function approvedPiece() {
    const id = await draftPiece();
    await call(submitRoute.POST, { method: "POST", cookie: cookie("EDITOR"), params: { slug: team.slug, id } });
    const versionId = (await getPrisma().contentItem.findUniqueOrThrow({ where: { id } })).currentVersionId;
    expect((await call(approveContentRoute.POST, { method: "POST", cookie: cookie("APPROVER"), params: { slug: team.slug, id }, body: { versionId } })).status).toBe(200);
    return id;
  }
  const publish = (id: string, body: Record<string, unknown>, role: Role = "EDITOR") => call(publicationRoute.POST, { method: "POST", cookie: cookie(role), params: { slug: team.slug, id }, body });
  const yesterday = () => new Date(Date.now() - 86_400_000).toISOString();

  it("solo se registra una versión aprobada; queda publicada y no se edita más", async () => {
    const draft = await draftPiece();
    expect((await publish(draft, { publishedAt: yesterday(), permalink: "https://www.instagram.com/p/ABCdef123/" })).body).toMatchObject({ error: "not_approved" });

    const id = await approvedPiece();
    expect((await publish(id, { publishedAt: yesterday(), permalink: "https://example.com/p/x" })).body).toMatchObject({ error: "invalid_permalink" });
    expect((await publish(id, { publishedAt: new Date(Date.now() + 86_400_000).toISOString(), permalink: "https://www.instagram.com/p/ABCdef123/" })).body).toMatchObject({ error: "publication_in_future" });
    expect((await publish(id, { publishedAt: yesterday(), permalink: "https://www.instagram.com/p/ABCdef123/" }, "VIEWER")).status).toBe(403);
    const res = await publish(id, { publishedAt: yesterday(), permalink: "https://www.instagram.com/p/ABCdef123/" });
    expect(res.status).toBe(201);
    const item = await getPrisma().contentItem.findUniqueOrThrow({ where: { id }, include: { publication: true } });
    expect(item.status).toBe("PUBLISHED");
    expect(item.publication).toMatchObject({ versionId: item.currentVersionId, shortcode: "ABCdef123" });
    expect((await call(versionsRoute.POST, { method: "POST", cookie: cookie("OWNER"), params: { slug: team.slug, id }, body: { content: { ...CAROUSEL, caption: "Otro.\n\nEscribinos." } } })).body).toMatchObject({ error: "content_locked" });
    // El mismo enlace no se registra en otra pieza.
    const second = await approvedPiece();
    expect((await publish(second, { publishedAt: yesterday(), permalink: "https://www.instagram.com/reel/ABCdef123/" })).body).toMatchObject({ error: "permalink_used" });
  });

  it("métricas manuales y públicas (Apify) con su fuente; aprendizajes recién con 6 medidas a 7 días", async () => {
    const id = await approvedPiece();
    const pub = (await publish(id, { publishedAt: yesterday(), permalink: "https://www.instagram.com/p/ABCdef124/" })).body.publication as { id: string };
    const manual = await call(metricsRoute.POST, { method: "POST", cookie: cookie("EDITOR"), params: { slug: team.slug, pubId: pub.id }, body: { reach: 900, saves: 12, inquiries: 2 } });
    expect(manual.status).toBe(201);
    expect((await call(metricsRoute.POST, { method: "POST", cookie: cookie("APPROVER"), params: { slug: team.slug, pubId: pub.id }, body: { reach: 1 } })).status).toBe(403);

    // Apify: sin token, 503; con token y confirmación, guarda lo público.
    expect((await call(publicMetricsRoute.POST, { method: "POST", cookie: cookie("EDITOR"), params: { slug: team.slug, pubId: pub.id }, body: { confirm: true } })).body).toMatchObject({ error: "apify_not_configured" });
    process.env.APIFY_TOKEN = "token-de-prueba";
    resetEnvCache();
    try {
      const fetchMock = vi.fn(async () => Response.json([{ shortCode: "ABCdef124", likesCount: 40, commentsCount: 5, videoPlayCount: null }]));
      vi.stubGlobal("fetch", fetchMock);
      expect((await call(publicMetricsRoute.POST, { method: "POST", cookie: cookie("EDITOR"), params: { slug: team.slug, pubId: pub.id }, body: {} })).status).toBe(400);
      const res = await call(publicMetricsRoute.POST, { method: "POST", cookie: cookie("EDITOR"), params: { slug: team.slug, pubId: pub.id }, body: { confirm: true } });
      expect(res.body.snapshot).toMatchObject({ likes: 40, comments: 5, costMicros: 2700 });
      const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toContain("maxTotalChargeUsd=0.01");
      expect(url).not.toContain("token-de-prueba");
      expect(JSON.parse(init.body as string)).toEqual({ username: ["https://www.instagram.com/p/ABCdef124/"], dataDetailLevel: "detailedData" });
    } finally {
      delete process.env.APIFY_TOKEN;
      resetEnvCache();
    }
    const snaps = await getPrisma().metricSnapshot.findMany({ where: { publicationId: pub.id }, orderBy: { capturedAt: "asc" } });
    expect(snaps.map((s) => s.source)).toEqual(["MANUAL", "APIFY_PUBLIC"]);
  });

  it("con 6 publicaciones medidas a 7 días, la estrategia recibe los aprendizajes", async () => {
    const prisma = getPrisma();
    for (let i = 0; i < 6; i++) {
      const id = await approvedPiece();
      const publishedAt = new Date(Date.now() - 10 * 86_400_000);
      const pub = await prisma.publication.create({ data: { workspaceId: team.id, itemId: id, versionId: "v", approvalId: "a", publishedAt, permalink: `https://www.instagram.com/p/POST${i}abc/`, shortcode: `POST${i}abc` } });
      await prisma.contentItem.update({ where: { id }, data: { status: "PUBLISHED", format: i < 3 ? "CAROUSEL" : "REEL" } });
      await prisma.metricSnapshot.create({ data: { workspaceId: team.id, publicationId: pub.id, source: "MANUAL", ageHours: 170, likes: i < 3 ? 100 : 20, comments: 5, saves: 3, inquiries: i === 0 ? 2 : 0 } });
    }
    const ai = scripted({ strategy: strategyAnswer() });
    const prompts: string[] = [];
    const base = ai.provider.complete.bind(ai.provider);
    setProviderForTests({ name: "scripted", complete: async (r) => (prompts.push(r.messages[0]!.content), base(r)) });
    await setFocus();
    await propose();
    expect(prompts[0]).toMatch(/Aprendizajes de resultados anteriores/);
    expect(prompts[0]).toMatch(/Formato con más interacciones: Carrusel/);
  });
});
