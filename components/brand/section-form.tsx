"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";

import { AssistPanel } from "@/components/brand/assist-panel";
import { AddRowButton, Dial, RepeaterRow, TagInput } from "@/components/brand/inputs";
import { useSectionSave, type FieldErrors } from "@/components/brand/use-section-save";
import { Button, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { DIALS, EMOJI_LABELS, HEX, nextSection, type SectionInput, type SectionKey } from "@/modules/brand/sections";

const ASSISTABLE: SectionKey[] = ["servicios", "publico", "objetivos", "voz", "pilares", "reglas"];
import type { AnySectionInput } from "@/modules/brand/values";

interface FormProps<K extends SectionKey> {
  slug: string;
  initial: SectionInput<K>;
  readOnly: boolean;
  aiEnabled: boolean;
}

const TIMEZONES = [
  ["America/Argentina/Buenos_Aires", "Argentina"],
  ["America/Montevideo", "Uruguay"],
  ["America/Santiago", "Chile"],
  ["America/Sao_Paulo", "Brasil (São Paulo)"],
  ["America/Bogota", "Colombia"],
  ["America/Lima", "Perú"],
  ["America/Mexico_City", "México (centro)"],
  ["Europe/Madrid", "España"],
] as const;

function move<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}

function err(errors: FieldErrors, key: string) {
  return errors[key] ?? null;
}

