import { getAuth } from "@/lib/auth/auth";
import { getPrisma } from "@/lib/prisma";

export const ORIGIN = "http://localhost:3000";
export const PASSWORD = "contraseña-de-prueba-123";

export interface TestUser {
  id: string;
  email: string;
  cookie: string;
}

let counter = 0;

// Crea un usuario con Better Auth real, opcionalmente lo marca como
// verificado, y devuelve la cookie de sesión de un login real.
export async function createUser(options: { name?: string; email?: string; verified?: boolean } = {}): Promise<TestUser> {
  counter += 1;
  const email = options.email ?? `persona${counter}-${Date.now()}@ejemplo.com`;
  const auth = getAuth();
  await auth.api.signUpEmail({ body: { name: options.name ?? `Persona ${counter}`, email, password: PASSWORD } });
  const user = await getPrisma().user.update({
    where: { email },
    data: { emailVerified: options.verified ?? true },
  });
  return { id: user.id, email, cookie: await login(email) };
}

export async function login(email: string, password = PASSWORD): Promise<string> {
  const response = await getAuth().api.signInEmail({
    body: { email, password },
    asResponse: true,
    headers: new Headers({ origin: ORIGIN }),
  });
  if (!response.ok) throw new Error(`Login falló con ${response.status}`);
  const setCookie = response.headers.getSetCookie();
  return setCookie.map((c) => c.split(";")[0]).join("; ");
}

type Handler<P> = (request: Request, context: { params: Promise<P> }) => Promise<Response>;

// Llama a un route handler como lo haría Next.js.
export async function call<P extends Record<string, string>>(
  handler: Handler<P> | ((request: Request) => Promise<Response>),
  options: { method?: string; path?: string; cookie?: string; body?: unknown; params?: P; origin?: string | null } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const headers = new Headers({ "content-type": "application/json" });
  if (options.cookie) headers.set("cookie", options.cookie);
  if (options.origin !== null) headers.set("origin", options.origin ?? ORIGIN);
  const request = new Request(`${ORIGIN}${options.path ?? "/api/test"}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const response = await (handler as Handler<P>)(request, { params: Promise.resolve(options.params ?? ({} as P)) });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : {} };
}
