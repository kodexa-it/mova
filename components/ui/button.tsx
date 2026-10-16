import type { ButtonHTMLAttributes } from "react";

import { Spinner } from "@/components/ui/spinner";

export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";
export type ButtonSize = "lg" | "md" | "sm";

const base =
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium " +
  "transition-[background-color,color,box-shadow,transform] duration-[var(--dur-fast)] ease-[var(--ease-standard)] " +
  "active:scale-[0.98] disabled:pointer-events-none disabled:active:scale-100";

const sizes: Record<ButtonSize, string> = {
  lg: "h-[46px] rounded-[12px] px-5 text-body",
  md: "h-10 rounded-[var(--radius-control)] px-4 text-body",
  sm: "h-8 rounded-[8px] px-3 text-small",
};

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_1px_2px_rgb(61_58_216/0.24)] " +
    "hover:bg-accent-hover active:bg-accent-press disabled:bg-accent/45",
  secondary:
    "bg-surface text-ink shadow-raised hover:bg-pearl active:bg-pearl-strong disabled:text-ink-3",
  quiet: "bg-transparent text-ink-2 hover:bg-pearl hover:text-ink active:bg-pearl-strong disabled:text-ink-3",
  danger: "bg-danger text-white hover:bg-danger-hover disabled:bg-danger/45",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Muestra el indicador de carga, bloquea el botón y lo anuncia a lectores de pantalla. */
  loading?: boolean;
}

export function Button({ variant = "primary", size = "md", loading = false, disabled, className = "", children, ...props }: ButtonProps) {
  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner className={size === "sm" ? "size-3.5" : "size-4"} /> : null}
      {children}
    </button>
  );
}
