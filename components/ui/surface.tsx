import type { ReactNode } from "react";

// Superficie sólida (no vidrio): el vidrio queda reservado a capas flotantes.
export function Card({
  children,
  className = "",
  tone = "default",
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  tone?: "default" | "danger";
  as?: "section" | "div" | "article";
}) {
  const ring = tone === "danger" ? "shadow-[0_1px_2px_rgb(20_20_25/0.05),0_0_0_1px_rgb(194_56_47/0.28)]" : "shadow-raised";
  return <Tag className={`rounded-[var(--radius-card)] bg-surface ${ring} ${className}`}>{children}</Tag>;
}

export function CardHeader({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <div className="mb-5">
      <h2 className="text-lead font-semibold text-ink">{title}</h2>
      {description ? <p className="mt-1 text-small text-ink-2">{description}</p> : null}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <h1 className="text-display font-semibold text-ink">{title}</h1>
        {description ? <p className="mt-2 text-body text-ink-2">{description}</p> : null}
      </div>
      {actions}
    </header>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-[var(--radius-card)] bg-pearl/60 px-6 py-8">
      <p className="font-medium text-ink">{title}</p>
      <p className="max-w-md text-small text-ink-2">{description}</p>
      {action}
    </div>
  );
}
