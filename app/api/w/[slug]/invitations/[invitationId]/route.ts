import { assertSameOrigin, clientIp, handle, json } from "@/lib/http";
import { resolveWorkspaceContext } from "@/modules/access/context";
import { revokeInvitation } from "@/modules/invitations/service";

type Params = { params: Promise<{ slug: string; invitationId: string }> };

export const DELETE = handle(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const { slug, invitationId } = await params;
  const ctx = await resolveWorkspaceContext(request.headers, slug);
  await revokeInvitation(ctx, invitationId, clientIp(request.headers));
  return json({ ok: true });
});