// Marco común: errores generales, campos y la barra de acciones.
function SectionFrame({
  slug,
  section,
  readOnly,
  onSubmit,
  formError,
  listError,
  pending,
  children,
}: {
  slug: string;
  section: SectionKey;
  readOnly: boolean;
  onSubmit: (advance: boolean) => void;
  formError: string | null;
  listError?: string | null;
  pending: boolean;
  children: ReactNode;
}) {
  const next = nextSection(section);
  const [advance, setAdvance] = useState(true);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(advance);
  };
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      {readOnly ? <Notice tone="info">Solo los Dueños del workspace pueden editar la marca. Podés verla para producir con su contexto.</Notice> : null}
      {formError ? <Notice tone="error">{formError}</Notice> : null}
      {listError ? <Notice tone="error">{listError}</Notice> : null}
      <fieldset disabled={readOnly} className="flex flex-col gap-6">
        {children}
      </fieldset>
      {!readOnly ? (
        <div className="-mx-6 -mb-6 mt-2 sm:sticky sm:bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-b-[var(--radius-card)] border-t border-line bg-surface/90 px-6 py-4 backdrop-blur sm:-mx-7 sm:-mb-7 sm:px-7">
          <Link href={`/w/${slug}/marca`} className="text-small text-ink-2 underline-offset-4 hover:text-ink hover:underline">
            Volver al resumen
          </Link>
          <div className="flex gap-2">
            {next ? (
              <>
                <Button type="submit" variant="secondary" loading={pending && !advance} disabled={pending} onClick={() => setAdvance(false)}>
                  Guardar
                </Button>
                <Button type="submit" loading={pending && advance} disabled={pending} onClick={() => setAdvance(true)}>
                  Guardar y seguir
                </Button>
              </>
            ) : (
              <Button type="submit" loading={pending} onClick={() => setAdvance(false)}>
                Guardar
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </form>
  );
}

function IdentityForm({ slug, initial, readOnly }: FormProps<"identidad">) {
  const [v, setV] = useState(initial);
  const { save, errors, formError, pending } = useSectionSave(slug, "identidad");
  const set = <K extends keyof typeof v>(key: K, value: (typeof v)[K]) => setV((prev) => ({ ...prev, [key]: value }));
  return (
    <SectionFrame slug={slug} section="identidad" readOnly={readOnly} formError={formError} pending={pending} onSubmit={(advance) => save(v, { advance })}>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="name" label="Nombre de la marca" error={err(errors, "name")}>
          <Input id="name" value={v.name} onChange={(e) => set("name", e.target.value)} aria-invalid={Boolean(errors.name) || undefined} />
        </Field>
        <Field id="industry" label="Rubro" hint="Por ejemplo: estudio contable, cafetería, software." error={err(errors, "industry")}>
          <Input id="industry" value={v.industry} onChange={(e) => set("industry", e.target.value)} aria-invalid={Boolean(errors.industry) || undefined} />
        </Field>
      </div>
      <Field id="description" label="Qué hace la marca" hint="Dos o tres frases, como se lo contarías a un cliente nuevo." error={err(errors, "description")}>
        <Textarea
          id="description"
          value={v.description}
          maxLength={600}
          onChange={(e) => set("description", e.target.value)}
          aria-invalid={Boolean(errors.description) || undefined}
        />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="website" label="Sitio web" hint="Opcional." error={err(errors, "website")}>
          <Input id="website" type="url" placeholder="https://" value={v.website} onChange={(e) => set("website", e.target.value)} aria-invalid={Boolean(errors.website) || undefined} />
        </Field>
        <Field id="tz" label="Zona horaria del público" hint="Para proponer horarios de publicación.">
          <Select id="tz" value={v.audienceTimezone} onChange={(e) => set("audienceTimezone", e.target.value)}>
            {TIMEZONES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </SectionFrame>
  );
}

function ListSection<Item extends Record<string, unknown>>({
  slug,
  section,
  initial,
  readOnly,
  empty,
  label,
  addLabel,
  max,
  min,
  renderItem,
  footer,
  aiEnabled,
  previewItem,
}: {
  slug: string;
  section: SectionKey;
  initial: { items: Item[] };
  readOnly: boolean;
  aiEnabled: boolean;
  previewItem?: (item: Item) => ReactNode;
  empty: Item;
  label: string;
  addLabel: string;
  max: number;
  min: number;
  renderItem: (item: Item, index: number, update: (patch: Partial<Item>) => void, errors: FieldErrors) => ReactNode;
  footer?: (items: Item[]) => ReactNode;
}) {
  const [items, setItems] = useState<Item[]>(initial.items);
  const { save, errors, formError, pending } = useSectionSave(slug, section);
  const update = (index: number) => (patch: Partial<Item>) => setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  return (
    <SectionFrame
      slug={slug}
      section={section}
      readOnly={readOnly}
      formError={formError}
      listError={errors.items ?? null}
      pending={pending}
      onSubmit={(advance) => save({ items }, { advance })}
    >
      {!readOnly && ASSISTABLE.includes(section) ? (
        <AssistPanel<{ items: Item[] }>
          slug={slug}
          section={section}
          enabled={aiEnabled}
          onApply={(proposal) => setItems(proposal.items)}
          renderPreview={(proposal) => (
            <ul className="flex list-disc flex-col gap-1.5 pl-4">
              {proposal.items.map((item, i) => (
                <li key={i}>{previewItem ? previewItem(item) : String(Object.values(item)[0] ?? "")}</li>
              ))}
            </ul>
          )}
        />
      ) : null}
      {items.length === 0 ? <p className="text-small text-ink-2">Todavía no hay nada cargado. Es opcional.</p> : null}
      {items.map((item, index) => (
        <RepeaterRow
          key={index}
          index={index}
          total={items.length}
          label={label}
          canRemove={items.length > min}
          disabled={readOnly}
          onMove={(from, to) => setItems((prev) => move(prev, from, to))}
          onRemove={(i) => setItems((prev) => prev.filter((_, j) => j !== i))}
        >
          {renderItem(item, index, update(index), errors)}
        </RepeaterRow>
      ))}
      {footer ? footer(items) : null}
      {!readOnly ? (
        <AddRowButton onClick={() => setItems((prev) => [...prev, { ...empty }])} disabled={items.length >= max}>
          {addLabel}
        </AddRowButton>
      ) : null}
    </SectionFrame>
  );
}

function VoiceForm({ slug, initial, readOnly, aiEnabled }: FormProps<"voz">) {
  const [v, setV] = useState(initial);
  const { save, errors, formError, pending } = useSectionSave(slug, "voz");
  const set = <K extends keyof typeof v>(key: K, value: (typeof v)[K]) => setV((prev) => ({ ...prev, [key]: value }));
  return (
    <SectionFrame slug={slug} section="voz" readOnly={readOnly} formError={formError} pending={pending} onSubmit={(advance) => save(v, { advance })}>
      {!readOnly ? (
        <AssistPanel<SectionInput<"voz">>
          slug={slug}
          section="voz"
          enabled={aiEnabled}
          onApply={(proposal) => setV(proposal)}
          renderPreview={(p) => (
            <div className="flex flex-col gap-1.5">
              <p>{DIALS.map((d) => `${d.label}: ${p[d.key]} de 5`).join(", ")}.</p>
              {p.wordsToUse.length ? <p>Usa: {p.wordsToUse.join(", ")}.</p> : null}
              {p.wordsToAvoid.length ? <p>Evita: {p.wordsToAvoid.join(", ")}.</p> : null}
              <p>Emojis: {EMOJI_LABELS[p.emojiPolicy].toLowerCase()}.</p>
            </div>
          )}
        />
      ) : null}
      <div className="flex flex-col gap-5 rounded-[12px] bg-pearl/55 p-5">
        {DIALS.map((dial) => (
          <Dial key={dial.key} label={dial.label} low={dial.low} high={dial.high} value={v[dial.key]} onChange={(n) => set(dial.key, n)} disabled={readOnly} />
        ))}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="use" label="Palabras que usa" hint="Enter para agregar." error={err(errors, "wordsToUse")}>
          <TagInput id="use" value={v.wordsToUse} onChange={(next) => set("wordsToUse", next)} max={20} placeholder="cercanía, a medida…" disabled={readOnly} />
        </Field>
        <Field id="avoid" label="Palabras que evita" hint="Enter para agregar." error={err(errors, "wordsToAvoid")}>
          <TagInput id="avoid" value={v.wordsToAvoid} onChange={(next) => set("wordsToAvoid", next)} max={20} placeholder="barato, increíble…" disabled={readOnly} />
        </Field>
      </div>
      <fieldset>
        <legend className="mb-2 text-small font-medium text-ink">Emojis</legend>
        <div className="grid grid-cols-3 gap-1 rounded-[12px] bg-pearl p-1">
          {(Object.keys(EMOJI_LABELS) as (keyof typeof EMOJI_LABELS)[]).map((key) => (
            <label
              key={key}
              className={`flex h-9 cursor-pointer items-center justify-center rounded-[9px] text-small transition-[background-color,box-shadow,color] duration-[var(--dur-base)] has-focus-visible:shadow-[var(--focus-ring)] ${
                v.emojiPolicy === key ? "bg-surface font-medium text-ink shadow-raised" : "text-ink-2 hover:text-ink"
              }`}
            >
              <input type="radio" name="emoji" className="sr-only" checked={v.emojiPolicy === key} onChange={() => set("emojiPolicy", key)} />
              {EMOJI_LABELS[key]}
            </label>
          ))}
        </div>
      </fieldset>
      <Field id="examples" label="Textos de ejemplo" hint="Publicaciones o mensajes reales que suenan como la marca. Uno por bloque, separados por una línea en blanco.">
        <Textarea
          id="examples"
          className="min-h-36"
          value={v.examples.join("\n\n")}
          onChange={(e) =>
            set(
              "examples",
              e.target.value
                .split(/\n\s*\n/)
                .map((s) => s.trim())
                .filter(Boolean)
                .slice(0, 5),
            )
          }
        />
      </Field>
    </SectionFrame>
  );
}

function VisualForm({ slug, initial, readOnly }: FormProps<"visual">) {
  const [v, setV] = useState(initial);
  const { save, errors, formError, pending } = useSectionSave(slug, "visual");
  const setColor = (index: number, patch: Partial<{ name: string; hex: string }>) =>
    setV((prev) => ({ ...prev, palette: prev.palette.map((c, i) => (i === index ? { ...c, ...patch } : c)) }));
  return (
    <SectionFrame slug={slug} section="visual" readOnly={readOnly} formError={formError} listError={errors.palette ?? null} pending={pending} onSubmit={(advance) => save(v, { advance })}>
      <div>
        <p className="mb-2 text-small font-medium text-ink">Paleta</p>
        <div aria-hidden className="mb-4 flex h-14 overflow-hidden rounded-[12px] shadow-raised">
          {v.palette.map((color, index) => (
            <span key={index} className="flex-1 transition-[background-color] duration-[var(--dur-base)]" style={{ backgroundColor: HEX.test(color.hex) ? color.hex : "transparent" }} />
          ))}
        </div>
        <ul className="flex flex-col gap-2">
          {v.palette.map((color, index) => (
            <li key={index} className="flex items-start gap-2">
              <label className="relative mt-0.5 size-9 shrink-0 cursor-pointer overflow-hidden rounded-[9px] shadow-raised">
                <span className="sr-only">Elegir el color {index + 1}</span>
                <input type="color" value={HEX.test(color.hex) ? color.hex : "#000000"} onChange={(e) => setColor(index, { hex: e.target.value })} className="absolute -inset-2 size-14 cursor-pointer" />
              </label>
              <div className="flex-1">
                <Input aria-label={`Nombre del color ${index + 1}`} value={color.name} onChange={(e) => setColor(index, { name: e.target.value })} placeholder="Principal" />
                {errors[`palette.${index}.name`] ? <p className="mt-1 text-small text-danger">{errors[`palette.${index}.name`]}</p> : null}
              </div>
              <div className="w-32">
                <Input
                  aria-label={`Código del color ${index + 1}`}
                  value={color.hex}
                  onChange={(e) => setColor(index, { hex: e.target.value })}
                  className="tabular font-mono uppercase"
                  aria-invalid={Boolean(errors[`palette.${index}.hex`]) || undefined}
                />
                {errors[`palette.${index}.hex`] ? <p className="mt-1 text-small text-danger">{errors[`palette.${index}.hex`]}</p> : null}
              </div>
              {!readOnly ? (
                <button
                  type="button"
                  disabled={v.palette.length <= 1}
                  onClick={() => setV((prev) => ({ ...prev, palette: prev.palette.filter((_, i) => i !== index) }))}
                  aria-label={`Quitar el color ${index + 1}`}
                  className="mt-1.5 grid size-7 place-items-center rounded-[7px] text-ink-2 hover:bg-ink/[0.06] hover:text-danger disabled:opacity-30"
                >
                  <svg aria-hidden viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                    <path d="m4.5 4.5 7 7M11.5 4.5l-7 7" />
                  </svg>
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        {!readOnly ? (
          <div className="mt-3">
            <AddRowButton
              disabled={v.palette.length >= 6}
              onClick={() => setV((prev) => ({ ...prev, palette: [...prev.palette, { name: "", hex: "#d6d5d0" }] }))}
            >
              Agregar color
            </AddRowButton>
          </div>
        ) : null}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="heading-font" label="Tipografía de títulos" hint="Opcional.">
          <Input id="heading-font" value={v.headingFont} onChange={(e) => setV((p) => ({ ...p, headingFont: e.target.value }))} />
        </Field>
        <Field id="body-font" label="Tipografía de textos" hint="Opcional.">
          <Input id="body-font" value={v.bodyFont} onChange={(e) => setV((p) => ({ ...p, bodyFont: e.target.value }))} />
        </Field>
      </div>
      <Field id="image-style" label="Estilo de imagen" hint="Por ejemplo: fotos reales del equipo, luz natural, sin bancos de imágenes.">
        <Textarea id="image-style" value={v.imageStyle} onChange={(e) => setV((p) => ({ ...p, imageStyle: e.target.value }))} />
      </Field>
    </SectionFrame>
  );
}

export function SectionForm({
  slug,
  section,
  initial,
  readOnly,
  aiEnabled,
}: {
  slug: string;
  section: SectionKey;
  initial: AnySectionInput;
  readOnly: boolean;
  aiEnabled: boolean;
}) {
  const props = { slug, readOnly, aiEnabled };
  switch (section) {
    case "identidad":
      return <IdentityForm {...props} initial={initial as SectionInput<"identidad">} />;
    case "voz":
      return <VoiceForm {...props} initial={initial as SectionInput<"voz">} />;
    case "visual":
      return <VisualForm {...props} initial={initial as SectionInput<"visual">} />;
    case "servicios":
      return (
        <ListSection
          {...props}
          section="servicios"
          initial={initial as SectionInput<"servicios">}
          empty={{ name: "", description: "" }}
          label="Servicio"
          addLabel="Agregar servicio"
          previewItem={(item) => (
            <>
              <span className="font-medium">{item.name}</span>
              {item.description ? <span className="text-ink-2">. {item.description}</span> : null}
            </>
          )}
          min={1}
          max={12}
          renderItem={(item, i, update, errors) => (
            <>
              <Field id={`off-${i}-name`} label="Nombre" error={err(errors, `items.${i}.name`)}>
                <Input id={`off-${i}-name`} value={item.name} onChange={(e) => update({ name: e.target.value })} />
              </Field>
              <Field id={`off-${i}-desc`} label="Qué incluye o para quién es" hint="Opcional.">
                <Textarea id={`off-${i}-desc`} className="min-h-20" value={item.description} onChange={(e) => update({ description: e.target.value })} />
              </Field>
            </>
          )}
        />
      );
    case "publico":
      return (
        <ListSection
          {...props}
          section="publico"
          initial={initial as SectionInput<"publico">}
          empty={{ name: "", description: "", painPoints: [] as string[] }}
          label="Público"
          addLabel="Agregar público"
          previewItem={(item) => (
            <>
              <span className="font-medium">{item.name}</span>
              {item.painPoints.length ? <span className="text-ink-2">. Le preocupa: {item.painPoints.join(", ")}.</span> : null}
            </>
          )}
          min={1}
          max={6}
          renderItem={(item, i, update, errors) => (
            <>
              <Field id={`aud-${i}-name`} label="Quiénes son" hint="Por ejemplo: dueños de pymes de servicios." error={err(errors, `items.${i}.name`)}>
                <Input id={`aud-${i}-name`} value={item.name} onChange={(e) => update({ name: e.target.value })} />
              </Field>
              <Field id={`aud-${i}-desc`} label="Cómo son y qué buscan" hint="Opcional.">
                <Textarea id={`aud-${i}-desc`} className="min-h-20" value={item.description} onChange={(e) => update({ description: e.target.value })} />
              </Field>
              <Field id={`aud-${i}-pains`} label="Qué les preocupa" hint="Hasta 6. Enter para agregar.">
                <TagInput id={`aud-${i}-pains`} value={item.painPoints} onChange={(next) => update({ painPoints: next })} max={6} disabled={readOnly} />
              </Field>
            </>
          )}
        />
      );
    case "objetivos":
      return (
        <ListSection
          {...props}
          section="objetivos"
          initial={initial as SectionInput<"objetivos">}
          empty={{ title: "", kpi: "", target: "" }}
          label="Objetivo"
          addLabel="Agregar objetivo"
          previewItem={(item) => (
            <>
              <span className="font-medium">{item.title}</span>
              {item.kpi ? <span className="text-ink-2">. Se mide por: {item.kpi}.</span> : null}
            </>
          )}
          min={1}
          max={5}
          renderItem={(item, i, update, errors) => (
            <>
              <Field id={`goal-${i}-title`} label="Objetivo" hint="Por ejemplo: conseguir consultas de empresas nuevas." error={err(errors, `items.${i}.title`)}>
                <Input id={`goal-${i}-title`} value={item.title} onChange={(e) => update({ title: e.target.value })} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id={`goal-${i}-kpi`} label="Cómo se mide" hint="Por ejemplo: consultas por WhatsApp.">
                  <Input id={`goal-${i}-kpi`} value={item.kpi} onChange={(e) => update({ kpi: e.target.value })} />
                </Field>
                <Field id={`goal-${i}-target`} label="Meta" hint="Opcional. Por ejemplo: 8 por mes.">
                  <Input id={`goal-${i}-target`} value={item.target} onChange={(e) => update({ target: e.target.value })} />
                </Field>
              </div>
            </>
          )}
        />
      );
    case "pilares":
      return (
        <ListSection
          {...props}
          section="pilares"
          initial={initial as SectionInput<"pilares">}
          empty={{ name: "", description: "", weight: 10 }}
          label="Pilar"
          addLabel="Agregar pilar"
          previewItem={(item) => (
            <>
              <span className="font-medium">{item.name}</span> <span className="tabular text-ink-2">{item.weight} %</span>
            </>
          )}
          min={2}
          max={6}
          footer={(items) => {
            const total = items.reduce((sum, item) => sum + (Number.isFinite(item.weight) ? item.weight : 0), 0);
            return (
              <div className="flex items-center gap-3">
                <div aria-hidden className="flex h-2 flex-1 overflow-hidden rounded-full bg-pearl-strong">
                  {items.map((item, i) => (
                    <span key={i} className="h-full border-r-2 border-surface bg-accent transition-[width] duration-[var(--dur-base)] last:border-r-0" style={{ width: `${Math.max(0, item.weight)}%`, opacity: 1 - i * 0.13 }} />
                  ))}
                </div>
                <p className={`tabular text-small ${total === 100 ? "text-success" : "text-ink-2"}`} aria-live="polite">
                  {total} de 100 %
                </p>
              </div>
            );
          }}
          renderItem={(item, i, update, errors) => (
            <>
              <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
                <Field id={`pil-${i}-name`} label="Tema" hint="Por ejemplo: casos de clientes." error={err(errors, `items.${i}.name`)}>
                  <Input id={`pil-${i}-name`} value={item.name} onChange={(e) => update({ name: e.target.value })} />
                </Field>
                <Field id={`pil-${i}-w`} label="Peso (%)" error={err(errors, `items.${i}.weight`)}>
                  <Input
                    id={`pil-${i}-w`}
                    type="number"
                    inputMode="numeric"
                    min={5}
                    max={80}
                    step={5}
                    className="tabular"
                    value={Number.isFinite(item.weight) ? item.weight : ""}
                    onChange={(e) => update({ weight: e.target.value === "" ? Number.NaN : Number(e.target.value) })}
                  />
                </Field>
              </div>
              <Field id={`pil-${i}-desc`} label="De qué se trata" hint="Opcional.">
                <Textarea id={`pil-${i}-desc`} className="min-h-20" value={item.description} onChange={(e) => update({ description: e.target.value })} />
              </Field>
            </>
          )}
        />
      );
    case "datos":
      return (
        <ListSection
          {...props}
          section="datos"
          initial={initial as SectionInput<"datos">}
          empty={{ statement: "", source: "" }}
          label="Dato"
          addLabel="Agregar dato"
          min={0}
          max={30}
          renderItem={(item, i, update, errors) => (
            <>
              <Field id={`proof-${i}-st`} label="Dato o hecho" hint="Por ejemplo: 120 empresas acompañadas desde 2019." error={err(errors, `items.${i}.statement`)}>
                <Input id={`proof-${i}-st`} value={item.statement} onChange={(e) => update({ statement: e.target.value })} />
              </Field>
              <Field id={`proof-${i}-src`} label="Fuente" hint="De dónde sale: sistema interno, informe, sitio." error={err(errors, `items.${i}.source`)}>
                <Input id={`proof-${i}-src`} value={item.source} onChange={(e) => update({ source: e.target.value })} />
              </Field>
            </>
          )}
        />
      );
    case "reglas":
      return (
        <ListSection
          {...props}
          section="reglas"
          initial={initial as SectionInput<"reglas">}
          empty={{ kind: "NEVER" as const, text: "" }}
          label="Regla"
          addLabel="Agregar regla"
          previewItem={(item) => `${item.kind === "ALWAYS" ? "Siempre" : "Nunca"}: ${item.text}`}
          min={0}
          max={30}
          renderItem={(item, i, update, errors) => (
            <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
              <Field id={`rule-${i}-kind`} label="Tipo">
                <Select id={`rule-${i}-kind`} value={item.kind} onChange={(e) => update({ kind: e.target.value as "ALWAYS" | "NEVER" })}>
                  <option value="ALWAYS">Siempre</option>
                  <option value="NEVER">Nunca</option>
                </Select>
              </Field>
              <Field id={`rule-${i}-text`} label="Regla" hint="Por ejemplo: nunca prometer resultados en plazos." error={err(errors, `items.${i}.text`)}>
                <Input id={`rule-${i}-text`} value={item.text} onChange={(e) => update({ text: e.target.value })} />
              </Field>
            </div>
          )}
        />
      );
  }
}
