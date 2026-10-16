import { handle, json } from "@/lib/http";
import { resolveWorkspaceContext } from "@/modules/access/context";
import { listAudit } from "@/modules/audit/service";

type Params = { params: Promise<{ slug: string }> };

export const GET = handle(async (request: Request, { params }: Params) => {
  const ctx = await resolveWorkspaceContext(request.headers, (await params).slug);
  return json({ entries: await listAudit(ctx) });
});
