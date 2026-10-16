import "server-only";

import { getAuth } from "@/lib/auth/auth";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
}

// Resuelve el usuario de la sesión desde los encabezados del request. Nunca
// confía en datos de usuario enviados en el cuerpo.
export async function getSessionUser(headers: Headers): Promise<SessionUser | null> {
  const result = await getAuth().api.getSession({ headers });
  if (!result) return null;
  const { id, name, email, emailVerified } = result.user;
  return { id, name, email, emailVerified };
}
