import { assertSameOrigin, handle, json, parseBody } from "@/lib/http";
import { requirePermission, resolveWorkspaceContext } from "@/modules/access/context";
import { artInputSchema, quoteArt } from "@/modules/images/service";

type Params = { params: Promise<{ slug: string; id: string }> };

// Costo estimado, límite disponible e imágenes reutilizables antes de
// confirmar. No llama al proveedor ni cobra nada.
export const POST = handle(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const { slug, id } = await params;
  const ctx = await resolveWorkspaceContext(request.headers, slug);
  requirePermission(ctx, "content.write");
  return json(await quoteArt(ctx, id, await parseBody(request, artInputSchema)));
});
