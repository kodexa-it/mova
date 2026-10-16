import type { ContentStatus } from "@prisma/client";

import { STATUS_LABELS, STATUS_TONES } from "@/modules/content/status";

const DOT: Record<(typeof STATUS_TONES)[ContentStatus], string> = {
  neutral: "bg-ink-3",
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-[#C98A1E]",
  danger: "bg-danger",
};

// Nombres cortos para las tarjetas angostas del calendario.
const SHORT: Partial<Record<ContentStatus, string>> = { PENDING_APPROVAL: "Por aprobar" };

// Punto de estado con su nombre al lado (o solo para lectores de pantalla). El
// color nunca es la única señal.
export function StatusDot({ status, label = true, short = false }: { status: ContentStatus; label?: boolean; short?: boolean }) {
  const text = (short && SHORT[status]) || STATUS_LABELS[status];
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${DOT[STATUS_TONES[status]]}`} />
      <span className={label ? "truncate" : "sr-only"}>{label && short && SHORT[status] ? <span title={STATUS_LABELS[status]}>{text}</span> : text}</span>
    </span>
  );
}
