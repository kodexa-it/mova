import { afterEach, describe, expect, it } from "vitest";

import { getAuth, resetAuthInstance } from "@/lib/auth/auth";
import { getMemoryOutbox } from "@/lib/email/transport";
import { getPrisma } from "@/lib/prisma";
import * as workspaces from "@/app/api/workspaces/route";
import { call, createUser, login, ORIGIN, PASSWORD } from "@/tests/helpers";

const originHeaders = () => new Headers({ origin: ORIGIN });

describe("autenticación", () => {
  afterEach(() => {
    delete process.env.MOVA_TEST_RATE_LIMIT;
    resetAuthInstance();
  });

  it("el registro envía un email de verificación con enlace válido", async () => {
    await getAuth().api.signUpEmail({ body: { name: "Ana", email: "ana@ejemplo.com", password: PASSWORD } });
    const mail = getMemoryOutbox().find((m) => m.to === "ana@ejemplo.com");
    expect(mail?.subject).toContain("Confirmá tu email");
    const url = new URL(mail!.text.match(/http\S+/)![0]);
    const token = url.searchParams.get("token")!;
    await getAuth().api.verifyEmail({ query: { token } });
    const user = await getPrisma().user.findUniqueOrThrow({ where: { email: "ana@ejemplo.com" } });
    expect(user.emailVerified).toBe(true);
  });

  it("rechaza contraseñas cortas", async () => {
    await expect(
      getAuth().api.signUpEmail({ body: { name: "Beto", email: "beto@ejemplo.com", password: "corta" } }),
    ).rejects.toThrow();
  });

  it("la recuperación responde igual exista o no el email, y solo envía al existente", async () => {
    const user = await createUser({ email: "existe@ejemplo.com" });
    const existing = await getAuth().api.requestPasswordReset({
      body: { email: user.email, redirectTo: "/restablecer" },
      headers: originHeaders(),
      asResponse: true,
    });
    const missing = await getAuth().api.requestPasswordReset({
      body: { email: "no-existe@ejemplo.com", redirectTo: "/restablecer" },
      headers: originHeaders(),
      asResponse: true,
    });
    expect(existing.status).toBe(missing.status);
    expect(await existing.json()).toEqual(await missing.json());
    expect(getMemoryOutbox().some((m) => m.to === "no-existe@ejemplo.com")).toBe(false);
    expect(getMemoryOutbox().some((m) => m.to === "existe@ejemplo.com" && m.subject.includes("contraseña"))).toBe(true);
  });

  it("cambiar la contraseña invalida las sesiones abiertas", async () => {
    const user = await createUser({ email: "reset@ejemplo.com" });
    await getAuth().api.requestPasswordReset({ body: { email: user.email, redirectTo: "/restablecer" }, headers: originHeaders() });
    const mail = getMemoryOutbox().find((m) => m.to === user.email && m.subject.includes("contraseña"))!;
    const token = new URL(mail.text.match(/http\S+/)![0]).pathname.split("/").at(-1)!;
    await getAuth().api.resetPassword({ body: { token, newPassword: "otra-contraseña-segura-456" } });

    const res = await call(workspaces.GET, { cookie: user.cookie });
    expect(res.status).toBe(401);
    await expect(login(user.email)).rejects.toThrow();
    expect(await login(user.email, "otra-contraseña-segura-456")).toContain("better-auth");
  });

  it("limita los intentos de login y lo persiste en la base", async () => {
    process.env.MOVA_TEST_RATE_LIMIT = "1";
    resetAuthInstance();
    await createUser({ email: "limite@ejemplo.com" });
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) {
      const response = await getAuth().handler(
        new Request(`${ORIGIN}/api/auth/sign-in/email`, {
          method: "POST",
          headers: { "content-type": "application/json", origin: ORIGIN, "x-forwarded-for": "203.0.113.7" },
          body: JSON.stringify({ email: "limite@ejemplo.com", password: "incorrecta-000000" }),
        }),
      );
      statuses.push(response.status);
    }
    expect(statuses).toContain(429);
    expect(await getPrisma().rateLimit.count()).toBeGreaterThan(0);
  });
});
