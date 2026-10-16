import { describe, expect, it } from "vitest";

import { contentHash } from "@/modules/content/hash";
import {
  artRefsOf,
  carryDesigns,
  checkDesign,
  cleanStyle,
  normalizeDesigns,
  optionsFor,
  suggestDesigns,
  suggestStyle,
  withoutDesigns,
  type Slot,
} from "@/modules/content/layouts";
import { blockHeight, estimateLines, frameLegibility } from "@/modules/content/legibility";
import { framesOf } from "@/modules/content/render/frames";
import { pieceVisualHash, pieceVisualSnapshot, visualSnapshot } from "@/modules/content/render/fingerprint";
import { themeFor, themeFrom, contrast } from "@/modules/content/render/theme";
import { validateContent } from "@/modules/content/validators";
import { changeReason } from "@/modules/content/change";

const ART = { assetId: "clxart000000000000000001", sha256: "a".repeat(64) };
const ART2 = { assetId: "clxart000000000000000002", sha256: "b".repeat(64) };
const PALETTE = [
  { name: "Grafito", hex: "#1F2023" },
  { name: "Naranja", hex: "#FE6A00" },
];
const VISUAL = { brandName: "Kodexa", palette: PALETTE, website: "https://kodexa.ar" };

const BASE = {
  caption: "Respondé en la primera hora.\n\nGuardá este post.",
  altText: "Slides",
  hashtags: ["pymes"],
  slides: [
    { title: "Tu web pierde consultas", body: "" },
    { title: "Cómo responder rápido", body: "Respondé en menos de una hora\nUsá respuestas guardadas\nAvisá cuándo volvés" },
    { title: "Escribinos hoy", body: "Te mostramos cómo lo hacemos." },
  ],
};
const cover: Slot = { role: "cover", title: "Tu web pierde consultas", body: "" };

describe("V1b: estilo de pieza, patrones y laptop", () => {
  it("el estilo por defecto se guarda como ausencia: el hash de las piezas existentes no cambia", () => {
    const withDefault = { ...BASE, style: { preset: "marca" as const, motif: "none" as const } };
    expect(contentHash(normalizeDesigns("CAROUSEL", withDefault))).toBe(contentHash(normalizeDesigns("CAROUSEL", BASE)));
    expect(cleanStyle({ preset: "oscuro", motif: "dots" })).toEqual({ preset: "oscuro", motif: "dots" });
  });

  it("un estilo distinto cambia el contenido y queda en la huella solo si hay composiciones", () => {
    const styled = normalizeDesigns("CAROUSEL", { ...BASE, style: { preset: "editorial", motif: "grid" } });
    expect(contentHash(styled)).not.toBe(contentHash(BASE));
    // Sin composiciones (todo clásico) el estilo no se dibuja: huella igual a la de siempre.
    expect(pieceVisualSnapshot("CAROUSEL", styled, VISUAL)).toEqual(visualSnapshot(VISUAL));
    const composed = { ...styled, slides: styled.slides.map((s, i) => (i === 0 ? { ...s, design: { layout: "cover-editorial" as const } } : s)) };
    expect(pieceVisualSnapshot("CAROUSEL", composed, VISUAL)).toMatchObject({ style: { preset: "editorial", motif: "grid", version: 1 } });
  });

  it("presets: claro y oscuro mantienen contraste legible", () => {
    const dark = themeFor(PALETTE, "oscuro");
    expect(contrast(dark.strong.text.startsWith("#") ? dark.strong.text : "#ffffff", dark.strong.background)).toBeGreaterThanOrEqual(7);
    expect(themeFor(PALETTE, "claro").strong).toEqual(themeFrom(PALETTE).light);
    expect(themeFor(PALETTE, "marca")).toEqual(themeFrom(PALETTE));
  });

  it("sugiere estilo desde la marca (tipografía e imageStyle)", () => {
    expect(suggestStyle({ headingFont: "Playfair Display", imageStyle: "" }).preset).toBe("editorial");
    expect(suggestStyle({ headingFont: "Instrument Sans", imageStyle: "tecnológico, geométrico" })).toEqual({ preset: "marca", motif: "grid" });
    expect(suggestStyle({ headingFont: "", imageStyle: "fondos oscuros" }).preset).toBe("oscuro");
  });

  it("la laptop es un dispositivo válido de la portada", () => {
    expect(checkDesign(cover, { layout: "cover-device", device: "laptop" }, {})).toBeNull();
  });

  it("la IA de texto recibe el contenido sin diseños ni estilo, y al reescribir se conserva el estilo", () => {
    const styled = { ...BASE, style: { preset: "oscuro" as const, motif: "arcs" as const } };
    expect(withoutDesigns("CAROUSEL", styled)).not.toHaveProperty("style");
    const next = carryDesigns("CAROUSEL", styled, { ...BASE, slides: BASE.slides.map((s) => ({ ...s, title: `${s.title}.` })) }, {});
    expect((next as typeof styled).style).toEqual({ preset: "oscuro", motif: "arcs" });
  });
});

