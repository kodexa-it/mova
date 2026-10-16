import type { Metadata } from "next";
import Link from "next/link";

import { ScheduleControl } from "@/components/calendar/schedule-control";
import { ReviewPanel, type ReviewPanelProps } from "@/components/review/review-panel";
import { ReviewThread, type ThreadEntry } from "@/components/review/review-thread";
import { ArchiveButton } from "@/components/content/archive-button";
import { ContentEditor } from "@/components/content/content-editor";
import { PreviewGallery, savedImageSrc } from "@/components/content/preview-gallery";
import { FormatIcon } from "@/components/content/format-icon";
import { Badge } from "@/components/ui";
import { requirePageWorkspace } from "@/lib/page-context";
import { dayLabel, zonedHm, zonedYmd } from "@/lib/time";
import { can } from "@/modules/access/permissions";
import { formatUsd } from "@/modules/ai/pricing";
import { getProvider } from "@/modules/ai/providers/registry";
import { brandProgress } from "@/modules/brand/completeness";
import { getBrand, paletteOf, shapeOf } from "@/modules/brand/service";
import { suggestStyle } from "@/modules/content/layouts";
import { publicationOfItem } from "@/modules/metrics/service";
import { listReferences } from "@/modules/brand/references";
import { buildBrief } from "@/modules/content/brief";
import { BriefButton } from "@/components/content/brief-button";
import { PublicationPanel } from "@/components/results/publication-panel";
import { MAX_GENERATIONS } from "@/modules/content/generate";
import { allText, emptyContent, FORMAT_LABELS, type AnyContent, type FormatContent } from "@/modules/content/formats";
import { framesOf, isBlankFrame } from "@/modules/content/render/frames";
import { getContent } from "@/modules/content/service";
import { STATUS_LABELS, STATUS_TONES, statusAfterEdit } from "@/modules/content/status";
import { getCalendarZone } from "@/modules/plans/service";
import { STALE_TEXT } from "@/modules/review/approval";
import { getReview, type Review } from "@/modules/review/service";

export const metadata: Metadata = { title: "Pieza" };

const when = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Argentina/Buenos_Aires" });

