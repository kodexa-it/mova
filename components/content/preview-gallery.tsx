import { frameLabel, framesOf, isBlankFrame, sizeOf } from "@/modules/content/render/frames";
import type { AnyContent, Format } from "@/modules/content/formats";

export function savedImageSrc(slug: string, itemId: string, versionId: string, paletteStamp: string, index: number) {
  return `/api/w/${slug}/content/${itemId}/render/${index}?v=${versionId}&p=${paletteStamp}`;
}

// Imágenes de la versión guardada, para abrir o descargar una por una. Plegado
// por defecto: la vista previa principal está en la columna lateral.
export function PreviewGallery({
  slug,
  itemId,
  versionId,
  format,
  content,
  paletteStamp,
}: {
  slug: string;
  itemId: string;
  versionId: string;
  format: Format;
  content: AnyContent;
  paletteStamp: string;
}) {
  const frames = framesOf(format, content);
  return (
    <details className="group rounded-[var(--radius-card)] bg-surface shadow-raised">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-[var(--radius-card)] px-5 py-4 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-small font-medium text-ink">Imágenes para descargar</span>
          <span className="block text-caption text-ink-2">
            {frames.length} {frames.length === 1 ? "imagen" : "imágenes"} de la versión guardada, en PNG de 1080 px.
          </span>
        </span>
        <svg aria-hidden viewBox="0 0 16 16" className="size-4 text-ink-2 transition-transform duration-[var(--dur-fast)] group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="m4.5 6.5 3.5 3.5 3.5-3.5" />
        </svg>
      </summary>
      <ul className="flex gap-4 overflow-x-auto px-5 pb-5">
        {frames.map((frame, i) => {
          const size = sizeOf(frame);
          const src = savedImageSrc(slug, itemId, versionId, paletteStamp, i);
          const label = frameLabel(format, frame);
          if (isBlankFrame(frame)) {
            return (
              <li key={i} className="flex w-36 shrink-0 flex-col gap-2">
                <div
                  className="flex items-center justify-center rounded-[10px] border border-dashed border-line-strong bg-pearl/60 p-4 text-center text-caption text-ink-2"
                  style={{ aspectRatio: `${size.width} / ${size.height}` }}
                >
                  Falta el texto de esta imagen
                </div>
                <span className="text-caption text-ink-2">{label}</span>
              </li>
            );
          }
          return (
            <li key={i} className="flex w-36 shrink-0 flex-col gap-2">
              <a href={src} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-[10px] bg-pearl shadow-raised transition-transform duration-[var(--dur-fast)] hover:-translate-y-0.5">
                {/* eslint-disable-next-line @next/next/no-img-element -- PNG dinámico de la API, no hace falta optimizarlo */}
                <img src={src} alt={`${label} de la pieza`} width={size.width} height={size.height} loading="lazy" className="h-auto w-full" />
              </a>
              <div className="flex items-center justify-between text-caption">
                <span className="text-ink-2">{label}</span>
                <a href={src} download={`${String(i + 1).padStart(2, "0")}-${label.toLowerCase().replace(/\s+/g, "-")}.png`} className="font-medium text-accent underline-offset-4 hover:underline">
                  Descargar
                </a>
              </div>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
