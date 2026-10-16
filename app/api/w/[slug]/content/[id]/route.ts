import { assertSameOrigin, handle, json, parseBody } from "@/lib/http";
import { requirePermission, resolveWorkspaceContext } from "@/modules/access/context";
import { updateMetaSchema } from "@/modules/content/schemas";
import { getContent, updateContentMeta } from "@/modules/content/service";

type Params = { params: Promise<{ slug: string; id: string }> };

export const GET = handle(async (request: Request, { params }: Params) => {
  const { slug, id } = await params;
  const ctx = await resolveWorkspaceContext(request.headers, slug);
  return json({ item: await getContent(ctx, id) });
});

export const PATCH = handle(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const { slug, id } = await params;
  const ctx = await resolveWorkspaceContext(request.headers, slug);
  requirePermission(ctx, "content.write");
  await updateContentMeta(ctx, id, await parseBody(request, updateMetaSchema));
  return json({ ok: true });
});
