import { z } from "zod";

import { assertSameOrigin, clientIp, handle, json, parseBody } from "@/lib/http";
import { requirePermission, resolveWorkspaceContext } from "@/modules/access/context";
import { setArchived } from "@/modules/content/service";

type Params = { params: Promise<{ slug: string; id: string }> };

export const POST = handle(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const { slug, id } = await params;
  const ctx = await resolveWorkspaceContext(request.headers, slug);
  requirePermission(ctx, "content.write");
  const { archived } = await parseBody(request, z.object({ archived: z.boolean() }));
  return json(await setArchived(ctx, id, archived, clientIp(request.headers)));
});
