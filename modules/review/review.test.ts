import { describe, expect, it } from "vitest";

import { emptyContent } from "@/modules/content/formats";
import { RENDER_VERSION, visualHash } from "@/modules/content/render/fingerprint";
import { approvalStateOf } from "@/modules/review/approval";
import { reviewBlockers } from "@/modules/review/gate";

const CAROUSEL = {
  caption: "Atendimos 120 consultas en marzo.\n\nGuardá este post.",
  altText: "Tres slides con texto",
  hashtags: ["pymes"],
  slides: [
    { title: "3 errores que te cuestan clientes", body: "" },
    { title: "Responder tarde", body: "Cada hora cuenta." },
    { title: "Cierre", body: "Escribinos." },
  ],
};

const decision = { id: "d1", versionId: "v1", contentHash: "c1", visualHash: "x1", renderVersion: RENDER_VERSION, invalidatedAt: null, invalidReason: null };
const now = { versionId: "v1", contentHash: "c1", visualHash: "x1" };

describe("estado de la aprobación", () => {
  it("sin aprobaciones no hay nada aprobado", () => {
    expect(approvalStateOf(null, now)).toEqual({ kind: "none" });
  });
  it("vale solo para la misma versión, contenido, apariencia y plantillas", () => {
    expect(approvalStateOf(decision, now).kind).toBe("valid");
    expect(approvalStateOf(decision, { ...now, versionId: "v2" })).toMatchObject({ kind: "stale", reason: "content_changed" });
    expect(approvalStateOf(decision, { ...now, contentHash: "c2" })).toMatchObject({ kind: "stale", reason: "content_changed" });
    expect(approvalStateOf(decision, { ...now, visualHash: "x2" })).toMatchObject({ kind: "stale", reason: "visual_changed" });
    expect(approvalStateOf({ ...decision, renderVersion: "plantillas-viejas" }, now)).toMatchObject({ kind: "stale", reason: "templates_changed" });
  });
  it("una aprobación invalidada no vuelve a valer aunque todo coincida", () => {
    expect(approvalStateOf({ ...decision, invalidatedAt: new Date(), invalidReason: "archived" }, now)).toMatchObject({ kind: "stale", reason: "archived" });
  });
});

describe("huella visual", () => {
  it("depende de los colores y el nombre, no del nombre de cada color ni de mayúsculas", () => {
    const a = visualHash({ brandName: "Kodexa", palette: [{ name: "Naranja", hex: "#FE6A00" }] });
    expect(visualHash({ brandName: "Kodexa", palette: [{ name: "Otro", hex: "#fe6a00" }] })).toBe(a);
    expect(visualHash({ brandName: "Kodexa", palette: [{ name: "Naranja", hex: "#3D3AD8" }] })).not.toBe(a);
    expect(visualHash({ brandName: "Mova", palette: [{ name: "Naranja", hex: "#FE6A00" }] })).not.toBe(a);
  });
});

describe("bloqueos de revisión", () => {
  it("una pieza completa no tiene bloqueos", () => {
    expect(reviewBlockers("CAROUSEL", CAROUSEL, { wordsToAvoid: [] })).toEqual([]);
  });
  it("los datos por completar y las palabras que la marca evita bloquean", () => {
    expect(reviewBlockers("CAROUSEL", { ...CAROUSEL, caption: "Somos {{cantidad}}.\nGuardá este post." }, { wordsToAvoid: [] }).length).toBeGreaterThan(0);
    expect(reviewBlockers("CAROUSEL", CAROUSEL, { wordsToAvoid: ["consultas"] }).map((b) => b.id)).toContain("brand.avoid");
  });
  it("las imágenes sin texto bloquean", () => {
    const blockers = reviewBlockers("CAROUSEL", { ...CAROUSEL, slides: [CAROUSEL.slides[0]!, { title: "", body: "" }, CAROUSEL.slides[2]!] }, { wordsToAvoid: [] });
    expect(blockers).toContainEqual(expect.objectContaining({ id: "frame.1.blank", detail: "Slide 2 no tiene texto." }));
  });
  it("una pieza vacía está bloqueada en todos los formatos", () => {
    for (const format of ["CAROUSEL", "FEED_IMAGE", "STORY", "REEL"] as const) expect(reviewBlockers(format, emptyContent(format), { wordsToAvoid: [] }).length).toBeGreaterThan(0);
  });
});
