import "server-only";

import { createHash } from "node:crypto";

import { HttpError } from "@/lib/http";
import { getPrisma } from "@/lib/prisma";
import type { ArtRef } from "@/modules/content/layouts";

// Imagen generada lista para el renderizador (data URL). Solo se lee dentro del
// workspace y si la huella coincide: una versión nunca muestra otra imagen que
// la que se aprobó.
export async function loadArt(workspaceId: string | undefined, art: ArtRef | undefined): Promise<string> {
  if (!workspaceId || !art) throw new HttpError(409, "art_missing");
  const asset = await getPrisma().imageAsset.findFirst({ where: { id: art.assetId, workspaceId, sha256: art.sha256 }, select: { bytes: true, mimeType: true } });
  if (!asset || createHash("sha256").update(asset.bytes).digest("hex") !== art.sha256) throw new HttpError(409, "art_missing");
  return `data:${asset.mimeType};base64,${Buffer.from(asset.bytes).toString("base64")}`;
}
