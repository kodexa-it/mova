"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { AddRowButton, RepeaterRow, TagInput } from "@/components/brand/inputs";
import { ComposePanel } from "@/components/content/compose-panel";
import { InstagramPreview } from "@/components/content/instagram-preview";
import { PieceSidePanel, type SideTab } from "@/components/content/piece-side-panel";
import { useLivePreview } from "@/components/content/use-live-preview";
import { GeneratePanel, type GenerationState } from "@/components/content/generate-panel";
import { LayoutPicker } from "@/components/content/layout-picker";
import { ValidationPanel, type FixActions } from "@/components/content/validation-panel";
import { ArtContext } from "@/components/content/visual-mode";
import { VisualPanel } from "@/components/content/visual-panel";
import { Button, Card, Field, Input, Notice, Select, Spinner, Textarea, useToast } from "@/components/ui";
import { apiRequest } from "@/lib/errors";
import {
  FORMAT_SCHEMAS,
  REEL_TARGETS,
  STICKER_LABELS,
  STICKERS,
  type AnyContent,
  type Format,
  type FormatContent,
} from "@/modules/content/formats";
import { isFixable } from "@/modules/content/fixes";
import { isArtLayout, slotsOf, styleOf, suggestDesigns, withDesigns, withoutDesigns, type Design, type PieceStyle, type ProofSnapshot } from "@/modules/content/layouts";
import { frameLabel } from "@/modules/content/render/frames";
import { validateContent } from "@/modules/content/validators";
import { FEED_WINDOW } from "@/modules/content/validators/caption";
import { timeline } from "@/modules/content/validators/reel";

type Updater<T> = (patch: Partial<T>) => void;

// Antes de guardar: los hooks vacíos no se guardan y la elección se reubica.
function normalize(format: Format, value: AnyContent): AnyContent {
  if (format !== "REEL") return value;
  const reel = value as FormatContent<"REEL">;
  const chosen = reel.hooks[reel.selectedHook] ?? "";
  const hooks = reel.hooks.map((h) => h.trim()).filter(Boolean);
  const selectedHook = Math.max(0, hooks.indexOf(chosen.trim()));
  return { ...reel, hooks, selectedHook };
}

function move<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-lead font-semibold text-ink">{children}</h2>;
}

