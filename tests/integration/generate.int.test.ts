import { afterEach, beforeEach, describe, expect, it } from "vitest";

import * as sectionRoute from "@/app/api/w/[slug]/brand/[section]/route";
import * as generateRoute from "@/app/api/w/[slug]/content/[id]/generate/route";
import * as contentRoute from "@/app/api/w/[slug]/content/route";
import { getPrisma } from "@/lib/prisma";
import { setProviderForTests } from "@/modules/ai/providers/registry";
import type { AiProvider, AiRequest } from "@/modules/ai/providers/types";
import { call } from "@/tests/helpers";
import { createTeamWorkspace, type TeamWorkspace } from "@/tests/integration/fixtures";

const BRAND = {
  identidad: { name: "Kodexa", industry: "Software", description: "Desarrollamos productos digitales para pymes de servicios.", website: "", audienceTimezone: "America/Argentina/Buenos_Aires" },
  servicios: { items: [{ name: "Automatización", description: "" }] },
  publico: { items: [{ name: "Dueños de pymes", description: "", painPoints: ["Falta de tiempo"] }] },
  objetivos: { items: [{ title: "Conseguir consultas", kpi: "WhatsApp", target: "" }] },
  voz: { formality: 2, humor: 2, technicality: 2, enthusiasm: 3, wordsToUse: [], wordsToAvoid: ["revolucionario"], emojiPolicy: "FEW", examples: [] },
  pilares: { items: [{ name: "Casos", description: "", weight: 50 }, { name: "Consejos", description: "", weight: 50 }] },
  visual: { palette: [{ name: "Naranja", hex: "#FE6A00" }], headingFont: "", bodyFont: "", imageStyle: "" },
  datos: { items: [{ statement: "Más de 40 proyectos entregados", source: "Registro interno de Kodexa" }] },
  reglas: { items: [{ kind: "NEVER", text: "Prometer resultados en plazos fijos" }] },
} as const;

const CAROUSEL = JSON.stringify({
  caption: "Perdés 3 de cada 10 consultas si respondés tarde.\n\nGuardá este post.",
  altText: "Carrusel con texto",
  hashtags: ["pymes"],
  slides: [
    { title: "3 errores que cuestan clientes", body: "" },
    { title: "Responder tarde", body: "Después de un día, la consulta se enfría." },
    { title: "Cotizar sin plazos", body: "Sin fecha, comparan solo por precio." },
    { title: "Resumen", body: "Escribinos y lo ordenamos juntos." },
  ],
});

function scripted(reply: string) {
  const requests: AiRequest[] = [];
  const provider: AiProvider = {
    name: "scripted",
    async complete(request) {
      requests.push(request);
      return { text: reply, model: request.model, inputTokens: 2000, outputTokens: 600, truncated: false };
    },
  };
  return { provider, requests };
}

let team: TeamWorkspace;
let itemId: string;
const generate = (cookie = team.members.OWNER.cookie, id = itemId, instructions = "") =>
  call(generateRoute.POST, { method: "POST", cookie, params: { slug: team.slug, id }, body: { instructions } });

async function configureBrand() {
  for (const [section, body] of Object.entries(BRAND)) {
    await call(sectionRoute.PUT, { method: "PUT", cookie: team.members.OWNER.cookie, params: { slug: team.slug, section }, body });
  }
}

beforeEach(async () => {
  team = await createTeamWorkspace("Generación");
  const res = await call(contentRoute.POST, { method: "POST", cookie: team.members.OWNER.cookie, params: { slug: team.slug }, body: { format: "CAROUSEL", title: "Errores al cotizar", pillar: "Consejos" } });
  itemId = (res.body.item as { id: string }).id;
});

afterEach(() => setProviderForTests(null));

