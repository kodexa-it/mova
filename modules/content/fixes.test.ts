import { describe, expect, it } from "vitest";

import { mergeScopes, scopesFor } from "@/modules/content/fixes";
import type { AnyContent } from "@/modules/content/formats";
import { carryDesigns, slotsOf, withDesigns } from "@/modules/content/layouts";

const CAROUSEL = {
  caption: "Caption original",
  altText: "Alt original",
  hashtags: ["uno"],
  slides: [
    { title: "Portada original", body: "", design: { layout: "cover-editorial" as const } },
    { title: "Pasos", body: "Uno\nDos\nTres" },
    { title: "Cierre", body: "Escribinos." },
  ],
};
const PROPOSAL = { caption: "Caption nuevo", altText: "Alt nuevo", hashtags: ["dos"], slides: CAROUSEL.slides.map((s) => ({ title: `${s.title} nuevo`, body: `${s.body} nuevo` })) };

describe("alcance de cada corrección", () => {
  it("asigna campos según la sugerencia", () => {
    expect(scopesFor({ id: "caption.first-line" }, "CAROUSEL")).toEqual(["caption"]);
    expect(scopesFor({ id: "caption.hashtags" }, "CAROUSEL")).toEqual(["caption", "hashtags"]);
    expect(scopesFor({ id: "hook" }, "CAROUSEL")).toEqual(["cover"]);
    expect(scopesFor({ id: "hook" }, "STORY")).toBeNull();
    expect(scopesFor({ id: "brand.placeholders" }, "CAROUSEL")).toBeNull();
    expect(scopesFor({ id: "layout.2" }, "CAROUSEL")).toBeNull();
    expect(scopesFor({ id: "human.stock" }, "CAROUSEL")).toEqual(["text"]);
  });

  it("solo copia lo permitido y conserva los diseños", () => {
    const caption = mergeScopes("CAROUSEL", CAROUSEL as AnyContent, PROPOSAL as AnyContent, ["caption"]) as typeof CAROUSEL;
    expect(caption.caption).toBe("Caption nuevo");
    expect(caption.altText).toBe("Alt original");
    expect(caption.slides).toEqual(CAROUSEL.slides);

    const cover = mergeScopes("CAROUSEL", CAROUSEL as AnyContent, PROPOSAL as AnyContent, ["cover"]) as typeof CAROUSEL;
    expect(cover.slides[0]).toEqual({ title: "Portada original nuevo", body: "", design: { layout: "cover-editorial" } });
    expect(cover.slides[1]).toEqual(CAROUSEL.slides[1]);
    expect(cover.caption).toBe("Caption original");

    const text = mergeScopes("CAROUSEL", CAROUSEL as AnyContent, PROPOSAL as AnyContent, ["text"]) as typeof CAROUSEL;
    expect(text.slides[0]).toMatchObject({ title: "Portada original nuevo", design: { layout: "cover-editorial" } });
    expect(text.hashtags).toEqual(["dos"]);
  });

  it("si la IA cambió la cantidad de slides, no se toman sus textos", () => {
    const shorter = { ...PROPOSAL, slides: PROPOSAL.slides.slice(0, 2) };
    expect((mergeScopes("CAROUSEL", CAROUSEL as AnyContent, shorter as AnyContent, ["text"]) as typeof CAROUSEL).slides).toEqual(CAROUSEL.slides);
  });
});

describe("la composición sobrevive a un texto nuevo", () => {
  it("una pieza sin composiciones recibe la sugerencia completa", () => {
    const plain = { ...CAROUSEL, slides: CAROUSEL.slides.map(({ title, body }) => ({ title, body })) };
    const next = carryDesigns("CAROUSEL", plain, plain, {});
    expect(slotsOf("CAROUSEL", next).map((s) => s.design?.layout)).toEqual(["cover-editorial", "steps", "cta"]);
  });

  it("conserva lo que entra, cambia lo que no y respeta lo clásico elegido", () => {
    const composed = withDesigns("CAROUSEL", CAROUSEL, [{ layout: "cover-editorial" }, { layout: "steps" }, undefined]);
    const nextText = { ...CAROUSEL, slides: [{ title: "Otra portada", body: "" }, { title: "Pasos", body: "Una sola línea larga para esta slide." }, { title: "Cierre", body: "Escribinos." }] };
    const next = carryDesigns("CAROUSEL", composed, nextText, {});
    expect(slotsOf("CAROUSEL", next).map((s) => s.design?.layout)).toEqual(["cover-editorial", "quote", undefined]);
  });
});
