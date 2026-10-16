import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { Card, PageHeader } from "@/components/ui";
import { requirePageWorkspace } from "@/lib/page-context";
import { can } from "@/modules/access/permissions";
import { brandProgress, sectionStatus } from "@/modules/brand/completeness";
import { DIALS, EMOJI_LABELS, SECTION_KEYS, SECTIONS, type SectionKey } from "@/modules/brand/sections";
import { getBrand, paletteOf, shapeOf, type BrandProfile } from "@/modules/brand/service";

export const metadata: Metadata = { title: "Marca" };

function dialWord(value: number, low: string, high: string) {
  if (value <= 2) return low.toLowerCase();
  if (value >= 4) return high.toLowerCase();
  return `entre ${low.toLowerCase()} y ${high.toLowerCase()}`;
}

function preview(brand: BrandProfile | null, key: SectionKey): ReactNode {
  if (!brand) return null;
  const names = (items: { name?: string; title?: string }[]) =>
    items
      .map((i) => i.name ?? i.title)
      .filter(Boolean)
      .join(", ");
  switch (key) {
    case "identidad":
      return brand.industry ? `${brand.name}, ${brand.industry.toLowerCase()}.` : null;
    case "servicios":
      return names(brand.offerings) || null;
    case "publico":
      return names(brand.audiences) || null;
    case "objetivos":
      return names(brand.goals) || null;
    case "voz":
      return brand.voice
        ? `${DIALS.map((d) => dialWord(brand.voice![d.key], d.low, d.high)).join(", ")}. ${EMOJI_LABELS[brand.voice.emojiPolicy]}.`.replace(/^./, (c) => c.toUpperCase())
        : null;
    case "pilares":
      return brand.pillars.length ? brand.pillars.map((p) => `${p.name} ${p.weight} %`).join(", ") : null;
    case "visual": {
      const palette = paletteOf(brand);
      return palette.length ? (
        <span className="flex items-center gap-1.5">
          {palette.map((c, i) => (
            <span key={i} title={`${c.name} ${c.hex}`} className="size-5 rounded-full shadow-[inset_0_0_0_1px_rgb(20_20_25/0.1)]" style={{ backgroundColor: c.hex }} />
          ))}
        </span>
      ) : null;
    }
    case "datos":
      return brand.proofs.length ? `${brand.proofs.length} ${brand.proofs.length === 1 ? "dato con fuente" : "datos con fuente"}` : null;
    case "reglas":
      return brand.rules.length ? `${brand.rules.length} ${brand.rules.length === 1 ? "regla" : "reglas"}` : null;
  }
}

function minutesBetween(from: Date, to: Date) {
  return Math.max(1, Math.round((to.getTime() - from.getTime()) / 60000));
}

export default async function BrandPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requirePageWorkspace(slug);
  const brand = await getBrand(ctx);
  const shape = shapeOf(brand);
  const progress = brandProgress(shape);
  const canEdit = can(ctx.role, "brand.update");
  const firstPending = progress.nextIncomplete ?? "identidad";

  return (
    <>
      <PageHeader
        title="Marca"
        description="El contexto que Mova usa para planificar y escribir. Ninguna sección pide conectar Instagram."
        actions={
          canEdit && !progress.isComplete ? (
            <Link
              href={`/w/${slug}/marca/${firstPending}`}
              className="inline-flex h-10 items-center rounded-[var(--radius-control)] bg-accent px-4 font-medium text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_1px_2px_rgb(61_58_216/0.24)] transition-colors hover:bg-accent-hover"
            >
              {brand ? "Seguir configurando" : "Empezar"}
            </Link>
          ) : null
        }
      />

      <Card as="div" className="mb-6 flex flex-wrap items-center gap-x-8 gap-y-4 p-5">
        <div className="min-w-[12rem] flex-1">
          <div className="flex items-baseline justify-between">
            <p className="text-small font-medium text-ink">{progress.isComplete ? "Marca configurada" : "Secciones necesarias"}</p>
            <p className="tabular text-small text-ink-2">
              {progress.completed} de {progress.total}
            </p>
          </div>
          <div aria-hidden className="mt-2.5 flex gap-1">
            {SECTION_KEYS.filter((k) => SECTIONS[k].required).map((k) => (
              <span key={k} className={`h-1.5 flex-1 rounded-full ${sectionStatus(shape, k) === "complete" ? "bg-success" : "bg-pearl-strong"}`} />
            ))}
          </div>
        </div>
        {brand?.completedAt ? (
          <p className="text-small text-ink-2">
            Quedó lista en <span className="tabular font-medium text-ink">{minutesBetween(brand.startedAt, brand.completedAt)} min</span> desde el primer guardado.
          </p>
        ) : null}
      </Card>

      <Card as="div" className="overflow-hidden">
        <ul className="divide-y divide-line">
          {SECTION_KEYS.map((key) => {
            const status = sectionStatus(shape, key);
            const content = preview(brand, key);
            return (
              <li key={key}>
                <Link
                  href={`/w/${slug}/marca/${key}`}
                  className="group flex items-center gap-4 px-5 py-4 transition-colors duration-[var(--dur-fast)] hover:bg-pearl/50"
                >
                  <span
                    aria-hidden
                    className={`grid size-8 shrink-0 place-items-center rounded-full ${
                      status === "complete" ? "bg-success-soft text-success" : status === "optional" ? "bg-pearl text-ink-3" : "bg-warning-soft text-warning"
                    }`}
                  >
                    {status === "complete" ? (
                      <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m3.75 8.25 2.75 2.75 5.75-6.25" />
                      </svg>
                    ) : (
                      <span className="size-1.5 rounded-full bg-current" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-medium text-ink">
                      {SECTIONS[key].title}
                      {!SECTIONS[key].required ? <span className="text-caption font-normal text-ink-2">opcional</span> : null}
                      <span className="sr-only">{status === "complete" ? "(completa)" : status === "optional" ? "(opcional, sin cargar)" : "(pendiente)"}</span>
                    </p>
                    <div className="mt-0.5 truncate text-small text-ink-2">{content ?? SECTIONS[key].summary}</div>
                  </div>
                  <svg aria-hidden viewBox="0 0 16 16" className="size-4 shrink-0 text-ink-3 transition-transform duration-[var(--dur-fast)] group-hover:translate-x-0.5 group-hover:text-ink-2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m6 3.5 4.5 4.5L6 12.5" />
                  </svg>
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}
