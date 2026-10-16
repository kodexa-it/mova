import { assertSameOrigin, clientIp, handle, json, parseBody } from "@/lib/http";
import { resolveWorkspaceContext } from "@/modules/access/context";
import { publicationSchema, recordPublication } from "@/modules/metrics/service";

type Params = { params: Promise<{ slug: string; id: string }> };

// Registro manual de la publicación (fecha y enlace). Solo versiones aprobadas.
export const POST = handle(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const { slug, id } = await params;
  const ctx = await resolveWorkspaceContext(request.headers, slug);
  return json({ publication: await recordPublication(ctx, id, await parseBody(request, publicationSchema), clientIp(request.headers)) }, 201);
});
