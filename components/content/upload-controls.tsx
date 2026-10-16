"use client";

import { useRef, useState } from "react";

import { artUrl, useArt } from "@/components/content/visual-mode";
import { Button, Notice } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import type { ArtRef } from "@/modules/content/layouts";

// Diseño propio: la imagen final de esta posición, hecha por un diseñador o con
// otra herramienta. Se ve en la vista previa antes de guardar la versión y
// pasa por la misma aprobación.
export function UploadControls({ index, art, onArt, disabled, vertical }: { index: number; art: ArtRef | undefined; onArt: (art: ArtRef) => void; disabled?: boolean; vertical: boolean }) {
  const ctx = useArt();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!ctx) return null;

  async function upload(file: File | undefined) {
    if (!file) return;
    setPending(true);
    setError(null);
    const form = new FormData();
    form.set("file", file);
    form.set("index", String(index));
    const response = await fetch(`/api/w/${ctx!.slug}/content/${ctx!.itemId}/art/upload`, { method: "POST", body: form }).catch(() => null);
    const data = response ? await response.json().catch(() => ({})) : {};
    setPending(false);
    if (input.current) input.current.value = "";
    if (!response?.ok) return setError(errorMessage(data.error));
    onArt({ assetId: data.asset.id, sha256: data.asset.sha256 });
  }

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-[12px] bg-surface p-3 shadow-raised">
      <div className="flex items-start gap-3">
        <span className={`block w-14 shrink-0 overflow-hidden rounded-[8px] bg-pearl ${vertical ? "aspect-[9/16]" : "aspect-[4/5]"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {art ? <img src={artUrl(ctx.slug, ctx.itemId, art.assetId)} alt="Diseño subido para esta posición" className="size-full object-cover" /> : null}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-small font-medium text-ink">{art ? "Diseño final subido" : "Todavía sin diseño"}</p>
          <p className="text-caption text-ink-2">
            {vertical ? "9:16, 1080×1920" : "4:5, 1080×1350"}, PNG o JPG, hasta 8 MB. Mova lo publica tal cual: revisá que el texto coincida con el aprobado.
          </p>
        </div>
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Elegir imagen" onChange={(e) => void upload(e.target.files?.[0])} />
      <div>
        <Button size="sm" variant={art ? "secondary" : "primary"} loading={pending} disabled={disabled} onClick={() => input.current?.click()}>
          {art ? "Reemplazar imagen" : "Subir imagen"}
        </Button>
      </div>
    </div>
  );
}
