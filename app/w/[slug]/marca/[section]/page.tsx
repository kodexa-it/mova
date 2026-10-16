import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BrandSteps } from "@/components/brand/brand-steps";
import { ReferencesPanel } from "@/components/brand/references-panel";
import { SectionForm } from "@/components/brand/section-form";
import { Card } from "@/components/ui";
import { requirePageWorkspace } from "@/lib/page-context";
import { can } from "@/modules/access/permissions";
import { getProvider } from "@/modules/ai/providers/registry";
import { listReferences } from "@/modules/brand/references";
import { isSectionKey, SECTION_KEYS, SECTIONS } from "@/modules/brand/sections";
import { getBrand, shapeOf } from "@/modules/brand/service";
import { sectionValues } from "@/modules/brand/values";

type Params = { params: Promise<{ slug: string; section: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { section } = await params;
  return { title: isSectionKey(section) ? `${SECTIONS[section].title} · Marca` : "Marca" };
}

export default async function BrandSectionPage({ params }: Params) {
  const { slug, section } = await params;
  if (!isSectionKey(section)) notFound();
  const ctx = await requirePageWorkspace(slug);
  const brand = await getBrand(ctx);
  const meta = SECTIONS[section];
  const step = SECTION_KEYS.indexOf(section) + 1;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8">
      <div className="lg:sticky lg:top-28 lg:self-start">
        <BrandSteps slug={slug} shape={shapeOf(brand)} current={section} />
      </div>
      <div className="min-w-0">
        <header className="mb-6">
          <p className="tabular text-small text-ink-2">
            Paso {step} de {SECTION_KEYS.length}
            {meta.required ? "" : ", opcional"}
          </p>
          <h1 className="mt-1 text-display font-semibold text-ink">{meta.title}</h1>
          <p className="mt-2 text-body text-ink-2">{meta.summary}</p>
        </header>
        <Card className="p-6 sm:p-7">
          {/* key: al cambiar de sección se reinicia el estado del formulario */}
          <SectionForm
            key={section}
            slug={slug}
            section={section}
            initial={sectionValues(brand, section, ctx.workspace.name)}
            readOnly={!can(ctx.role, "brand.update")}
            aiEnabled={getProvider() !== null}
          />
        </Card>
        {section === "visual" ? (
          <Card className="mt-6 p-6 sm:p-7">
            <ReferencesPanel slug={slug} initial={await listReferences(ctx)} canEdit={can(ctx.role, "brand.update")} />
          </Card>
        ) : null}
      </div>
    </div>
  );
}
