// Verifica que el código que descarga el navegador (.next/static) no contenga
// secretos ni restos de código de servidor. Correr después de `npm run build`.
import "dotenv/config";

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), ".next", "static");

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

const secretValues = ["BETTER_AUTH_SECRET", "APIFY_TOKEN", "ANTHROPIC_API_KEY", "DATABASE_URL", "TEST_DATABASE_URL"]
  .map((key) => [key, process.env[key]])
  .filter(([, value]) => typeof value === "string" && value.length >= 8);

// No se buscan nombres de variables: librerías como Better Auth mencionan
// "BETTER_AUTH_SECRET" en su código de cliente para leerla solo en el
// servidor. Lo que importa es que no aparezca ningún valor.
const forbiddenPatterns = [
  ["cadena de conexión PostgreSQL", /postgres(ql)?:\/\//],
  ["cliente de Prisma", /PrismaClient|@prisma\/adapter-pg/],
  ["clave de Anthropic", /sk-ant-[A-Za-z0-9_-]{8,}/],
];

const problems = [];
for (const file of files(root).filter((f) => /\.(js|css|html|json|map)$/.test(f))) {
  const content = readFileSync(file, "utf8");
  for (const [key, value] of secretValues) if (content.includes(value)) problems.push(`${file}: contiene el valor de ${key}`);
  for (const [label, pattern] of forbiddenPatterns) if (pattern.test(content)) problems.push(`${file}: contiene ${label}`);
}

if (problems.length > 0) {
  console.error("El bundle del navegador contiene información que no debería:\n" + problems.join("\n"));
  process.exit(1);
}
console.info(`Bundle del navegador revisado: sin secretos ni código de servidor (${secretValues.length} valores comparados).`);
