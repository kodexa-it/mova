import { assertSameOrigin, handle, json, parseBody } from "@/lib/http";
import { resolveWorkspaceContext } from "@/modules/access/context";
import { manualMetricsSchema } from "@/modules/metrics/model";
import { addManualMetrics } from "@/modules/metrics/service";

type Params = { params: Promise<{ slug: string; pubId: string }> };

export const POST = handle(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const { slug, pubId } = await params;
  const ctx = await resolveWorkspaceContext(request.headers, slug);
  return json({ snapshot: await addManualMetrics(ctx, pubId, await parseBody(request, manualMetricsSchema)) }, 201);
});
