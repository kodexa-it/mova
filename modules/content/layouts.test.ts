import { describe, expect, it } from "vitest";

import { designsFromAnswer } from "@/modules/content/compose-answer";
import { contentHash } from "@/modules/content/hash";
import {
  checkDesign,
  domainOf,
  layoutsFor,
  normalizeDesigns,
  optionsFor,
  proofMatchesSlot,
  slotsOf,
  suggestDesigns,
  usedLayouts,
  withDesigns,
  withoutDesigns,
  type Slot,
} from "@/modules/content/layouts";
import { pieceVisualHash, pieceVisualSnapshot, visualHash, LAYOUT_VERSIONS } from "@/modules/content/render/fingerprint";
import { approvalStateOf } from "@/modules/review/approval";
import { validateContent } from "@/modules/content/validators";

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
const PROOFS = [
  { id: "p1", statement: "120 consultas atendidas en marzo de 2026", source: "CRM interno" },
  { id: "p2", statement: "Trabajamos con 35 estudios contables", source: "Cartera" },
];
const middle = (body: string, title = "Título"): Slot => ({ role: "middle", title, body });

describe("catálogo de composiciones", () => {
  it("cada lugar admite solo sus composiciones", () => {
    expect(layoutsFor("cover")).toEqual(["classic", "cover-editorial", "cover-device", "art-cover", "upload"]);
    expect(layoutsFor("last")).toEqual(["classic", "cta", "art-panel", "upload"]);
    expect(layoutsFor("middle")).not.toContain("cta");
    expect(checkDesign(middle("a\nb"), { layout: "cover-editorial" }, {})).toMatch(/no se usa en esta posición/);
  });

  it("pasos y listas: de 2 a 5 líneas, con largo máximo por punto", () => {
    expect(checkDesign(middle("Uno solo"), { layout: "steps" }, {})).toMatch(/2 a 5 líneas/);
    expect(checkDesign(middle("Uno\nDos"), { layout: "steps" }, {})).toBeNull();
    expect(checkDesign(middle(`Uno\n${"x".repeat(95)}`), { layout: "steps" }, {})).toMatch(/línea 2 es larga/);
    expect(checkDesign(middle("Uno\nDos"), { layout: "icon-list", icons: ["check"] }, {})).toMatch(/ícono para cada línea/);
    expect(checkDesign(middle("Uno\nDos"), { layout: "icon-list", icons: ["check", "clock"] }, {})).toBeNull();
  });

  it("comparación exige exactamente dos líneas; frase destacada, un párrafo", () => {
    expect(checkDesign(middle("No esperes\nRespondé hoy\nTercera"), { layout: "compare" }, {})).toMatch(/exactamente 2/);
    expect(checkDesign(middle("Una frase con algo de largo para destacar"), { layout: "quote" }, {})).toBeNull();
    expect(checkDesign(middle("Corta"), { layout: "quote" }, {})).toMatch(/muy corta/);
    expect(checkDesign(middle("Una\nDos líneas no van como frase destacada"), { layout: "quote" }, {})).toMatch(/un solo párrafo/);
  });

  it("dato grande: solo con un dato publicable vigente cuya cifra esté en el texto", () => {
    const slot = middle("Atendimos 120 consultas de clientes nuevos.");
    expect(checkDesign(slot, { layout: "stat" }, { proofs: PROOFS })).toMatch(/Elegí un dato/);
    expect(checkDesign(slot, { layout: "stat", proof: PROOFS[0] }, { proofs: PROOFS })).toBeNull();
    // La cifra del dato no está en el texto: la composición agregaría una afirmación nueva.
    expect(checkDesign(slot, { layout: "stat", proof: PROOFS[1] }, { proofs: PROOFS })).toMatch(/tiene que aparecer en el texto/);
    // Un dato que ya no está en la marca (o que cambió) no sirve.
    expect(checkDesign(slot, { layout: "stat", proof: { ...PROOFS[0]!, statement: "150 consultas" } }, { proofs: PROOFS })).toMatch(/ya no coincide/);
    expect(proofMatchesSlot({ id: "x", statement: "$18.000 por mes", source: "" }, middle("Desde 18.000 por mes"))).toBe(true);
  });

  it("en Stories con sticker solo va la composición clásica", () => {
    const story: Slot = { role: "story", title: "", body: "¿Cuál preferís para arrancar el día?", hasSticker: true };
    expect(checkDesign(story, { layout: "quote" }, {})).toMatch(/sticker/);
  });

  it("las opciones para la IA son solo las que entran con el texto", () => {
    const opts = optionsFor(middle("Atendimos 120 consultas de clientes nuevos."), { proofs: PROOFS });
    expect(opts).toContain("stat");
    expect(opts).toContain("quote");
    expect(opts).not.toContain("steps");
    expect(opts).not.toContain("compare");
  });
});

