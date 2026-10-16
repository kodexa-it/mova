import type { Role } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import * as sectionRoute from "@/app/api/w/[slug]/brand/[section]/route";
import * as approveRoute from "@/app/api/w/[slug]/content/[id]/approve/route";
import * as composeRoute from "@/app/api/w/[slug]/content/[id]/compose/route";
import * as reviewRoute from "@/app/api/w/[slug]/content/[id]/review/route";
import * as submitRoute from "@/app/api/w/[slug]/content/[id]/submit/route";
import * as versionsRoute from "@/app/api/w/[slug]/content/[id]/versions/route";
import * as contentRoute from "@/app/api/w/[slug]/content/route";
import { getPrisma } from "@/lib/prisma";
import { setProviderForTests } from "@/modules/ai/providers/registry";
import type { AiProvider } from "@/modules/ai/providers/types";
import { contentHash } from "@/modules/content/hash";
import { withoutDesigns } from "@/modules/content/layouts";
import { call } from "@/tests/helpers";
import { createTeamWorkspace, type TeamWorkspace } from "@/tests/integration/fixtures";

const CAROUSEL = {
  caption: "Atendimos 120 consultas en marzo.\n\nGuardá este post.",
  altText: "Slides",
  hashtags: ["pymes"],
  slides: [
    { title: "Tu web pierde consultas", body: "" },
    { title: "Cómo responder rápido", body: "Respondé en menos de una hora\nUsá respuestas guardadas\nAvisá cuándo volvés" },
    { title: "En marzo", body: "Atendimos 120 consultas de clientes nuevos." },
    { title: "Escribinos hoy", body: "Te mostramos cómo lo hacemos." },
  ],
};
const IDENTITY = { name: "Kodexa", industry: "Software", description: "Desarrollamos productos digitales para pymes.", website: "https://kodexa.ar", audienceTimezone: "America/Argentina/Buenos_Aires" };

let team: TeamWorkspace;
const cookie = (role: Role) => team.members[role].cookie;
const p = (id: string, slug = team.slug) => ({ slug, id });
const putBrand = (section: string, body: unknown) => call(sectionRoute.PUT, { method: "PUT", cookie: cookie("OWNER"), params: { slug: team.slug, section }, body });
const compose = (id: string, mode: "ai" | "auto", role: Role = "EDITOR", slug = team.slug, c = cookie(role)) =>
  call(composeRoute.POST, { method: "POST", cookie: c, params: p(id, slug), body: { mode } });
const current = (id: string) => getPrisma().contentItem.findUniqueOrThrow({ where: { id }, include: { currentVersion: true } });

async function draft(content: unknown = CAROUSEL) {
  const res = await call(contentRoute.POST, { method: "POST", cookie: cookie("OWNER"), params: { slug: team.slug }, body: { format: "CAROUSEL", title: "Consultas" } });
  const id = (res.body.item as { id: string }).id;
  await call(versionsRoute.POST, { method: "POST", cookie: cookie("OWNER"), params: p(id), body: { content } });
  return id;
}
async function approve(id: string) {
  expect((await call(submitRoute.POST, { method: "POST", cookie: cookie("OWNER"), params: p(id) })).status).toBe(200);
  const res = await call(approveRoute.POST, { method: "POST", cookie: cookie("APPROVER"), params: p(id), body: { versionId: (await current(id)).currentVersionId } });
  expect(res.status).toBe(200);
}
const approval = async (id: string) => ((await call(reviewRoute.GET, { cookie: cookie("OWNER"), params: p(id) })).body.review as { approval: { kind: string; reason?: string } }).approval;

function scripted(reply: string) {
  const requests: { system: string; content: string }[] = [];
  const provider: AiProvider = {
    name: "scripted",
    async complete(request) {
      requests.push({ system: request.system, content: request.messages[0]!.content });
      return { text: reply, model: request.model, inputTokens: 900, outputTokens: 120, truncated: false };
    },
  };
  return { provider, requests };
}

beforeEach(async () => {
  team = await createTeamWorkspace("Composición");
  await putBrand("identidad", IDENTITY);
  await putBrand("datos", { items: [{ statement: "120 consultas atendidas en marzo de 2026", source: "CRM interno" }] });
});
afterEach(() => setProviderForTests(null));

