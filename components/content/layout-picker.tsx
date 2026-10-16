"use client";

import { useState, type ReactNode } from "react";

import { ArtControls } from "@/components/content/art-controls";
import { UploadControls } from "@/components/content/upload-controls";
import { useArt } from "@/components/content/visual-mode";
import { Select } from "@/components/ui";
import { ICON_SHAPES } from "@/modules/content/icons";
import {
  checkDesign,
  cleanDesign,
  ICON_LABELS,
  ICONS,
  iconFor,
  isArtLayout,
  LAYOUT_SPECS,
  layoutsFor,
  leadingFigure,
  lines,
  proofMatchesSlot,
  type Design,
  type IconId,
  type LayoutId,
  type ProofSnapshot,
  type Slot,
} from "@/modules/content/layouts";

export function IconGlyph({ id, className = "size-4" }: { id: IconId; className?: string }) {
  const shape = ICON_SHAPES[id];
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {(shape.rects ?? []).map(([x, y, w, h, r], i) => (
        <rect key={`r${i}`} x={x} y={y} width={w} height={h} rx={r} />
      ))}
      {(shape.circles ?? []).map(([cx, cy, r], i) => (
        <circle key={`c${i}`} cx={cx} cy={cy} r={r} />
      ))}
      {(shape.paths ?? []).map((d, i) => (
        <path key={`p${i}`} d={d} />
      ))}
    </svg>
  );
}

// Miniaturas esquemáticas de cada composición (no son el render real).
const bar = (w: string, extra = "") => <span className={`block h-[3px] rounded-full bg-current ${extra}`} style={{ width: w }} />;
const THUMBS: Record<LayoutId, ReactNode> = {
  classic: (
    <span className="flex h-full flex-col justify-end gap-1 p-1.5">
      {bar("80%")}
      {bar("55%", "opacity-50")}
    </span>
  ),
  "cover-editorial": (
    <span className="relative flex h-full flex-col justify-end gap-1 overflow-hidden p-1.5">
      <span className="absolute -right-3 -top-3 size-7 rounded-full bg-current opacity-25" />
      {bar("30%", "text-accent")}
      {bar("90%")}
      {bar("70%")}
    </span>
  ),
  "cover-device": (
    <span className="flex h-full flex-col gap-1 p-1.5">
      {bar("75%")}
      <span className="mt-auto block h-4 rounded-[2px] border border-current opacity-70" />
    </span>
  ),
  steps: (
    <span className="flex h-full flex-col justify-center gap-1 p-1.5">
      {[0, 1, 2].map((i) => (
        <span key={i} className="flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-accent" />
          {bar("70%", "opacity-60")}
        </span>
      ))}
    </span>
  ),
  "icon-list": (
    <span className="flex h-full flex-col justify-center gap-1 p-1.5">
      {[0, 1, 2].map((i) => (
        <span key={i} className="flex items-center gap-1">
          <span className="size-1.5 rounded-[1px] border border-accent" />
          {bar("70%", "opacity-60")}
        </span>
      ))}
    </span>
  ),
  compare: (
    <span className="flex h-full flex-col justify-center gap-1 p-1.5">
      <span className="block h-2.5 rounded-[2px] bg-current opacity-15" />
      <span className="block h-2.5 rounded-[2px] bg-accent opacity-40" />
    </span>
  ),
  quote: (
    <span className="flex h-full flex-col justify-center gap-0.5 p-1.5">
      <span className="text-[13px] font-semibold leading-none text-accent">“</span>
      {bar("85%")}
      {bar("60%")}
    </span>
  ),
  stat: (
    <span className="flex h-full flex-col justify-center gap-1 p-1.5">
      <span className="text-[12px] font-semibold leading-none text-accent">%</span>
      {bar("80%", "opacity-60")}
    </span>
  ),
  browser: (
    <span className="flex h-full flex-col gap-1 p-1.5">
      {bar("60%")}
      <span className="mt-auto flex h-4 flex-col rounded-[2px] border border-current opacity-70">
        <span className="h-[3px] border-b border-current" />
      </span>
    </span>
  ),
  phone: (
    <span className="flex h-full items-center gap-1 p-1.5">
      <span className="flex flex-1 flex-col gap-1">
        {bar("90%")}
        {bar("60%", "opacity-60")}
      </span>
      <span className="block h-6 w-3 rounded-[3px] border border-current opacity-70" />
    </span>
  ),
  cta: (
    <span className="flex h-full flex-col justify-center gap-1 p-1.5">
      {bar("85%")}
      <span className="block h-2 w-6 rounded-full bg-accent" />
    </span>
  ),
  "art-cover": (
    <span className="relative flex h-full flex-col justify-end gap-1 overflow-hidden bg-gradient-to-b from-accent/50 to-ink/80 p-1.5 text-white">
      <span className="absolute right-1 top-1 rounded-[2px] bg-white/85 px-0.5 text-[6px] font-semibold leading-tight text-accent">IA</span>
      {bar("85%")}
      {bar("55%", "opacity-70")}
    </span>
  ),
  upload: (
    <span className="relative flex h-full flex-col items-center justify-center gap-0.5 p-1.5">
      <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 10.5V3M5 5.75 8 2.75l3 3M3 10.5v1.75c0 .55.45 1 1 1h8c.55 0 1-.45 1-1V10.5" />
      </svg>
    </span>
  ),
  "art-panel": (
    <span className="relative flex h-full flex-col gap-1 p-1.5">
      <span className="absolute right-1 top-1 rounded-[2px] bg-accent px-0.5 text-[6px] font-semibold leading-tight text-white">IA</span>
      {bar("60%")}
      <span className="mt-auto block h-5 rounded-[3px] bg-gradient-to-br from-accent/60 to-ink/50" />
    </span>
  ),
};

