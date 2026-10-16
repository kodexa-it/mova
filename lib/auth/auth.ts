import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

import { allowedOrigins, getEnv } from "@/lib/env";
import { passwordResetEmail, verificationEmail } from "@/lib/email/templates";
import { sendEmailSafely } from "@/lib/email/transport";
import { getPrisma } from "@/lib/prisma";

export const VERIFICATION_TTL_SECONDS = 60 * 60 * 24;
export const RESET_TTL_SECONDS = 60 * 60;
export const MIN_PASSWORD_LENGTH = 10;

function createAuth() {
  const env = getEnv();
  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.APP_URL,
    trustedOrigins: allowedOrigins(env),
    database: prismaAdapter(getPrisma(), { provider: "postgresql" }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      maxPasswordLength: 128,
      // Se puede iniciar sesión sin verificar, pero sin email verificado no se
      // crea un workspace ni se aceptan invitaciones (ADR 0002).
      requireEmailVerification: false,
      resetPasswordTokenExpiresIn: RESET_TTL_SECONDS,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendEmailSafely("recuperación de contraseña", passwordResetEmail({ to: user.email, name: user.name, url }));
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      expiresIn: VERIFICATION_TTL_SECONDS,
      sendVerificationEmail: async ({ user, url }) => {
        await sendEmailSafely("verificación de email", verificationEmail({ to: user.email, name: user.name, url }));
      },
    },
    // Límite de intentos persistido en la base: vale aunque haya varias instancias.
    rateLimit: {
      enabled: env.NODE_ENV !== "test" || process.env.MOVA_TEST_RATE_LIMIT === "1",
      storage: "database",
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60, max: 5 },
        "/request-password-reset": { window: 60, max: 3 },
        "/send-verification-email": { window: 60, max: 3 },
      },
    },
    advanced: {
      database: { generateId: false },
      useSecureCookies: env.NODE_ENV === "production",
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;

let instance: Auth | null = null;

// Perezoso: `next build` no necesita variables de entorno ni base.
export function getAuth(): Auth {
  if (!instance) instance = createAuth();
  return instance;
}

// Solo para tests.
export function resetAuthInstance(): void {
  instance = null;
}