describe("mejorar composición", () => {
  it("la sugerencia automática solo cambia diseños, guarda una versión de Mova y no usa IA", async () => {
    const id = await draft();
    const before = await current(id);
    const res = await compose(id, "auto");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ changed: true, mode: "auto", replaced: 0 });
    const after = await current(id);
    expect(after.currentVersion!.author).toBe("AI");
    expect(after.currentVersion!.llmCallId).toBeNull();
    expect(contentHash(withoutDesigns("CAROUSEL", after.currentVersion!.content as Record<string, unknown>))).toBe(before.currentVersion!.contentHash);
    const slides = (after.currentVersion!.content as { slides: { design?: { layout: string; proof?: { statement: string } } }[] }).slides;
    expect(slides.map((s) => s.design?.layout)).toEqual(["cover-device", "steps", "stat", "cta"]);
    // El dato grande es una copia del dato publicable, no un texto de la IA.
    expect(slides[2]!.design!.proof!.statement).toBe("120 consultas atendidas en marzo de 2026");
    expect(await getPrisma().llmCall.count({ where: { workspaceId: team.id } })).toBe(0);
    // Volver a pedir lo mismo no crea otra versión.
    expect((await compose(id, "auto")).body).toMatchObject({ changed: false });
  });

  it("con IA: elige del catálogo, se valida en el servidor y lo inválido se reemplaza", async () => {
    const proofId = (await getPrisma().proofItem.findFirstOrThrow({ where: { workspaceId: team.id } })).id;
    const ai = scripted(
      JSON.stringify({
        slots: [
          { index: 0, layout: "cover-editorial" },
          { index: 1, layout: "icon-list", icons: ["clock", "chat", "calendar"] },
          { index: 2, layout: "stat", proofId },
          { index: 3, layout: "compare" },
        ],
      }),
    );
    setProviderForTests(ai.provider);
    const id = await draft();
    const res = await compose(id, "ai");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ mode: "ai", replaced: 1 });
    const content = (await current(id)).currentVersion!.content as { slides: { design?: { layout: string; icons?: string[] } }[] };
    expect(content.slides.map((s) => s.design?.layout)).toEqual(["cover-editorial", "icon-list", "stat", "cta"]);
    expect(content.slides[1]!.design!.icons).toEqual(["clock", "chat", "calendar"]);
    // El pedido solo lleva opciones que entran y el dato con su id; nunca la caption para reescribir.
    expect(ai.requests[0]!.content).toContain(proofId);
    expect(ai.requests[0]!.system).toContain("No escribís ni cambiás textos");
    const call_ = await getPrisma().llmCall.findFirstOrThrow({ where: { workspaceId: team.id } });
    expect(call_).toMatchObject({ operation: "content.compose.CAROUSEL", status: "SUCCEEDED" });
    expect((await current(id)).currentVersion!.llmCallId).toBe(call_.id);
  });

  it("si la IA responde algo fuera del esquema no se guarda nada y se puede usar la automática", async () => {
    setProviderForTests(scripted('{"slots":[{"index":0,"layout":"hero-3d"}]}').provider);
    const id = await draft();
    const versionsBefore = await getPrisma().contentVersion.count({ where: { itemId: id } });
    const res = await compose(id, "ai");
    expect(res.status).toBe(502);
    expect(res.body.error).toBe("ai_invalid_output");
    expect(await getPrisma().contentVersion.count({ where: { itemId: id } })).toBe(versionsBefore);
    expect((await compose(id, "auto")).status).toBe(200);
  });

  it("sin IA configurada responde ai_unavailable (la interfaz ofrece la automática)", async () => {
    const id = await draft();
    const res = await compose(id, "ai");
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("ai_unavailable");
  });

  it("sin presupuesto de IA tampoco se cobra ni se guarda", async () => {
    setProviderForTests(scripted("{}").provider);
    await getPrisma().workspace.update({ where: { id: team.id }, data: { aiMonthlyBudgetMicros: 0 } });
    const id = await draft();
    expect((await compose(id, "ai")).status).toBe(402);
    expect((await compose(id, "auto")).status).toBe(200);
  });

  it("cambiar la composición de una pieza aprobada invalida la aprobación (motivo explícito: composición)", async () => {
    const id = await draft();
    await approve(id);
    expect((await approval(id)).kind).toBe("valid");
    await compose(id, "auto");
    expect((await current(id)).status).toBe("DRAFT");
    expect(await approval(id)).toMatchObject({ kind: "stale", reason: "design_changed" });
  });

  it("una pieza publicada no cambia de composición", async () => {
    const id = await draft();
    await getPrisma().contentItem.update({ where: { id }, data: { status: "PUBLISHED" } });
    expect((await compose(id, "auto")).status).toBe(409);
  });
});

