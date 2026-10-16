import { z } from "zod";

import { assertSameOrigin, clientIp, handle, json, parseBody } from "@/lib/http";
import { resolveWorkspaceContext } from "@/modules/access/context";
import { getImageUsage, MAX_IMAGE_BUDGET_USD, setImageBudget } from "@/modules/images/service";

type Params = { params: Promise<{ slug: string }> };

export const GET = handle(async (request: Request, { params }: Params) => {
  const ctx = await resolveWorkspaceContext(request.headers, (await params).slug);
  return json(await getImageUsage(ctx));
});

// Límite mensual de imágenes con IA (solo Dueño). 0 bloquea toda generación.
export const PUT = handle(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const ctx = await resolveWorkspaceContext(request.headers, (await params).slug);
  const { usd } = await parseBody(request, z.object({ usd: z.number().min(0).max(MAX_IMAGE_BUDGET_USD) }));
  return json(await setImageBudget(ctx, usd, clientIp(request.headers)));
});
