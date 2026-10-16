import { z } from "zod";

import { assertSameOrigin, badRequest, handle, notFound } from "@/lib/http";
import { getPrisma } from "@/lib/prisma";
import { requirePermission, resolveWorkspaceContext } from "@/modules/access/context";
import { FORMAT_SCHEMAS, type AnyContent } from "@/modules/content/formats";
import { normalizeDesigns } from "@/modules/content/layouts";
import { renderFrame } from "@/modules/content/render/render";
import { visualContextOf } from "@/modules/content/render/visual";

export const runtime = "nodejs";

type Params = { params: Promise<{ slug: string; id: string }> };

const bodySchema = z.object({ content: z.unknown(), index: z.number().int().min(0).max(20) });

// Vista previa en vivo: renderiza una imagen con el contenido que se está
// editando, sin guardarlo. Solo para quien puede editar; no se guarda nada ni
// se puede cachear (el contenido no tiene versión).
export const POST = handle(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const { slug, id } = await params;
  const ctx = await resolveWorkspaceContext(request.headers, slug);
  requirePermission(ctx, "content.write");
  const prisma = getPrisma();
  const item = await prisma.contentItem.findFirst({ where: { id, workspaceId: ctx.workspace.id }, select: { format: true } });
  if (!item) throw notFound();
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) throw badRequest();
  // Mientras se escribe, los campos pueden estar incompletos: se valida la
  // forma, no el contenido mínimo (por eso no se usa el esquema estricto).
  const parsed = FORMAT_SCHEMAS[item.format].safeParse(body.data.content);
  const content = parsed.success ? normalizeDesigns(item.format, parsed.data as AnyContent) : null;
  if (!content) throw badRequest();
  const image = await renderFrame({ format: item.format, content, index: body.data.index, ...(await visualContextOf(prisma, ctx.workspace.id)) });
  if (!image) throw notFound();
  const headers = new Headers(image.headers);
  headers.set("Cache-Control", "private, no-store");
  return new Response(image.body, { status: 200, headers });
});
