import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// Chequeo barato de "hay cookie de sesión" para redirigir antes de renderizar.
// No es la protección: cada página y cada endpoint valida la sesión real y la
// membresía en el servidor.
export function middleware(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const next = request.nextUrl.pathname + request.nextUrl.search;
    const url = new URL("/ingresar", request.url);
    url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/w/:path*", "/invitacion/:path*"],
};
