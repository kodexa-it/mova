import type { Metadata } from "next";
import Link from "next/link";

import { FormatIcon } from "@/components/content/format-icon";
import { NewContentButton } from "@/components/content/new-content";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { requirePageWorkspace } from "@/lib/page-context";
import { dayLabel, zonedHm, zonedYmd } from "@/lib/time";
import { can } from "@/modules/access/permissions";
import { getBrand } from "@/modules/brand/service";
import { FORMAT_LABELS } from "@/modules/content/formats";
import { listContent } from "@/modules/content/service";
import { STATUS_LABELS, STATUS_TONES } from "@/modules/content/status";
import { getCalendarZone } from "@/modules/plans/service";

export const metadata: Metadata = { title: "Contenido" };

const VERDICT_TEXT: Record<string, string> = { ready: "Sin observaciones", review: "Con sugerencias", fix: "Para corregir" };
const VERDICT_DOT: Record<string, string> = { ready: "bg-success", review: "bg-warning", fix: "bg-danger" };

const updated = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Argentina/Buenos_Aires" });

export default async function ContentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requirePageWorkspace(slug);
  const [items, brand, timezone] = await Promise.all([listContent(ctx), getBrand(ctx), getCalendarZone(ctx)]);
  const canWrite = can(ctx.role, "content.write");

  return (
    <>
      <PageHeader
        title="Contenido"
        description="Las piezas de la marca con su versión vigente y la revisión automática."
        actions={canWrite ? <NewContentButton slug={slug} pillars={brand?.pillars.map((p) => p.name) ?? []} goals={brand?.goals.map((g) => g.title) ?? []} /> : null}
      />
      {items.length === 0 ? (
        <EmptyState
          title="Todavía no hay piezas"
          description={canWrite ? "Creá la primera: elegí el formato y escribila, o pedile una propuesta a Mova cuando esté activado el asistente." : "Cuando el equipo cree piezas, van a aparecer acá."}
        />
      ) : (
        <Card as="div" className="overflow-hidden">
          <ul className="divide-y divide-line">
            {items.map((item) => (
              <li key={item.id}>
                <Link href={`/w/${slug}/contenido/${item.id}`} className="group flex items-center gap-4 px-5 py-4 transition-colors duration-[var(--dur-fast)] hover:bg-pearl/50">
                  <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-[11px] bg-pearl text-ink-2">
                    <FormatIcon format={item.format} className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{item.title}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-small text-ink-2">
                      <span>{FORMAT_LABELS[item.format]}</span>
                      {item.scheduledFor ? (
                        <span className="tabular">
                          {dayLabel(zonedYmd(item.scheduledFor, timezone))} · {zonedHm(item.scheduledFor, timezone)}
                        </span>
                      ) : null}
                      {item.pillar ? <span>{item.pillar}</span> : null}
                      {item.currentVersion ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span aria-hidden className={`size-1.5 rounded-full ${VERDICT_DOT[item.currentVersion.verdict] ?? "bg-ink-3"}`} />
                          {VERDICT_TEXT[item.currentVersion.verdict] ?? item.currentVersion.verdict}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <div className="hidden flex-col items-end gap-1 sm:flex">
                    <Badge tone={STATUS_TONES[item.status]}>{STATUS_LABELS[item.status]}</Badge>
                    <span className="tabular text-caption text-ink-2">
                      v{item.currentVersion?.number ?? 1} · {updated.format(item.updatedAt)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
