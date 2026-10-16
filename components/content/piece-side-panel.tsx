"use client";

import type { ReactNode } from "react";

export type SideTab = "preview" | "review" | "comments" | "versions";

// Columna lateral de la pieza: una sola cosa a la vez para no alargar la página.
export function PieceSidePanel({
  tab,
  onTab,
  panels,
  badges,
}: {
  tab: SideTab;
  onTab: (tab: SideTab) => void;
  panels: Record<SideTab, ReactNode>;
  badges: Partial<Record<SideTab, number>>;
}) {
  const tabs: [SideTab, string][] = [
    ["preview", "Vista previa"],
    ["review", "Revisión"],
    ["comments", "Comentarios"],
    ["versions", "Versiones"],
  ];
  return (
    <div className="rounded-[var(--radius-card)] bg-surface shadow-raised">
      <div role="tablist" aria-label="Panel de la pieza" className="flex gap-0.5 overflow-x-auto border-b border-line px-2 pt-2 [scrollbar-width:none]">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`side-tab-${id}`}
            aria-selected={tab === id}
            aria-controls="side-panel"
            onClick={() => onTab(id)}
            className={`relative flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-t-[8px] px-3 pb-2.5 pt-2 text-small transition-colors duration-[var(--dur-fast)] ${
              tab === id ? "font-medium text-ink after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-accent" : "text-ink-2 hover:text-ink"
            }`}
          >
            {label}
            {badges[id] ? <span className="tabular grid h-4.5 min-w-4.5 place-items-center rounded-full bg-pearl px-1 text-[11px] font-medium text-ink-2">{badges[id]}</span> : null}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="side-panel" aria-labelledby={`side-tab-${tab}`} className="p-5">
        {panels[tab]}
      </div>
    </div>
  );
}
