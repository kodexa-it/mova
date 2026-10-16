import { assertSameOrigin, clientIp, handle, json, parseBody } from "@/lib/http";
import { requirePermission, resolveWorkspaceContext } from "@/modules/access/context";
import { permissionsFor } from "@/modules/access/permissions";
import { renameWorkspaceSchema } from "@/modules/access/schemas";
import { deleteWorkspace, renameWorkspace } from "@/modules/workspaces/service";

type Params = { params: Promise<{ slug: string }> };

export const GET = handle(async (request: Request, { params }: Params) => {
  const ctx = await resolveWorkspaceContext(request.headers, (await params).slug);
  requirePermission(ctx, "workspace.read");
  return json({ workspace: ctx.workspace, role: ctx.role, permissions: permissionsFor(ctx.role) });
});

export const PATCH = handle(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const ctx = await resolveWorkspaceContext(request.headers, (await params).slug);
  const { name } = await parseBody(request, renameWorkspaceSchema);
  return json({ workspace: await renameWorkspace(ctx, name, clientIp(request.headers)) });
});

export const DELETE = handle(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const ctx = await resolveWorkspaceContext(request.headers, (await params).slug);
  await deleteWorkspace(ctx, clientIp(request.headers));
  return json({ ok: true });
});
