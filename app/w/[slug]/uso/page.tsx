import type { Metadata } from "next";

import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { requirePageWorkspace } from "@/lib/page-context";
import { formatUsd } from "@/modules/ai/pricing";
import { getProvider } from "@/modules/ai/providers/registry";
import { getAiUsage } from "@/modules/ai/usage";
import { SECTIONS, isSectionKey } from "@/modules/brand/sections";
import { FORMAT_LABELS } from "@/modules/content/formats";
import { ImageBudgetForm } from "@/components/usage/image-budget-form";
import { IMAGE_PRICES, IMAGE_PRICES_CHECKED } from "@/modules/images/pricing";
import { getImageUsage } from "@/modules/images/service";

export const metadata: Metadata = { title: "Uso de IA" };

const STATUS = {
  SUCCEEDED: { label: "Completada", tone: "success" },
  FAILED: { label: "Falló", tone: "danger" },
  BLOCKED: { label: "Bloqueada", tone: "warning" },
  PENDING: { label: "En curso", tone: "neutral" },
} as const;

function operationLabel(operation: string) {
  const match = operation.match(/^brand\.assist\.(.+)$/);
  if (match?.[1] && isSectionKey(match[1])) return `Propuesta de marca: ${SECTIONS[match[1]].title}`;
  const piece = operation.match(/^content\.(?:generate|fix|compose)\.(.+)$/);
  if (piece?.[1] && piece[1] in FORMAT_LABELS) return `Pieza: ${FORMAT_LABELS[piece[1] as keyof typeof FORMAT_LABELS]}`;
  return operation;
}

const dateTime = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Argentina/Buenos_Aires" });
const monthName = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" });
const integer = new Intl.NumberFormat("es-AR");

