"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { initials } from "@/components/app/initials";
import { Button, Notice, Textarea, useToast } from "@/components/ui";
import { apiRequest } from "@/lib/errors";

export type ThreadEntry =
  | { type: "comment"; id: string; author: string; at: string; body: string; versionNumber: number | null; changeRequest: boolean }
  | { type: "event"; id: string; at: string; text: string; tone: "success" | "warning" | "neutral"; note?: string };

const EVENT_TONE = { success: "bg-success", warning: "bg-[#C98A1E]", neutral: "bg-ink-3" };

// Historial de revisión: comentarios, pedidos de cambio y aprobaciones, en orden.
export function ReviewThread({ slug, itemId, entries, canComment, bare = false }: { slug: string; itemId: string; entries: ThreadEntry[]; canComment: boolean; bare?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim()) return;
    setPending(true);
    setError(null);
    const result = await apiRequest(`/api/w/${slug}/content/${itemId}/comments`, { method: "POST", body: { body } });
    setPending(false);
    if (!result.ok) return setError(result.message);
    setBody("");
    toast.success("Comentario publicado");
    router.refresh();
  }

  return (
    <section aria-labelledby="thread-title" className={bare ? "" : "mt-6 rounded-[var(--radius-card)] bg-surface p-5 shadow-raised"}>
      <h2 id="thread-title" className={bare ? "sr-only" : "text-small font-medium text-ink"}>
        Comentarios y revisión
      </h2>
      <p className={`${bare ? "" : "mt-0.5 "}text-caption text-ink-2`}>Cada comentario queda asociado a la versión que se estaba viendo.</p>

      {entries.length ? (
        <ol className="mt-5 flex flex-col gap-4">
          {entries.map((entry) =>
            entry.type === "comment" ? (
              <li key={entry.id} className="flex gap-3">
                <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-pearl text-caption font-semibold text-ink-2">
                  {initials(entry.author)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-small">
                    <span className="font-medium text-ink">{entry.author}</span>
                    {entry.changeRequest ? <span className="rounded-[var(--radius-badge)] bg-warning-soft px-1.5 py-px text-caption font-medium text-warning">Pidió cambios</span> : null}
                    <span className="tabular text-caption text-ink-2">
                      {entry.at}
                      {entry.versionNumber ? ` · sobre la v${entry.versionNumber}` : ""}
                    </span>
                  </p>
                  <p className="mt-1 whitespace-pre-line text-body text-ink">{entry.body}</p>
                </div>
              </li>
            ) : (
              <li key={entry.id} className="flex items-start gap-3 text-small text-ink-2">
                <span className="grid size-8 shrink-0 place-items-center">
                  <span aria-hidden className={`size-2 rounded-full ${EVENT_TONE[entry.tone]}`} />
                </span>
                <p className="pt-1.5">
                  {entry.text} <span className="tabular text-caption">· {entry.at}</span>
                  {entry.note ? <span className="mt-1 block text-body text-ink">“{entry.note}”</span> : null}
                </p>
              </li>
            ),
          )}
        </ol>
      ) : (
        <p className="mt-4 text-small text-ink-2">Todavía no hay comentarios.</p>
      )}

      {canComment ? (
        <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-2.5 border-t border-line pt-5">
          {error ? <Notice tone="error">{error}</Notice> : null}
          <label htmlFor="comment-body" className="sr-only">
            Comentario
          </label>
          <Textarea
            id="comment-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") e.currentTarget.form?.requestSubmit();
            }}
            maxLength={2000}
            rows={2}
            placeholder="Escribí un comentario para el equipo"
            className="min-h-0!"
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm" loading={pending} disabled={!body.trim()}>
              Comentar
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
