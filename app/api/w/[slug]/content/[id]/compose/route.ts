import { z } from "zod";

import { assertSameOrigin, handle, json, parseBody } from "@/lib/http";
import { requirePermission, resolveWorkspaceContext } from "@/modules/access/context";
import { composePiece } from "@/modules/content/compose";

type Params = { params: Promise<{ slug: string; id: string }> };

// Mejora la composición de las imágenes: { mode: "ai" } elige con IA del
// catálogo; { mode: "auto" } aplica la sugerencia determinista, sin costo.
export const POST = handle(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const { slug, id } = await params;
  const ctx = await resolveWorkspaceContext(request.headers, slug);
  requirePermission(ctx, "content.write");
  const { mode } = await parseBody(request, z.object({ mode: z.enum(["ai", "auto"]) }));
  return json(await composePiece(ctx, id, mode));
});
