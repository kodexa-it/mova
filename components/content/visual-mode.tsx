"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { AnyContent, Format } from "@/modules/content/formats";

// Interruptor accesible (role="switch").
export function Switch({ id, checked, onChange, disabled, label }: { id: string; checked: boolean; onChange: (next: boolean) => void; disabled?: boolean; label: ReactNode }) {
  return (
    <label htmlFor={id} className={`inline-flex items-center gap-3 ${disabled ? "opacity-60" : "cursor-pointer"}`}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-[var(--dur-fast)] focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none ${checked ? "bg-accent" : "bg-ink/20"}`}
      >
        <span aria-hidden className={`inline-block size-5 rounded-full bg-white shadow-raised transition-transform duration-[var(--dur-fast)] ${checked ? "translate-x-[1.375rem]" : "translate-x-0.5"}`} />
      </button>
      <span className="text-small font-medium text-ink">{label}</span>
    </label>
  );
}

// Lo que necesita el selector de composición para el modo premium: si está
// activado, el contenido que se está editando (para el pedido) y cómo volver
// al modo estándar.
export interface ArtContextValue {
  enabled: boolean;
  slug: string;
  itemId: string;
  format: Format;
  content: AnyContent;
  backToStandard: () => void;
}

export const ArtContext = createContext<ArtContextValue | null>(null);
export const useArt = () => useContext(ArtContext);

export const MODE_COPY = {
  standard: "Composiciones de Mova con ilustraciones vectoriales, patrones y la paleta de la marca. Se dibujan al instante y no tienen costo.",
  ai: "Además, imágenes originales generadas con IA (Google Gemini) para portadas y paneles. Cada imagen tiene costo: se muestra antes y se confirma una por una. Los textos, el logo y el llamado los sigue dibujando Mova.",
} as const;

export const artUrl = (slug: string, itemId: string, assetId: string) => `/api/w/${slug}/content/${itemId}/art/${assetId}`;

export function newRequestKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
