import { handle } from "@/lib/http";
import { resolveWorkspaceContext } from "@/modules/access/context";
import { readArt } from "@/modules/images/service";

export const runtime = "nodejs";

type Params = { params: Promise<{ slug: string; id: string; assetId: string }> };

// Archivo de una imagen generada. Inmutable: se puede guardar en caché.
export const GET = handle(async (request: Request, { params }: Params) => {
  const { slug, id, assetId } = await params;
  const ctx = await resolveWorkspaceContext(request.headers, slug);
  const asset = await readArt(ctx, id, assetId);
  return new Response(new Uint8Array(asset.bytes), {
    status: 200,
    headers: { "Content-Type": asset.mimeType, "Cache-Control": "private, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
  });
});
