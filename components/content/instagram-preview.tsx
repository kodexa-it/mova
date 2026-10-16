"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { initials } from "@/components/app/initials";
import { FEED_WINDOW } from "@/modules/content/validators/caption";

export interface PreviewImage {
  src: string | null; // null: imagen sin texto todavía
  label: string;
}

type Kind = "feed" | "story" | "reel";

// Íconos de interfaz genéricos (contornos simples, no la marca de Instagram).
const UI: Record<string, ReactNode> = {
  heart: <path d="M12 20s-7.5-4.6-7.5-10.1A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.7C19.5 15.4 12 20 12 20z" />,
  comment: <path d="M20 11.5a8 8 0 0 1-11.6 7.1L4 20l1.4-4.2A8 8 0 1 1 20 11.5z" />,
  send: <path d="M21 3.5 10.2 13.8M21 3.5l-6.8 17-4-6.7-6.7-4z" />,
  save: <path d="M6 3.5h12v17l-6-4.5-6 4.5z" />,
  more: (
    <>
      <circle cx="5.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="18.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  prev: <path d="m14.5 6-6 6 6 6" />,
  next: <path d="m9.5 6 6 6-6 6" />,
};

function Glyph({ name, className = "size-6" }: { name: keyof typeof UI; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {UI[name]}
    </svg>
  );
}

function Avatar({ name, color, size = "size-8" }: { name: string; color: string; size?: string }) {
  return (
    <span aria-hidden className={`grid ${size} shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white ring-2 ring-white`} style={{ background: color }}>
      {initials(name)}
    </span>
  );
}

function Missing({ label, ratio }: { label: string; ratio: string }) {
  return (
    <div className="flex items-center justify-center bg-[#efefef] p-6 text-center text-[13px] text-[#737373]" style={{ aspectRatio: ratio }}>
      {label}: falta el texto
    </div>
  );
}

// Carrusel deslizable (en el teléfono se arrastra con el dedo; en la
// computadora, con las flechas o el teclado).
function Slides({ images, ratio, index, onIndex }: { images: PreviewImage[]; ratio: string; index: number; onIndex: (i: number) => void }) {
  const scroller = useRef<HTMLDivElement>(null);
  const go = (i: number) => {
    const el = scroller.current;
    if (!el) return;
    const next = Math.max(0, Math.min(images.length - 1, i));
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  };
  // Si el índice cambia desde afuera (clic en una slide del editor), se desliza ahí.
  useEffect(() => {
    const el = scroller.current;
    if (el && Math.round(el.scrollLeft / Math.max(1, el.clientWidth)) !== index) el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
  }, [index]);
  return (
    <div className="group relative">
      <div
        ref={scroller}
        tabIndex={images.length > 1 ? 0 : -1}
        aria-label={images.length > 1 ? "Imágenes de la publicación: usá las flechas para pasar" : undefined}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(index + 1);
          if (e.key === "ArrowLeft") go(index - 1);
        }}
        onScroll={(e) => {
          const el = e.currentTarget;
          const i = Math.round(el.scrollLeft / el.clientWidth);
          if (i !== index) onIndex(i);
        }}
        className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] focus-visible:outline-none [&::-webkit-scrollbar]:hidden"
      >
        {images.map((img, i) => (
          <div key={i} className="w-full shrink-0 snap-center">
            {img.src ? (
              // eslint-disable-next-line @next/next/no-img-element -- PNG dinámico de la API
              <img src={img.src} alt={img.label} className="block h-auto w-full" style={{ aspectRatio: ratio }} loading={i < 2 ? "eager" : "lazy"} draggable={false} />
            ) : (
              <Missing label={img.label} ratio={ratio} />
            )}
          </div>
        ))}
      </div>
      {images.length > 1 ? (
        <>
          <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/60 px-2 py-0.5 text-[12px] font-medium text-white tabular-nums">
            {index + 1}/{images.length}
          </span>
          {index > 0 ? (
            <button type="button" onClick={() => go(index - 1)} aria-label="Imagen anterior" className="absolute left-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-[#262626] shadow opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100">
              <Glyph name="prev" className="size-4" />
            </button>
          ) : null}
          {index < images.length - 1 ? (
            <button type="button" onClick={() => go(index + 1)} aria-label="Imagen siguiente" className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-[#262626] shadow opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100">
              <Glyph name="next" className="size-4" />
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function Caption({ name, caption, hashtags }: { name: string; caption: string; hashtags: string[] }) {
  const [open, setOpen] = useState(false);
  const tags = hashtags.map((t) => `#${t.replace(/^#/, "")}`);
  const text = caption.trim();
  const long = text.length > FEED_WINDOW;
  if (!text && !tags.length) return <p className="text-[13px] text-[#737373]">Sin caption todavía.</p>;
  return (
    <p className="whitespace-pre-line break-words text-[13px] leading-[18px] text-[#262626]">
      <span className="font-semibold">{name}</span> {open || !long ? text : `${text.slice(0, FEED_WINDOW).trimEnd()}…`}
      {long && !open ? (
        <button type="button" onClick={() => setOpen(true)} className="ml-1 text-[#737373]">
          más
        </button>
      ) : null}
      {(open || !long) && tags.length ? <span className="text-[#00376b]">{`\n${tags.join(" ")}`}</span> : null}
    </p>
  );
}

function FeedPost({ images, name, color, caption, hashtags, index, onIndex }: { images: PreviewImage[]; name: string; color: string; caption: string; hashtags: string[]; index: number; onIndex: (i: number) => void }) {
  return (
    <article className="w-full bg-white text-[#262626]">
      <header className="flex items-center gap-2.5 px-3 py-2.5">
        <Avatar name={name} color={color} />
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{name}</span>
        <Glyph name="more" className="size-5" />
      </header>
      <Slides images={images} ratio="4 / 5" index={index} onIndex={onIndex} />
      <div className="flex items-center px-3 pt-2.5">
        <div className="flex flex-1 gap-3.5">
          <Glyph name="heart" />
          <Glyph name="comment" />
          <Glyph name="send" />
        </div>
        {images.length > 1 ? (
          <div aria-hidden className="flex flex-1 justify-center gap-1">
            {images.map((_, i) => (
              <span key={i} className={`size-1.5 rounded-full ${i === index ? "bg-[#0095f6]" : "bg-[#c7c7c7]"}`} />
            ))}
          </div>
        ) : (
          <div className="flex-1" />
        )}
        <div className="flex flex-1 justify-end">
          <Glyph name="save" />
        </div>
      </div>
      <div className="px-3 pb-4 pt-2">
        <Caption name={name} caption={caption} hashtags={hashtags} />
      </div>
    </article>
  );
}

function Story({ images, name, color, index, onIndex }: { images: PreviewImage[]; name: string; color: string; index: number; onIndex: (i: number) => void }) {
  const setIndex = onIndex;
  const img = images[Math.min(index, images.length - 1)]!;
  return (
    <div className="relative w-full overflow-hidden bg-black" style={{ aspectRatio: "9 / 16" }}>
      {img.src ? (
        // eslint-disable-next-line @next/next/no-img-element -- PNG dinámico de la API
        <img src={img.src} alt={img.label} className="absolute inset-0 size-full object-cover" draggable={false} />
      ) : (
        <Missing label={img.label} ratio="9 / 16" />
      )}
      <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/35 to-transparent px-2 pb-6 pt-2">
        <div className="flex gap-1">
          {images.map((_, i) => (
            <span key={i} className={`h-0.5 flex-1 rounded-full ${i <= index ? "bg-white" : "bg-white/40"}`} />
          ))}
        </div>
        <div className="mt-2.5 flex items-center gap-2 text-white">
          <Avatar name={name} color={color} size="size-7" />
          <span className="text-[13px] font-semibold">{name}</span>
          <span className="text-[13px] text-white/70">ahora</span>
        </div>
      </div>
      <button type="button" aria-label="Frame anterior" disabled={index === 0} onClick={() => setIndex(index - 1)} className="absolute inset-y-0 left-0 w-1/3 focus-visible:bg-white/10 focus-visible:outline-none" />
      <button type="button" aria-label="Frame siguiente" disabled={index === images.length - 1} onClick={() => setIndex(index + 1)} className="absolute inset-y-0 right-0 w-2/3 focus-visible:bg-white/10 focus-visible:outline-none" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-3 px-3 pb-4 pt-8">
        <span className="flex-1 rounded-full border border-white/60 px-4 py-2 text-[13px] text-white/80">Enviar mensaje</span>
        <Glyph name="heart" className="size-6 text-white" />
        <Glyph name="send" className="size-6 text-white" />
      </div>
    </div>
  );
}

function Reel({ image, name, color, caption }: { image: PreviewImage; name: string; color: string; caption: string }) {
  return (
    <div className="relative w-full overflow-hidden bg-black" style={{ aspectRatio: "9 / 16" }}>
      {image.src ? (
        // eslint-disable-next-line @next/next/no-img-element -- PNG dinámico de la API
        <img src={image.src} alt={image.label} className="absolute inset-0 size-full object-cover" />
      ) : (
        <Missing label={image.label} ratio="9 / 16" />
      )}
      <div className="absolute bottom-24 right-3 flex flex-col items-center gap-5 text-white">
        <Glyph name="heart" className="size-7" />
        <Glyph name="comment" className="size-7" />
        <Glyph name="send" className="size-7" />
        <Glyph name="more" className="size-6" />
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent px-3 pb-4 pt-10 text-white">
        <div className="flex items-center gap-2">
          <Avatar name={name} color={color} size="size-7" />
          <span className="text-[13px] font-semibold">{name}</span>
        </div>
        <p className="mt-2 line-clamp-1 pr-10 text-[13px] text-white/90">{caption.trim() || "Sin caption todavía."}</p>
      </div>
    </div>
  );
}

// Cómo queda la primera imagen en la grilla del perfil: Instagram la recorta a 3:4.
function ProfileGrid({ image }: { image: PreviewImage }) {
  return (
    <div>
      <p className="mb-2 text-caption text-ink-2">En la grilla del perfil (recorte 3:4)</p>
      <div className="grid w-[16rem] grid-cols-3 gap-0.5 bg-white">
        <div className="relative overflow-hidden bg-[#efefef]" style={{ aspectRatio: "3 / 4" }}>
          {image.src ? (
            // eslint-disable-next-line @next/next/no-img-element -- PNG dinámico de la API
            <img src={image.src} alt="" className="absolute inset-0 size-full object-cover" />
          ) : null}
        </div>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-[#efefef]" style={{ aspectRatio: "3 / 4" }} />
        ))}
      </div>
    </div>
  );
}

// Vista previa a escala de teléfono (375 px de ancho, como un iPhone): sirve
// para juzgar si los textos se leen. Sin métricas inventadas: los me gusta y
// comentarios reales aparecen al publicar.
export function InstagramPreview({
  kind,
  images,
  name,
  color,
  caption,
  hashtags,
  index: controlled,
  onIndexChange,
  stacked = false,
  status,
}: {
  kind: Kind;
  images: PreviewImage[];
  name: string;
  color: string;
  caption: string;
  hashtags: string[];
  index?: number;
  onIndexChange?: (i: number) => void;
  stacked?: boolean; // en la columna lateral: notas debajo del teléfono
  status?: ReactNode;
}) {
  const [own, setOwn] = useState(0);
  const index = Math.min(controlled ?? own, Math.max(0, images.length - 1));
  const setIndex = (i: number) => (onIndexChange ? onIndexChange(i) : setOwn(i));
  return (
    <div className={stacked ? "flex flex-col items-center gap-4" : "flex flex-wrap items-start gap-8"}>
      <div className="relative w-[375px] max-w-full overflow-hidden rounded-[28px] border-[6px] border-[#16161a] bg-white shadow-floating">
        {kind === "feed" ? <FeedPost images={images} name={name} color={color} caption={caption} hashtags={hashtags} index={index} onIndex={setIndex} /> : null}
        {kind === "story" ? <Story images={images} name={name} color={color} index={index} onIndex={setIndex} /> : null}
        {kind === "reel" ? <Reel image={images[0]!} name={name} color={color} caption={caption} /> : null}
      </div>
      {status}
      <div className={`flex flex-col gap-4 text-small text-ink-2 ${stacked ? "w-full" : "max-w-xs"}`}>
        <p>Tamaño real de un teléfono: si algo cuesta leerse acá, también va a costar en Instagram.</p>
        {kind === "story" ? <p>Tocá a la derecha o a la izquierda de la imagen para pasar de frame. La barra de arriba y el campo de mensaje tapan los bordes: por eso el texto queda en el centro.</p> : null}
        {kind === "reel" ? <p>Es la portada del Reel. Los íconos de la derecha y el caption de abajo tapan esas zonas.</p> : null}
        {kind !== "story" && images[0] ? <ProfileGrid image={images[0]} /> : null}
      </div>
    </div>
  );
}
