import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Card, EmptyState, PageHeader } from "@/components/ui";
import { requirePageWorkspace } from "@/lib/page-context";
import { getPrisma } from "@/lib/prisma";
import { isYmd, weekLabel } from "@/lib/time";
import { listAudit } from "@/modules/audit/service";

export const metadata: Metadata = { title: "Auditoría" };

type Kind = "workspace" | "people" | "invitation" | "danger" | "brand";

const ACTIONS: Record<string, { text: string; kind: Kind }> = {
  "workspace.created": { text: "creó el workspace", kind: "workspace" },
  "workspace.updated": { text: "cambió el nombre del workspace", kind: "workspace" },
  "workspace.deleted": { text: "eliminó el workspace", kind: "danger" },
  "member.role_changed": { text: "cambió el rol de un integrante", kind: "people" },
  "member.removed": { text: "quitó a un integrante", kind: "danger" },
  "member.left": { text: "salió del workspace", kind: "people" },
  "invitation.created": { text: "envió una invitación", kind: "invitation" },
  "invitation.revoked": { text: "anuló una invitación", kind: "danger" },
  "invitation.accepted": { text: "aceptó una invitación", kind: "invitation" },
  "brand.updated": { text: "actualizó la marca", kind: "brand" },
  "content.created": { text: "creó una pieza", kind: "brand" },
  "content.archived": { text: "archivó una pieza", kind: "danger" },
  "content.restored": { text: "restauró una pieza", kind: "brand" },
  "content.scheduled": { text: "cambió la fecha de una pieza", kind: "brand" },
  "plan.updated": { text: "actualizó el foco de una semana", kind: "brand" },
  "content.submitted": { text: "envió a revisión una pieza", kind: "brand" },
  "content.approved": { text: "aprobó una pieza", kind: "invitation" },
  "content.changes_requested": { text: "pidió cambios en una pieza", kind: "people" },
  "approval.invalidated": { text: "cambió la apariencia de la marca y piezas aprobadas volvieron a revisión", kind: "danger" },
  "content.published": { text: "registró la publicación de una pieza", kind: "invitation" },
  "plan.strategy_proposed": { text: "pidió a Mova la estrategia de una semana", kind: "brand" },
  "plan.strategy_approved": { text: "aprobó la estrategia de una semana", kind: "invitation" },
  "content.art_generated": { text: "generó una imagen con IA para una pieza", kind: "brand" },
  "usage.image_budget_updated": { text: "cambió el límite mensual de imágenes con IA", kind: "workspace" },
};

const KIND_STYLE: Record<Kind, { tone: string; icon: ReactNode }> = {
  workspace: { tone: "bg-accent-soft text-accent", icon: <path d="M3.5 6.5 8 3l4.5 3.5V12a.5.5 0 0 1-.5.5H4a.5.5 0 0 1-.5-.5V6.5Z" /> },
  people: {
    tone: "bg-pearl text-ink-2",
    icon: (
      <>
        <circle cx="8" cy="5.75" r="2.25" />
        <path d="M3.75 12.75c.45-2.1 2.1-3.25 4.25-3.25s3.8 1.15 4.25 3.25" />
      </>
    ),
  },
  invitation: { tone: "bg-success-soft text-success", icon: <path d="M2.75 4.25h10.5v7.5H2.75zM3 4.5l5 4 5-4" /> },
  danger: { tone: "bg-danger-soft text-danger", icon: <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" /> },
  brand: { tone: "bg-accent-soft text-accent", icon: <path d="M8 2.75a5.25 5.25 0 1 0 0 10.5c.7 0 1-.45 1-1 0-.6-.5-.85-.5-1.4 0-.6.45-1 1.1-1h1.4a2.25 2.25 0 0 0 2.25-2.25C13.25 4.9 10.9 2.75 8 2.75Z" /> },
};

function detail(metadata: unknown): string {
  if (metadata && typeof metadata === "object" && "title" in metadata && typeof metadata.title === "string") return ` (${metadata.title})`;
  if (metadata && typeof metadata === "object" && "week" in metadata && typeof metadata.week === "string" && isYmd(metadata.week)) return ` (${weekLabel(metadata.week)})`;
  return "";
}

const dayFormat = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Argentina/Buenos_Aires" });
const timeFormat = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Argentina/Buenos_Aires" });

export default async function AuditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requirePageWorkspace(slug, "audit.read");
  const entries = await listAudit(ctx);
  const actorIds = [...new Set(entries.map((e) => e.actorUserId).filter((id): id is string => Boolean(id)))];
  const actors = await getPrisma().user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } });
  const actorName = new Map(actors.map((a) => [a.id, a.name]));

  // Agrupar por día (en la hora de Argentina, la del equipo).
  const days: { label: string; items: typeof entries }[] = [];
  for (const entry of entries) {
    const label = dayFormat.format(entry.createdAt);
    const last = days.at(-1);
    if (last && last.label === label) last.items.push(entry);
    else days.push({ label, items: [entry] });
  }

  return (
    <>
      <PageHeader title="Auditoría" description="Cambios de integrantes, roles, invitaciones y configuración, del más reciente al más antiguo." />
      {entries.length === 0 ? (
        <EmptyState title="Sin cambios registrados" description="Cuando alguien cambie integrantes, roles o la configuración, va a aparecer acá." />
      ) : (
        <div className="flex flex-col gap-8">
          {days.map((day) => (
            <section key={day.label} aria-label={day.label}>
              <h2 className="mb-3 text-small font-medium first-letter:uppercase text-ink-2">{day.label}</h2>
              <Card as="div" className="overflow-hidden">
                <ol className="divide-y divide-line">
                  {day.items.map((entry) => {
                    const action = ACTIONS[entry.action] ?? { text: entry.action, kind: "workspace" as const };
                    const style = KIND_STYLE[action.kind];
                    return (
                      <li key={entry.id} className="flex items-center gap-3.5 px-5 py-3.5 text-small">
                        <span aria-hidden className={`grid size-8 shrink-0 place-items-center rounded-full ${style.tone}`}>
                          <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                            {style.icon}
                          </svg>
                        </span>
                        <span className="min-w-0 flex-1 text-ink-2">
                          <span className="font-medium text-ink">{(entry.actorUserId && actorName.get(entry.actorUserId)) || "Alguien"}</span> {action.text}
                          {entry.action === "brand.updated" || entry.action.startsWith("content.") || entry.action.startsWith("plan.") ? detail(entry.metadata) : ""}
                        </span>
                        <time className="tabular shrink-0 text-ink-2" dateTime={entry.createdAt.toISOString()}>
                          {timeFormat.format(entry.createdAt)}
                        </time>
                      </li>
                    );
                  })}
                </ol>
              </Card>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
