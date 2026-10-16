import { z } from "zod";

import { assertSameOrigin, badRequest, clientIp, handle, json, parseBody } from "@/lib/http";
import { requirePermission, resolveWorkspaceContext } from "@/modules/access/context";
import { kickJobs } from "@/modules/jobs/run";
import { weekStartSchema } from "@/modules/plans/schemas";
import { approveStrategy } from "@/modules/plans/strategy";

type Params = { params: Promise<{ slug: string; week: string }> };

// Aprueba la estrategia: crea las piezas y encola su generación en segundo
// plano. Responde enseguida; el avance se consulta con GET .../strategy.
export const POST = handle(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const { slug, week } = await params;
  const parsed = weekStartSchema.safeParse(week);
  if (!parsed.success) throw badRequest();
  const ctx = await resolveWorkspaceContext(request.headers, slug);
  requirePermission(ctx, "plan.write");
  const input = await parseBody(request, z.object({ visualMode: z.enum(["STANDARD", "AI"]).default("STANDARD") }));
  const result = await approveStrategy(ctx, parsed.data, input, clientIp(request.headers));
  kickJobs();
  return json(result, 201);
});