describe("guardado y hash", () => {
  it("'Clásico' no se guarda: el hash es el mismo que antes de existir los layouts", () => {
    const withClassic = { ...CAROUSEL, slides: CAROUSEL.slides.map((s) => ({ ...s, design: { layout: "classic" as const } })) };
    expect(contentHash(normalizeDesigns("CAROUSEL", withClassic))).toBe(contentHash(CAROUSEL));
  });

  it("limpia parámetros que el layout no usa", () => {
    const content = withDesigns("CAROUSEL", CAROUSEL, [{ layout: "cover-editorial", icons: ["check"], device: "phone" }]);
    expect(content.slides[0]).toEqual({ title: CAROUSEL.slides[0]!.title, body: "", design: { layout: "cover-editorial" } });
  });

  it("asignar diseños no toca ningún otro campo", () => {
    const designed = withDesigns("CAROUSEL", CAROUSEL, suggestDesigns("CAROUSEL", CAROUSEL, { proofs: PROOFS }));
    expect(contentHash(withoutDesigns("CAROUSEL", designed))).toBe(contentHash(CAROUSEL));
    expect(designed.caption).toBe(CAROUSEL.caption);
  });
});

describe("sugerencia automática", () => {
  it("portada, pasos, dato y cierre según el texto, todo válido", () => {
    const designs = suggestDesigns("CAROUSEL", CAROUSEL, { proofs: PROOFS });
    expect(designs.map((d) => d?.layout ?? "classic")).toEqual(["cover-device", "steps", "stat", "cta"]);
    expect(designs[2]?.proof?.id).toBe("p1");
    const designed = withDesigns("CAROUSEL", CAROUSEL, designs);
    expect(validateContent("CAROUSEL", designed, { wordsToAvoid: [], proofs: PROOFS }).checks.filter((c) => c.id.startsWith("layout") && c.status === "fail")).toEqual([]);
  });

  it("sin datos publicables nunca propone un dato grande", () => {
    expect(suggestDesigns("CAROUSEL", CAROUSEL, { proofs: [] }).some((d) => d?.layout === "stat")).toBe(false);
  });

  it("como máximo una frase destacada por pieza", () => {
    const content = { ...CAROUSEL, slides: [CAROUSEL.slides[0]!, ...[1, 2, 3].map(() => ({ title: "Algo", body: "Una frase de la marca que sirve para destacar." })), CAROUSEL.slides[3]!] };
    expect(suggestDesigns("CAROUSEL", content, {}).filter((d) => d?.layout === "quote")).toHaveLength(1);
  });
});

describe("ritmo de la pieza", () => {
  const WEB = {
    ...CAROUSEL,
    slides: [
      { title: "¿Tu web trabaja para tu negocio?", body: "" },
      { title: "Una web débil cuesta consultas", body: "Si tu sitio está desactualizado, muchos clientes siguen de largo." },
      { title: "Qué desarrollamos", body: "Sitios web profesionales y tiendas online a medida." },
      { title: "Hablemos", body: "Escribinos y vemos tu caso." },
    ],
  };

  it("la sugerencia automática no repite la misma ilustración en imágenes seguidas", () => {
    const layouts = suggestDesigns("CAROUSEL", WEB, {}).map((d) => d?.layout ?? "classic");
    expect(layouts[0]).toBe("cover-device");
    expect(layouts[1]).not.toBe("browser");
    for (let i = 1; i < layouts.length; i++) if (layouts[i] !== "classic") expect(layouts[i]).not.toBe(layouts[i - 1]);
  });

  it("si la IA repite la composición anterior, esa imagen se reemplaza", () => {
    const refs = slotsOf("CAROUSEL", WEB);
    const fallback = suggestDesigns("CAROUSEL", WEB, {});
    const answer = designsFromAnswer(
      { slots: [{ index: 0, layout: "cover-device", device: "browser" }, { index: 1, layout: "browser" }, { index: 2, layout: "browser" }, { index: 3, layout: "cta" }] },
      refs,
      [],
      fallback,
    );
    expect(answer?.replaced).toBe(1);
    const layouts = answer!.designs.map((d) => d?.layout ?? "classic");
    expect(layouts[0]).toBe("cover-device");
    expect(layouts[1]).not.toBe("browser");
    expect(layouts[2]).toBe("browser");
  });
});

