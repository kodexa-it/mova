import { assertSameOrigin, clientIp, handle, json, parseBody } from "@/lib/http";
import { resolveWorkspaceContext } from "@/modules/access/context";
import { createInvitationSchema } from "@/modules/access/schemas";
import { createInvitation, listPendingInvitations } from "@/modules/invitations/service";

type Params = { params: Promise<{ slug: string }> };

export const GET = handle(async (request: Request, { params }: Params) => {
  const ctx = await resolveWorkspaceContext(request.headers, (await params).slug);
  return json({ invitations: await listPendingInvitations(ctx) });
});

export const POST = handle(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const ctx = await resolveWorkspaceContext(request.headers, (await params).slug);
  const input = await parseBody(request, createInvitationSchema);
  return json({ invitation: await createInvitation(ctx, input, clientIp(request.headers)) }, 201);
});
