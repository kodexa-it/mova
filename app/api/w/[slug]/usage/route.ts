import { handle, json } from "@/lib/http";
import { resolveWorkspaceContext } from "@/modules/access/context";
import { getAiUsage } from "@/modules/ai/usage";

type Params = { params: Promise<{ slug: string }> };

export const GET = handle(async (request: Request, { params }: Params) => {
  const ctx = await resolveWorkspaceContext(request.headers, (await params).slug);
  return json(await getAiUsage(ctx));
});
