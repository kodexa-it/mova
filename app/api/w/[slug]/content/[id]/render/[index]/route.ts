import { badRequest, handle, notFound } from "@/lib/http";
import { getPrisma } from "@/lib/prisma";
import { resolveWorkspaceContext } from "@/modules/access/context";
import type { AnyContent } from "@/modules/content/formats";
import { renderFrame } from "@/modules/content/render/render";
import { visualContextOf } from "@/modules/content/render/visual";

export const runtime = "nodejs";

type Params = { params: Promise<{ slug: string; id: string; index: string }> };

// PNG de una imagen de la pieza. Con ?v=<versión> renderiza esa versión exacta
// (y se puede guardar en caché: las versiones no cambian); sin v, la vigente.
export const GET = handle(async (request: Request, { params }: Params) => {
  const { slug, id, index } = await params;
  const ctx = await resolveWorkspaceContext(request.headers, slug);
  const n = Number(index);
  if (!Number.isInteger(n) || n < 0 || n > 50) throw badRequest();
  const versionId = new URL(request.url).searchParams.get("v");

  const prisma = getPrisma();
  const item = await prisma.contentItem.findFirst({
    where: { id, workspaceId: ctx.workspace.id },
    select: { format: true, currentVersionId: true },
  });
  if (!item) throw notFound();
  const version = await prisma.contentVersion.findFirst({
    where: { itemId: id, workspaceId: ctx.workspace.id, ...(versionId ? { id: versionId } : { id: item.currentVersionId ?? "" }) },
    select: { id: true, content: true },
  });
  if (!version) throw notFound();

  const image = await renderFrame({ format: item.format, content: version.content as AnyContent, index: n, ...(await visualContextOf(prisma, ctx.workspace.id)) });
  if (!image) throw notFound();

  const headers = new Headers(image.headers);
  headers.set("Cache-Control", versionId ? "private, max-age=31536000, immutable" : "private, no-store");
  return new Response(image.body, { status: 200, headers });
});