export default async function ContentItemPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const ctx = await requirePageWorkspace(slug);
  const [item, brand, timezone, review, publication, references] = await Promise.all([getContent(ctx, id), getBrand(ctx), getCalendarZone(ctx), getReview(ctx, id), publicationOfItem(ctx, id), listReferences(ctx)]);
  const canWrite = can(ctx.role, "content.write");
  const scheduledDate = item.scheduledFor ? zonedYmd(item.scheduledFor, timezone) : null;
  const scheduledTime = item.scheduledFor ? zonedHm(item.scheduledFor, timezone) : null;
  const paletteStamp = `${brand?.visual?.updatedAt.getTime() ?? 0}-${brand?.updatedAt.getTime() ?? 0}`;
  const locked = statusAfterEdit(item.status) === "locked";

  let initial = (item.currentVersion?.content as AnyContent | undefined) ?? emptyContent(item.format);
  if (item.format === "REEL") {
    const reel = initial as FormatContent<"REEL">;
    initial = { ...reel, hooks: [...reel.hooks, "", "", ""].slice(0, 3) };
  }

  const refFiles = references.map((r) => ({ id: r.id, label: r.label, file: `referencia-${r.id.slice(-6)}` }));
  const brief = buildBrief({
    brand: {
      name: brand?.name || ctx.workspace.name,
      industry: brand?.industry ?? "",
      website: brand?.website ?? null,
      audiences: brand?.audiences.map((a) => a.name) ?? [],
      palette: paletteOf(brand),
      headingFont: brand?.visual?.headingFont ?? "",
      bodyFont: brand?.visual?.bodyFont ?? "",
      imageStyle: brand?.visual?.imageStyle ?? "",
    },
    item: { title: item.title, format: item.format, pillar: item.pillar, goal: item.goal, angle: item.angle },
    content: initial,
    references: refFiles.map((r) => ({ file: r.file, label: r.label })),
  });

  const aiOn = getProvider() !== null;
  const brandReady = brandProgress(shapeOf(brand)).isComplete;
  const remaining = Math.max(0, MAX_GENERATIONS - item.regenerations);
  const generation = {
    enabled: aiOn && brandReady && remaining > 0,
    reason: !aiOn
      ? "La generación con IA se activa cuando el servidor tiene configurada una clave de IA."
      : !brandReady
        ? "Completá las secciones necesarias de la marca para que Mova pueda escribir esta pieza."
        : "Esta pieza llegó al tope de 5 propuestas de Mova. Podés seguir editándola a mano.",
    remaining,
    hasContent: allText(item.format, initial).trim().length > 0,
  };

  return (
    <>
      <nav aria-label="Ruta" className="mb-4 text-small text-ink-2">
        <Link href={`/w/${slug}/contenido`} className="underline-offset-4 hover:text-ink hover:underline">
          Contenido
        </Link>
        <span aria-hidden> / </span>
        <span className="text-ink">{item.title}</span>
      </nav>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-small text-ink-2">
            <span className="inline-flex items-center gap-1.5">
              <FormatIcon format={item.format} />
              {FORMAT_LABELS[item.format]}
            </span>
            {item.pillar ? <span>· {item.pillar}</span> : null}
            {item.goal ? <span>· {item.goal}</span> : null}
          </div>
          <h1 className="mt-1 text-display font-semibold text-ink">{item.title}</h1>
          <div className="mt-2">
            <ScheduleControl
              slug={slug}
              itemId={item.id}
              date={scheduledDate}
              time={scheduledTime}
              label={scheduledDate ? `${dayLabel(scheduledDate)} · ${scheduledTime}` : null}
              canEdit={can(ctx.role, "plan.write")}
              locked={["PUBLISHING", "PUBLISHED", "ARCHIVED"].includes(item.status)}
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          {item.status === "APPROVED" && review.approval.kind === "stale" ? <Badge tone="warning">Hay que volver a aprobar</Badge> : <Badge tone={STATUS_TONES[item.status]}>{STATUS_LABELS[item.status]}</Badge>}
          {allText(item.format, initial).trim() ? <BriefButton slug={slug} brief={brief} references={refFiles} /> : null}
          {canWrite && item.status !== "PUBLISHED" && item.status !== "PUBLISHING" ? <ArchiveButton slug={slug} itemId={item.id} archived={item.status === "ARCHIVED"} /> : null}
        </div>
      </header>

      <ContentEditor
        key={item.currentVersion?.id ?? "nueva"}
        slug={slug}
        itemId={item.id}
        format={item.format}
        initial={initial}
        wordsToAvoid={brand?.voice?.wordsToAvoid ?? []}
        readOnly={!canWrite || locked}
        generation={generation}
        proofs={(brand?.proofs ?? []).map((p) => ({ id: p.id, statement: p.statement, source: p.source }))}
        composeAi={aiOn}
        fixBlocked={!brandReady ? "Completá las secciones necesarias de la marca para que Mova pueda corregir." : undefined}
        visual={{ mode: item.visualMode, suggested: suggestStyle({ headingFont: brand?.visual?.headingFont, imageStyle: brand?.visual?.imageStyle }) }}
        media={{
          savedSrcs: item.currentVersion
            ? framesOf(item.format, item.currentVersion.content as AnyContent).map((frame, i) => (isBlankFrame(frame) ? null : savedImageSrc(slug, item.id, item.currentVersion!.id, paletteStamp, i)))
            : [],
          brandName: brand?.name || ctx.workspace.name,
          brandColor: paletteOf(brand)[0]?.hex ?? "#3d3ad8",
          downloads: item.currentVersion ? (
            <PreviewGallery slug={slug} itemId={item.id} versionId={item.currentVersion.id} format={item.format} content={item.currentVersion.content as AnyContent} paletteStamp={paletteStamp} />
          ) : null,
        }}
        comments={<ReviewThread slug={slug} itemId={item.id} entries={threadOf(review)} canComment={can(ctx.role, "content.comment")} bare />}
        commentsCount={review.comments.length}
        versions={
          <div>
            <p className="text-caption text-ink-2">Cada guardado crea una versión nueva; ninguna se borra.</p>
            <ol className="mt-4 flex flex-col gap-2.5">
              {item.versions.map((v) => (
                <li key={v.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-small">
                  <span className="text-ink">
                    <span className="tabular font-medium">v{v.number}</span>
                    <span className="text-ink-2">
                      {" "}
                      · {v.author === "AI" ? "propuesta de Mova" : "edición del equipo"}
                      {v.costMicros !== null ? ` · ${formatUsd(v.costMicros)}` : ""}
                    </span>
                    {v.id === item.currentVersion?.id ? <span className="ml-2 text-accent">vigente</span> : null}
                  </span>
                  <span className="tabular text-caption text-ink-2">{when.format(v.createdAt)}</span>
                </li>
              ))}
            </ol>
          </div>
        }
        review={
          <div className="flex flex-col gap-4">
          <ReviewPanel
            slug={slug}
            itemId={item.id}
            status={item.status}
            version={review.currentVersion}
            approval={approvalProps(review)}
            blockers={review.blockers}
            can={{ write: canWrite, approve: can(ctx.role, "content.approve"), requestChanges: can(ctx.role, "content.requestChanges") }}
          />
          <PublicationPanel
            slug={slug}
            itemId={item.id}
            publication={publication ? { publishedAt: publication.publishedAt.toISOString(), permalink: publication.permalink } : null}
            canRecord={can(ctx.role, "content.publishManual")}
            approved={(item.status === "APPROVED" || item.status === "SCHEDULED") && review.approval.kind === "valid"}
          />
          </div>
        }
        lockedReason={
          locked && canWrite
            ? item.status === "ARCHIVED"
              ? "La pieza está archivada. Restaurala para editarla."
              : "La pieza ya se publicó: no se puede editar."
            : !canWrite
              ? "Tu rol puede ver las piezas, pero no editarlas."
              : undefined
        }
      />

    </>
  );
}

