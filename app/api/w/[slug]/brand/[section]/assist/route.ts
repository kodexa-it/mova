import { z } from "zod";

import { assertSameOrigin, handle, json, notFound, parseBody } from "@/lib/http";
import { requirePermission, resolveWorkspaceContext } from "@/modules/access/context";
import { assistBrandSection, isAssistable } from "@/modules/brand/assist";

type Params = { params: Promise<{ slug: string; section: string }> };

const bodySchema = z.object({ notes: z.string().trim().max(600).default("") });

// Devuelve una propuesta para la sección. No guarda nada: la persona la revisa
// y decide si la usa.
export const POST = handle(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const { slug, section } = await params;
  if (!isAssistable(section)) throw notFound();
  const ctx = await resolveWorkspaceContext(request.headers, slug);
  requirePermission(ctx, "brand.update");
  const { notes } = await parseBody(request, bodySchema);
  return json({ proposal: await assistBrandSection(ctx, section, notes) });
});
