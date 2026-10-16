import { z } from "zod";

import { assertSameOrigin, handle, json, parseBody } from "@/lib/http";
import { resolveWorkspaceContext } from "@/modules/access/context";
import { markRead } from "@/modules/notifications/service";

type Params = { params: Promise<{ slug: string }> };

export const POST = handle(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const ctx = await resolveWorkspaceContext(request.headers, (await params).slug);
  const { ids } = await parseBody(request, z.object({ ids: z.union([z.literal("all"), z.array(z.string().max(40)).max(100)]) }));
  return json({ marked: await markRead(ctx, ids) });
});
