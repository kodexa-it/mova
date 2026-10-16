"use client";

import type { ContentStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button, Field, Modal, Notice, Textarea, useToast } from "@/components/ui";
import { apiRequest } from "@/lib/errors";

export interface ReviewPanelProps {
  slug: string;
  itemId: string;
  status: ContentStatus;
  version: { id: string; number: number } | null;
  approval:
    | { kind: "none" }
    | { kind: "valid"; versionNumber: number; by: string; at: string; note: string }
    | { kind: "stale"; versionNumber: number; reason: string };
  blockers: { id: string; label: string; detail: string }[];
  can: { write: boolean; approve: boolean; requestChanges: boolean };
}

const ICON_CHECK = <path d="m4.5 8.25 2.25 2.25 4.75-5" />;

// Revisión de la pieza: estado de la aprobación, lo que la bloquea y las
// acciones que el rol permite. Las reglas reales se aplican en el servidor.
export function ReviewPanel({ slug, itemId, status, version, approval, blockers, can }: ReviewPanelProps) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState<"submit" | "approve" | "changes" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [changesOpen, setChangesOpen] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  const blocked = blockers.length > 0;
  const approvable = status === "PENDING_APPROVAL" || (status === "APPROVED" && approval.kind === "stale");

  async function act(kind: "submit" | "approve" | "changes", path: string, body?: unknown) {
    setPending(kind);
    setError(null);
    const result = await apiRequest(`/api/w/${slug}/content/${itemId}/${path}`, { method: "POST", body });
    setPending(null);
    if (!result.ok) return setError(result.message);
    toast.success(kind === "submit" ? "Enviada a revisión" : kind === "approve" ? `Versión ${version?.number} aprobada` : "Pedido de cambios enviado");
    setChangesOpen(false);
    router.refresh();
  }

  function onRequestChanges(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const note = String(new FormData(event.currentTarget).get("note") ?? "").trim();
    if (note.length < 3) return setNoteError("Contá qué hay que cambiar.");
    setNoteError(null);
    void act("changes", "request-changes", { versionId: version?.id, note });
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="sr-only">Revisión</h2>

      {approval.kind === "valid" && status !== "PENDING_APPROVAL" ? (
        <div className="rounded-[12px] bg-success-soft px-4 py-3 text-success">
          <p className="flex items-center gap-1.5 text-small font-semibold">
            <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              {ICON_CHECK}
            </svg>
            Aprobada
          </p>
          <p className="mt-0.5 text-caption">
            Versión {approval.versionNumber} · {approval.by} · {approval.at}
          </p>
          <p className="mt-1.5 text-caption text-success/90">El texto y las imágenes quedan fijados en esta versión. Si cambian, hay que volver a aprobar.</p>
          {approval.note ? <p className="mt-2 border-t border-success/15 pt-2 text-caption text-ink">“{approval.note}”</p> : null}
        </div>
      ) : status === "PENDING_APPROVAL" ? (
        <div className="rounded-[12px] bg-accent-soft px-4 py-3">
          <p className="text-small font-semibold text-accent">En revisión · versión {version?.number}</p>
          <p className="mt-0.5 text-caption text-ink-2">{can.approve ? "Revisá el texto y las imágenes, y decidí." : "Espera la decisión de un Aprobador o Dueño."}</p>
        </div>
      ) : status === "DRAFT" ? (
        <div className="rounded-[12px] bg-pearl px-4 py-3">
          <p className="text-small font-semibold text-ink">Borrador</p>
          <p className="mt-0.5 text-caption text-ink-2">Cuando esté lista, enviala a revisión. Solo se puede publicar lo aprobado.</p>
        </div>
      ) : null}

      {approval.kind === "stale" ? (
        <Notice tone="warning">
          La aprobación de la versión {approval.versionNumber} quedó sin efecto: {approval.reason}.
        </Notice>
      ) : null}

      {blocked && (status === "DRAFT" || approvable) ? (
        <div>
          <p className="text-caption font-medium text-ink">Antes de {status === "DRAFT" ? "enviarla" : "aprobarla"}, corregí:</p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {blockers.slice(0, 4).map((b) => (
              <li key={b.id} className="flex gap-2 text-caption text-ink-2">
                <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-danger" />
                <span>
                  <span className="font-medium text-ink">{b.label}:</span> {b.detail}
                </span>
              </li>
            ))}
            {blockers.length > 4 ? <li className="pl-3.5 text-caption text-ink-2">y {blockers.length - 4} más en la revisión automática.</li> : null}
          </ul>
        </div>
      ) : null}

      {error ? <Notice tone="error">{error}</Notice> : null}

      {status === "DRAFT" && can.write ? (
        <Button onClick={() => act("submit", "submit")} loading={pending === "submit"} disabled={blocked || pending !== null} className="w-full">
          Enviar a revisión
        </Button>
      ) : null}

      {approvable && can.approve ? (
        <div className="flex flex-col gap-2">
          <Button onClick={() => act("approve", "approve", { versionId: version?.id })} loading={pending === "approve"} disabled={blocked || pending !== null} className="w-full">
            {pending === "approve" ? "Fijando texto e imágenes" : `Aprobar versión ${version?.number}`}
          </Button>
          {status === "PENDING_APPROVAL" && can.requestChanges ? (
            <Button variant="secondary" onClick={() => setChangesOpen(true)} disabled={pending !== null} className="w-full">
              Pedir cambios
            </Button>
          ) : null}
        </div>
      ) : null}

      <Modal open={changesOpen} onOpenChange={setChangesOpen} title="Pedir cambios" description={`La pieza vuelve a borrador con tu pedido como comentario sobre la versión ${version?.number}.`}>
        <form onSubmit={onRequestChanges} className="flex flex-col gap-5" noValidate>
          <Field id="change-note" label="Qué hay que cambiar" error={noteError ?? undefined}>
            <Textarea id="change-note" name="note" rows={4} maxLength={1000} required aria-invalid={noteError ? true : undefined} placeholder="Por ejemplo: la portada promete un dato que no tenemos. Usemos el caso de la clínica." />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setChangesOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending === "changes"}>
              Enviar pedido
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
