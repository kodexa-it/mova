import { z } from "zod";

import { assertSameOrigin, handle, json, parseBody } from "@/lib/http";
import { resolveWorkspaceContext } from "@/modules/access/context";
import { fetchPublicMetrics } from "@/modules/metrics/service";

export const maxDuration = 120;

type Params = { params: Promise<{ slug: string; pubId: string }> };

// Lee métricas públicas con Apify. Llamada paga: exige { confirm: true }.
export const POST = handle(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const { slug, pubId } = await params;
  const ctx = await resolveWorkspaceContext(request.headers, slug);
  await parseBody(request, z.object({ confirm: z.literal(true) }));
  return json({ snapshot: await fetchPublicMetrics(ctx, pubId) }, 201);
});
