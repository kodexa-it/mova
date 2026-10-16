import { handle, json } from "@/lib/http";
import { resolveWorkspaceContext } from "@/modules/access/context";
import { getReview } from "@/modules/review/service";

type Params = { params: Promise<{ slug: string; id: string }> };

// Estado de revisión: aprobación vigente o vencida, bloqueos, comentarios y decisiones.
export const GET = handle(async (request: Request, { params }: Params) => {
  const { slug, id } = await params;
  const ctx = await resolveWorkspaceContext(request.headers, slug);
  return json({ review: await getReview(ctx, id) });
});
