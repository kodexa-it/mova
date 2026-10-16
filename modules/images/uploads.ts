import "server-only";

import { createHash } from "node:crypto";

import { badRequest, conflict, notFound } from "@/lib/http";
import { getPrisma } from "@/lib/prisma";
import { requirePermission, type WorkspaceContext } from "@/modules/access/context";
import { statusAfterEdit } from "@/modules/content/status";
import { imageDimensions } from "@/modules/images/prompt";

// Archivos de imagen que sube el equipo: diseños finales de una pieza y
// referencias de la marca. Solo PNG, JPEG o WebP reales (se lee el
// encabezado, no se confía en el nombre ni en el tipo que manda el navegador).
export const UPLOAD_MAX_BYTES = 8 * 1024 * 1024;
const TYPES = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" } as const;

export function sniffImage(bytes: Uint8Array): (typeof TYPES)[keyof typeof TYPES] | null {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return TYPES.png;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return TYPES.jpeg;
  if (String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return TYPES.webp;
  return null;
}

export async function readImageFile(file: unknown) {
  if (!(file instanceof File)) throw badRequest();
  if (file.size > UPLOAD_MAX_BYTES) throw badRequest("upload_too_large");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = sniffImage(bytes);
  if (!mimeType) throw badRequest("upload_not_image");
  const size = imageDimensions(bytes);
  if (!size || !size.width || !size.height) throw badRequest("upload_not_image");
  return { bytes, mimeType, ...size, sha256: createHash("sha256").update(bytes).digest("hex") };
}

// Proporción esperada por formato: 4:5 en el feed, 9:16 en Stories y Reels.
export function expectedRatio(format: string) {
  return format === "STORY" || format === "REEL" ? { label: "9:16 (por ejemplo 1080×1920)", ratio: 9 / 16 } : { label: "4:5 (por ejemplo 1080×1350)", ratio: 4 / 5 };
}

// Sube el diseño final de una imagen de la pieza. No crea versión: queda
// disponible para elegirlo (composición «Diseño propio») y guardar.
export async function uploadDesign(ctx: WorkspaceContext, itemId: string, index: number, file: unknown) {
  requirePermission(ctx, "content.write");
  const prisma = getPrisma();
  const item = await prisma.contentItem.findFirst({ where: { id: itemId, workspaceId: ctx.workspace.id }, select: { format: true, status: true } });
  if (!item) throw notFound();
  if (statusAfterEdit(item.status) === "locked") throw conflict("content_locked");
  if (!Number.isInteger(index) || index < 0 || index > 19) throw badRequest();
  const image = await readImageFile(file);
  const expected = expectedRatio(item.format);
  if (Math.abs(image.width / image.height - expected.ratio) > 0.02) throw badRequest("upload_wrong_ratio");
  if (image.width < 1000) throw badRequest("upload_too_small");
  return prisma.imageAsset.create({
    data: { workspaceId: ctx.workspace.id, itemId, slotIndex: index, source: "UPLOAD", uploadedById: ctx.user.id, sha256: image.sha256, mimeType: image.mimeType, width: image.width, height: image.height, bytes: Buffer.from(image.bytes) },
    select: { id: true, sha256: true, width: true, height: true },
  });
}