function CaptionFields({ value, update, readOnly }: { value: AnyContent; update: Updater<AnyContent>; readOnly: boolean }) {
  const length = value.caption.trim().length;
  return (
    <div className="flex flex-col gap-5">
      <SectionTitle>Caption</SectionTitle>
      <Field id="caption" label="Texto de la publicación" hint={`${length} de 2200. En el feed se ven los primeros ~${FEED_WINDOW} caracteres: ahí va el gancho.`}>
        <Textarea id="caption" className="min-h-40" value={value.caption} maxLength={2200} onChange={(e) => update({ caption: e.target.value })} />
      </Field>
      {value.caption.trim() ? (
        <div className="rounded-[10px] bg-pearl/60 px-3.5 py-3 text-small text-ink">
          <p className="mb-1 text-caption text-ink-2">Así se ve en el feed antes de &quot;más&quot;</p>
          <p className="whitespace-pre-line">
            {value.caption.trim().slice(0, FEED_WINDOW)}
            {length > FEED_WINDOW ? <span className="text-ink-2">… más</span> : null}
          </p>
        </div>
      ) : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="hashtags" label="Hashtags" hint="Hasta 5, sobre el tema. Enter para agregar.">
          <TagInput id="hashtags" value={value.hashtags} onChange={(next) => update({ hashtags: next.map((t) => t.replace(/^#/, "")) })} max={5} disabled={readOnly} placeholder="automatizacion" />
        </Field>
        <Field id="alt" label="Texto alternativo" hint="Describe la imagen para quien usa lector de pantalla.">
          <Textarea id="alt" className="min-h-[2.5rem]" value={value.altText} onChange={(e) => update({ altText: e.target.value })} />
        </Field>
      </div>
    </div>
  );
}

// Lugar de cada imagen (rol, título y texto) para el selector de composición.
const slotAt = (format: Format, value: AnyContent, index: number) => slotsOf(format, value as unknown as Record<string, unknown>)[index]!.slot;

// Miniaturas de cada imagen junto a sus campos: muestran la versión guardada y
// marcan si hay cambios sin guardar. Un clic la muestra en la vista previa.
const Media = createContext<{ thumbs: (string | null)[]; changed: (i: number) => boolean; onPreview: (i: number) => void } | null>(null);

function Thumb({ index, ratio, label }: { index: number; ratio: string; label: string }) {
  const media = useContext(Media);
  if (!media) return null;
  const src = media.thumbs[index];
  return (
    <button
      type="button"
      onClick={() => media.onPreview(index)}
      aria-label={`Ver ${label} en la vista previa`}
      className="group relative block w-full overflow-hidden rounded-[8px] bg-pearl shadow-raised transition-transform duration-[var(--dur-fast)] hover:-translate-y-0.5 focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none"
      style={{ aspectRatio: ratio }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- PNG dinámico de la API
        <img src={src} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" />
      ) : (
        <span className="absolute inset-0 grid place-items-center p-2 text-center text-[11px] text-ink-3">Sin texto</span>
      )}
      {media.changed(index) ? <span className="absolute inset-x-1 bottom-1 rounded-[5px] bg-ink/75 px-1 py-0.5 text-center text-[10px] font-medium text-white">Sin guardar</span> : null}
    </button>
  );
}

function FeedImageFields({ value, update, proofs, readOnly }: { value: FormatContent<"FEED_IMAGE">; update: Updater<FormatContent<"FEED_IMAGE">>; proofs: ProofSnapshot[]; readOnly: boolean }) {
  return (
    <div className="flex flex-col gap-5">
      <SectionTitle>Imagen</SectionTitle>
      <Field id="headline" label="Titular en la imagen" hint="Corto: se lee en el feed en un segundo.">
        <Input id="headline" value={value.headline} maxLength={80} onChange={(e) => update({ headline: e.target.value })} />
      </Field>
      <Field id="subline" label="Bajada" hint="Opcional.">
        <Input id="subline" value={value.subline} maxLength={140} onChange={(e) => update({ subline: e.target.value })} />
      </Field>
      <Field id="visual" label="Indicaciones visuales" hint="Qué foto o recurso acompaña. Opcional.">
        <Textarea id="visual" className="min-h-20" value={value.visualNotes} onChange={(e) => update({ visualNotes: e.target.value })} />
      </Field>
      <LayoutPicker id="img" index={0} slot={slotAt("FEED_IMAGE", value, 0)} design={value.design} proofs={proofs} disabled={readOnly} onChange={(design) => update({ design })} />
    </div>
  );
}

function CarouselFields({ value, update, readOnly, proofs }: { value: FormatContent<"CAROUSEL">; update: Updater<FormatContent<"CAROUSEL">>; readOnly: boolean; proofs: ProofSnapshot[] }) {
  const set = (i: number, patch: Partial<{ kicker: string; title: string; body: string; design: Design | undefined }>) => update({ slides: value.slides.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  return (
    <div className="flex flex-col gap-4">
      <SectionTitle>Slides</SectionTitle>
      <p className="-mt-2 text-caption text-ink-2">
        Marcá entre *asteriscos* las palabras que querés destacar en el color de la marca (se ven con el estilo Impacto).
      </p>
      {value.slides.map((slide, i) => (
        <RepeaterRow
          key={i}
          index={i}
          total={value.slides.length}
          label={i === 0 ? "Portada · slide" : "Slide"}
          canRemove={value.slides.length > 3}
          disabled={readOnly}
          onMove={(from, to) => update({ slides: move(value.slides, from, to) })}
          onRemove={(idx) => update({ slides: value.slides.filter((_, j) => j !== idx) })}
        >
          <div className="grid gap-4 sm:grid-cols-[6rem_minmax(0,1fr)]">
            <div className="hidden sm:block">
              <Thumb index={i} ratio="4 / 5" label={`la slide ${i + 1}`} />
            </div>
            <div className="flex min-w-0 flex-col gap-3">
              <Field id={`s-${i}-k`} label="Etiqueta (opcional)" hint={i === 0 ? "Una o tres palabras sobre el título, por ejemplo: PREGUNTA INCÓMODA." : undefined}>
                <Input id={`s-${i}-k`} value={slide.kicker ?? ""} maxLength={40} onChange={(e) => set(i, { kicker: e.target.value })} />
              </Field>
              <Field id={`s-${i}-t`} label={i === 0 ? "Portada" : "Título"} hint={i === 0 ? "6 palabras o menos: es lo que se ve en el feed." : undefined}>
                <Input id={`s-${i}-t`} value={slide.title} maxLength={80} onChange={(e) => set(i, { title: e.target.value })} />
              </Field>
              <Field id={`s-${i}-b`} label="Texto" hint={i === 1 ? "Una idea por slide. Para pasos, listas o comparaciones, un punto por línea." : undefined}>
                <Textarea id={`s-${i}-b`} className="min-h-[4.5rem]" rows={2} value={slide.body} maxLength={260} onChange={(e) => set(i, { body: e.target.value })} />
              </Field>
              <LayoutPicker id={`s-${i}`} index={i} slot={slotAt("CAROUSEL", value, i)} design={slide.design} proofs={proofs} disabled={readOnly} onChange={(design) => set(i, { design })} />
            </div>
          </div>
        </RepeaterRow>
      ))}
      {!readOnly ? (
        <AddRowButton disabled={value.slides.length >= 10} onClick={() => update({ slides: [...value.slides, { title: "", body: "" }] })}>
          Agregar slide
        </AddRowButton>
      ) : null}
    </div>
  );
}

function ReelFields({ value, update, readOnly, proofs }: { value: FormatContent<"REEL">; update: Updater<FormatContent<"REEL">>; readOnly: boolean; proofs: ProofSnapshot[] }) {
  const beats = timeline(value.script.map((l) => l.say));
  const setLine = (i: number, patch: Partial<{ say: string; onScreen: string }>) => update({ script: value.script.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  const hooks = [...value.hooks, "", "", ""].slice(0, 3);
  let beatIndex = 0;
  return (
    <div className="flex flex-col gap-5">
      <SectionTitle>Hooks</SectionTitle>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-small text-ink-2">Tres opciones para la primera línea. Elegí con cuál se graba.</legend>
        {hooks.map((hook, i) => (
          <div key={i} className="flex items-center gap-3">
            <input
              type="radio"
              name="selectedHook"
              aria-label={`Usar el hook ${i + 1}`}
              checked={value.selectedHook === i}
              onChange={() => update({ selectedHook: i })}
              className="size-4 shrink-0 accent-[var(--color-accent)]"
            />
            <Input aria-label={`Hook ${i + 1}`} value={hook} maxLength={140} placeholder={`Hook ${i + 1}`} onChange={(e) => update({ hooks: hooks.map((h, j) => (j === i ? e.target.value : h)) })} />
          </div>
        ))}
      </fieldset>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="target" label="Duración objetivo">
          <Select id="target" value={value.targetSeconds} onChange={(e) => update({ targetSeconds: Number(e.target.value) })}>
            {REEL_TARGETS.map((n) => (
              <option key={n} value={n}>
                {n} segundos
              </option>
            ))}
          </Select>
        </Field>
        <Field id="cover" label="Texto de portada" hint="Lo que se ve en la grilla del perfil.">
          <Input id="cover" value={value.coverText} maxLength={60} onChange={(e) => update({ coverText: e.target.value })} />
        </Field>
      </div>
      <LayoutPicker id="reel" index={0} slot={slotAt("REEL", value, 0)} design={value.design} proofs={proofs} disabled={readOnly} onChange={(design) => update({ design })} />
      <SectionTitle>Guion</SectionTitle>
      {value.script.map((line, i) => {
        const beat = line.say.trim() ? beats[beatIndex++] : undefined;
        return (
          <RepeaterRow
            key={i}
            index={i}
            total={value.script.length}
            label="Línea"
            canRemove={value.script.length > 2}
            disabled={readOnly}
            onMove={(from, to) => update({ script: move(value.script, from, to) })}
            onRemove={(idx) => update({ script: value.script.filter((_, j) => j !== idx) })}
          >
            <Field id={`l-${i}-say`} label="Qué se dice" hint={beat ? `De ${beat.start.toFixed(1)} s a ${(beat.start + beat.duration).toFixed(1)} s (${beat.duration.toFixed(1)} s)` : undefined}>
              <Textarea id={`l-${i}-say`} className="min-h-16" value={line.say} maxLength={280} onChange={(e) => setLine(i, { say: e.target.value })} />
            </Field>
            <Field id={`l-${i}-scr`} label="Texto en pantalla" hint="Opcional.">
              <Input id={`l-${i}-scr`} value={line.onScreen} maxLength={80} onChange={(e) => setLine(i, { onScreen: e.target.value })} />
            </Field>
          </RepeaterRow>
        );
      })}
      {!readOnly ? (
        <AddRowButton disabled={value.script.length >= 30} onClick={() => update({ script: [...value.script, { say: "", onScreen: "" }] })}>
          Agregar línea
        </AddRowButton>
      ) : null}
    </div>
  );
}

function StoryFields({ value, update, readOnly, proofs }: { value: FormatContent<"STORY">; update: Updater<FormatContent<"STORY">>; readOnly: boolean; proofs: ProofSnapshot[] }) {
  const set = (i: number, patch: Partial<FormatContent<"STORY">["frames"][number]>) => update({ frames: value.frames.map((f, j) => (j === i ? { ...f, ...patch } : f)) });
  return (
    <div className="flex flex-col gap-4">
      <SectionTitle>Frames</SectionTitle>
      {value.frames.map((frame, i) => (
        <RepeaterRow
          key={i}
          index={i}
          total={value.frames.length}
          label="Frame"
          canRemove={value.frames.length > 3}
          disabled={readOnly}
          onMove={(from, to) => update({ frames: move(value.frames, from, to) })}
          onRemove={(idx) => update({ frames: value.frames.filter((_, j) => j !== idx) })}
        >
          <div className="grid gap-4 sm:grid-cols-[4.5rem_minmax(0,1fr)]">
            <div className="hidden sm:block">
              <Thumb index={i} ratio="9 / 16" label={`el frame ${i + 1}`} />
            </div>
            <div className="flex min-w-0 flex-col gap-3">
          <Field id={`f-${i}-t`} label="Texto">
            <Textarea id={`f-${i}-t`} className="min-h-16" value={frame.text} maxLength={200} onChange={(e) => set(i, { text: e.target.value })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
            <Field id={`f-${i}-s`} label="Sticker">
              <Select id={`f-${i}-s`} value={frame.sticker} onChange={(e) => set(i, { sticker: e.target.value as (typeof STICKERS)[number] })}>
                {STICKERS.map((s) => (
                  <option key={s} value={s}>
                    {STICKER_LABELS[s]}
                  </option>
                ))}
              </Select>
            </Field>
            {frame.sticker !== "NONE" ? (
              <Field id={`f-${i}-st`} label="Texto del sticker" hint="Se agrega a mano al publicar.">
                <Input id={`f-${i}-st`} value={frame.stickerText} maxLength={80} onChange={(e) => set(i, { stickerText: e.target.value })} />
              </Field>
            ) : null}
          </div>
          <LayoutPicker id={`f-${i}`} index={i} slot={slotAt("STORY", value, i)} design={frame.design} proofs={proofs} disabled={readOnly} onChange={(design) => set(i, { design })} />
            </div>
          </div>
        </RepeaterRow>
      ))}
      {!readOnly ? (
        <AddRowButton disabled={value.frames.length >= 7} onClick={() => update({ frames: [...value.frames, { text: "", sticker: "NONE", stickerText: "" }] })}>
          Agregar frame
        </AddRowButton>
      ) : null}
    </div>
  );
}

export interface EditorMedia {
  savedSrcs: (string | null)[];
  brandName: string;
  brandColor: string;
  downloads: ReactNode;
}

export function ContentEditor({
  slug,
  itemId,
  format,
  initial,
  wordsToAvoid,
  readOnly,
  lockedReason,
  generation,
  review,
  proofs,
  composeAi,
  media,
  comments,
  commentsCount,
  versions,
  fixBlocked,
  visual,
}: {
  slug: string;
  itemId: string;
  format: Format;
  initial: AnyContent;
  wordsToAvoid: string[];
  readOnly: boolean;
  lockedReason?: string;
  generation: GenerationState;
  review?: ReactNode;
  proofs: ProofSnapshot[];
  composeAi: boolean;
  media: EditorMedia;
  comments: ReactNode;
  commentsCount: number;
  versions: ReactNode;
  fixBlocked?: string;
  // Modo visual de la pieza y estilo sugerido por la marca.
  visual: { mode: "STANDARD" | "AI"; suggested: PieceStyle };
}) {
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState<AnyContent>(initial);
  const [saved, setSaved] = useState(() => JSON.stringify(initial));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [tab, setTab] = useState<SideTab>("preview");
  const [previewIndex, setPreviewIndex] = useState(0);
  const [fixing, setFixing] = useState<string | null>(null);
  const [mode, setMode] = useState(visual.mode);
  const [modePending, setModePending] = useState(false);
  const dirty = JSON.stringify(value) !== saved;
  const report = useMemo(() => validateContent(format, value, { wordsToAvoid, proofs }), [format, value, wordsToAvoid, proofs]);
  const update = useCallback((patch: Partial<AnyContent>) => setValue((prev) => ({ ...prev, ...patch }) as AnyContent), []);

  const live = useLivePreview({ slug, itemId, format, value, dirty, savedSrcs: media.savedSrcs, current: previewIndex, enabled: !readOnly });
  const savedSlots = useMemo(() => slotsOf(format, JSON.parse(saved) as Record<string, unknown>), [format, saved]);
  const currentSlots = useMemo(() => slotsOf(format, value as unknown as Record<string, unknown>), [format, value]);
  const mediaContext = useMemo(
    () => ({
      thumbs: media.savedSrcs,
      changed: (i: number) => JSON.stringify(currentSlots[i] ?? null) !== JSON.stringify(savedSlots[i] ?? null),
      onPreview: (i: number) => {
        setPreviewIndex(i);
        setTab("preview");
      },
    }),
    [media.savedSrcs, currentSlots, savedSlots],
  );

  const save = useCallback(async () => {
    if (readOnly || pending || !dirty) return;
    const parsed = FORMAT_SCHEMAS[format].safeParse(normalize(format, value));
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisá los campos.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await apiRequest<{ changed: boolean; version?: { number: number } }>(`/api/w/${slug}/content/${itemId}/versions`, {
      method: "POST",
      body: { content: parsed.data },
    });
    setPending(false);
    if (!result.ok) return setError(result.message);
    setSaved(JSON.stringify(value));
    toast.success(result.data.version ? `Versión ${result.data.version.number} guardada` : "Sin cambios para guardar");
    router.refresh();
  }, [readOnly, pending, dirty, format, value, slug, itemId, toast, router]);

  // Corregir sugerencias: con Mova sobre la versión guardada, o la composición
  // de una imagen con la sugerencia automática (queda en el editor sin guardar).
  const fix: FixActions | undefined = readOnly
    ? undefined
    : {
        kindOf: (check) => (check.id.startsWith("layout.") ? "layout" : composeAi && isFixable(check, format) ? "ai" : null),
        pending: fixing,
        disabledReason: dirty ? "Guardá los cambios primero: Mova corrige la versión guardada." : fixBlocked,
        onFix: async (ids) => {
          setFixing(ids.length > 1 ? "all" : ids[0]!);
          const result = await apiRequest<{ changed: boolean; version?: { number: number }; fixed: string[] }>(`/api/w/${slug}/content/${itemId}/fix`, { method: "POST", body: { checks: ids } });
          setFixing(null);
          if (!result.ok) return toast.error(result.message);
          toast.success(result.data.changed ? `Mova corrigió ${result.data.fixed.length === 1 ? "la sugerencia" : `${result.data.fixed.length} sugerencias`} en la versión ${result.data.version?.number}` : "La corrección quedó igual a la versión actual");
          router.refresh();
        },
        onFixLayout: (checkId) => {
          const index = Number(checkId.split(".")[1]);
          const suggestion = suggestDesigns(format, withoutDesigns(format, value as unknown as Record<string, unknown>), { proofs })[index];
          const designs = currentSlots.map((slot, i) => (i === index ? suggestion : slot.design));
          setValue(withDesigns(format, value as unknown as Record<string, unknown>, designs) as unknown as AnyContent);
          toast.success("Composición cambiada", "Guardá la versión para aplicarla.");
        },
      };

  // Modo visual: se guarda al instante (no crea versión ni cobra nada). Al
  // volver al estándar, las imágenes generadas se reemplazan en el editor por
  // la composición sugerida; quedan guardadas para volver a elegirlas.
  const changeMode = useCallback(
    async (next: "STANDARD" | "AI") => {
      setModePending(true);
      const result = await apiRequest(`/api/w/${slug}/content/${itemId}`, { method: "PATCH", body: { visualMode: next } });
      setModePending(false);
      if (!result.ok) return toast.error(result.message);
      setMode(next);
      if (next === "STANDARD") {
        const plain = withoutDesigns(format, value as unknown as Record<string, unknown>);
        const suggestion = suggestDesigns(format, plain, { proofs });
        const designs = currentSlots.map((slot, i) => (isArtLayout(slot.design?.layout) ? suggestion[i] : slot.design));
        if (designs.some((d, i) => d !== currentSlots[i]!.design)) {
          setValue(withDesigns(format, value as unknown as Record<string, unknown>, designs) as unknown as AnyContent);
          toast.success("Modo estándar", "Las imágenes con IA se reemplazaron por composiciones estándar. Guardá la versión para aplicarlo.");
        } else toast.success("Modo estándar", "Sin imágenes generadas ni costo.");
      } else toast.success("Generación visual con IA activada", "Cada imagen muestra su costo y se confirma antes de generarla.");
      router.refresh();
    },
    [slug, itemId, toast, format, value, proofs, currentSlots, router],
  );
  const artContext = useMemo(
    () => ({ enabled: mode === "AI" && !readOnly, slug, itemId, format, content: normalize(format, value), backToStandard: () => void changeMode("STANDARD") }),
    [mode, readOnly, slug, itemId, format, value, changeMode],
  );
  const hasArt = currentSlots.some((slot) => isArtLayout(slot.design?.layout));

  // Cmd/Ctrl + S guarda.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  // Avisa antes de salir con cambios sin guardar.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const kind = format === "STORY" ? "story" : format === "REEL" ? "reel" : "feed";
  const issues = report.checks.filter((c) => c.status !== "pass").length;
  const statusLine =
    readOnly || !dirty ? null : (
      <p className="flex items-center gap-2 text-caption text-ink-2" aria-live="polite">
        {live.status === "updating" ? <Spinner className="size-3.5" /> : <span aria-hidden className={`size-1.5 rounded-full ${live.status === "live" ? "bg-success" : "bg-warning"}`} />}
        {live.status === "updating" ? "Actualizando la vista previa…" : live.status === "live" ? "Vista previa de los cambios sin guardar" : "Completá los campos obligatorios para ver los cambios"}
      </p>
    );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
      <div className="flex min-w-0 flex-col gap-5">
        {!readOnly ? (
          <div className="grid gap-3 lg:grid-cols-2">
            <GeneratePanel slug={slug} itemId={itemId} state={generation} dirty={dirty} />
            <ComposePanel slug={slug} itemId={itemId} aiEnabled={composeAi} dirty={dirty} />
          </div>
        ) : null}
        <VisualPanel
          mode={mode}
          onMode={(next) => void changeMode(next)}
          style={styleOf(value as unknown as Record<string, unknown>)}
          onStyle={(style) => update({ style } as Partial<AnyContent>)}
          suggested={visual.suggested}
          hasArt={hasArt}
          readOnly={readOnly}
          pending={modePending}
        />
        <Card className="p-5 sm:p-6">
          {lockedReason ? (
            <div className="mb-5">
              <Notice tone="info">{lockedReason}</Notice>
            </div>
          ) : null}
          {error ? (
            <div className="mb-5">
              <Notice tone="error">{error}</Notice>
            </div>
          ) : null}
          <ArtContext.Provider value={artContext}>
          <Media.Provider value={mediaContext}>
            <fieldset disabled={readOnly} className="flex flex-col gap-7">
              {format === "FEED_IMAGE" ? <FeedImageFields value={value as FormatContent<"FEED_IMAGE">} update={update as Updater<FormatContent<"FEED_IMAGE">>} proofs={proofs} readOnly={readOnly} /> : null}
              {format === "CAROUSEL" ? <CarouselFields value={value as FormatContent<"CAROUSEL">} update={update as Updater<FormatContent<"CAROUSEL">>} readOnly={readOnly} proofs={proofs} /> : null}
              {format === "REEL" ? <ReelFields value={value as FormatContent<"REEL">} update={update as Updater<FormatContent<"REEL">>} readOnly={readOnly} proofs={proofs} /> : null}
              {format === "STORY" ? <StoryFields value={value as FormatContent<"STORY">} update={update as Updater<FormatContent<"STORY">>} readOnly={readOnly} proofs={proofs} /> : null}
              <div className="h-px bg-line" />
              <CaptionFields value={value} update={update} readOnly={readOnly} />
            </fieldset>
          </Media.Provider>
          </ArtContext.Provider>
          {!readOnly ? (
            <div className="sticky bottom-0 -mx-5 -mb-5 mt-7 flex flex-wrap items-center justify-between gap-3 rounded-b-[var(--radius-card)] border-t border-line bg-surface/90 px-5 py-3.5 backdrop-blur sm:-mx-6 sm:-mb-6 sm:px-6">
              <p className="text-small text-ink-2" aria-live="polite">
                {dirty ? "Cambios sin guardar" : "Todo guardado"}
              </p>
              <Button onClick={save} loading={pending} disabled={!dirty}>
                Guardar versión
              </Button>
            </div>
          ) : null}
        </Card>
        {media.downloads}
      </div>
      <aside className="min-w-0 xl:sticky xl:top-24 xl:max-h-[calc(100dvh-7rem)] xl:self-start xl:overflow-y-auto xl:pb-2">
        <PieceSidePanel
          tab={tab}
          onTab={setTab}
          badges={{ review: issues || undefined, comments: commentsCount || undefined }}
          panels={{
            preview: (
              <InstagramPreview
                kind={kind}
                images={live.srcs.map((src, i) => ({ src, label: frameLabel(format, live.labels[i]!) }))}
                name={media.brandName}
                color={media.brandColor}
                caption={value.caption}
                hashtags={value.hashtags}
                index={previewIndex}
                onIndexChange={setPreviewIndex}
                stacked
                status={statusLine}
              />
            ),
            review: (
              <div className="flex flex-col gap-6">
                {review ? (
                  <div>
                    {review}
                    {dirty ? <p className="mt-3 text-caption text-ink-2">Hay cambios sin guardar: la revisión es sobre la última versión guardada.</p> : null}
                  </div>
                ) : null}
                <div className="border-t border-line pt-5">
                  <h3 className="mb-3 text-small font-medium text-ink">Revisión automática</h3>
                  <ValidationPanel report={report} fix={fix} />
                </div>
              </div>
            ),
            comments,
            versions,
          }}
        />
      </aside>
    </div>
  );
}
