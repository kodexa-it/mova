import { afterEach, beforeEach, describe, expect, it } from "vitest";

import * as assistRoute from "@/app/api/w/[slug]/brand/[section]/assist/route";
import * as sectionRoute from "@/app/api/w/[slug]/brand/[section]/route";
import * as usageRoute from "@/app/api/w/[slug]/usage/route";
import { getPrisma } from "@/lib/prisma";
import { setProviderForTests } from "@/modules/ai/providers/registry";
import { AiProviderError, type AiProvider, type AiRequest } from "@/modules/ai/providers/types";
import { call } from "@/tests/helpers";
import { createTeamWorkspace, type TeamWorkspace } from "@/tests/integration/fixtures";

// Proveedor programado: devuelve respuestas fijas y cuenta las llamadas. Solo
// existe en tests (setProviderForTests falla fuera de NODE_ENV=test).
function scripted(reply: string | (() => never), usage = { inputTokens: 800, outputTokens: 300 }, delayMs = 0) {
  const requests: AiRequest[] = [];
  const provider: AiProvider = {
    name: "scripted",
    async complete(request) {
      requests.push(request);
      if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
      if (typeof reply !== "string") return reply();
      return { text: reply, model: request.model, truncated: false, ...usage };
    },
  };
  return { provider, requests };
}

const IDENTITY = {
  name: "Kodexa",
  industry: "Software",
  description: "Desarrollamos productos digitales para pymes de servicios.",
  website: "",
  audienceTimezone: "America/Argentina/Buenos_Aires",
};

const PILLARS = JSON.stringify({
  items: [
    { name: "Casos de clientes", description: "", weight: 40 },
    { name: "Consejos", description: "", weight: 35 },
    { name: "Detrás de escena", description: "", weight: 25 },
  ],
});

let team: TeamWorkspace;
const assist = (section = "pilares", cookie = team.members.OWNER.cookie) =>
  call(assistRoute.POST, { method: "POST", cookie, params: { slug: team.slug, section }, body: { notes: "" } });

beforeEach(async () => {
  team = await createTeamWorkspace("IA");
  await call(sectionRoute.PUT, { method: "PUT", cookie: team.members.OWNER.cookie, params: { slug: team.slug, section: "identidad" }, body: IDENTITY });
});

afterEach(() => setProviderForTests(null));

