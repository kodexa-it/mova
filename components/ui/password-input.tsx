"use client";

import { useState, type InputHTMLAttributes } from "react";

import { Input, type InputVariant } from "@/components/ui/field";

// Contraseña con botón para mostrarla u ocultarla. El botón no envía el
// formulario y anuncia su estado con aria-pressed.
export function PasswordInput({
  variant = "outline",
  className = "",
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { variant?: InputVariant }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input {...props} variant={variant} type={visible ? "text" : "password"} className={`pr-12 ${className}`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        aria-pressed={visible}
        className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-[9px] text-ink-2 transition-colors duration-[var(--dur-fast)] hover:bg-ink/5 hover:text-ink"
      >
        <svg aria-hidden viewBox="0 0 20 20" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1.75 10S4.75 4.25 10 4.25 18.25 10 18.25 10 15.25 15.75 10 15.75 1.75 10 1.75 10Z" />
          <circle cx="10" cy="10" r="2.6" />
          <path
            d="M3.5 3.5 16.5 16.5"
            className="transition-[stroke-dashoffset] duration-[var(--dur-base)] ease-[var(--ease-standard)]"
            strokeDasharray="19"
            strokeDashoffset={visible ? 0 : 19}
          />
        </svg>
      </button>
    </div>
  );
}