function approvalProps(review: Review): ReviewPanelProps["approval"] {
  const a = review.approval;
  if (a.kind === "none") return { kind: "none" };
  if (a.kind === "valid") return { kind: "valid", versionNumber: a.decision.version.number, by: decidedBy(review, a.decision.id), at: when.format(a.decision.createdAt), note: a.decision.note };
  return { kind: "stale", versionNumber: a.decision.version.number, reason: STALE_TEXT[a.reason] };
}

function decidedBy(review: Review, decisionId: string) {
  return review.decisions.find((d) => d.id === decisionId)?.decidedBy ?? "Alguien";
}

// Comentarios, aprobaciones y aprobaciones vencidas, en orden cronológico.
function threadOf(review: Review): ThreadEntry[] {
  const rows: { t: number; entry: ThreadEntry }[] = review.comments.map((c) => ({
    t: c.createdAt.getTime(),
    entry: { type: "comment", id: c.id, author: c.author, at: when.format(c.createdAt), body: c.body, versionNumber: c.versionNumber, changeRequest: c.kind === "CHANGE_REQUEST" },
  }));
  for (const d of review.decisions) {
    if (d.outcome !== "APPROVED") continue;
    rows.push({ t: d.createdAt.getTime(), entry: { type: "event", id: d.id, at: when.format(d.createdAt), text: `${d.decidedBy} aprobó la versión ${d.version.number}`, tone: "success", note: d.note || undefined } });
    if (d.invalidatedAt) {
      const reason = STALE_TEXT[(d.invalidReason ?? "content_changed") as keyof typeof STALE_TEXT] ?? STALE_TEXT.content_changed;
      rows.push({ t: d.invalidatedAt.getTime(), entry: { type: "event", id: `${d.id}-x`, at: when.format(d.invalidatedAt), text: `La aprobación de la versión ${d.version.number} quedó sin efecto: ${reason}`, tone: "warning" } });
    }
  }
  return rows.sort((a, b) => a.t - b.t).map((r) => r.entry);
}