// Parámetros por defecto al elegir una composición.
function defaultsFor(layout: LayoutId, slot: Slot, proofs: ProofSnapshot[], current: Design | undefined): Design {
  if (layout === "icon-list") {
    const items = lines(slot.body);
    return { layout, icons: items.map((l, i) => current?.icons?.[i] ?? iconFor(l)) };
  }
  if (layout === "cover-device") return { layout, device: current?.device ?? "browser" };
  // Al pasar entre las dos composiciones con imagen se conserva la imagen.
  if (isArtLayout(layout) || layout === "upload") return current?.art ? { layout, art: current.art } : { layout };
  if (layout === "stat") {
    const proof = current?.proof ?? proofs.find((p) => proofMatchesSlot(p, slot)) ?? proofs.find((p) => leadingFigure(p.statement));
    return proof ? { layout, proof } : { layout };
  }
  return { layout };
}

export function LayoutPicker({
  id,
  index,
  slot,
  design,
  proofs,
  onChange,
  disabled,
}: {
  id: string;
  index: number;
  slot: Slot;
  design: Design | undefined;
  proofs: ProofSnapshot[];
  onChange: (next: Design | undefined) => void;
  disabled?: boolean;
}) {
  const selected: LayoutId = design?.layout ?? "classic";
  const problem = checkDesign(slot, design, { proofs });
  const items = lines(slot.body);
  const art = useArt();
  // Las composiciones con imagen generada solo se ofrecen con el modo premium
  // activado (o si la imagen ya tiene una, para poder verla y cambiarla).
  const options = layoutsFor(slot.role).filter((l) => !isArtLayout(l) || art?.enabled || l === selected);
  const [open, setOpen] = useState(false);

  // Plegado: una línea con la composición elegida. Se abre para cambiarla.
  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={disabled}
          aria-expanded={false}
          className="group inline-flex items-center gap-2.5 rounded-[10px] py-1 pl-1 pr-2.5 text-left transition-colors hover:bg-pearl disabled:hover:bg-transparent"
        >
          <span aria-hidden className="block h-9 w-7 shrink-0 overflow-hidden rounded-[4px] bg-surface text-ink-2 shadow-raised">
            {THUMBS[selected]}
          </span>
          <span className="flex flex-col">
            <span className="text-caption text-ink-2">Composición</span>
            <span className="text-small font-medium text-ink">{LAYOUT_SPECS[selected].label}</span>
          </span>
          {!disabled ? <span className="ml-1 text-caption font-medium text-accent group-hover:underline">Cambiar</span> : null}
        </button>
        {problem ? (
          <p className="text-caption text-danger" role="status">
            {problem}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <fieldset disabled={disabled} className="min-w-0 rounded-[12px] bg-pearl/55 p-3">
      <legend className="sr-only">Composición</legend>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-caption font-medium text-ink">Composición</span>
        <span className="min-w-0 flex-1 truncate text-right text-caption text-ink-2">{LAYOUT_SPECS[selected].hint}</span>
        <button type="button" onClick={() => setOpen(false)} className="text-caption font-medium text-accent underline-offset-4 hover:underline">
          Listo
        </button>
      </div>
      <div role="radiogroup" aria-label="Composición de la imagen" className="flex flex-wrap gap-1.5">
        {options.map((layout) => {
          const fits = checkDesign(slot, defaultsFor(layout, slot, proofs, design), { proofs }) === null;
          const active = layout === selected;
          return (
            <button
              key={layout}
              type="button"
              role="radio"
              aria-checked={active}
              title={fits ? LAYOUT_SPECS[layout].hint : `No entra con este texto: ${checkDesign(slot, defaultsFor(layout, slot, proofs, design), { proofs })}`}
              onClick={() => onChange(cleanDesign(defaultsFor(layout, slot, proofs, design)))}
              className={`flex w-[4.75rem] flex-col items-center gap-1 rounded-[10px] p-1.5 text-center transition-[background-color,box-shadow] duration-[var(--dur-fast)] focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none ${
                active ? "bg-surface shadow-[0_0_0_1.5px_var(--color-accent)]" : "hover:bg-surface/70"
              } ${fits || active ? "" : "opacity-45"}`}
            >
              <span aria-hidden className={`block h-[3.1rem] w-10 overflow-hidden rounded-[5px] bg-surface text-ink-2 shadow-raised ${active ? "text-ink" : ""}`}>
                {THUMBS[layout]}
              </span>
              <span className="text-[11px] leading-tight text-ink-2">{LAYOUT_SPECS[layout].label}</span>
            </button>
          );
        })}
      </div>

      {design?.layout === "cover-device" ? (
        <div className="mt-3 flex gap-1.5" role="radiogroup" aria-label="Dispositivo">
          {(["browser", "laptop", "phone"] as const).map((device) => (
            <button
              key={device}
              type="button"
              role="radio"
              aria-checked={design.device === device}
              onClick={() => onChange({ ...design, device })}
              className={`h-8 rounded-[8px] px-3 text-small ${design.device === device ? "bg-surface font-medium text-ink shadow-raised" : "text-ink-2 hover:bg-surface/70"}`}
            >
              {device === "browser" ? "Navegador" : device === "laptop" ? "Laptop" : "Teléfono"}
            </button>
          ))}
        </div>
      ) : null}

      {design?.layout === "upload" ? (
        <UploadControls index={index} art={design.art} disabled={disabled} vertical={slot.role === "story" || slot.role === "reel-cover"} onArt={(next) => onChange({ layout: "upload", art: next })} />
      ) : null}
      {design && isArtLayout(design.layout) ? <ArtControls index={index} layout={design.layout} art={design.art} disabled={disabled} onArt={(next) => onChange({ layout: design.layout, art: next })} /> : null}

      {design?.layout === "icon-list" && items.length ? (
        <div className="mt-3 flex flex-col gap-1.5">
          {items.map((line, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="grid size-8 shrink-0 place-items-center rounded-[8px] bg-surface text-accent shadow-raised">
                <IconGlyph id={design.icons?.[i] ?? "check"} />
              </span>
              <label className="sr-only" htmlFor={`${id}-icon-${i}`}>
                Ícono para “{line}”
              </label>
              <Select
                id={`${id}-icon-${i}`}
                controlSize="sm"
                value={design.icons?.[i] ?? "check"}
                onChange={(e) => {
                  const icons = items.map((_, j) => design.icons?.[j] ?? "check");
                  icons[i] = e.target.value as IconId;
                  onChange({ ...design, icons });
                }}
              >
                {ICONS.map((icon) => (
                  <option key={icon} value={icon}>
                    {ICON_LABELS[icon]}
                  </option>
                ))}
              </Select>
              <span className="min-w-0 flex-1 truncate text-caption text-ink-2">{line}</span>
            </div>
          ))}
        </div>
      ) : null}

      {design?.layout === "stat" ? (
        <div className="mt-3">
          <label htmlFor={`${id}-proof`} className="mb-1 block text-caption text-ink-2">
            Dato publicable (la cifra tiene que estar en el texto de esta imagen)
          </label>
          <Select
            id={`${id}-proof`}
            controlSize="sm"
            value={design.proof?.id ?? ""}
            onChange={(e) => {
              const proof = proofs.find((p) => p.id === e.target.value);
              onChange(proof ? { layout: "stat", proof } : { layout: "stat" });
            }}
          >
            <option value="">Elegí un dato</option>
            {proofs
              .filter((p) => leadingFigure(p.statement))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.statement}
                </option>
              ))}
          </Select>
          {!proofs.some((p) => leadingFigure(p.statement)) ? <p className="mt-1 text-caption text-ink-2">La marca no tiene datos publicables con cifras. Cargalos en Marca → Datos publicables.</p> : null}
        </div>
      ) : null}

      {problem ? (
        <p className="mt-2 text-caption text-danger" role="status">
          {problem}
        </p>
      ) : null}
    </fieldset>
  );
}
