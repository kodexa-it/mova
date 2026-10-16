import { assertSameOrigin, clientIp, handle, json, parseBody } from "@/lib/http";
import { requirePermission, resolveWorkspaceContext } from "@/modules/access/context";
import { approveSchema } from "@/modules/review/schemas";
import { approveVersion } from "@/modules/review/service";

export const runtime = "nodejs";

type Params = { params: Promise<{ slug: string; id: string }> };

// Aprueba la versión indicada (la que la persona estaba viendo).
export const POST = handle(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const { slug, id } = await params;
  const ctx = await resolveWorkspaceContext(request.headers, slug);
  requirePermission(ctx, "content.approve");
  const { versionId, note } = await parseBody(request, approveSchema);
  return json(await approveVersion(ctx, id, versionId, note, clientIp(request.headers)));
});
