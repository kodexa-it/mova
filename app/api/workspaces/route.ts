import { assertSameOrigin, clientIp, handle, json, parseBody } from "@/lib/http";
import { requireUser } from "@/modules/access/context";
import { createWorkspaceSchema } from "@/modules/access/schemas";
import { createWorkspace, listWorkspacesForUser } from "@/modules/workspaces/service";

export const GET = handle(async (request: Request) => {
  const user = await requireUser(request.headers);
  return json({ workspaces: await listWorkspacesForUser(user.id) });
});

export const POST = handle(async (request: Request) => {
  assertSameOrigin(request);
  const user = await requireUser(request.headers);
  const { name } = await parseBody(request, createWorkspaceSchema);
  const workspace = await createWorkspace(user, name, clientIp(request.headers));
  return json({ workspace }, 201);
});
