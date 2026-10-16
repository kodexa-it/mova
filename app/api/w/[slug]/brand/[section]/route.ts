import { assertSameOrigin, clientIp, handle, json, notFound, parseBody } from "@/lib/http";
import { requirePermission, resolveWorkspaceContext } from "@/modules/access/context";
import { brandProgress } from "@/modules/brand/completeness";
import { isSectionKey, SECTIONS } from "@/modules/brand/sections";
import { saveBrandSection, shapeOf } from "@/modules/brand/service";

type Params = { params: Promise<{ slug: string; section: string }> };

export const PUT = handle(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const { slug, section } = await params;
  if (!isSectionKey(section)) throw notFound();
  const ctx = await resolveWorkspaceContext(request.headers, slug);
  // El permiso se verifica antes de leer el cuerpo: sin permiso, 403 aunque los datos sean inválidos.
  requirePermission(ctx, "brand.update");
  const input = await parseBody(request, SECTIONS[section].schema);
  const brand = await saveBrandSection(ctx, section, input as never, clientIp(request.headers));
  return json({ brand, progress: brandProgress(shapeOf(brand)) });
});