describe("respuesta de la IA", () => {
  const refs = slotsOf("CAROUSEL", CAROUSEL);
  const fallback = suggestDesigns("CAROUSEL", CAROUSEL, { proofs: PROOFS });

  it("acepta elecciones válidas del catálogo", () => {
    const answer = designsFromAnswer(
      { slots: [{ index: 0, layout: "cover-editorial" }, { index: 1, layout: "icon-list", icons: ["clock", "chat", "calendar"] }, { index: 2, layout: "stat", proofId: "p1" }, { index: 3, layout: "cta" }] },
      refs,
      PROOFS,
      fallback,
    );
    expect(answer?.replaced).toBe(0);
    expect(answer?.designs.map((d) => d?.layout)).toEqual(["cover-editorial", "icon-list", "stat", "cta"]);
    expect(answer?.designs[2]?.proof).toEqual(PROOFS[0]);
  });

  it("reemplaza por la sugerencia automática lo que no cumple: datos inventados, layouts que no entran, posiciones faltantes", () => {
    const answer = designsFromAnswer(
      { slots: [{ index: 0, layout: "cta" }, { index: 1, layout: "compare" }, { index: 2, layout: "stat", proofId: "inventado" }] },
      refs,
      PROOFS,
      fallback,
    );
    expect(answer?.replaced).toBe(4);
    expect(answer?.designs).toEqual(fallback);
  });

  it("rechaza respuestas fuera del esquema (layouts o íconos que no existen)", () => {
    expect(designsFromAnswer({ slots: [{ index: 0, layout: "hero-3d" }] }, refs, PROOFS, fallback)).toBeNull();
    expect(designsFromAnswer({ slots: [{ index: 1, layout: "icon-list", icons: ["rocket", "x"] }] }, refs, PROOFS, fallback)).toBeNull();
    expect(designsFromAnswer("texto", refs, PROOFS, fallback)).toBeNull();
  });
});

describe("huella de aprobación con composiciones", () => {
  const visual = { brandName: "Kodexa", palette: [{ name: "Índigo", hex: "#3D3AD8" }], website: "https://www.kodexa.ar/" };

  it("una pieza sin composiciones tiene la misma huella que antes de V1a", () => {
    expect(pieceVisualHash("CAROUSEL", CAROUSEL, visual)).toBe(visualHash(visual));
  });

  it("con composiciones suma su versión, y el sitio solo si alguna lo dibuja", () => {
    const quote = withDesigns("CAROUSEL", CAROUSEL, [undefined, undefined, { layout: "quote" }]);
    expect(pieceVisualSnapshot("CAROUSEL", quote, visual)).toMatchObject({ layouts: { quote: LAYOUT_VERSIONS.quote } });
    expect(pieceVisualSnapshot("CAROUSEL", quote, visual)).not.toHaveProperty("website");
    const cta = withDesigns("CAROUSEL", CAROUSEL, [undefined, undefined, undefined, { layout: "cta" }]);
    expect(pieceVisualSnapshot("CAROUSEL", cta, visual)).toMatchObject({ website: "kodexa.ar" });
    // Cambiar el sitio cambia la huella de la pieza con cierre, no la de la pieza con frase.
    const other = { ...visual, website: "https://kodexa.com" };
    expect(pieceVisualHash("CAROUSEL", cta, other)).not.toBe(pieceVisualHash("CAROUSEL", cta, visual));
    expect(pieceVisualHash("CAROUSEL", quote, other)).toBe(pieceVisualHash("CAROUSEL", quote, visual));
    expect(usedLayouts("CAROUSEL", cta)).toEqual(["cta"]);
  });

  it("si cambia la versión de una composición usada, el motivo es 'plantillas'", () => {
    const cta = withDesigns("CAROUSEL", CAROUSEL, [undefined, undefined, undefined, { layout: "cta" }]);
    const current = pieceVisualSnapshot("CAROUSEL", cta, visual);
    const approved = { ...current, layouts: { cta: 0 } };
    const decision = { id: "d", versionId: "v", contentHash: "c", visualHash: "viejo", renderVersion: current.renderVersion, invalidatedAt: null, invalidReason: null, visual: approved };
    expect(approvalStateOf(decision, { versionId: "v", contentHash: "c", visualHash: "nuevo", visual: current })).toMatchObject({ kind: "stale", reason: "templates_changed" });
    expect(approvalStateOf({ ...decision, visual: current }, { versionId: "v", contentHash: "c", visualHash: "nuevo", visual: current })).toMatchObject({ kind: "stale", reason: "visual_changed" });
  });

  it("dominio del sitio, sin protocolo ni www", () => {
    expect(domainOf("https://www.kodexa.ar/")).toBe("kodexa.ar");
    expect(domainOf("kodexa.ar/servicios?x=1")).toBe("kodexa.ar");
    expect(domainOf("")).toBeNull();
  });
});
