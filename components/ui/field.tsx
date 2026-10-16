import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

// Campo con etiqueta, ayuda y error. El error se asocia al control con
// aria-describedby y aria-invalid usando el mismo id del control.
export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-small font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="animate-rise-in text-small text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-small text-ink-2">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function describedBy(id: string, opts: { error?: string | null; hint?: string }): string | undefined {
  if (opts.error) return `${id}-error`;
  if (opts.hint) return `${id}-hint`;
  return undefined;
}

const control =
  "w-full bg-surface text-ink shadow-raised " +
  "placeholder:text-ink-3 transition-shadow duration-[var(--dur-fast)] ease-[var(--ease-standard)] " +
  "hover:shadow-[0_1px_2px_rgb(20_20_25/0.06),0_0_0_1px_rgb(20_20_25/0.12)] " +
  "focus-visible:shadow-[0_0_0_1px_var(--color-accent),var(--focus-ring)] " +
  "aria-invalid:shadow-[0_0_0_1px_var(--color-danger)] " +
  "disabled:bg-pearl disabled:text-ink-3";

// "outline": campo blanco con borde suave, para formularios dentro de tarjetas.
// "filled": campo perla sin borde que se aclara al enfocarlo, para pantallas
// abiertas como el acceso.
export type InputVariant = "outline" | "filled";

const inputVariants: Record<InputVariant, string> = {
  outline: `${control} h-10 rounded-[var(--radius-control)] px-3`,
  filled:
    "w-full h-[46px] rounded-[12px] bg-pearl px-3.5 text-ink placeholder:text-ink-3 " +
    "shadow-[inset_0_0_0_1px_transparent] transition-[background-color,box-shadow] duration-[var(--dur-base)] ease-[var(--ease-standard)] " +
    "hover:bg-pearl-strong/70 " +
    "focus-visible:bg-surface focus-visible:shadow-[inset_0_0_0_1px_var(--color-accent),0_0_0_4px_rgb(61_58_216/0.14)] " +
    "aria-invalid:bg-danger-soft/60 aria-invalid:shadow-[inset_0_0_0_1px_var(--color-danger)] " +
    "disabled:text-ink-3",
};

export function Input({
  className = "",
  variant = "outline",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { variant?: InputVariant }) {
  return <input className={`${inputVariants[variant]} text-body ${className}`} {...props} />;
}

export function Select({
  className = "",
  controlSize = "md",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { controlSize?: "md" | "sm" }) {
  const size = controlSize === "sm" ? "h-8 rounded-[8px] text-small" : "h-10 rounded-[var(--radius-control)] text-body";
  return (
    <div className="relative">
      <select className={`${control} ${size} appearance-none pl-3 pr-9 ${className}`} {...props}>
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m4.5 6.5 3.5 3.5 3.5-3.5" />
      </svg>
    </div>
  );
}

export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${control} min-h-24 resize-y rounded-[var(--radius-control)] px-3 py-2.5 text-body leading-relaxed ${className}`} {...props} />;
}