export default async function UsagePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requirePageWorkspace(slug, "usage.read");
  const [usage, images] = await Promise.all([getAiUsage(ctx), getImageUsage(ctx)]);
  const imageRatio = images.limitMicros > 0 ? Math.min(1, images.spentMicros / images.limitMicros) : 1;
  const ratio = usage.budgetMicros > 0 ? Math.min(1, usage.spentMicros / usage.budgetMicros) : 1;
  const enabled = getProvider() !== null;

  return (
    <>
      <PageHeader title="Uso de IA" description="Cada llamada a un modelo, con sus tokens y su costo. El presupuesto se controla antes de llamar." />
      <Card as="div" className="mb-6 p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-small text-ink-2 first-letter:uppercase">{monthName.format(usage.monthStart)}</p>
            <p className="mt-1 text-display font-semibold text-ink">
              <span className="tabular">{formatUsd(usage.spentMicros)}</span>
              <span className="text-lead font-normal text-ink-2"> de {formatUsd(usage.budgetMicros)}</span>
            </p>
          </div>
          {!enabled ? <Badge tone="neutral">IA desactivada en este servidor</Badge> : ratio >= 1 ? <Badge tone="danger">Presupuesto agotado</Badge> : ratio >= 0.8 ? <Badge tone="warning">Queda poco presupuesto</Badge> : null}
        </div>
        <div
          role="meter"
          aria-label="Presupuesto de IA usado este mes"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(ratio * 100)}
          className="mt-4 h-2 overflow-hidden rounded-full bg-pearl-strong"
        >
          <div className={`h-full rounded-full transition-[width] duration-[var(--dur-slow)] ${ratio >= 1 ? "bg-danger" : ratio >= 0.8 ? "bg-warning" : "bg-accent"}`} style={{ width: `${ratio * 100}%` }} />
        </div>
        <p className="mt-3 text-small text-ink-2">
          Si el próximo pedido puede superar el presupuesto, Mova no llama al modelo y lo registra como bloqueado. El resto de la plataforma sigue funcionando.
        </p>
      </Card>

      <Card as="div" className="mb-6 p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-small font-medium text-ink">Imágenes generadas con IA (modo premium)</p>
            <p className="mt-1 text-title font-semibold text-ink">
              <span className="tabular">{formatUsd(images.spentMicros)}</span>
              <span className="text-body font-normal text-ink-2"> de {formatUsd(images.limitMicros)} este mes</span>
            </p>
          </div>
          {!images.configured ? <Badge tone="neutral">Sin proveedor de imágenes en este servidor</Badge> : imageRatio >= 1 ? <Badge tone="danger">Límite alcanzado</Badge> : null}
        </div>
        <div role="meter" aria-label="Límite de imágenes usado este mes" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(imageRatio * 100)} className="mt-4 h-2 overflow-hidden rounded-full bg-pearl-strong">
          <div className={`h-full rounded-full ${imageRatio >= 1 ? "bg-danger" : imageRatio >= 0.8 ? "bg-warning" : "bg-accent"}`} style={{ width: `${imageRatio * 100}%` }} />
        </div>
        <p className="mt-3 text-small text-ink-2">
          Separado del presupuesto de texto. Cada imagen muestra su costo y se confirma antes de generarse; si puede superar el límite, no se genera. Precios de referencia (Google, {IMAGE_PRICES_CHECKED}):{" "}
          {Object.values(IMAGE_PRICES)
            .map((p) => `${p.label}: USD ${p.perImage["1K"].toFixed(3)} (1K) y USD ${p.perImage["2K"].toFixed(3)} (2K) por imagen`)
            .join("; ")}
          .
        </p>
        <div className="mt-4">
          <ImageBudgetForm slug={slug} limitUsd={images.limitMicros / 1_000_000} />
        </div>
        {images.generations.length ? (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-small">
              <thead>
                <tr className="border-b border-line text-left text-caption text-ink-2">
                  <th className="py-2 pr-3 font-medium">Imagen</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 text-right font-medium">Estimado</th>
                  <th className="px-3 py-2 text-right font-medium">Costo</th>
                  <th className="py-2 pl-3 text-right font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {images.generations.map((g) => (
                  <tr key={g.id}>
                    <td className="py-2.5 pr-3">
                      <p className="text-ink">
                        {g.model} · {g.imageSize} · {g.aspectRatio}
                      </p>
                      <p className="text-caption text-ink-2">
                        {g.outputTokens ? `${integer.format(g.inputTokens)} / ${integer.format(g.outputTokens)} tokens` : g.errorCode ?? "sin consumo informado"}
                      </p>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={STATUS[g.status].tone}>{STATUS[g.status].label}</Badge>
                    </td>
                    <td className="tabular px-3 py-2.5 text-right text-ink-2">{formatUsd(g.estimatedMicros)}</td>
                    <td className="tabular px-3 py-2.5 text-right text-ink">
                      {formatUsd(g.costMicros)}
                      {g.status === "SUCCEEDED" ? <span className="block text-caption text-ink-2">{g.costSource === "usage" ? "según consumo" : "estimado"}</span> : null}
                    </td>
                    <td className="tabular py-2.5 pl-3 text-right text-ink-2">{dateTime.format(g.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>

      {usage.calls.length === 0 ? (
        <EmptyState title="Sin llamadas este mes" description="Cuando alguien use el asistente de marca, cada llamada va a aparecer acá con su costo." />
      ) : (
        <Card as="div" className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-small">
            <thead>
              <tr className="border-b border-line text-left text-caption text-ink-2">
                <th className="px-5 py-3 font-medium">Operación</th>
                <th className="px-3 py-3 font-medium">Estado</th>
                <th className="px-3 py-3 text-right font-medium">Tokens (entrada / salida)</th>
                <th className="px-3 py-3 text-right font-medium">Costo</th>
                <th className="px-5 py-3 text-right font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {usage.calls.map((call) => (
                <tr key={call.id}>
                  <td className="px-5 py-3">
                    <p className="text-ink">{operationLabel(call.operation)}</p>
                    <p className="text-caption text-ink-2">{call.model}</p>
                  </td>
                  <td className="px-3 py-3">
                    <Badge tone={STATUS[call.status].tone}>{STATUS[call.status].label}</Badge>
                  </td>
                  <td className="tabular px-3 py-3 text-right text-ink-2">
                    {integer.format(call.inputTokens)} / {integer.format(call.outputTokens)}
                  </td>
                  <td className="tabular px-3 py-3 text-right text-ink">{formatUsd(call.costMicros)}</td>
                  <td className="tabular px-5 py-3 text-right text-ink-2">{dateTime.format(call.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
