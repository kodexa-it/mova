import "dotenv/config";

import { execSync } from "node:child_process";

// Antes de toda la corrida: deja la base de test con el esquema actual,
// aplicando las migraciones desde cero. Nunca toca DATABASE_URL.
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("Falta TEST_DATABASE_URL para los tests de integración");
  if (url === process.env.DATABASE_URL) throw new Error("TEST_DATABASE_URL no puede ser igual a DATABASE_URL");
  execSync("npx prisma migrate reset --force", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });
}
