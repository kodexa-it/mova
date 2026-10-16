import type { Metadata } from "next";
import Link from "next/link";

import { AppHeader } from "@/components/app/app-header";
import { RoleBadge } from "@/components/app/role-badge";
import { Card, CardHeader, EmptyState, Notice } from "@/components/ui";
import { requirePageUser } from "@/lib/page-context";
import { listWorkspacesForUser } from "@/modules/workspaces/service";

import { CreateWorkspaceForm } from "./create-workspace-form";

export const metadata: Metadata = { title: "Tus workspaces" };
export const dynamic = "force-dynamic";

export default async function WorkspacesPage() {
  const user = await requirePageUser("/w");
  const workspaces = await listWorkspacesForUser(user.id);

  return (
    <div className="min-h-dvh">
      <AppHeader user={{ name: user.name, email: user.email }} />
      <main className="mx-auto flex max-w-2xl flex-col gap-10 px-6 py-14">
        <section>
          <h1 className="text-display font-semibold text-ink">Tus workspaces</h1>
          <p className="mt-2 text-body text-ink-2">Cada workspace es una empresa, con su propio equipo y contenido.</p>
          <div className="mt-8">
            {workspaces.length === 0 ? (
              <EmptyState
                title="Todavía no pertenecés a ningún workspace"
                description="Creá el de tu empresa para empezar, o pedile a alguien de tu equipo que te invite."
              />
            ) : (
              <Card as="div" className="overflow-hidden">
                <ul className="divide-y divide-line">
                  {workspaces.map((ws) => (
                    <li key={ws.id}>
                      <Link
                        href={`/w/${ws.slug}`}
                        className="group flex items-center justify-between gap-4 px-5 py-4 transition-colors duration-[var(--dur-fast)] hover:bg-pearl/60 focus-visible:bg-pearl/60"
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <span
                            aria-hidden
                            className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-control)] bg-pearl text-small font-semibold uppercase text-ink-2"
                          >
                            {ws.name.slice(0, 1)}
                          </span>
                          <span className="truncate font-medium text-ink">{ws.name}</span>
                        </span>
                        <span className="flex items-center gap-3">
                          <RoleBadge role={ws.role} />
                          <svg
                            aria-hidden
                            viewBox="0 0 16 16"
                            className="size-4 text-ink-3 transition-transform duration-[var(--dur-fast)] group-hover:translate-x-0.5 group-hover:text-ink-2"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="m6 3.5 4.5 4.5L6 12.5" />
                          </svg>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </section>
        <Card className="p-6">
          <CardHeader title="Crear un workspace" description="Vas a ser su Dueño y podrás invitar a tu equipo." />
          {user.emailVerified ? (
            <CreateWorkspaceForm />
          ) : (
            <Notice tone="warning">
              Confirmá tu email para crear un workspace.{" "}
              <Link href={`/verificar?email=${encodeURIComponent(user.email)}`} className="font-medium underline underline-offset-4">
                Reenviar el enlace
              </Link>
            </Notice>
          )}
        </Card>
      </main>
    </div>
  );
}
