import { assertSameOrigin, handle, json } from "@/lib/http";
import { resolveWorkspaceContext } from "@/modules/access/context";
import { readReference, removeReference } from "@/modules/brand/references";

export const runtime = "nodejs";

type Params = { params: Promise<{ slug: string; refId: string }> };

export const GET = handle(async (request: Request, { params }: Params) => {
  const { slug, refId } = await params;
  const ctx = await resolveWorkspaceContext(request.headers, slug);
  const ref = await readReference(ctx, refId);
  const download = new URL(request.url).searchParams.has("descargar");
  const ext = ref.mimeType.split("/")[1] === "jpeg" ? "jpg" : ref.mimeType.split("/")[1];
  return new Response(new Uint8Array(ref.bytes), {
    headers: {
      "Content-Type": ref.mimeType,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      ...(download ? { "Content-Disposition": `attachment; filename="referencia-${refId.slice(-6)}.${ext}"` } : {}),
    },
  });
});

export const DELETE = handle(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const { slug, refId } = await params;
  const ctx = await resolveWorkspaceContext(request.headers, slug);
  await removeReference(ctx, refId);
  return json({ ok: true });
});