describe("gateway de IA", () => {
  it("sin proveedor configurado responde 503 y no registra nada", async () => {
    setProviderForTests(null);
    expect((await assist()).status).toBe(503);
    expect(await getPrisma().llmCall.count()).toBe(0);
  });

  it("registra cada llamada con modelo, tokens y costo, y devuelve una propuesta validada", async () => {
    const { provider, requests } = scripted(PILLARS);
    setProviderForTests(provider);
    const res = await assist();
    expect(res.status).toBe(200);
    expect((res.body.proposal as { items: unknown[] }).items).toHaveLength(3);
    expect(requests[0]?.system).toContain("No inventes cifras");
    expect(requests[0]?.messages[0]?.content).toContain("Kodexa");
    const log = await getPrisma().llmCall.findFirstOrThrow({ where: { workspaceId: team.id } });
    expect(log).toMatchObject({
      status: "SUCCEEDED",
      operation: "brand.assist.pilares",
      model: "claude-haiku-5-5",
      inputTokens: 800,
      outputTokens: 300,
      costMicros: 230, // 800 × 0,10 + 300 × 0,50
      userId: team.members.OWNER.id,
    });
    // La propuesta no se guarda sola.
    expect(await getPrisma().contentPillar.count({ where: { workspaceId: team.id } })).toBe(0);
  });

  it("un workspace sin presupuesto queda bloqueado antes de llamar al modelo", async () => {
    const { provider, requests } = scripted(PILLARS);
    setProviderForTests(provider);
    await getPrisma().workspace.update({ where: { id: team.id }, data: { aiMonthlyBudgetMicros: 100 } });
    const res = await assist();
    expect(res.status).toBe(402);
    expect(res.body.error).toBe("ai_credits_exhausted");
    expect(requests).toHaveLength(0);
    const log = await getPrisma().llmCall.findFirstOrThrow({ where: { workspaceId: team.id } });
    expect(log).toMatchObject({ status: "BLOCKED", costMicros: 0, errorCode: "credits_exhausted" });
  });

  it("el gasto acumulado del mes cuenta para el bloqueo", async () => {
    const { provider, requests } = scripted(PILLARS);
    setProviderForTests(provider);
    await getPrisma().workspace.update({ where: { id: team.id }, data: { aiMonthlyBudgetMicros: 10_000 } });
    await getPrisma().llmCall.create({
      data: { workspaceId: team.id, operation: "previa", provider: "scripted", model: "claude-haiku-5-5", status: "SUCCEEDED", costMicros: 9_900 },
    });
    expect((await assist()).status).toBe(402);
    expect(requests).toHaveLength(0);
  });

  it("dos pedidos simultáneos no gastan el mismo presupuesto", async () => {
    // El proveedor tarda: la segunda reserva ve la primera todavía pendiente.
    const { provider, requests } = scripted(PILLARS, undefined, 300);
    setProviderForTests(provider);
    // Alcanza para una reserva (≈ USD 0,0008) pero no para dos.
    await getPrisma().workspace.update({ where: { id: team.id }, data: { aiMonthlyBudgetMicros: 1_200 } });
    const results = await Promise.all([assist(), assist()]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 402]);
    expect(requests).toHaveLength(1);
  });

  it("si el proveedor falla, la llamada queda como fallida y libera la reserva", async () => {
    setProviderForTests(
      scripted(() => {
        throw new AiProviderError("provider_timeout");
      }).provider,
    );
    expect((await assist()).status).toBe(502);
    const log = await getPrisma().llmCall.findFirstOrThrow({ where: { workspaceId: team.id } });
    expect(log).toMatchObject({ status: "FAILED", errorCode: "provider_timeout", costMicros: 0 });
  });

  it("una respuesta que no cumple el esquema no llega a la persona", async () => {
    setProviderForTests(scripted('{"items":[{"name":"Uno","description":"","weight":70}]}').provider);
    const res = await assist();
    expect(res.status).toBe(502);
    expect(res.body.error).toBe("ai_invalid_output");
    const log = await getPrisma().llmCall.findFirstOrThrow({ where: { workspaceId: team.id } });
    expect(log).toMatchObject({ status: "SUCCEEDED", errorCode: "invalid_output" });
    expect(log.costMicros).toBeGreaterThan(0);
  });

  it("los datos publicables nunca se piden a la IA", async () => {
    const { provider, requests } = scripted(PILLARS);
    setProviderForTests(provider);
    expect((await assist("datos")).status).toBe(404);
    expect(requests).toHaveLength(0);
  });

  it("sin identidad completa pide completarla antes de llamar", async () => {
    const { provider, requests } = scripted(PILLARS);
    setProviderForTests(provider);
    const other = await createTeamWorkspace("Sin identidad");
    const res = await call(assistRoute.POST, { method: "POST", cookie: other.members.OWNER.cookie, params: { slug: other.slug, section: "pilares" }, body: {} });
    expect(res.status).toBe(409);
    expect(requests).toHaveLength(0);
  });

  it.each(["EDITOR", "APPROVER", "VIEWER"] as const)("el rol %s no puede usar el asistente ni ver el uso", async (role) => {
    const { provider, requests } = scripted(PILLARS);
    setProviderForTests(provider);
    expect((await assist("pilares", team.members[role].cookie)).status).toBe(403);
    expect((await call(usageRoute.GET, { cookie: team.members[role].cookie, params: { slug: team.slug } })).status).toBe(403);
    expect(requests).toHaveLength(0);
  });

  it("el Dueño ve el uso del mes con el gasto y el presupuesto", async () => {
    setProviderForTests(scripted(PILLARS).provider);
    await assist();
    const res = await call(usageRoute.GET, { cookie: team.members.OWNER.cookie, params: { slug: team.slug } });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ budgetMicros: 2_000_000, spentMicros: 230 });
    expect(res.body.calls as unknown[]).toHaveLength(1);
  });

  it("el uso de un workspace no se mezcla con el de otro", async () => {
    setProviderForTests(scripted(PILLARS).provider);
    await assist();
    const other = await createTeamWorkspace("Otra");
    const res = await call(usageRoute.GET, { cookie: other.members.OWNER.cookie, params: { slug: other.slug } });
    expect(res.body).toMatchObject({ spentMicros: 0 });
    expect(res.body.calls as unknown[]).toHaveLength(0);
  });
});
