"use client";

import { useState } from "react";

import { Button, Modal, useToast } from "@/components/ui";

// Brief de diseño: el prompt para la IA que prefiera la persona y la versión
// para un diseñador, con las referencias de la marca para adjuntar.
export function BriefButton({ slug, brief, references }: { slug: string; brief: { designer: string; prompt: string; fileName: string }; references: { id: string; label: string; file: string }[] }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"prompt" | "designer">("prompt");
  const text = tab === "prompt" ? brief.prompt : brief.designer;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copiado");
    } catch {
      toast.error("No se pudo copiar. Seleccioná el texto y copialo a mano.");
    }
  }

  function download() {
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = tab === "prompt" ? brief.fileName.replace(/^brief-/, "prompt-") : brief.fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Brief de diseño
      </Button>
      <Modal open={open} onOpenChange={setOpen} title="Brief de diseño" description="Para hacer las imágenes con tu IA de preferencia o con un diseñador. Después subí cada diseño final en la pieza con la composición «Diseño propio»." size="lg">
        <div className="flex flex-col gap-4">
          <div role="tablist" className="flex rounded-[10px] bg-pearl p-0.5">
            {(["prompt", "designer"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`h-8 flex-1 rounded-[8px] text-small ${tab === t ? "bg-surface font-medium text-ink shadow-raised" : "text-ink-2 hover:text-ink"}`}
              >
                {t === "prompt" ? "Prompt para tu IA" : "Para un diseñador"}
              </button>
            ))}
          </div>
          <textarea readOnly value={text} className="h-72 w-full resize-none rounded-[12px] bg-pearl/60 p-3 font-mono text-caption text-ink" aria-label={tab === "prompt" ? "Prompt" : "Brief"} />
          {references.length ? (
            <div>
              <p className="text-caption font-medium text-ink">Referencias para adjuntar ({references.length})</p>
              <ul className="mt-1.5 flex flex-wrap gap-2">
                {references.map((r) => (
                  <li key={r.id}>
                    <a href={`/api/w/${slug}/brand/references/${r.id}?descargar`} className="flex items-center gap-2 rounded-[8px] bg-surface p-1 pr-2 text-caption text-accent shadow-raised hover:underline">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/w/${slug}/brand/references/${r.id}`} alt="" className="size-8 rounded-[6px] object-cover" />
                      {r.file}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-caption text-ink-2">Tip: cargá referencias visuales en Marca → Visual para que el brief las use.</p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={download}>
              Descargar .md
            </Button>
            <Button onClick={copy}>Copiar</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
