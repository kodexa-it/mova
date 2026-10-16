import { assertSameOrigin, handle, json } from "@/lib/http";
import { requirePermission, resolveWorkspaceContext } from "@/modules/access/context";
import { addReference, listReferences } from "@/modules/brand/references";

export const runtime = "nodejs";

type Params = { params: Promise<{ slug: string }> };

export const GET = handle(async (request: Request, { params }: Params) => {
  const ctx = await resolveWorkspaceContext(request.headers, (await params).slug);
  return json({ references: await listReferences(ctx) });
});

export const POST = handle(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const ctx = await resolveWorkspaceContext(request.headers, (await params).slug);
  requirePermission(ctx, "brand.update");
  const form = await request.formData().catch(() => null);
  return json({ reference: await addReference(ctx, form?.get("file"), String(form?.get("label") ?? "")) }, 201);
});
