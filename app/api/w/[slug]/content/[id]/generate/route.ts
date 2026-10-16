import { z } from "zod";

import { assertSameOrigin, handle, json, parseBody } from "@/lib/http";
import { requirePermission, resolveWorkspaceContext } from "@/modules/access/context";
import { generatePiece } from "@/modules/content/generate";

type Params = { params: Promise<{ slug: string; id: string }> };

const bodySchema = z.object({ instructions: z.string().trim().max(800).default("") });

export const POST = handle(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const { slug, id } = await params;
  const ctx = await resolveWorkspaceContext(request.headers, slug);
  requirePermission(ctx, "content.write");
  const { instructions } = await parseBody(request, bodySchema);
  return json(await generatePiece(ctx, id, instructions), 201);
});
