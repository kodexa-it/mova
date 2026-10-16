import { z } from "zod";

import { assertSameOrigin, handle, json, parseBody } from "@/lib/http";
import { requirePermission, resolveWorkspaceContext } from "@/modules/access/context";
import { saveVersion } from "@/modules/content/service";

type Params = { params: Promise<{ slug: string; id: string }> };

// El contenido se valida contra el esquema de su formato dentro del servicio.
const bodySchema = z.object({ content: z.unknown() });

export const POST = handle(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const { slug, id } = await params;
  const ctx = await resolveWorkspaceContext(request.headers, slug);
  requirePermission(ctx, "content.write");
  const { content } = await parseBody(request, bodySchema);
  const result = await saveVersion(ctx, id, content);
  return json(result, result.changed ? 201 : 200);
});
