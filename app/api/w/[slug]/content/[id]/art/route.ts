import { assertSameOrigin, clientIp, handle, json, parseBody } from "@/lib/http";
import { requirePermission, resolveWorkspaceContext } from "@/modules/access/context";
import { generateArt, generateSchema, listArt } from "@/modules/images/service";

export const runtime = "nodejs";
// La generación puede tardar: el proveedor responde en segundos, con margen.
export const maxDuration = 120;

type Params = { params: Promise<{ slug: string; id: string }> };

// Imágenes generadas de la pieza (para volver a elegir una, sin costo).
export const GET = handle(async (request: Request, { params }: Params) => {
  const { slug, id } = await params;
  const ctx = await resolveWorkspaceContext(request.headers, slug);
  return json({ assets: await listArt(ctx, id) });
});

// Genera una imagen con IA. Llamada paga: exige la confirmación explícita
// (costo estimado que se mostró y una clave única por confirmación).
export const POST = handle(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const { slug, id } = await params;
  const ctx = await resolveWorkspaceContext(request.headers, slug);
  requirePermission(ctx, "content.write");
  const input = await parseBody(request, generateSchema);
  return json(await generateArt(ctx, id, input, clientIp(request.headers)), 201);
});
