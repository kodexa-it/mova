import type { Metadata } from "next";
import Link from "next/link";

import { FormatIcon } from "@/components/content/format-icon";
import { PublicationActions } from "@/components/results/publication-actions";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { requirePageWorkspace } from "@/lib/page-context";
import { can } from "@/modules/access/permissions";
import { FORMAT_LABELS } from "@/modules/content/formats";
import { MIN_MEASURED } from "@/modules/metrics/model";
import { getResults, listPublishable } from "@/modules/metrics/service";

export const metadata: Metadata = { title: "Resultados" };

const date = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Argentina/Buenos_Aires" });
const n = (v: number | null) => (v === null ? "—" : v.toLocaleString("es-AR"));

export default async function ResultsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requirePageWorkspace(slug);
  const [results, publishable] = await Promise.all([getResults(ctx), listPublishable(ctx)]);
  const canWrite = can(ctx.role, "metrics.writeManual");
  const { learnings } = results;

  return (
    <>
      <PageHeader title="Resultados" description="Lo que pasó con cada publicación y lo que Mova aprende para planificar la semana siguiente. Cada dato muestra su fuente." />

      <Card as="div" className="mb-6 p-6">
        <h2 className="text-small font-medium text-ink">Aprendizajes</h2>
        {learnings.enough ? (
          <>
            <ul className="mt-3 flex flex-col gap-2">
              {learnings.lines.map((line) => (
                <li key={line} className="flex gap-2 text-body text-ink">
                  <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                  {line}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-caption text-ink-2">Mova usa estos aprendizajes al proponer la estrategia de cada semana. Son promedios a 7 días de la publicación, con la cantidad de casos.</p>
          </>
        ) : (
          <p className="mt-2 text-small text-ink-2">
            Hay {learnings.measured} de {MIN_MEASURED} publicaciones medidas a 7 días. Con menos no se sacan conclusiones: cargá las métricas de cada publicación a la semana de publicarla.
          </p>
        )}
      </Card>

      {publishable.length ? (
        <Card as="div" className="mb-6 p-6">
          <h2 className="text-small font-medium text-ink">Aprobadas sin publicación registrada</h2>
          <p className="mt-0.5 text-caption text-ink-2">Cuando las publiques, registrá la fecha y el enlace desde la pieza (pestaña Revisión).</p>
          <ul className="mt-3 flex flex-col gap-1.5">
            {publishable.map((item) => (
              <li key={item.id}>
                <Link href={`/w/${slug}/contenido/${item.id}`} className="flex items-center gap-2 text-small text-ink hover:underline">
                  <FormatIcon format={item.format} />
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {results.publications.length === 0 ? (
        <EmptyState title="Todavía no hay publicaciones registradas" description="Aprobá una pieza, publicala en Instagram y registrá su enlace: acá vas a ver sus resultados." />
      ) : (
        <Card as="div" className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-small">
            <thead>
              <tr className="border-b border-line text-left text-caption text-ink-2">
                <th className="px-5 py-3 font-medium">Publicación</th>
                <th className="px-3 py-3 text-right font-medium">Me gusta</th>
                <th className="px-3 py-3 text-right font-medium">Coment.</th>
                <th className="px-3 py-3 text-right font-medium">Guardados</th>
                <th className="px-3 py-3 text-right font-medium">Alcance</th>
                <th className="px-3 py-3 text-right font-medium">Consultas</th>
                <th className="px-3 py-3 text-right font-medium">Interacciones</th>
                <th className="px-5 py-3 text-right font-medium">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {results.publications.map((p) => (
                <tr key={p.id}>
                  <td className="px-5 py-3">
                    <Link href={`/w/${slug}/contenido/${p.item.id}`} className="flex items-center gap-2 font-medium text-ink hover:underline">
                      <FormatIcon format={p.item.format} />
                      {p.item.title}
                    </Link>
                    <p className="mt-0.5 text-caption text-ink-2">
                      {FORMAT_LABELS[p.item.format]} · {date.format(p.publishedAt)} ·{" "}
                      <a href={p.permalink} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                        Instagram
                      </a>
                      {p.snapshots[0] ? ` · medida ${p.snapshots[0].source === "APIFY_PUBLIC" ? "con Apify" : "a mano"} a las ${p.snapshots[0].ageHours} h` : " · sin métricas"}
                    </p>
                  </td>
                  <td className="tabular px-3 py-3 text-right">{n(p.summary.likes)}</td>
                  <td className="tabular px-3 py-3 text-right">{n(p.summary.comments)}</td>
                  <td className="tabular px-3 py-3 text-right">{n(p.summary.saves)}</td>
                  <td className="tabular px-3 py-3 text-right">{n(p.summary.reach)}</td>
                  <td className="tabular px-3 py-3 text-right">{n(p.summary.inquiries)}</td>
                  <td className="tabular px-3 py-3 text-right">
                    {p.snapshots.length ? p.interactions.toLocaleString("es-AR") : "—"}
                    {p.mature ? <Badge tone="success">7 días</Badge> : null}
                  </td>
                  <td className="px-5 py-3">
                    <PublicationActions slug={slug} publicationId={p.id} apify={results.apifyConfigured} canWrite={canWrite} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
