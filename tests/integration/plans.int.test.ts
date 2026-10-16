import type { Role } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";

import * as calendarRoute from "@/app/api/w/[slug]/calendar/route";
import * as scheduleRoute from "@/app/api/w/[slug]/content/[id]/schedule/route";
import * as contentRoute from "@/app/api/w/[slug]/content/route";
import * as planRoute from "@/app/api/w/[slug]/plans/[week]/route";
import { getPrisma } from "@/lib/prisma";
import { call } from "@/tests/helpers";
import { createTeamWorkspace, type TeamWorkspace } from "@/tests/integration/fixtures";

let team: TeamWorkspace;
const owner = () => team.members.OWNER.cookie;

async function create(body: Record<string, unknown> = {}, cookie = owner(), slug = team.slug) {
  const res = await call(contentRoute.POST, { method: "POST", cookie, params: { slug }, body: { format: "CAROUSEL", title: "Pieza", ...body } });
  return { status: res.status, id: (res.body.item as { id: string } | undefined)?.id ?? "" };
}
const schedule = (id: string, body: unknown, cookie = owner(), slug = team.slug) =>
  call(scheduleRoute.PUT, { method: "PUT", cookie, params: { slug, id }, body });
const calendar = (query: string, cookie = owner(), slug = team.slug) =>
  call(calendarRoute.GET, { cookie, params: { slug }, path: `/api/w/${slug}/calendar?${query}` });
const focus = (week: string, text: string, cookie = owner(), slug = team.slug) =>
  call(planRoute.PUT, { method: "PUT", cookie, params: { slug, week }, body: { focus: text } });

beforeEach(async () => {
  team = await createTeamWorkspace("Calendario");
});

describe("fecha de las piezas y planes semanales", () => {
  it("crear una pieza con fecha la ubica en el plan de su semana, en la hora de Buenos Aires", async () => {
    const a = await create({ date: "2026-10-22", time: "10:00" });
    const b = await create({ date: "2026-10-25", time: "23:30" });
    expect(a.status).toBe(201);
    const items = await getPrisma().contentItem.findMany({ where: { id: { in: [a.id, b.id] } }, include: { plan: true } });
    const first = items.find((i) => i.id === a.id)!;
    expect(first.scheduledFor?.toISOString()).toBe("2026-10-22T13:00:00.000Z");
    expect(first.plan?.weekStart.toISOString().slice(0, 10)).toBe("2026-10-19");
    // El domingo a la noche sigue siendo la misma semana local, aunque en UTC ya sea lunes.
    expect(items.find((i) => i.id === b.id)!.planId).toBe(first.planId);
    expect(await getPrisma().contentPlan.count({ where: { workspaceId: team.id } })).toBe(1);
  });

  it("sin fecha la pieza no tiene plan; sin hora usa las 10:00", async () => {
    const plain = await create();
    const noTime = await create({ date: "2026-10-20" });
    const [p, t] = await Promise.all([plain, noTime].map(({ id }) => getPrisma().contentItem.findUniqueOrThrow({ where: { id } })));
    expect(p!.scheduledFor).toBeNull();
    expect(p!.planId).toBeNull();
    expect(t!.scheduledFor?.toISOString()).toBe("2026-10-20T13:00:00.000Z");
  });

  it("mover una pieza de semana la cambia de plan; quitar la fecha la saca del calendario; queda en la auditoría", async () => {
    const { id } = await create({ date: "2026-10-20" });
    expect((await schedule(id, { date: "2026-10-28", time: "18:15" })).status).toBe(200);
    let item = await getPrisma().contentItem.findUniqueOrThrow({ where: { id }, include: { plan: true } });
    expect(item.scheduledFor?.toISOString()).toBe("2026-10-28T21:15:00.000Z");
    expect(item.plan?.weekStart.toISOString().slice(0, 10)).toBe("2026-10-26");
    expect((await schedule(id, { date: null })).status).toBe(200);
    item = await getPrisma().contentItem.findUniqueOrThrow({ where: { id }, include: { plan: true } });
    expect(item.scheduledFor).toBeNull();
    expect(item.planId).toBeNull();
    const audit = await getPrisma().auditLog.findMany({ where: { workspaceId: team.id, action: "content.scheduled" } });
    expect(audit).toHaveLength(2);
  });

  it("usa la zona horaria del público de la marca", async () => {
    await getPrisma().brand.create({ data: { workspaceId: team.id, name: "Marca", audienceTimezone: "Europe/Madrid" } });
    const { id } = await create({ date: "2026-10-20", time: "10:00" });
    const item = await getPrisma().contentItem.findUniqueOrThrow({ where: { id } });
    expect(item.scheduledFor?.toISOString()).toBe("2026-10-20T08:00:00.000Z");
    const res = await calendar("from=2026-10-19&to=2026-10-26");
    expect(res.body).toMatchObject({ timezone: "Europe/Madrid", items: [{ id, date: "2026-10-20", time: "10:00" }] });
  });

  it("pedidos simultáneos en una semana nueva crean un solo plan", async () => {
    const ids = await Promise.all([1, 2, 3].map(() => create()));
    const results = await Promise.all(ids.map(({ id }) => schedule(id, { date: "2026-11-04" })));
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(await getPrisma().contentPlan.count({ where: { workspaceId: team.id } })).toBe(1);
  });

  it("validación de fechas: días inexistentes, horas inválidas y semanas que no empiezan el lunes", async () => {
    const { id } = await create();
    expect((await schedule(id, { date: "2026-02-30" })).status).toBe(400);
    expect((await schedule(id, { date: "2026-10-20", time: "25:00" })).status).toBe(400);
    expect((await focus("2026-10-21", "Algo")).status).toBe(400);
    expect((await create({ date: "20/10/2026" })).status).toBe(400);
  });

  it("una pieza publicada o archivada no cambia de fecha", async () => {
    const { id } = await create({ date: "2026-10-20" });
    for (const status of ["PUBLISHED", "ARCHIVED"] as const) {
      await getPrisma().contentItem.update({ where: { id }, data: { status } });
      const res = await schedule(id, { date: "2026-10-21" });
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ error: "schedule_locked" });
    }
  });
});

