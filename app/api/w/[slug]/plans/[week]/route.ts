import { assertSameOrigin, badRequest, clientIp, handle, json, parseBody } from "@/lib/http";
import { requirePermission, resolveWorkspaceContext } from "@/modules/access/context";
import { planFocusSchema, weekStartSchema } from "@/modules/plans/schemas";
import { savePlanFocus } from "@/modules/plans/service";

type Params = { params: Promise<{ slug: string; week: string }> };

// Foco de la semana que empieza el lunes {week}.
export const PUT = handle(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const { slug, week } = await params;
  const ctx = await resolveWorkspaceContext(request.headers, slug);
  requirePermission(ctx, "plan.write");
  if (!weekStartSchema.safeParse(week).success) throw badRequest();
  const { focus } = await parseBody(request, planFocusSchema);
  return json({ plan: await savePlanFocus(ctx, week, focus, clientIp(request.headers)) });
});
