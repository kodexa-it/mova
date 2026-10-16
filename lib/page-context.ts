import "server-only";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { HttpError } from "@/lib/http";
import { resolveWorkspaceContext, type WorkspaceContext } from "@/modules/access/context";
import { can, type Permission } from "@/modules/access/permissions";

// Versiones para páginas (Server Components) de los resolvedores de la API:
// mismas reglas, pero un error se traduce en redirección o 404.
export async function requirePageUser(next?: string): Promise<SessionUser> {
  const user = await getSessionUser(await headers());
  if (!user) redirect(next ? `/ingresar?next=${encodeURIComponent(next)}` : "/ingresar");
  return user;
}

export async function requirePageWorkspace(slug: string, permission: Permission = "workspace.read"): Promise<WorkspaceContext> {
  try {
    const ctx = await resolveWorkspaceContext(await headers(), slug);
    if (!can(ctx.role, permission)) notFound();
    return ctx;
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) redirect(`/ingresar?next=${encodeURIComponent(`/w/${slug}`)}`);
    if (error instanceof HttpError) notFound();
    throw error;
  }
}

// Solo rutas internas como destino después del login (evita redirecciones abiertas).
export function safeNext(next: string | undefined | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/w";
  return next;
}
