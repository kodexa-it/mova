import { describe, expect, it } from "vitest";

import { emptyContent, type AnyContent, type Format, type FormatContent } from "@/modules/content/formats";
import { withDesigns, type Design } from "@/modules/content/layouts";
import { bytesHash } from "@/modules/content/render/fingerprint";
import { framesOf } from "@/modules/content/render/frames";
import { renderFrameBytes } from "@/modules/content/render/render";

// Huellas de las imágenes clásicas tomadas ANTES de agregar las composiciones
// (15/10/2026). Si este test falla, cambió cómo se ve una imagen clásica: las
// aprobaciones existentes ya no se pueden reproducir. O se revierte el cambio,
// o se sube RENDER_VERSION a propósito (todas las aprobaciones quedan sin
// efecto, con motivo "plantillas") y se actualizan estas huellas.
const GOLDEN: Record<Format, string[]> = {
  CAROUSEL: [
    "7551a107cb793365fc4330eac2bcac140f8ce69c537f0653b50a59a792a6a736",
    "e4d1f4fc840d367bf647a191763c3484e238e15adce7ffef5ea976220b5419e6",
    "f67d2d1a0e0c0cd543a611d195bf2613b4b0db90af9f79e1208a61eaaa750394",
  ],
  FEED_IMAGE: ["0ca210bd4c3920dcfe6c8bb990dc3fee7ac6f9149d0c64cc13ebe3c19772a6b4"],
  STORY: [
    "60734bf9168d5abae15b36041002bd44ceb7f14a3e8f9f380b03027bf2f3530c",
    "e3b9b05ad97509b7e1d23d4675fbb1876dc8f8a75f44f73b2e522a6115cc7e02",
    "70e0afc4a1ec2c1a7e63c5669713968d027ee359d08411ce92b44217cfa3fe71",
  ],
  REEL: ["83d2deda08700f3f9c25026649e804a94fcf34f937269e661ed494d74976535a"],
};

const palette = [
  { name: "Índigo", hex: "#3D3AD8" },
  { name: "Naranja", hex: "#FE6A00" },
  { name: "Crema", hex: "#F6F1E7" },
];
const base = { caption: "Texto", altText: "Alt", hashtags: [] as string[] };
const CASES: Record<Format, AnyContent> = {
  CAROUSEL: { ...base, slides: [{ title: "3 errores que te cuestan clientes", body: "" }, { title: "Responder tarde", body: "Cada hora cuenta." }, { title: "Cierre", body: "Escribinos." }] },
  FEED_IMAGE: { ...base, headline: "Llegó el café de Etiopía", subline: "Notas florales y cítricas.", visualNotes: "" },
  STORY: {
    ...base,
    frames: [
      { text: "¿Espresso o filtrado?", sticker: "POLL", stickerText: "¿Cuál preferís?" },
      { text: "Contanos", sticker: "NONE", stickerText: "" },
      { text: "Te esperamos", sticker: "NONE", stickerText: "" },
    ],
  },
  REEL: { ...base, hooks: ["Si tu café sale amargo, estás moliendo mal.", "", ""], selectedHook: 0, script: [{ say: "a", onScreen: "" }, { say: "b", onScreen: "" }], targetSeconds: 30, coverText: "" },
};

async function hashes(format: Format, content: AnyContent, website: string | null = null) {
  const out: string[] = [];
  for (let index = 0; index < framesOf(format, content).length; index++) {
    out.push(bytesHash((await renderFrameBytes({ format, content, index, brandName: "Kodexa", palette, website }))!));
  }
  return out;
}

describe("imágenes clásicas (sin composición elegida)", () => {
  it.each(Object.keys(GOLDEN) as Format[])("%s se renderiza exactamente igual que antes", async (format) => {
    expect(await hashes(format, CASES[format])).toEqual(GOLDEN[format]);
  });
});

describe("composiciones del catálogo", () => {
  const proof = { id: "p1", statement: "120 consultas atendidas en marzo", source: "CRM" };
  const carousel: AnyContent = {
    ...base,
    slides: [
      { title: "Tu web pierde consultas", body: "" },
      { title: "Cómo responder", body: "Respondé en menos de una hora\nUsá respuestas guardadas\nAvisá cuándo volvés" },
      { title: "Con íconos", body: "Agenda online\nRecordatorios por WhatsApp" },
      { title: "Antes y después", body: "No respondas al otro día\nRespondé en la primera hora" },
      { title: "Frase", body: "Responder rápido es la forma más simple de no perder clientes." },
      { title: "En marzo", body: "Atendimos 120 consultas nuevas." },
      { title: "Tu sitio, claro", body: "Una página que explica qué hacés y cómo contratarte." },
      { title: "Desde el celular", body: "Tus clientes te escriben desde WhatsApp." },
      { title: "Escribinos hoy", body: "Te mostramos cómo lo hacemos." },
    ],
  };
  const designs: Design[] = [
    { layout: "cover-editorial" },
    { layout: "steps" },
    { layout: "icon-list", icons: ["calendar", "chat"] },
    { layout: "compare" },
    { layout: "quote" },
    { layout: "stat", proof },
    { layout: "browser" },
    { layout: "phone" },
    { layout: "cta" },
  ];

  it("cada composición se renderiza, es determinista y distinta de la clásica", async () => {
    const designed = withDesigns("CAROUSEL", carousel, designs);
    const first = await hashes("CAROUSEL", designed, "https://kodexa.ar");
    const again = await hashes("CAROUSEL", designed, "https://kodexa.ar");
    const classic = await hashes("CAROUSEL", carousel, "https://kodexa.ar");
    expect(again).toEqual(first);
    first.forEach((hash, i) => expect(hash).not.toBe(classic[i]));
    expect(new Set(first).size).toBe(first.length);
  }, 60_000);

  it("portada con dispositivo, en navegador y en teléfono, y portadas de Reel y Stories en vertical", async () => {
    for (const device of ["browser", "phone"] as const) {
      const content = withDesigns("CAROUSEL", carousel, [{ layout: "cover-device", device }]);
      expect((await renderFrameBytes({ format: "CAROUSEL", content, index: 0, brandName: "Kodexa", palette, website: "kodexa.ar" }))!.length).toBeGreaterThan(1000);
    }
    const reel = withDesigns("REEL", CASES.REEL, [{ layout: "cover-editorial" }]);
    expect((await renderFrameBytes({ format: "REEL", content: reel, index: 0, brandName: "Kodexa", palette }))!.length).toBeGreaterThan(1000);
    const storyBase = CASES.STORY as FormatContent<"STORY">;
    const storyContent = withDesigns("STORY", { ...storyBase, frames: storyBase.frames.map((f, i) => (i === 1 ? { ...f, text: "Una frase de la marca para destacar en la story." } : f)) }, [undefined, { layout: "quote" }]);
    expect((await renderFrameBytes({ format: "STORY", content: storyContent, index: 1, brandName: "Kodexa", palette }))!.length).toBeGreaterThan(1000);
  }, 60_000);

  it("una pieza vacía sigue sin imágenes con texto", () => {
    expect(framesOf("CAROUSEL", emptyContent("CAROUSEL")).every((f) => !f.design)).toBe(true);
  });
});
