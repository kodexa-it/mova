import type { CSSProperties, ReactNode } from "react";

// Título de las pantallas de acceso. El tamaño grande y el interletrado cerrado
// son la voz editorial del acceso; el resto de la columna queda en silencio.
export function AuthHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-9">
      <h1 className="animate-enter text-[2.375rem] font-[560] leading-[1.04] tracking-[-0.038em] text-ink [--i:2] sm:text-hero">
        {title}
      </h1>
      {children ? <p className="animate-enter mt-4 max-w-[21rem] text-lead text-ink-2 [--i:3]">{children}</p> : null}
    </div>
  );
}

export const textLink = "font-medium text-accent underline-offset-4 hover:underline";

// Orden de entrada escalonada para los campos de un formulario de acceso.
export const enterAt = (i: number) => ({ "--i": i }) as CSSProperties;
