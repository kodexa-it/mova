import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { styleOf, usesFile } from "@/modules/content/layouts";
import { framesOf, sizeOf } from "@/modules/content/render/frames";
import { ImpactTemplate } from "@/modules/content/render/impact-templates";
import { LayoutTemplate } from "@/modules/content/render/layout-templates";
import { FrameTemplate } from "@/modules/content/render/templates";
import { themeFor, themeFrom, type PaletteColor } from "@/modules/content/render/theme";
import type { AnyContent, Format } from "@/modules/content/formats";
import { loadArt } from "@/modules/images/assets";

let fonts: Promise<{ name: string; data: ArrayBuffer; weight: 400 | 600; style: "normal" }[]> | null = null;

function loadFonts() {
  fonts ??= Promise.all(
    ([
      ["InstrumentSans-Regular.ttf", "Instrument Sans", 400],
      ["InstrumentSans-SemiBold.ttf", "Instrument Sans", 600],
      // Preset editorial (títulos serif). Solo se usa si la pieza lo elige.
      ["InstrumentSerif-Regular.woff", "Instrument Serif", 400],
      // Estilo Impacto (títulos condensados).
      ["Anton-Regular.woff", "Anton", 400],
    ] as const).map(async ([file, name, weight]) => {
      const buffer = await readFile(join(process.cwd(), "assets", "fonts", file));
      return { name, data: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer, weight, style: "normal" as const };
    }),
  );
  return fonts;
}

// Devuelve el PNG de una imagen de la pieza, o null si el índice no existe.
// workspaceId hace falta solo para las composiciones con imagen generada.
export async function renderFrame(input: { format: Format; content: AnyContent; index: number; brandName: string; palette: PaletteColor[]; website?: string | null; workspaceId?: string }) {
  const frames = framesOf(input.format, input.content);
  const frame = frames[input.index];
  if (!frame) return null;
  const size = sizeOf(frame);
  const style = styleOf(input.content as unknown as Record<string, unknown>);
  const art = frame.design && usesFile(frame.design.layout) ? await loadArt(input.workspaceId, frame.design.art) : null;
  // Sin composición elegida se usa la plantilla clásica, sin cambios (el estilo
  // de la pieza solo se aplica a las composiciones del catálogo).
  // Estilo Impacto: todas las imágenes (también las clásicas) con su sistema
  // propio, salvo las composiciones con imagen generada.
  // Diseño propio: la imagen subida tal cual, sin nada encima.
  const element =
    frame.design?.layout === "upload" && art ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={art} width={size.width} height={size.height} alt="" style={{ width: size.width, height: size.height, objectFit: "cover" }} />
    ) : style?.preset === "impacto" && !art ? (
      <ImpactTemplate frame={frame} palette={input.palette} brand={input.brandName} website={input.website ?? null} {...size} />
    ) : frame.design && frame.design.layout !== "classic" ? (
      <LayoutTemplate frame={frame} theme={themeFor(input.palette, style?.preset)} brand={input.brandName} website={input.website ?? null} style={style} art={art} {...size} />
    ) : (
      <FrameTemplate frame={frame} theme={themeFrom(input.palette)} brand={input.brandName} />
    );
  return new ImageResponse(element, {
    ...size,
    fonts: await loadFonts(),
  });
}

// Bytes del PNG: para calcular la huella de cada imagen al aprobar y para exportar.
export async function renderFrameBytes(input: Parameters<typeof renderFrame>[0]): Promise<Uint8Array | null> {
  const image = await renderFrame(input);
  return image ? new Uint8Array(await image.arrayBuffer()) : null;
}
