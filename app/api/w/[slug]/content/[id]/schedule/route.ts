import { assertSameOrigin, clientIp, handle, json, parseBody } from "@/lib/http";
import { requirePermission, resolveWorkspaceContext } from "@/modules/access/context";
import { DEFAULT_TIME, scheduleSchema } from "@/modules/plans/schemas";
import { scheduleContent } from "@/modules/plans/service";

type Params = { params: Promise<{ slug: string; id: string }> };

// Fecha prevista de publicación: { date: "2026-10-20", time: "10:00" } o { date: null }.
export const PUT = handle(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const { slug, id } = await params;
  const ctx = await resolveWorkspaceContext(request.headers, slug);
  requirePermission(ctx, "plan.write");
  const { date, time } = await parseBody(request, scheduleSchema);
  const slot = date ? { date, time: time ?? DEFAULT_TIME } : null;
  return json(await scheduleContent(ctx, id, slot, clientIp(request.headers)));
});
