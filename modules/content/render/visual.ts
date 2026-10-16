import "server-only";

import type { Prisma } from "@prisma/client";

import type { VisualContext } from "@/modules/content/render/fingerprint";
import type { PaletteColor } from "@/modules/content/render/theme";

type Db = Pick<Prisma.TransactionClient, "brand" | "workspace">;

// Nombre y paleta con los que se renderizan las imágenes de un workspace (y su
// id, para leer las imágenes generadas, que nunca salen de su workspace).
export async function visualContextOf(db: Db, workspaceId: string): Promise<VisualContext> {
  const brand = await db.brand.findUnique({ where: { workspaceId }, select: { name: true, website: true, visual: { select: { palette: true } } } });
  const name = brand?.name || (await db.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { name: true } })).name;
  const palette = Array.isArray(brand?.visual?.palette) ? (brand.visual.palette as unknown as PaletteColor[]) : [];
  return { brandName: name, palette, website: brand?.website ?? null, workspaceId };
}
