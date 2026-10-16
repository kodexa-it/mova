import { z } from "zod";

import { assertSameOrigin, handle, json, parseBody } from "@/lib/http";
import { requirePermission, resolveWorkspaceContext } from "@/modules/access/context";
import { fixPiece } from "@/modules/content/generate";

type Params = { params: Promise<{ slug: string; id: string }> };

// Corrige con IA sugerencias de la revisión automática: { checks: ["caption.first-line"] }.
// Sin ids, corrige todas las que se pueden corregir.
export const POST = handle(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const { slug, id } = await params;
  const ctx = await resolveWorkspaceContext(request.headers, slug);
  requirePermission(ctx, "content.write");
  const { checks } = await parseBody(request, z.object({ checks: z.array(z.string().min(1).max(40)).max(30).default([]) }));
  return json(await fixPiece(ctx, id, checks), 201);
});
