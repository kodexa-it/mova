"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { FORMAT_SCHEMAS, type AnyContent, type Format } from "@/modules/content/formats";
import { framesOf, isBlankFrame } from "@/modules/content/render/frames";

export type LiveStatus = "saved" | "updating" | "live" | "incomplete";

// Imágenes para la vista previa. Sin cambios, son las de la versión guardada
// (con caché). Con cambios sin guardar, después de una pausa al escribir se
// renderizan con el contenido del editor, primero la que se está mirando.
export function useLivePreview({
  slug,
  itemId,
  format,
  value,
  dirty,
  savedSrcs,
  current,
  enabled,
}: {
  slug: string;
  itemId: string;
  format: Format;
  value: AnyContent;
  dirty: boolean;
  savedSrcs: (string | null)[];
  current: number;
  enabled: boolean;
}) {
  const key = useMemo(() => JSON.stringify(value), [value]);
  const frames = useMemo(() => framesOf(format, value), [format, value]);
  const [live, setLive] = useState<{ key: string; srcs: (string | null)[] } | null>(null);
  const [status, setStatus] = useState<LiveStatus>("saved");
  const urls = useRef<string[]>([]);
  const currentRef = useRef(current);
  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  useEffect(() => {
    if (!enabled || !dirty) {
      setStatus("saved");
      return;
    }
    const parsed = FORMAT_SCHEMAS[format].safeParse(value);
    if (!parsed.success) {
      setStatus("incomplete");
      return;
    }
    let cancelled = false;
    setStatus("updating");
    const timer = setTimeout(async () => {
      const order = frames.map((_, i) => i).sort((a, b) => (a === currentRef.current ? -1 : b === currentRef.current ? 1 : a - b));
      const srcs: (string | null)[] = frames.map(() => null);
      for (const index of order) {
        if (cancelled) return;
        if (isBlankFrame(frames[index]!)) continue;
        const res = await fetch(`/api/w/${slug}/content/${itemId}/preview`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ content: parsed.data, index }),
        }).catch(() => null);
        if (cancelled) return;
        if (!res?.ok) {
          setStatus("incomplete");
          return;
        }
        const url = URL.createObjectURL(await res.blob());
        urls.current.push(url);
        srcs[index] = url;
        setLive({ key, srcs: [...srcs] });
      }
      if (!cancelled) setStatus("live");
    }, 700);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, dirty, key, format, value, frames, slug, itemId]);

  // Libera las imágenes temporales al salir.
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const srcs = frames.map((frame, i) => {
    if (isBlankFrame(frame)) return null;
    if (dirty && live?.key === key && live.srcs[i]) return live.srcs[i]!;
    if (dirty && live?.srcs[i]) return live.srcs[i]!; // la anterior mientras se actualiza
    return savedSrcs[i] ?? null;
  });
  return { srcs, status, labels: frames };
}
