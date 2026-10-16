import { describe, expect, it } from "vitest";

import { emptyContent } from "@/modules/content/formats";
import { framesOf, isBlankFrame, sizeOf } from "@/modules/content/render/frames";
import { contrast, themeFrom } from "@/modules/content/render/theme";

describe("tema de las plantillas", () => {
  it("elige texto legible sobre cualquier paleta", () => {
    const palettes = [
      [{ name: "Naranja", hex: "#FE6A00" }],
      [{ name: "Amarillo", hex: "#FFE14D" }, { name: "Gris", hex: "#CCCCCC" }],
      [{ name: "Negro", hex: "#000000" }, { name: "Blanco", hex: "#FFFFFF" }],
      [{ name: "Pastel", hex: "#C9D3FF" }],
      [],
    ];
    for (const palette of palettes) {
      const theme = themeFrom(palette);
      expect(contrast(theme.strong.text, theme.strong.background)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(theme.light.text, theme.light.background)).toBeGreaterThanOrEqual(7);
    }
  });

  it("usa el color principal de la marca como fondo de portada", () => {
    expect(themeFrom([{ name: "Principal", hex: "#3D3AD8" }]).strong.background).toBe("#3d3ad8");
  });

  it("ignora colores mal formados", () => {
    expect(themeFrom([{ name: "Roto", hex: "rojo" }]).strong.background).toBe("#1f2023");
  });
});

describe("imágenes de cada pieza", () => {
  it("un carrusel da una imagen por slide, con portada y cierre", () => {
    const frames = framesOf("CAROUSEL", emptyContent("CAROUSEL"));
    expect(frames.map((f) => f.kind)).toEqual(["cover", "slide", "slide"]);
    expect(frames[2]).toMatchObject({ last: true });
    expect(sizeOf(frames[0]!)).toEqual({ width: 1080, height: 1350 });
  });

  it("las Stories y la portada del Reel son verticales", () => {
    expect(framesOf("STORY", emptyContent("STORY")).map(sizeOf)).toEqual(Array(3).fill({ width: 1080, height: 1920 }));
    expect(sizeOf(framesOf("REEL", emptyContent("REEL"))[0]!)).toEqual({ width: 1080, height: 1920 });
  });
});

describe("imágenes sin texto", () => {
  it("una pieza vacía no tiene imágenes para mostrar", () => {
    for (const format of ["CAROUSEL", "FEED_IMAGE", "STORY", "REEL"] as const) {
      expect(framesOf(format, emptyContent(format)).every(isBlankFrame)).toBe(true);
    }
  });

  it("la portada del Reel usa el hook elegido si no hay texto de portada", () => {
    const reel = { ...emptyContent("REEL"), hooks: ["", "Respondé en una hora", ""], selectedHook: 1 };
    const [frame] = framesOf("REEL", reel);
    expect(isBlankFrame(frame!)).toBe(false);
  });
});
