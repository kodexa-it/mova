import type { Role } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";

import * as sectionRoute from "@/app/api/w/[slug]/brand/[section]/route";
import * as brandRoute from "@/app/api/w/[slug]/brand/route";
import { getPrisma } from "@/lib/prisma";
import { call, createUser } from "@/tests/helpers";
import { createTeamWorkspace, type TeamWorkspace } from "@/tests/integration/fixtures";

const VALID = {
  identidad: {
    name: "Kodexa",
    industry: "Software",
    description: "Desarrollamos productos digitales para pymes de servicios.",
    website: "https://kodexa.com.ar",
    audienceTimezone: "America/Argentina/Buenos_Aires",
  },
  servicios: { items: [{ name: "Desarrollo web", description: "" }, { name: "Automatización", description: "Procesos con IA" }] },
  publico: { items: [{ name: "Dueños de pymes", description: "", painPoints: ["Falta de tiempo"] }] },
  objetivos: { items: [{ title: "Conseguir consultas", kpi: "Consultas por WhatsApp", target: "8 por mes" }] },
  voz: { formality: 2, humor: 2, technicality: 2, enthusiasm: 3, wordsToUse: ["simple"], wordsToAvoid: ["barato"], emojiPolicy: "FEW", examples: [] },
  pilares: { items: [{ name: "Casos", description: "", weight: 40 }, { name: "Consejos", description: "", weight: 60 }] },
  visual: { palette: [{ name: "Naranja", hex: "#FE6A00" }], headingFont: "", bodyFont: "", imageStyle: "" },
} as const;

let team: TeamWorkspace;

const put = (section: string, body: unknown, cookie = team.members.OWNER.cookie, slug = team.slug) =>
  call(sectionRoute.PUT, { method: "PUT", cookie, params: { slug, section }, body });

beforeEach(async () => {
  team = await createTeamWorkspace("Marca");
});

describe("perfil de marca", () => {
  it("el Dueño configura todas las secciones necesarias y la marca queda completa con su tiempo medido", async () => {
    for (const [section, body] of Object.entries(VALID)) {
      const res = await put(section, body);
      expect(res.status, section).toBe(200);
    }
    const res = await call(brandRoute.GET, { cookie: team.members.OWNER.cookie, params: { slug: team.slug } });
    expect(res.status).toBe(200);
    expect(res.body.progress).toMatchObject({ completed: 7, total: 7, isComplete: true });
    const brand = res.body.brand as { completedAt: string | null; startedAt: string; offerings: { name: string; position: number }[] };
    expect(brand.completedAt).not.toBeNull();
    expect(new Date(brand.completedAt!).getTime()).toBeGreaterThanOrEqual(new Date(brand.startedAt).getTime());
    expect(brand.offerings.map((o) => o.name)).toEqual(["Desarrollo web", "Automatización"]);
  });

  it("guardar una lista reemplaza la anterior y respeta el orden", async () => {
    await put("servicios", VALID.servicios);
    await put("servicios", { items: [{ name: "Solo uno", description: "" }] });
    const offerings = await getPrisma().offering.findMany({ where: { workspaceId: team.id } });
    expect(offerings.map((o) => o.name)).toEqual(["Solo uno"]);
  });

  it("la fecha de finalización no cambia con ediciones posteriores", async () => {
    for (const [section, body] of Object.entries(VALID)) await put(section, body);
    const first = await getPrisma().brand.findUniqueOrThrow({ where: { workspaceId: team.id } });
    await put("identidad", { ...VALID.identidad, name: "Kodexa IT" });
    const second = await getPrisma().brand.findUniqueOrThrow({ where: { workspaceId: team.id } });
    expect(second.completedAt?.getTime()).toBe(first.completedAt?.getTime());
    expect(second.name).toBe("Kodexa IT");
  });

  it("cada guardado queda en la auditoría con la sección", async () => {
    await put("voz", VALID.voz);
    const log = await getPrisma().auditLog.findFirstOrThrow({ where: { workspaceId: team.id, action: "brand.updated" } });
    expect(log.actorUserId).toBe(team.members.OWNER.id);
    expect(log.metadata).toMatchObject({ section: "voz" });
  });

  it("rechaza datos inválidos sin guardar nada", async () => {
    const res = await put("pilares", { items: [{ name: "A", description: "", weight: 50 }, { name: "B", description: "", weight: 30 }] });
    expect(res.status).toBe(400);
    expect(await getPrisma().contentPillar.count({ where: { workspaceId: team.id } })).toBe(0);
  });

  it("una sección que no existe responde 404", async () => {
    expect((await put("finanzas", {})).status).toBe(404);
  });
});

describe.each<Role>(["EDITOR", "APPROVER", "VIEWER"])("rol %s", (role) => {
  it("ve la marca pero no la puede editar, aunque mande datos válidos", async () => {
    await put("identidad", VALID.identidad);
    const read = await call(brandRoute.GET, { cookie: team.members[role].cookie, params: { slug: team.slug } });
    expect(read.status).toBe(200);
    expect((read.body.brand as { name: string }).name).toBe("Kodexa");
    expect((await put("identidad", { ...VALID.identidad, name: "Otro" }, team.members[role].cookie)).status).toBe(403);
    expect((await getPrisma().brand.findUniqueOrThrow({ where: { workspaceId: team.id } })).name).toBe("Kodexa");
  });
});

describe("aislamiento", () => {
  it("el Dueño de otro workspace no ve ni edita esta marca", async () => {
    await put("identidad", VALID.identidad);
    const other = await createTeamWorkspace("Otra empresa");
    const intruder = other.members.OWNER.cookie;
    expect((await call(brandRoute.GET, { cookie: intruder, params: { slug: team.slug } })).status).toBe(404);
    expect((await put("identidad", { ...VALID.identidad, name: "Hackeado" }, intruder)).status).toBe(404);
    // Su propia marca es independiente.
    expect((await put("identidad", { ...VALID.identidad, name: "Otra" }, intruder, other.slug)).status).toBe(200);
    const names = (await getPrisma().brand.findMany({ orderBy: { name: "asc" } })).map((b) => b.name);
    expect(names).toEqual(["Kodexa", "Otra"]);
  });

  it("sin sesión responde 401 y desde otra origin 403", async () => {
    expect((await call(brandRoute.GET, { params: { slug: team.slug } })).status).toBe(401);
    const res = await call(sectionRoute.PUT, {
      method: "PUT",
      cookie: team.members.OWNER.cookie,
      origin: "https://otro-sitio.example",
      params: { slug: team.slug, section: "identidad" },
      body: VALID.identidad,
    });
    expect(res.status).toBe(403);
  });

  it("alguien sin membresía recibe 404", async () => {
    const stranger = await createUser();
    expect((await call(brandRoute.GET, { cookie: stranger.cookie, params: { slug: team.slug } })).status).toBe(404);
  });
});
