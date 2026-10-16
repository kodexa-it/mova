import { describe, expect, it } from "vitest";

import { buildBrief } from "@/modules/content/brief";
import { normalizeDesigns, richParts, stripMarks } from "@/modules/content/layouts";
import { framesOf } from "@/modules/content/render/frames";
import { pieceVisualSnapshot, visualSnapshot } from "@/modules/content/render/fingerprint";
import { validateContent } from "@/modules/content/validators";

const CAROUSEL = {
  caption: "Tu web.\n\nComentá WEB.",
  altText: "x",
  hashtags: [],
  slides: [
    { kicker: "Pregunta incómoda", title: "Si Instagram te cierra la cuenta, *¿cuántos clientes te quedan?*", body: "" },
    { title: "Pasa más de *lo que creés*", body: "Hackeos\nBloqueos" },
    { title: "Comentá *WEB*", body: "Landings desde USD 250" },
  ],
};
const brand = { name: "Kodexa", industry: "Software", website: "https://kodexa.ar", audiences: ["Pymes"], palette: [{ name: "Naranja", hex: "#fe6a00" }], headingFont: "Anton", bodyFont: "", imageStyle: "audaz" };

describe("palabras destacadas", () => {
  it("se separan las marcas y no se ven fuera del estilo Impacto", () => {
    expect(richParts("Es *alquilado.* Y *tuyo*")).toEqual([
      { text: "Es ", em: false },
      { text: "alquilado.", em: true },
      { text: " Y ", em: false },
      { text: "tuyo", em: true },
    ]);
    expect(stripMarks("Comentá *WEB* ya*")).toBe("Comentá WEB ya");
    const frames = framesOf("CAROUSEL", CAROUSEL);
    expect(frames[0]).toMatchObject({ kind: "cover", title: "Si Instagram te cierra la cuenta, ¿cuántos clientes te quedan?" });
    expect(frames[0]!.rich.title).toContain("*¿cuántos");
    expect(frames[0]!.slot.kicker).toBe("Pregunta incómoda");
  });

  it("Impacto cambia también las imágenes clásicas: entra en la huella aunque no haya composiciones", () => {
    const visual = { brandName: "Kodexa", palette: brand.palette, website: brand.website };
    expect(pieceVisualSnapshot("CAROUSEL", CAROUSEL, visual)).toEqual(visualSnapshot(visual));
    const impact = normalizeDesigns("CAROUSEL", { ...CAROUSEL, style: { preset: "impacto" as const, motif: "none" as const } });
    expect(pieceVisualSnapshot("CAROUSEL", impact, visual)).toMatchObject({ style: { preset: "impacto", version: "1.1" }, website: "kodexa.ar" });
  });

  it("un diseño propio sin imagen no se puede aprobar; con imagen no se mide su texto", () => {
    const withUpload = { ...CAROUSEL, slides: CAROUSEL.slides.map((s, i) => (i === 1 ? { ...s, body: Array(60).fill("palabra").join(" "), design: { layout: "upload" as const } } : s)) };
    const report = validateContent("CAROUSEL", withUpload, { wordsToAvoid: [] });
    expect(report.checks.find((c) => c.id === "layout.1")?.status).toBe("fail");
    const done = { ...withUpload, slides: withUpload.slides.map((s, i) => (i === 1 ? { ...s, design: { layout: "upload" as const, art: { assetId: "clxupload0000001", sha256: "c".repeat(64) } } } : s)) };
    const ok = validateContent("CAROUSEL", done, { wordsToAvoid: [] });
    expect(ok.checks.some((c) => c.id.endsWith(".1") && c.status === "fail")).toBe(false);
  });
});

describe("brief de diseño", () => {
  const brief = buildBrief({ brand, item: { title: "Instagram es alquilado", format: "CAROUSEL", pillar: "Consejos", goal: "Consultas", angle: "Riesgo de depender de Instagram" }, content: CAROUSEL, references: [{ file: "referencia-abc123", label: "Carrusel de octubre" }] });

  it("trae medidas, identidad, reglas y el texto literal de cada imagen", () => {
    expect(brief.designer).toContain("Carrusel de 3 imágenes, 1080×1350 px (4:5)");
    expect(brief.designer).toContain("Naranja #FE6A00 (principal)");
    expect(brief.designer).toContain("Etiqueta: PREGUNTA INCÓMODA");
    expect(brief.designer).toContain('Destacar en el color de acento: "¿cuántos clientes te quedan?"');
    expect(brief.designer).toContain("Título: Comentá WEB");
    expect(brief.designer).toMatch(/No agregues textos, cifras, precios, clientes, testimonios/);
    expect(brief.fileName).toBe("brief-instagram-es-alquilado.md");
  });

  it("pide usar solo las referencias de la marca", () => {
    expect(brief.prompt).toMatch(/ÚNICA referencia visual/);
    expect(brief.designer).toContain("Usá SOLO estas imágenes como referencia visual");
    expect(brief.designer).toContain("referencia-abc123 — Carrusel de octubre");
  });

  it("en Stories pide respetar las zonas seguras", () => {
    const story = { caption: "", altText: "", hashtags: [], frames: [{ text: "Hola", sticker: "POLL" as const, stickerText: "¿Sí o no?" }, { text: "Dos", sticker: "NONE" as const, stickerText: "" }, { text: "Tres", sticker: "NONE" as const, stickerText: "" }] };
    const b = buildBrief({ brand, item: { title: "S", format: "STORY", pillar: null, goal: null, angle: "" }, content: story, references: [] });
    expect(b.designer).toContain("1080×1920 px (9:16)");
    expect(b.designer).toContain("250 px arriba y 360 px abajo");
    expect(b.designer).toContain("Sticker (se agrega al publicar, dejá el lugar): POLL — ¿Sí o no?");
    expect(b.designer).toContain("no cargó referencias");
  });
});
