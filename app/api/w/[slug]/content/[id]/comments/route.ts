import { assertSameOrigin, handle, json, parseBody } from "@/lib/http";
import { requirePermission, resolveWorkspaceContext } from "@/modules/access/context";
import { commentSchema } from "@/modules/review/schemas";
import { addComment } from "@/modules/review/service";

type Params = { params: Promise<{ slug: string; id: string }> };

export const POST = handle(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const { slug, id } = await params;
  const ctx = await resolveWorkspaceContext(request.headers, slug);
  requirePermission(ctx, "content.comment");
  const { body } = await parseBody(request, commentSchema);
  return json({ comment: await addComment(ctx, id, body) }, 201);
});
