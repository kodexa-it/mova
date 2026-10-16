import Link from "next/link";

import { sectionStatus, type BrandShape } from "@/modules/brand/completeness";
import { SECTION_KEYS, SECTIONS, type SectionKey } from "@/modules/brand/sections";

function StatusDot({ status, active }: { status: ReturnType<typeof sectionStatus>; active: boolean }) {
  if (status === "complete") {
    return (
      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-success text-white">
        <svg aria-hidden viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m3.75 8.25 2.75 2.75 5.75-6.25" />
        </svg>
      </span>
    );
  }
  return (
    <span
      className={`size-5 shrink-0 rounded-full ${
        active ? "bg-accent shadow-[0_0_0_4px_var(--color-accent-soft)]" : status === "optional" ? "border border-dashed border-line-strong" : "shadow-[inset_0_0_0_1.5px_var(--color-line-strong)]"
      }`}
    />
  );
}

// Pasos del asistente de marca, con el estado real de cada sección.
export function BrandSteps({ slug, shape, current }: { slug: string; shape: BrandShape | null; current?: SectionKey }) {
  return (
    <nav aria-label="Secciones de la marca">
      <ol className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:flex-col lg:pb-0">
        {SECTION_KEYS.map((key) => {
          const status = sectionStatus(shape, key);
          const active = key === current;
          return (
            <li key={key}>
              <Link
                href={`/w/${slug}/marca/${key}`}
                aria-current={active ? "step" : undefined}
                className={`relative flex items-center gap-2.5 whitespace-nowrap rounded-[10px] px-2.5 py-2 text-small transition-colors duration-[var(--dur-fast)] ${
                  active ? "bg-surface font-medium text-ink shadow-raised" : "text-ink-2 hover:bg-ink/[0.04] hover:text-ink"
                }`}
              >
                <StatusDot status={status} active={active} />
                <span>{SECTIONS[key].title}</span>
                {!SECTIONS[key].required ? <span className="text-caption text-ink-3">opcional</span> : null}
                <span className="sr-only">{status === "complete" ? "(completa)" : status === "optional" ? "(opcional)" : "(pendiente)"}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