describe("modo premium: composiciones con imagen generada", () => {
  it("sin imagen la composición no es válida; con imagen, sí", () => {
    expect(checkDesign(cover, { layout: "art-cover" }, {})).toMatch(/Generá la imagen/);
    expect(checkDesign(cover, { layout: "art-cover", art: ART }, {})).toBeNull();
    expect(checkDesign({ role: "story", title: "", body: "Hoy", hasSticker: true }, { layout: "art-cover", art: ART }, {})).toMatch(/sticker/);
    expect(checkDesign({ role: "middle", title: "Hola", body: "" }, { layout: "art-cover", art: ART }, {})).toMatch(/no se usa en esta posición/);
  });

  it("ni la sugerencia automática ni la IA de texto eligen composiciones con imagen", () => {
    expect(optionsFor(cover, {})).not.toContain("art-cover");
    const designs = suggestDesigns("CAROUSEL", BASE, {});
    expect(designs.every((d) => !d || !d.layout.startsWith("art-"))).toBe(true);
  });

  it("la imagen queda en el contenido (y en la huella) con su sha256", () => {
    const withArt = normalizeDesigns("CAROUSEL", { ...BASE, slides: BASE.slides.map((s, i) => (i === 0 ? { ...s, design: { layout: "art-cover" as const, art: ART } } : s)) });
    expect(artRefsOf("CAROUSEL", withArt)).toEqual([{ index: 0, art: ART }]);
    expect(pieceVisualSnapshot("CAROUSEL", withArt, VISUAL)).toMatchObject({ layouts: { "art-cover": 1 }, art: [{ index: 0, assetId: ART.assetId, sha256: ART.sha256 }] });
    const other = normalizeDesigns("CAROUSEL", { ...BASE, slides: BASE.slides.map((s, i) => (i === 0 ? { ...s, design: { layout: "art-cover" as const, art: ART2 } } : s)) });
    expect(contentHash(other)).not.toBe(contentHash(withArt));
    expect(pieceVisualHash("CAROUSEL", other, VISUAL)).not.toBe(pieceVisualHash("CAROUSEL", withArt, VISUAL));
  });

  it("dos imágenes generadas seguidas no rompen el ritmo (las eligió una persona)", () => {
    const prev = { ...BASE, slides: BASE.slides.map((s, i) => (i < 2 ? { ...s, design: { layout: i === 0 ? ("art-cover" as const) : ("art-panel" as const), art: i === 0 ? ART : ART2 } } : s)) };
    const kept = carryDesigns("CAROUSEL", prev, BASE, {});
    const slides = (kept as { slides: { design?: unknown }[] }).slides;
    expect(slides[0]!.design).toEqual({ layout: "art-cover", art: ART });
    expect(slides[1]!.design).toEqual({ layout: "art-panel", art: ART2 });
  });

  it("motivo explícito de la aprobación: texto, composición o imagen", () => {
    const a = normalizeDesigns("CAROUSEL", { ...BASE, slides: BASE.slides.map((s, i) => (i === 0 ? { ...s, design: { layout: "art-cover" as const, art: ART } } : s)) });
    const b = normalizeDesigns("CAROUSEL", { ...a, slides: a.slides.map((s, i) => (i === 0 ? { ...s, design: { layout: "art-cover" as const, art: ART2 } } : s)) });
    const c = normalizeDesigns("CAROUSEL", { ...a, slides: a.slides.map((s, i) => (i === 1 ? { ...s, design: { layout: "steps" as const } } : s)) });
    const d = normalizeDesigns("CAROUSEL", { ...a, caption: "Otro caption.\n\nGuardá." });
    expect(changeReason("CAROUSEL", a, b)).toBe("art_changed");
    expect(changeReason("CAROUSEL", a, c)).toBe("design_changed");
    expect(changeReason("CAROUSEL", a, d)).toBe("content_changed");
  });
});

