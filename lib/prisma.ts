import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
// eslint-disable-next-line no-restricted-imports -- único lugar autorizado a crear el cliente
import { PrismaClient } from "@prisma/client";

declare global {
  var __movaPrisma: PrismaClient | undefined;
}

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL no está configurada");
  // Pool chico y timeouts explícitos: en serverless cada instancia tiene su
  // propio pool, y un host inalcanzable debe fallar rápido.
  const adapter = new PrismaPg(
    { connectionString, max: 5, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 10_000 },
    { onPoolError: (error) => console.error("[prisma] error en el pool:", error.message) },
  );
  return new PrismaClient({ adapter });
}

// Singleton perezoso: no se conecta hasta la primera consulta, así `next build`
// no necesita una base disponible.
export function getPrisma(): PrismaClient {
  if (!globalThis.__movaPrisma) globalThis.__movaPrisma = createClient();
  return globalThis.__movaPrisma;
}

export type Db = PrismaClient;