describe("generación de piezas", () => {
  it("escribe una versión de autoría IA, enlazada a su llamada y con su costo", async () => {
    await configureBrand();
    const { provider, requests } = scripted(CAROUSEL);
    setProviderForTests(provider);
    const res = await generate();
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ changed: true, status: "DRAFT", remaining: 4 });
    const item = await getPrisma().contentItem.findUniqueOrThrow({ where: { id: itemId }, include: { currentVersion: true } });
    expect(item.currentVersion).toMatchObject({ number: 2, author: "AI" });
    expect(item.regenerations).toBe(1);
    const llm = await getPrisma().llmCall.findUniqueOrThrow({ where: { id: item.currentVersion!.llmCallId! } });
    expect(llm).toMatchObject({ operation: "content.generate.CAROUSEL", status: "SUCCEEDED", costMicros: 500 });
    // El prompt lleva el contexto de la marca, los datos reales y las reglas.
    const prompt = requests[0]!.messages[0]!.content;
    expect(prompt).toContain("Más de 40 proyectos entregados (fuente: Registro interno de Kodexa)");
    expect(prompt).toContain("Nunca: Prometer resultados en plazos fijos");
    expect(prompt).toContain("Palabras que NUNCA usa: revolucionario");
    expect(prompt).toContain("Pilar: Consejos");
    expect(requests[0]!.system).toContain("Nunca inventes cifras");
  });

  it("con la marca incompleta no llama al modelo", async () => {
    const { provider, requests } = scripted(CAROUSEL);
    setProviderForTests(provider);
    const res = await generate();
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("brand_incomplete");
    expect(requests).toHaveLength(0);
  });

  it("una respuesta que no cumple el formato no crea versión", async () => {
    await configureBrand();
    setProviderForTests(scripted('{"caption":"x","altText":"","hashtags":[],"slides":[{"title":"Solo una","body":""}]}').provider);
    expect((await generate()).status).toBe(502);
    expect(await getPrisma().contentVersion.count({ where: { itemId } })).toBe(1);
  });

  it("respeta el tope de 5 propuestas por pieza sin llamar al modelo", async () => {
    await configureBrand();
    const { provider, requests } = scripted(CAROUSEL);
    setProviderForTests(provider);
    await getPrisma().contentItem.update({ where: { id: itemId }, data: { regenerations: 5 } });
    const res = await generate();
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("generation_limit");
    expect(requests).toHaveLength(0);
  });

  it("si ya hay contenido, lo manda como versión actual junto con las indicaciones", async () => {
    await configureBrand();
    const { provider, requests } = scripted(CAROUSEL);
    setProviderForTests(provider);
    await generate();
    await generate(team.members.OWNER.cookie, itemId, "Más corto");
    const prompt = requests[1]!.messages[0]!.content;
    expect(prompt).toContain("# Versión actual");
    expect(prompt).toContain("Más corto");
  });

  it("solo Dueño y Editor pueden pedir una propuesta", async () => {
    await configureBrand();
    const { provider, requests } = scripted(CAROUSEL);
    setProviderForTests(provider);
    expect((await generate(team.members.APPROVER.cookie)).status).toBe(403);
    expect((await generate(team.members.VIEWER.cookie)).status).toBe(403);
    expect(requests).toHaveLength(0);
    expect((await generate(team.members.EDITOR.cookie)).status).toBe(201);
  });

  it("una pieza publicada no se regenera", async () => {
    await configureBrand();
    const { provider, requests } = scripted(CAROUSEL);
    setProviderForTests(provider);
    await getPrisma().contentItem.update({ where: { id: itemId }, data: { status: "PUBLISHED" } });
    expect((await generate()).status).toBe(409);
    expect(requests).toHaveLength(0);
  });

  it("no se puede generar sobre la pieza de otro workspace", async () => {
    const other = await createTeamWorkspace("Otra");
    setProviderForTests(scripted(CAROUSEL).provider);
    const res = await call(generateRoute.POST, { method: "POST", cookie: other.members.OWNER.cookie, params: { slug: other.slug, id: itemId }, body: {} });
    expect(res.status).toBe(404);
  });
});
