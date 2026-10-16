import { z } from "zod";

import { assertSameOrigin, badRequest, clientIp, handle, json, parseBody } from "@/lib/http";
import { requirePermission, resolveWorkspaceContext } from "@/modules/access/context";
import { weekStartSchema } from "@/modules/plans/schemas";
import { discardStrategy, getStrategy, proposeStrategy, updateStrategy } from "@/modules/plans/strategy";
import { MAX_SLOTS } from "@/modules/plans/strategy-model";

export const maxDuration = 60;

type Params = { params: Promise<{ slug: string; week: string }> };

async function context(request: Request, params: Params["params"]) {
  const { slug, week } = await params;
  const parsed = weekStartSchema.safeParse(week);
  if (!parsed.success) throw badRequest();
  return { ctx: await resolveWorkspaceContext(request.headers, slug), week: parsed.data };
}

export const GET = handle(async (request: Request, { params }: Params) => {
  const { ctx, week } = await context(request, params);
  return json(await getStrategy(ctx, week));
});

// La IA propone la estrategia de la semana a partir del foco guardado.
export const POST = handle(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const { ctx, week } = await context(request, params);
  requirePermission(ctx, "plan.write");
  const input = await parseBody(request, z.object({ count: z.number().int().min(1).max(MAX_SLOTS).default(4), instructions: z.string().trim().max(600).default("") }));
  return json(await proposeStrategy(ctx, week, input, clientIp(request.headers)), 201);
});

// Edición de la propuesta antes de aprobarla.
export const PUT = handle(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const { ctx, week } = await context(request, params);
  requirePermission(ctx, "plan.write");
  return json(await updateStrategy(ctx, week, await request.json().catch(() => null)));
});

export const DELETE = handle(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const { ctx, week } = await context(request, params);
  await discardStrategy(ctx, week);
  return json({ ok: true });
});
