import "dotenv/config";

import { afterAll, beforeEach } from "vitest";

// Cada archivo de test corre contra la base de test, con email en memoria y
// un secreto propio. Se fija antes de que se cargue cualquier módulo de la app.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.APP_URL = "http://localhost:3000";
process.env.BETTER_AUTH_SECRET = "test-secret-solo-para-tests-0123456789abcdef";
process.env.EMAIL_TRANSPORT = "memory";
(process.env as Record<string, string>).NODE_ENV = "test";

const { getPrisma } = await import("@/lib/prisma");
const { clearMemoryOutbox } = await import("@/lib/email/transport");

beforeEach(async () => {
  await getPrisma().$executeRawUnsafe(
    'TRUNCATE TABLE "AuditLog", "Invitation", "Membership", "Workspace", "session", "account", "verification", "rateLimit", "user" CASCADE',
  );
  clearMemoryOutbox();
});

afterAll(async () => {
  await getPrisma().$disconnect();
});