describe("aprobaciones y composiciones", () => {
  it("una composición que no entra con su texto bloquea el envío a revisión", async () => {
    const id = await draft({ ...CAROUSEL, slides: CAROUSEL.slides.map((s, i) => (i === 1 ? { ...s, body: "Un solo punto", design: { layout: "steps" } } : s)) });
    const res = await call(submitRoute.POST, { method: "POST", cookie: cookie("OWNER"), params: p(id) });
    expect(res.body).toMatchObject({ error: "review_blocked" });
  });

  it("guardar con 'Clásico' explícito no crea versión ni toca la aprobación", async () => {
    const id = await draft();
    await approve(id);
    const res = await call(versionsRoute.POST, {
      method: "POST",
      cookie: cookie("OWNER"),
      params: p(id),
      body: { content: { ...CAROUSEL, slides: CAROUSEL.slides.map((s) => ({ ...s, design: { layout: "classic" } })) } },
    });
    expect(res.body).toMatchObject({ changed: false });
    expect((await approval(id)).kind).toBe("valid");
  });

  it("cambiar el sitio de la marca reabre solo las piezas que lo dibujan", async () => {
    const classic = await draft();
    await approve(classic);
    const withCta = await draft();
    await compose(withCta, "auto");
    await approve(withCta);
    expect((await putBrand("identidad", { ...IDENTITY, website: "https://kodexa.com" })).status).toBe(200);
    expect((await approval(classic)).kind).toBe("valid");
    expect((await current(classic)).status).toBe("APPROVED");
    expect(await approval(withCta)).toMatchObject({ kind: "stale", reason: "visual_changed" });
    expect((await current(withCta)).status).toBe("PENDING_APPROVAL");
  });

  it("si cambia el dato publicable que muestra, la pieza vuelve a revisión y no se puede aprobar igual", async () => {
    const id = await draft();
    await compose(id, "auto");
    await approve(id);
    // Guardar los datos sin cambios recrea los ids pero no invalida nada.
    await putBrand("datos", { items: [{ statement: "120 consultas atendidas en marzo de 2026", source: "CRM interno" }] });
    expect((await approval(id)).kind).toBe("valid");
    await putBrand("datos", { items: [{ statement: "150 consultas atendidas en abril de 2026", source: "CRM interno" }] });
    expect(await approval(id)).toMatchObject({ kind: "stale", reason: "proof_changed" });
    expect((await current(id)).status).toBe("PENDING_APPROVAL");
    const res = await call(approveRoute.POST, { method: "POST", cookie: cookie("APPROVER"), params: p(id), body: { versionId: (await current(id)).currentVersionId } });
    expect(res.body).toMatchObject({ error: "review_blocked" });
  });

  it("al aprobar se guarda la apariencia con las composiciones y su versión", async () => {
    const id = await draft();
    await compose(id, "auto");
    await approve(id);
    const decision = await getPrisma().approvalDecision.findFirstOrThrow({ where: { itemId: id, outcome: "APPROVED" } });
    expect(decision.visual).toMatchObject({ layouts: { "cover-device": 1, steps: 1, stat: 2, cta: 1 }, website: "kodexa.ar" });
    expect(decision.frameHashes).toHaveLength(4);
  });
});

describe("permisos y aislamiento", () => {
  it.each<[Role, number]>([
    ["OWNER", 200],
    ["EDITOR", 200],
    ["APPROVER", 403],
    ["VIEWER", 403],
  ])("%s → %i", async (role, status) => {
    const id = await draft();
    expect((await compose(id, "auto", role)).status).toBe(status);
  });

  it("otra empresa no puede cambiar la composición de una pieza ajena", async () => {
    const other = await createTeamWorkspace("Otra");
    const id = await draft();
    for (const slug of [team.slug, other.slug]) expect((await compose(id, "auto", "OWNER", slug, other.members.OWNER.cookie)).status).toBe(404);
    expect(await getPrisma().contentVersion.count({ where: { itemId: id } })).toBe(2);
  });
});
