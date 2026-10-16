import { assertSameOrigin, handle, json } from "@/lib/http";
import { requirePermission, resolveWorkspaceContext } from "@/modules/access/context";
import { uploadDesign } from "@/modules/images/uploads";

export const runtime = "nodejs";

type Params = { params: Promise<{ slug: string; id: string }> };

// Sube el diseño final de una imagen (multipart: file, index).
export const POST = handle(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const { slug, id } = await params;
  const ctx = await resolveWorkspaceContext(request.headers, slug);
  requirePermission(ctx, "content.write");
  const form = await request.formData().catch(() => null);
  const asset = await uploadDesign(ctx, id, Number(form?.get("index")), form?.get("file"));
  return json({ asset }, 201);
});
