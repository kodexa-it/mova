"use client";

import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui";
import type { ValidationReport } from "@/modules/content/validators";
import type { Check, CheckStatus } from "@/modules/content/validators/report";

// Cómo se puede resolver una sugerencia desde el panel: con Mova (corrección
// acotada de la versión guardada) o, si es de composición, eligiendo la
// sugerencia automática para esa imagen (sin IA).
export type FixKind = "ai" | "layout" | null;
export interface FixActions {
  kindOf: (check: Check) => FixKind;
  onFix: (checkIds: string[]) => void;
  onFixLayout: (checkId: string) => void;
  pending: string | null; // id del chequeo que se está corrigiendo, o "all"
  disabledReason?: string; // por qué no se puede corregir ahora (cambios sin guardar, sin IA…)
}

const VERDICT = {
  ready: { label: "Lista para revisar", text: "Pasó todos los chequeos automáticos.", tone: "bg-success-soft text-success" },
  review: { label: "Con sugerencias", text: "Se puede enviar, pero conviene mirar lo marcado.", tone: "bg-warning-soft text-warning" },
  fix: { label: "Para corregir", text: "Hay algo que impide aprobarla.", tone: "bg-danger-soft text-danger" },
} as const;

const ICON: Record<CheckStatus, { path: string; tone: string; label: string }> = {
  fail: { path: "M5 5l6 6M11 5l-6 6", tone: "bg-danger-soft text-danger", label: "Para corregir" },
  warn: { path: "M8 4.75v4M8 11.25h.01", tone: "bg-warning-soft text-warning", label: "Sugerencia" },
  pass: { path: "m4.5 8.25 2.25 2.25 4.75-5", tone: "bg-success-soft text-success", label: "Bien" },
};

// Revisión automática: corre los mismos validadores que el servidor, mientras
// se escribe. Lo que se guarda con la versión es el reporte del servidor.
export function ValidationPanel({ report, fix }: { report: ValidationReport; fix?: FixActions }) {
  const [showPassed, setShowPassed] = useState(false);
  const order: CheckStatus[] = ["fail", "warn", "pass"];
  const sorted = [...report.checks].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
  const issues = sorted.filter((c) => c.status !== "pass");
  const passed = sorted.filter((c) => c.status === "pass");
  const verdict = VERDICT[report.verdict];

  return (
    <section aria-labelledby="review-title" className="flex flex-col gap-4">
      <div className={`rounded-[12px] px-4 py-3 ${verdict.tone}`} aria-live="polite">
        <p id="review-title" className="text-small font-semibold">
          {verdict.label}
        </p>
        <p className="mt-0.5 text-caption opacity-90">{verdict.text}</p>
      </div>
      {fix && aiFixable(issues, fix).length > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] bg-accent-soft/70 px-3.5 py-2.5">
          <p className="text-caption text-ink">Mova puede corregir {aiFixable(issues, fix).length} sugerencias sin tocar el resto.</p>
          <Button size="sm" onClick={() => fix.onFix(aiFixable(issues, fix).map((c) => c.id))} loading={fix.pending === "all"} disabled={fix.pending !== null || Boolean(fix.disabledReason)}>
            Corregir todo
          </Button>
        </div>
      ) : null}
      {fix?.disabledReason && issues.some((c) => fix.kindOf(c) === "ai") ? <p className="text-caption text-ink-2">{fix.disabledReason}</p> : null}
      <ul className="flex flex-col gap-2.5">
        {issues.map((c, i) => (
          <CheckRow key={`${c.id}-${i}`} status={c.status} label={c.label} detail={c.detail}>
            {fix ? <FixButton check={c} fix={fix} /> : null}
          </CheckRow>
        ))}
      </ul>
      {passed.length ? (
        <div>
          <button type="button" onClick={() => setShowPassed((v) => !v)} aria-expanded={showPassed} className="text-small text-ink-2 underline-offset-4 hover:text-ink hover:underline">
            {showPassed ? "Ocultar" : "Ver"} {passed.length} {passed.length === 1 ? "chequeo correcto" : "chequeos correctos"}
          </button>
          {showPassed ? (
            <ul className="mt-2.5 flex flex-col gap-2.5">
              {passed.map((c, i) => (
                <CheckRow key={`${c.id}-${i}`} status={c.status} label={c.label} detail={c.detail} />
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function aiFixable(issues: Check[], fix: FixActions) {
  const seen = new Set<string>();
  return issues.filter((c) => fix.kindOf(c) === "ai" && !seen.has(c.id) && seen.add(c.id));
}

function FixButton({ check, fix }: { check: Check; fix: FixActions }) {
  const kind = fix.kindOf(check);
  if (!kind) return null;
  const busy = fix.pending === check.id;
  const disabled = fix.pending !== null || (kind === "ai" && Boolean(fix.disabledReason));
  return (
    <button
      type="button"
      onClick={() => (kind === "ai" ? fix.onFix([check.id]) : fix.onFixLayout(check.id))}
      disabled={disabled}
      aria-busy={busy || undefined}
      className="mt-1 inline-flex items-center gap-1 text-caption font-medium text-accent underline-offset-4 hover:underline disabled:text-ink-3 disabled:no-underline"
    >
      {kind === "ai" ? (
        <svg aria-hidden viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
          <path d="M8 2.5 9.3 6.7 13.5 8 9.3 9.3 8 13.5 6.7 9.3 2.5 8l4.2-1.3L8 2.5Z" />
        </svg>
      ) : null}
      {busy ? "Corrigiendo…" : kind === "ai" ? "Corregir con Mova" : "Usar la sugerencia para esta imagen"}
    </button>
  );
}

function CheckRow({ status, label, detail, children }: { status: CheckStatus; label: string; detail: string; children?: ReactNode }) {
  const icon = ICON[status];
  return (
    <li className="animate-rise-in flex gap-2.5">
      <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${icon.tone}`}>
        <svg aria-hidden viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d={icon.path} />
        </svg>
        <span className="sr-only">{icon.label}:</span>
      </span>
      <div className="min-w-0">
        <p className="text-small font-medium text-ink">{label}</p>
        <p className="text-small text-ink-2">{detail}</p>
        {children}
      </div>
    </li>
  );
}
