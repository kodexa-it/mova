"use client";

import { useId, useState, type KeyboardEvent, type ReactNode } from "react";

import { Button } from "@/components/ui";

// Lista de etiquetas: se escribe y se agrega con Enter o coma. Cada etiqueta se
// quita con su botón o con Retroceso sobre el campo vacío.
export function TagInput({
  id,
  value,
  onChange,
  placeholder,
  max,
  disabled,
  describedBy,
}: {
  id: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  max: number;
  disabled?: boolean;
  describedBy?: string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const parts = draft
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .filter((part) => !value.includes(part));
    if (parts.length) onChange([...value, ...parts].slice(0, max));
    setDraft("");
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add();
    } else if (event.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };
  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-[var(--radius-control)] bg-surface p-1.5 shadow-raised focus-within:shadow-[0_0_0_1px_var(--color-accent),var(--focus-ring)]">
      {value.map((tag) => (
        <span key={tag} className="animate-rise-in inline-flex h-7 items-center gap-1 rounded-[7px] bg-pearl pl-2.5 pr-1 text-small text-ink">
          {tag}
          {!disabled ? (
            <button
              type="button"
              aria-label={`Quitar ${tag}`}
              onClick={() => onChange(value.filter((t) => t !== tag))}
              className="grid size-5 place-items-center rounded-[5px] text-ink-2 hover:bg-ink/10 hover:text-ink"
            >
              <svg aria-hidden viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="m4.5 4.5 7 7M11.5 4.5l-7 7" />
              </svg>
            </button>
          ) : null}
        </span>
      ))}
      {!disabled && value.length < max ? (
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={add}
          placeholder={value.length ? "" : placeholder}
          aria-describedby={describedBy}
          className="h-7 min-w-[8rem] flex-1 bg-transparent px-1.5 text-body text-ink outline-none placeholder:text-ink-3"
        />
      ) : null}
    </div>
  );
}

// Dial de 1 a 5 entre dos extremos. Es un grupo de radios: se usa con flechas.
export function Dial({
  label,
  low,
  high,
  value,
  onChange,
  disabled,
}: {
  label: string;
  low: string;
  high: string;
  value: number;
  onChange: (next: number) => void;
  disabled?: boolean;
}) {
  const name = useId();
  return (
    <fieldset disabled={disabled}>
      <legend className="mb-2 text-small font-medium text-ink">{label}</legend>
      <div className="flex items-center gap-3">
        <span className="hidden w-20 shrink-0 text-right text-caption text-ink-2 sm:block">{low}</span>
        <div className="relative flex min-w-0 flex-1 justify-between">
          <span aria-hidden className="absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-line-strong" />
          {[1, 2, 3, 4, 5].map((step) => (
            <label key={step} className="relative grid size-8 cursor-pointer place-items-center">
              <input
                type="radio"
                name={name}
                value={step}
                checked={value === step}
                onChange={() => onChange(step)}
                className="peer sr-only"
                aria-label={`${step} de 5, de ${low.toLowerCase()} a ${high.toLowerCase()}`}
              />
              <span
                className={`block rounded-full transition-all duration-[var(--dur-base)] ease-[var(--ease-spring)] peer-focus-visible:shadow-[var(--focus-ring)] ${
                  value === step ? "size-5 bg-accent shadow-[0_0_0_4px_var(--color-accent-soft)]" : "size-2.5 bg-surface shadow-[inset_0_0_0_1.5px_var(--color-line-strong)] hover:size-3.5"
                }`}
              />
            </label>
          ))}
        </div>
        <span className="hidden w-20 shrink-0 text-caption text-ink-2 sm:block">{high}</span>
      </div>
      <div aria-hidden className="mt-1 flex justify-between text-caption text-ink-2 sm:hidden">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </fieldset>
  );
}

// Fila repetible con acciones de orden y quitar.
export function RepeaterRow({
  index,
  total,
  label,
  onMove,
  onRemove,
  canRemove,
  disabled,
  children,
}: {
  index: number;
  total: number;
  label: string;
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  const iconButton = "grid size-7 place-items-center rounded-[7px] text-ink-2 transition-colors hover:bg-ink/[0.06] hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent";
  return (
    <div className="animate-rise-in rounded-[12px] bg-pearl/55 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="tabular text-caption font-medium text-ink-2">
          {label} {index + 1}
        </p>
        {!disabled ? (
          <div className="flex items-center gap-0.5">
            <button type="button" className={iconButton} disabled={index === 0} onClick={() => onMove(index, index - 1)} aria-label={`Subir ${label.toLowerCase()} ${index + 1}`}>
              <svg aria-hidden viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="m4.5 9.5 3.5-3.5 3.5 3.5" />
              </svg>
            </button>
            <button type="button" className={iconButton} disabled={index === total - 1} onClick={() => onMove(index, index + 1)} aria-label={`Bajar ${label.toLowerCase()} ${index + 1}`}>
              <svg aria-hidden viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="m4.5 6.5 3.5 3.5 3.5-3.5" />
              </svg>
            </button>
            <button type="button" className={`${iconButton} hover:text-danger`} disabled={!canRemove} onClick={() => onRemove(index)} aria-label={`Quitar ${label.toLowerCase()} ${index + 1}`}>
              <svg aria-hidden viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3.5 4.5h9M6.5 4.5V3.25h3V4.5M5 4.5l.5 8h5l.5-8" />
              </svg>
            </button>
          </div>
        ) : null}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

export function AddRowButton({ onClick, children, disabled }: { onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <Button type="button" variant="secondary" size="sm" onClick={onClick} disabled={disabled} className="self-start">
      <svg aria-hidden viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
        <path d="M8 3.5v9M3.5 8h9" />
      </svg>
      {children}
    </Button>
  );
}
