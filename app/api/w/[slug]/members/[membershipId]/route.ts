import { assertSameOrigin, clientIp, handle, json, parseBody } from "@/lib/http";
import { resolveWorkspaceContext } from "@/modules/access/context";
import { changeRoleSchema } from "@/modules/access/schemas";
import { changeMemberRole, removeMember } from "@/modules/members/service";

type Params = { params: Promise<{ slug: string; membershipId: string }> };

export const PATCH = handle(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const { slug, membershipId } = await params;
  const ctx = await resolveWorkspaceContext(request.headers, slug);
  const { role } = await parseBody(request, changeRoleSchema);
  return json(await changeMemberRole(ctx, membershipId, role, clientIp(request.headers)));
});

export const DELETE = handle(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const { slug, membershipId } = await params;
  const ctx = await resolveWorkspaceContext(request.headers, slug);
  await removeMember(ctx, membershipId, clientIp(request.headers));
  return json({ ok: true });
});
