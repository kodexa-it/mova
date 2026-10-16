import "dotenv/config";

import { getAuth } from "@/lib/auth/auth";
import { getPrisma } from "@/lib/prisma";

// Datos de desarrollo. Nunca correr contra una base con datos reales.
// Todos los usuarios usan la contraseña SEED_PASSWORD y tienen el email verificado.
const SEED_PASSWORD = "mova-local-1234";

const PEOPLE = [
  { name: "Ana Dueña", email: "ana@mova.local" },
  { name: "Eva Editora", email: "eva@mova.local" },
  { name: "Ale Aprobador", email: "ale@mova.local" },
  { name: "Leo Lector", email: "leo@mova.local" },
] as const;

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) throw new Error("La semilla solo corre contra una base local.");
  process.env.EMAIL_TRANSPORT = "console";
  const prisma = getPrisma();
  const auth = getAuth();

  const ids: Record<string, string> = {};
  for (const person of PEOPLE) {
    const existing = await prisma.user.findUnique({ where: { email: person.email } });
    if (!existing) await auth.api.signUpEmail({ body: { ...person, password: SEED_PASSWORD } });
    const user = await prisma.user.update({ where: { email: person.email }, data: { emailVerified: true } });
    ids[person.email] = user.id;
  }

  const workspaces = [
    { name: "Kodexa", slug: "kodexa", roles: { "ana@mova.local": "OWNER", "eva@mova.local": "EDITOR", "ale@mova.local": "APPROVER", "leo@mova.local": "VIEWER" } },
    { name: "Empresa demo", slug: "empresa-demo", roles: { "eva@mova.local": "OWNER", "ana@mova.local": "VIEWER" } },
  ] as const;

  for (const ws of workspaces) {
    const workspace = await prisma.workspace.upsert({ where: { slug: ws.slug }, update: {}, create: { name: ws.name, slug: ws.slug } });
    for (const [email, role] of Object.entries(ws.roles)) {
      await prisma.membership.upsert({
        where: { workspaceId_userId: { workspaceId: workspace.id, userId: ids[email]! } },
        update: { role },
        create: { workspaceId: workspace.id, userId: ids[email]!, role },
      });
    }
  }

  console.info(`Semilla lista. Usuarios: ${PEOPLE.map((p) => p.email).join(", ")} · contraseña: ${SEED_PASSWORD}`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
