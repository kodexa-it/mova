import { assertSameOrigin, clientIp, handle, json, parseBody } from "@/lib/http";
import { requirePermission, resolveWorkspaceContext } from "@/modules/access/context";
import { requestChangesSchema } from "@/modules/review/schemas";
import { requestChanges } from "@/modules/review/service";

type Params = { params: Promise<{ slug: string; id: string }> };

export const POST = handle(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const { slug, id } = await params;
  const ctx = await resolveWorkspaceContext(request.headers, slug);
  requirePermission(ctx, "content.requestChanges");
  const { versionId, note } = await parseBody(request, requestChangesSchema);
  return json(await requestChanges(ctx, id, versionId, note, clientIp(request.headers)));
});
