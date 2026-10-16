"use client";

import { useState } from "react";

import { artUrl, newRequestKey, useArt } from "@/components/content/visual-mode";
import { Button, Notice, Textarea } from "@/components/ui";
import { apiRequest } from "@/lib/errors";
import { FORMAT_SCHEMAS } from "@/modules/content/formats";
import type { ArtLayoutId, ArtRef } from "@/modules/content/layouts";
import { formatUsd } from "@/modules/ai/pricing";

interface Quote {
  configured: boolean;
  provider: string | null;
  model: string | null;
  aspectRatio: string;
  imageSize: string;
  estimateMicros: number | null;
  reserveMicros: number | null;
  precision: string | null;
  budget: { limitMicros: number; spentMicros: number; remainingMicros: number };
  blocked: boolean;
  reusable: { assetId: string; sha256: string; createdAt: string }[];
}

interface Asset {
  id: string;
  sha256: string;
  slotIndex: number;
  createdAt: string;
  generation: { layout: string; costMicros: number } | null;
}

// Imagen generada de una composición premium: costo antes de confirmar,
// generación (o regeneración) de esta sola imagen, reutilizar una ya generada
// sin costo y volver al modo estándar si algo falla. Nada se guarda hasta
// «Guardar versión»: la vista previa muestra el resultado antes.
export function ArtControls({ index, layout, art, onArt, disabled }: { index: number; layout: ArtLayoutId; art: ArtRef | undefined; onArt: (art: ArtRef) => void; disabled?: boolean }) {
  const ctx = useArt();
  const [brief, setBrief] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [pending, setPending] = useState<"quote" | "generate" | "list" | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [history, setHistory] = useState<Asset[] | null>(null);
  const [last, setLast] = useState<{ costMicros: number; costSource: string } | null>(null);
  if (!ctx) return null;
  const { slug, itemId } = ctx;

  function payload() {
    const parsed = FORMAT_SCHEMAS[ctx!.format].safeParse(ctx!.content);
    if (!parsed.success) return null;
    return { content: parsed.data, index, layout, brief };
  }

  async function askQuote() {
    const body = payload();
    if (!body) return setError({ code: "invalid_input", message: "Completá los textos obligatorios de la pieza antes de generar: la imagen se pide a partir de ellos." });
    setPending("quote");
    setError(null);
    const result = await apiRequest<Quote>(`/api/w/${slug}/content/${itemId}/art/quote`, { method: "POST", body });
    setPending(null);
    if (!result.ok) return setError({ code: result.code ?? "error", message: result.message });
    setQuote(result.data);
  }

  async function generate() {
    const body = payload();
    if (!body || !quote?.estimateMicros) return;
    setPending("generate");
    setError(null);
    const result = await apiRequest<{ asset: { id: string; sha256: string }; costMicros: number; costSource: string }>(`/api/w/${slug}/content/${itemId}/art`, {
      method: "POST",
      body: { ...body, requestKey: newRequestKey(), confirmMicros: quote.estimateMicros },
    });
    setPending(null);
    if (!result.ok) {
      setQuote(null);
      return setError({ code: result.code ?? "error", message: result.message });
    }
    setQuote(null);
    setLast({ costMicros: result.data.costMicros, costSource: result.data.costSource });
    setHistory(null);
    onArt({ assetId: result.data.asset.id, sha256: result.data.asset.sha256 });
  }

  async function loadHistory() {
    setPending("list");
    const result = await apiRequest<{ assets: Asset[] }>(`/api/w/${slug}/content/${itemId}/art`);
    setPending(null);
    if (result.ok) setHistory(result.data.assets);
  }

  const blockedByServer = error && ["images_not_configured", "images_budget_exhausted", "images_auth", "images_no_credits", "images_failed", "images_rejected", "visual_mode_standard"].includes(error.code);

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-[12px] bg-surface p-3 shadow-raised">
      <div className="flex items-start gap-3">
        <span className="block h-[4.5rem] w-14 shrink-0 overflow-hidden rounded-[8px] bg-pearl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {art ? <img src={artUrl(slug, itemId, art.assetId)} alt="Imagen generada para esta posición" className="size-full object-cover" /> : null}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-small font-medium text-ink">{art ? "Imagen generada con IA" : "Todavía sin imagen"}</p>
          <p className="text-caption text-ink-2">{art ? "El texto, la marca y el llamado los dibuja Mova encima. Mirala en la vista previa antes de guardar." : "Se genera a partir del texto de esta imagen, la paleta y el estilo de la marca. Sin textos ni logos dentro."}</p>
          {last ? (
            <p className="mt-1 text-caption text-success">
              Generada · costo {last.costSource === "usage" ? "real" : "estimado"} {formatUsd(last.costMicros)}. Guardá la versión para usarla.
            </p>
          ) : null}
        </div>
      </div>

      {!ctx.enabled ? <p className="text-caption text-ink-2">Activá «Generación visual con IA» para generar o regenerar esta imagen.</p> : null}

      {ctx.enabled && !quote ? (
        <>
          <div>
            <label htmlFor={`brief-${index}`} className="mb-1 block text-caption text-ink-2">
              Dirección de arte (opcional)
            </label>
            <Textarea id={`brief-${index}`} rows={2} maxLength={300} value={brief} disabled={disabled} onChange={(e) => setBrief(e.target.value)} placeholder="Por ejemplo: escritorio luminoso con una laptop en blanco, tonos cálidos." />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={askQuote} loading={pending === "quote"} disabled={disabled || pending !== null}>
              {art ? "Regenerar esta imagen" : "Generar imagen"}
            </Button>
            <Button size="sm" variant="quiet" onClick={loadHistory} loading={pending === "list"} disabled={disabled || pending !== null}>
              Elegir una ya generada
            </Button>
          </div>
        </>
      ) : null}

      {quote ? (
        <div className="flex flex-col gap-2 rounded-[10px] bg-pearl/70 p-3" role="group" aria-label="Confirmar generación">
          {!quote.configured ? (
            <Notice tone="warning">La generación de imágenes no está activada en este servidor (falta GEMINI_API_KEY). Podés seguir en modo estándar, sin costo.</Notice>
          ) : (
            <>
              <p className="text-small text-ink">
                Costo estimado: <span className="font-semibold">{quote.estimateMicros !== null ? formatUsd(quote.estimateMicros) : "—"}</span> · {quote.model}, {quote.imageSize}, {quote.aspectRatio}
              </p>
              {quote.precision ? <p className="text-caption text-ink-2">{quote.precision}</p> : null}
              <p className="text-caption text-ink-2">
                Límite de imágenes del mes: {formatUsd(quote.budget.spentMicros)} usados de {formatUsd(quote.budget.limitMicros)}.
              </p>
              {quote.blocked ? <Notice tone="warning">No alcanza el límite mensual de imágenes con IA. Un Dueño puede subirlo en Uso de IA.</Notice> : null}
              {quote.reusable.length ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-caption text-ink-2">Ya generaste una imagen con este mismo pedido:</span>
                  {quote.reusable.map((r) => (
                    <button key={r.assetId} type="button" onClick={() => { onArt({ assetId: r.assetId, sha256: r.sha256 }); setQuote(null); }} className="flex items-center gap-1.5 rounded-[8px] bg-surface p-1 pr-2 text-caption font-medium text-accent shadow-raised">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={artUrl(slug, itemId, r.assetId)} alt="" className="size-8 rounded-[6px] object-cover" />
                      Reutilizar sin costo
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            {quote.configured && !quote.blocked && quote.estimateMicros !== null ? (
              <Button size="sm" onClick={generate} loading={pending === "generate"} disabled={pending !== null}>
                {pending === "generate" ? "Generando (puede tardar unos segundos)" : `Confirmar y generar · ${formatUsd(quote.estimateMicros)}`}
              </Button>
            ) : null}
            <Button size="sm" variant="secondary" onClick={() => setQuote(null)} disabled={pending === "generate"}>
              Cancelar
            </Button>
            {!quote.configured || quote.blocked ? (
              <Button size="sm" variant="quiet" onClick={ctx.backToStandard}>
                Volver al modo estándar
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="flex flex-col gap-2">
          <Notice tone="error">{error.message}</Notice>
          {blockedByServer ? (
            <div>
              <Button size="sm" variant="secondary" onClick={ctx.backToStandard}>
                Volver al modo estándar
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {history ? (
        history.length ? (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Imágenes ya generadas">
            {history.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => onArt({ assetId: a.id, sha256: a.sha256 })}
                aria-pressed={art?.assetId === a.id}
                title={`Generada para la imagen ${a.slotIndex + 1}${a.generation ? ` · ${formatUsd(a.generation.costMicros)}` : ""}`}
                className={`h-16 w-12 overflow-hidden rounded-[8px] ${art?.assetId === a.id ? "shadow-[0_0_0_2px_var(--color-accent)]" : "shadow-raised"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={artUrl(slug, itemId, a.id)} alt={`Imagen generada ${a.slotIndex + 1}`} className="size-full object-cover" />
              </button>
            ))}
          </div>
        ) : (
          <p className="text-caption text-ink-2">Esta pieza todavía no tiene imágenes generadas.</p>
        )
      ) : null}
    </div>
  );
}