describe("V1c: legibilidad en el teléfono", () => {
  it("estima líneas por ancho y tamaño", () => {
    expect(estimateLines({ text: "Hola", size: 40, lineHeight: 1.3, width: 888, kind: "body" })).toBe(1);
    expect(estimateLines({ text: "palabra ".repeat(60).trim(), size: 42, lineHeight: 1.35, width: 888, kind: "body" })).toBeGreaterThan(8);
    expect(blockHeight({ text: "Uno\nDos", size: 40, lineHeight: 1.5, width: 888, kind: "body" })).toBe(120);
  });

  it("un texto que entra pasa; uno que desborda la composición falla y bloquea", () => {
    const ok = validateContent("CAROUSEL", BASE, { wordsToAvoid: [] });
    expect(ok.checks.find((c) => c.id === "legibility")?.status).toBe("pass");
    // Defensa: los límites de cada campo ya evitan casi todos los desbordes;
    // si un texto igual no entra (por ejemplo, una portada de 400 caracteres
    // que llegó sin pasar por el formulario), la pieza no se puede aprobar.
    const crowded = { ...BASE, slides: BASE.slides.map((s, i) => (i === 0 ? { ...s, title: "consulta ".repeat(45).trim() } : s)) };
    const report = validateContent("CAROUSEL", crowded, { wordsToAvoid: [] });
    const fit = report.checks.find((c) => c.id === "legibility.fit.0");
    expect(fit?.status).toBe("fail");
    expect(report.verdict).toBe("fix");
  });

  it("densidad: demasiadas palabras en una imagen falla", () => {
    const words = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`).join(" ");
    const dense = { ...BASE, slides: BASE.slides.map((s, i) => (i === 1 ? { title: "Ideas", body: words(48) } : s)) };
    const report = validateContent("CAROUSEL", dense, { wordsToAvoid: [] });
    expect(report.checks.find((c) => c.id === "legibility.density.1")?.status).toBe("fail");
  });

  it("ningún texto de las composiciones queda por debajo del mínimo en el teléfono", () => {
    const frames = framesOf("CAROUSEL", normalizeDesigns("CAROUSEL", { ...BASE, slides: BASE.slides.map((s, i) => (i === 0 ? { ...s, design: { layout: "art-cover" as const, art: ART } } : s)) }));
    for (const frame of frames) expect(frameLegibility(frame).tooSmall).toBeNull();
  });

  it("las Stories clásicas avisan por la zona segura inferior", () => {
    const story = { caption: "Hola.\n\nGuardá.", altText: "x", hashtags: [], frames: [0, 1, 2].map((i) => ({ text: `Frame ${i}`, sticker: "NONE" as const, stickerText: "" })) };
    expect(validateContent("STORY", story, { wordsToAvoid: [] }).checks.find((c) => c.id === "legibility.safe-zone")?.status).toBe("warn");
  });
});
