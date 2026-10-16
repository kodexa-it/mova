import { badRequest, handle, json } from "@/lib/http";
import { resolveWorkspaceContext } from "@/modules/access/context";
import { calendarQuerySchema } from "@/modules/plans/schemas";
import { getCalendar } from "@/modules/plans/service";

type Params = { params: Promise<{ slug: string }> };

// Piezas con fecha entre from (incluido) y to (excluido), días en la zona de la marca.
export const GET = handle(async (request: Request, { params }: Params) => {
  const ctx = await resolveWorkspaceContext(request.headers, (await params).slug);
  const search = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = calendarQuerySchema.safeParse(search);
  if (!parsed.success) throw badRequest();
  return json(await getCalendar(ctx, parsed.data));
});