describe("calendario", () => {
  it("devuelve las piezas del rango con día y hora locales, y filtra por formato, estado y pilar", async () => {
    const a = await create({ date: "2026-10-19", time: "09:00", pillar: "Casos" });
    const b = await create({ date: "2026-10-25", time: "23:30", format: "REEL" });
    await create({ date: "2026-10-26", time: "00:00" });
    await create();
    const res = await calendar("from=2026-10-19&to=2026-10-26");
    expect(res.status).toBe(200);
    const items = res.body.items as { id: string; date: string; time: string }[];
    expect(items.map((i) => i.id)).toEqual([a.id, b.id]);
    expect(items[1]).toMatchObject({ date: "2026-10-25", time: "23:30" });

    expect(((await calendar("from=2026-10-19&to=2026-10-26&format=REEL")).body.items as unknown[]).length).toBe(1);
    expect(((await calendar("from=2026-10-19&to=2026-10-26&pillar=Casos")).body.items as unknown[]).length).toBe(1);
    expect(((await calendar("from=2026-10-19&to=2026-10-26&status=APPROVED")).body.items as unknown[]).length).toBe(0);
  });

  it("no lista piezas archivadas salvo que se pidan", async () => {
    const { id } = await create({ date: "2026-10-20" });
    await getPrisma().contentItem.update({ where: { id }, data: { status: "ARCHIVED" } });
    expect(((await calendar("from=2026-10-19&to=2026-10-26")).body.items as unknown[]).length).toBe(0);
    expect(((await calendar("from=2026-10-19&to=2026-10-26&status=ARCHIVED")).body.items as unknown[]).length).toBe(1);
  });

  it("rechaza rangos inválidos o de más de seis semanas", async () => {
    expect((await calendar("from=2026-10-19&to=2026-10-19")).status).toBe(400);
    expect((await calendar("from=2026-10-19&to=2026-12-31")).status).toBe(400);
    expect((await calendar("from=2026-10-19")).status).toBe(400);
  });

  it("guarda el foco de la semana y lo devuelve con el plan", async () => {
    expect((await focus("2026-10-19", "  Casos reales de clientes  ")).status).toBe(200);
    const res = await calendar("from=2026-10-19&to=2026-10-26");
    expect(res.body.plans).toEqual([expect.objectContaining({ weekStart: "2026-10-19", focus: "Casos reales de clientes", source: "MANUAL" })]);
    expect(await getPrisma().auditLog.count({ where: { workspaceId: team.id, action: "plan.updated" } })).toBe(1);
  });
});

describe.each<[Role, boolean]>([
  ["OWNER", true],
  ["EDITOR", true],
  ["APPROVER", false],
  ["VIEWER", false],
])("rol %s", (role, canPlan) => {
  it(`${canPlan ? "puede" : "no puede"} planificar, y siempre puede ver el calendario`, async () => {
    const { id } = await create();
    const cookie = team.members[role].cookie;
    expect((await schedule(id, { date: "2026-10-20" }, cookie)).status).toBe(canPlan ? 200 : 403);
    expect((await focus("2026-10-19", "Foco", cookie)).status).toBe(canPlan ? 200 : 403);
    expect((await create({ date: "2026-10-21" }, cookie)).status).toBe(canPlan ? 201 : 403);
    expect((await calendar("from=2026-10-19&to=2026-10-26", cookie)).status).toBe(200);
  });
});

describe("aislamiento entre workspaces", () => {
  it("otra empresa no ve ni mueve piezas ajenas, y su calendario no las incluye", async () => {
    const other = await createTeamWorkspace("Otra empresa");
    const { id } = await create({ date: "2026-10-20" });
    const outsider = other.members.OWNER.cookie;
    // Con el slug propio, la pieza ajena no existe.
    expect((await schedule(id, { date: "2026-10-21" }, outsider, other.slug)).status).toBe(404);
    // Con el slug ajeno, el workspace no existe para quien no es integrante.
    expect((await schedule(id, { date: "2026-10-21" }, outsider)).status).toBe(404);
    expect((await calendar("from=2026-10-19&to=2026-10-26", outsider)).status).toBe(404);
    expect((await focus("2026-10-19", "Ajeno", outsider)).status).toBe(404);
    const own = await calendar("from=2026-10-19&to=2026-10-26", outsider, other.slug);
    expect(own.body.items).toEqual([]);
    expect(own.body.plans).toEqual([]);
    const item = await getPrisma().contentItem.findUniqueOrThrow({ where: { id } });
    expect(item.scheduledFor?.toISOString()).toBe("2026-10-20T13:00:00.000Z");
  });

  it("cada workspace tiene su propio plan para la misma semana", async () => {
    const other = await createTeamWorkspace("Otra empresa");
    await focus("2026-10-19", "Nuestro foco");
    await focus("2026-10-19", "Su foco", other.members.OWNER.cookie, other.slug);
    const plans = await getPrisma().contentPlan.findMany({ where: { weekStart: new Date("2026-10-19T00:00:00Z"), workspaceId: { in: [team.id, other.id] } } });
    expect(plans.map((p) => p.focus).sort()).toEqual(["Nuestro foco", "Su foco"]);
  });
});
