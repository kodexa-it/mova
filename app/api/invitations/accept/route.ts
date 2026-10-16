import { assertSameOrigin, clientIp, handle, json, parseBody } from "@/lib/http";
import { requireUser } from "@/modules/access/context";
import { acceptInvitationSchema } from "@/modules/access/schemas";
import { acceptInvitation } from "@/modules/invitations/service";

export const POST = handle(async (request: Request) => {
  assertSameOrigin(request);
  const user = await requireUser(request.headers);
  const { token } = await parseBody(request, acceptInvitationSchema);
  return json({ workspace: await acceptInvitation(user, token, clientIp(request.headers)) });
});
