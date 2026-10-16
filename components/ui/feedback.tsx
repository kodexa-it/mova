import type { ReactNode } from "react";

export type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

const badgeTones: Record<Tone, string> = {
  neutral: "bg-pearl text-ink-2",
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex h-6 items-center rounded-[var(--radius-badge)] px-2 text-caption font-medium ${badgeTones[tone]}`}>
      {children}
    </span>
  );
}

const icons = {
  info: <path d="M8 7.25v3.5M8 5.25h.01M14.25 8a6.25 6.25 0 1 1-12.5 0 6.25 6.25 0 0 1 12.5 0Z" />,
  success: <path d="m5.25 8.25 1.9 1.9 3.6-4.1M14.25 8a6.25 6.25 0 1 1-12.5 0 6.25 6.25 0 0 1 12.5 0Z" />,
  warning: <path d="M8 6v3M8 11.25h.01M7.13 2.5 1.6 12a1 1 0 0 0 .87 1.5h11.06a1 1 0 0 0 .87-1.5L8.87 2.5a1 1 0 0 0-1.74 0Z" />,
  error: <path d="M8 5v3.5M8 10.75h.01M14.25 8a6.25 6.25 0 1 1-12.5 0 6.25 6.25 0 0 1 12.5 0Z" />,
};

const noticeTones = {
  info: "bg-pearl text-ink [&_svg]:text-ink-2",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  error: "bg-danger-soft text-danger",
};

// Aviso en línea. Los errores se anuncian de inmediato (role="alert"); el
// resto, de forma cortés (role="status").
export function Notice({ tone = "info", children }: { tone?: keyof typeof noticeTones; children: ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`animate-rise-in flex gap-2.5 rounded-[var(--radius-control)] px-3.5 py-3 text-small ${noticeTones[tone]}`}
    >
      <svg aria-hidden viewBox="0 0 16 16" className="mt-px size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {icons[tone]}
      </svg>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
