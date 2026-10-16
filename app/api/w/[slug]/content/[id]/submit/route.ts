import { assertSameOrigin, clientIp, handle, json } from "@/lib/http";
import { requirePermission, resolveWorkspaceContext } from "@/modules/access/context";
import { submitForReview } from "@/modules/review/service";

type Params = { params: Promise<{ slug: string; id: string }> };

// Borrador → pendiente de aprobación.
export const POST = handle(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const { slug, id } = await params;
  const ctx = await resolveWorkspaceContext(request.headers, slug);
  requirePermission(ctx, "content.write");
  return json(await submitForReview(ctx, id, clientIp(request.headers)));
});
