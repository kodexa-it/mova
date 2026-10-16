// Diagnóstico del entorno local: `npm run doctor`.
// Revisa .env, la base de datos, las migraciones, los usuarios de prueba y
// Mailpit. Nunca imprime valores de secretos.
import "dotenv/config";

import { existsSync, readdirSync, readFileSync } from "node:fs";
import net from "node:net";

import pg from "pg";

let failures = 0;
const ok = (msg) => console.log(`OK    ${msg}`);
const bad = (msg, fix) => {
  failures += 1;
  console.log(`FALLA ${msg}`);
  if (fix) console.log(`      → ${fix}`);
};
const info = (msg) => console.log(`INFO  ${msg}`);

const major = Number(process.versions.node.split(".")[0]);
if (major >= 22) ok(`Node ${process.versions.node}`);
else bad(`Node ${process.versions.node}`, "Instalá Node 22 (ver .nvmrc).");

for (const name of ["DATABASE_URL", "APP_URL", "BETTER_AUTH_SECRET"]) {
  if (!process.env[name]) bad(`${name} no está definida`, "Copiá .env.example a .env y completala.");
}
const secret = process.env.BETTER_AUTH_SECRET ?? "";
if (secret && secret.length < 32) bad("BETTER_AUTH_SECRET tiene menos de 32 caracteres", "Generá uno nuevo (comando en .env.example).");
else if (secret) ok("BETTER_AUTH_SECRET definida (valor oculto)");

if (process.env.APP_URL) {
  info(`APP_URL = ${process.env.APP_URL}. Abrí la app exactamente desde esa dirección.`);
}

function portOpen(host, port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port, timeout: 1500 });
    socket.once("connect", () => (socket.destroy(), resolve(true)));
    socket.once("timeout", () => (socket.destroy(), resolve(false)));
    socket.once("error", () => resolve(false));
  });
}

if (process.env.DATABASE_URL) {
  const url = new URL(process.env.DATABASE_URL);
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000 });
  try {
    await client.connect();
    ok(`PostgreSQL responde en ${url.hostname}:${url.port || 5432}, base "${url.pathname.slice(1)}"`);
    const migrations = await client
      .query(`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`)
      .catch(() => null);
    if (!migrations || migrations.rowCount === 0) {
      bad("La base no tiene las migraciones aplicadas", "Corré npm run db:migrate.");
    } else {
      const applied = new Set(migrations.rows.map((m) => m.migration_name));
      const pending = readdirSync("prisma/migrations", { withFileTypes: true })
        .filter((d) => d.isDirectory() && !applied.has(d.name))
        .map((d) => d.name);
      if (pending.length) bad(`Faltan aplicar ${pending.length} migración(es): ${pending.join(", ")}`, "Pará npm run dev y corré npm run db:migrate.");
      else ok(`${migrations.rowCount} migración(es) aplicada(s), ninguna pendiente`);
      const users = await client
        .query(`SELECT email, "emailVerified" FROM "user" WHERE email LIKE '%@mova.local' ORDER BY email`)
        .catch(() => null);
      if (!users || users.rowCount === 0) bad("No están los usuarios de prueba", "Corré npm run db:seed.");
      else ok(`Usuarios de prueba: ${users.rows.map((u) => `${u.email}${u.emailVerified ? "" : " (sin verificar)"}`).join(", ")}`);
      const ws = await client.query(`SELECT slug FROM "Workspace" WHERE "deletedAt" IS NULL ORDER BY slug`).catch(() => null);
      if (ws) info(`Workspaces: ${ws.rows.map((w) => w.slug).join(", ") || "ninguno"}`);
    }
  } catch (error) {
    const code = error?.code ?? "";
    if (code === "ECONNREFUSED" || code === "ETIMEDOUT" || /timeout/i.test(String(error?.message))) {
      bad(`PostgreSQL no responde en ${url.hostname}:${url.port}`, "¿Docker Desktop está abierto? Corré npm run db:up y esperá unos segundos.");
    } else if (code === "28P01") {
      bad("PostgreSQL rechazó usuario o contraseña", "Revisá DATABASE_URL. Si otro Postgres usa el puerto 5433, apagalo o cambiá el puerto.");
    } else if (code === "3D000") {
      bad(`No existe la base "${url.pathname.slice(1)}"`, "Corré npm run db:down y npm run db:up para recrear el contenedor.");
    } else {
      bad(`No se pudo conectar a PostgreSQL (${code || "error"})`, String(error?.message ?? error));
    }
  } finally {
    await client.end().catch(() => {});
  }
}

// El cliente de Prisma se genera a partir del esquema. Si el esquema tiene
// modelos que el cliente no conoce, la app falla con "Cannot read properties of
// undefined" al usarlos.
{
  const generated = "node_modules/.prisma/client/schema.prisma";
  const models = (file) => new Set([...readFileSync(file, "utf8").matchAll(/^model (\w+)/gm)].map((m) => m[1]));
  if (!existsSync(generated)) bad("El cliente de Prisma no está generado", "Corré npm install (o npx prisma generate).");
  else {
    const missing = [...models("prisma/schema.prisma")].filter((m) => !models(generated).has(m));
    if (missing.length) bad(`El cliente de Prisma está desactualizado (no conoce ${missing.join(", ")})`, "Pará npm run dev y corré npx prisma generate.");
    else ok("Cliente de Prisma al día con el esquema");
  }
}

if (process.env.EMAIL_TRANSPORT === "smtp") {
  const host = process.env.SMTP_HOST ?? "localhost";
  const port = Number(process.env.SMTP_PORT ?? 1025);
  if (await portOpen(host, port)) ok(`Mailpit (SMTP) responde en ${host}:${port}; los emails se ven en http://localhost:8025`);
  else bad(`Mailpit no responde en ${host}:${port}`, "Corré npm run db:up. Los emails no van a llegar, pero el login funciona igual.");
} else {
  info(`EMAIL_TRANSPORT=${process.env.EMAIL_TRANSPORT ?? "console"}: los emails se imprimen en la terminal.`);
}

console.log(failures === 0 ? "\nTodo listo." : `\n${failures} problema(s) para resolver.`);
process.exit(failures === 0 ? 0 : 1);
