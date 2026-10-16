"use client";

import { useState } from "react";

import { MODE_COPY, Switch } from "@/components/content/visual-mode";
import { Select, useConfirm } from "@/components/ui";
import { MOTIF_LABELS, MOTIFS, PRESET_LABELS, PRESETS, type MotifId, type PieceStyle, type PresetId } from "@/modules/content/layouts";

// Modo visual de la pieza y estilo de las composiciones (preset y patrón de
// marca). El modo se guarda al instante (no crea versión); el estilo forma
// parte del contenido y se guarda con la versión.
export function VisualPanel({
  mode,
  onMode,
  style,
  onStyle,
  suggested,
  hasArt,
  readOnly,
  pending,
}: {
  mode: "STANDARD" | "AI";
  onMode: (next: "STANDARD" | "AI") => void;
  style: PieceStyle | undefined;
  onStyle: (next: PieceStyle | undefined) => void;
  suggested: PieceStyle;
  hasArt: boolean;
  readOnly: boolean;
  pending: boolean;
}) {
  const [confirm, dialog] = useConfirm();
  const [open, setOpen] = useState(false);
  const current: PieceStyle = style ?? { preset: "marca", motif: "none" };
  const differs = suggested.preset !== current.preset || suggested.motif !== current.motif;

  async function toggle(next: boolean) {
    if (!next && hasArt) {
      const ok = await confirm({
        title: "¿Volver al modo estándar?",
        description: "Las imágenes generadas se reemplazan por composiciones estándar en el editor. No se borran: si volvés a activar el modo, las podés elegir de nuevo sin costo.",
        confirmLabel: "Volver al modo estándar",
      });
      if (!ok) return;
    }
    onMode(next ? "AI" : "STANDARD");
  }

  return (
    <div className="rounded-[14px] bg-surface p-4 shadow-raised">
      {dialog}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Switch id="visual-mode" checked={mode === "AI"} onChange={toggle} disabled={readOnly || pending} label="Generación visual con IA" />
          <p className="mt-1.5 max-w-prose text-caption text-ink-2">{mode === "AI" ? MODE_COPY.ai : MODE_COPY.standard}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-caption font-medium ${mode === "AI" ? "bg-accent-soft text-accent" : "bg-pearl text-ink-2"}`}>{mode === "AI" ? "Premium · con costo" : "Estándar · sin costo"}</span>
      </div>

      <div className="mt-3 border-t border-line pt-3">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between text-left">
          <span className="text-small font-medium text-ink">
            Estilo: {PRESET_LABELS[current.preset].label}
            {current.motif !== "none" ? ` · ${MOTIF_LABELS[current.motif]}` : ""}
          </span>
          <span className="text-caption font-medium text-accent">{open ? "Listo" : "Cambiar"}</span>
        </button>
        {open ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="style-preset" className="mb-1 block text-caption text-ink-2">
                Preset
              </label>
              <Select id="style-preset" controlSize="sm" disabled={readOnly} value={current.preset} onChange={(e) => onStyle({ ...current, preset: e.target.value as PresetId })}>
                {PRESETS.map((p) => (
                  <option key={p} value={p}>
                    {PRESET_LABELS[p].label}
                  </option>
                ))}
              </Select>
              <p className="mt-1 text-caption text-ink-2">{PRESET_LABELS[current.preset].hint}</p>
            </div>
            <div>
              <label htmlFor="style-motif" className="mb-1 block text-caption text-ink-2">
                Patrón de marca
              </label>
              <Select id="style-motif" controlSize="sm" disabled={readOnly} value={current.motif} onChange={(e) => onStyle({ ...current, motif: e.target.value as MotifId })}>
                {MOTIFS.map((m) => (
                  <option key={m} value={m}>
                    {MOTIF_LABELS[m]}
                  </option>
                ))}
              </Select>
              <p className="mt-1 text-caption text-ink-2">Solo en las composiciones, nunca sobre el texto.</p>
            </div>
            {differs && !readOnly ? (
              <p className="text-caption text-ink-2 sm:col-span-2">
                Según la marca: {PRESET_LABELS[suggested.preset].label}
                {suggested.motif !== "none" ? ` con ${MOTIF_LABELS[suggested.motif].toLowerCase()}` : ""}.{" "}
                <button type="button" className="font-medium text-accent hover:underline" onClick={() => onStyle(suggested)}>
                  Usar
                </button>
              </p>
            ) : null}
            <p className="text-caption text-ink-2 sm:col-span-2">La composición clásica no cambia con el estilo.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
