import { assertSameOrigin, clientIp, handle, json, parseBody } from "@/lib/http";
import { requirePermission, resolveWorkspaceContext } from "@/modules/access/context";
import { createContentSchema } from "@/modules/content/schemas";
import { createContent, listContent } from "@/modules/content/service";
import { DEFAULT_TIME } from "@/modules/plans/schemas";

type Params = { params: Promise<{ slug: string }> };

export const GET = handle(async (request: Request, { params }: Params) => {
  const ctx = await resolveWorkspaceContext(request.headers, (await params).slug);
  return json({ items: await listContent(ctx) });
});

export const POST = handle(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const ctx = await resolveWorkspaceContext(request.headers, (await params).slug);
  requirePermission(ctx, "content.write");
  const { date, time, ...input } = await parseBody(request, createContentSchema);
  const slot = date ? { date, time: time ?? DEFAULT_TIME } : null;
  return json({ item: await createContent(ctx, { ...input, slot }, clientIp(request.headers)) }, 201);
});
