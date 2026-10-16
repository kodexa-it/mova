// Prueba técnica de Row Level Security con Prisma 7 + @prisma/adapter-pg.
// Resultados y decisión: docs/adr/0004-row-level-security.md
//
// Uso (base descartable, nunca la de desarrollo):
//   SPIKE_ADMIN_URL=postgresql://mova:...@localhost:5433/mova_rls_spike \
//   SPIKE_APP_URL=postgresql://mova_app:mova_app_local@localhost:5433/mova_rls_spike \
//   npx tsx scripts/spikes/rls-spike.mts
// La base tiene que tener las migraciones aplicadas (prisma migrate deploy).
import { PrismaPg } from "@prisma/adapter-pg";
// eslint-disable-next-line no-restricted-imports -- script aislado de prueba
import { PrismaClient } from "@prisma/client";

const adminUrl = process.env.SPIKE_ADMIN_URL;
const appUrl = process.env.SPIKE_APP_URL;
if (!adminUrl || !appUrl || !adminUrl.includes("rls_spike")) throw new Error("Usar solo con una base *_rls_spike");

const client = (url: string) => new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 5 }) });
const admin = client(adminUrl);
const results: Record<string, unknown> = {};

// 1. Rol de aplicación sin superusuario ni BYPASSRLS, y RLS forzado en AuditLog.
await admin.$executeRawUnsafe(`DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mova_app') THEN
    CREATE ROLE mova_app LOGIN PASSWORD 'mova_app_local' NOSUPERUSER NOBYPASSRLS;
  END IF; END $$;`);
await admin.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO mova_app`);
await admin.$executeRawUnsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO mova_app`);
await admin.$executeRawUnsafe(`ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY`);
await admin.$executeRawUnsafe(`ALTER TABLE "AuditLog" FORCE ROW LEVEL SECURITY`);
await admin.$executeRawUnsafe(`DROP POLICY IF EXISTS workspace_isolation ON "AuditLog"`);
await admin.$executeRawUnsafe(`CREATE POLICY workspace_isolation ON "AuditLog"
  USING ("workspaceId" = current_setting('app.workspace_id', true))
  WITH CHECK ("workspaceId" = current_setting('app.workspace_id', true))`);

// 2. Datos: dos workspaces con 3 registros cada uno (cargados con RLS desactivado para el admin).
await admin.$executeRawUnsafe(`TRUNCATE "AuditLog", "Workspace" CASCADE`);
const a = await admin.workspace.create({ data: { name: "A", slug: "spike-a" } });
const b = await admin.workspace.create({ data: { name: "B", slug: "spike-b" } });
await admin.$executeRawUnsafe(`ALTER TABLE "AuditLog" NO FORCE ROW LEVEL SECURITY`);
for (const ws of [a, b]) for (let i = 0; i < 3; i++) await admin.auditLog.create({ data: { workspaceId: ws.id, action: "spike" } });
await admin.$executeRawUnsafe(`ALTER TABLE "AuditLog" FORCE ROW LEVEL SECURITY`);

const app = client(appUrl);
const setWorkspace = (id: string) => app.$executeRaw`SELECT set_config('app.workspace_id', ${id}, true)`;

// a. Sin contexto: no ve nada.
results.sinContexto = await app.auditLog.count();

// b. Transacción interactiva con set_config local: ve solo su workspace.
results.transaccionInteractiva = await app.$transaction(async (tx) => {
  await tx.$executeRaw`SELECT set_config('app.workspace_id', ${a.id}, true)`;
  const rows = await tx.auditLog.findMany();
  return { filas: rows.length, soloA: rows.every((r) => r.workspaceId === a.id) };
});

// c. Transacción en lote (patrón de extensión de cliente de la documentación de Prisma).
const [, batchRows] = await app.$transaction([setWorkspace(b.id), app.auditLog.findMany()]);
results.transaccionEnLote = { filas: batchRows.length, soloB: batchRows.every((r) => r.workspaceId === b.id) };

// d. Escribir en otro workspace con contexto A: lo bloquea WITH CHECK.
results.escrituraCruzada = await app
  .$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.workspace_id', ${a.id}, true)`;
    await tx.auditLog.create({ data: { workspaceId: b.id, action: "intruso" } });
    return "permitida (MAL)";
  })
  .catch((error: Error) => `bloqueada: ${error.message.split("\n").at(-1)?.slice(0, 120)}`);

// e. El contexto local no queda pegado a la conexión del pool.
await Promise.all(Array.from({ length: 10 }, () => app.$transaction([setWorkspace(a.id), app.auditLog.count()])));
results.contextoNoSeFiltraAlPool = (await Promise.all(Array.from({ length: 10 }, () => app.auditLog.count()))).every((n) => n === 0);

// f. Costo: 300 lecturas simples con y sin el envoltorio de transacción.
async function time(fn: () => Promise<unknown>, n = 300) {
  const start = performance.now();
  for (let i = 0; i < n; i++) await fn();
  return Number(((performance.now() - start) / n).toFixed(3));
}
results.msPorConsulta = {
  sinRls_admin: await time(() => admin.auditLog.findMany({ where: { workspaceId: a.id } })),
  conRls_enLote: await time(() => app.$transaction([setWorkspace(a.id), app.auditLog.findMany()])),
};

// g. Las consultas previas al contexto (resolver membresía por usuario) no
// tienen workspace todavía: con RLS en Membership necesitarían otra política.
results.nota = "Membership y Workspace se consultan antes de conocer el workspace (resolveWorkspaceContext, listWorkspacesForUser).";

console.info(JSON.stringify(results, null, 2));
await app.$disconnect();
await admin.$disconnect();
