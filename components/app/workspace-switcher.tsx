"use client";

import type { Role } from "@prisma/client";

import { MenuLabel, MenuLinkItem, MenuPopup, MenuRoot, MenuSeparator, MenuTrigger } from "@/components/ui";
import { ROLE_LABELS } from "@/modules/access/permissions";

export interface SwitcherWorkspace {
  slug: string;
  name: string;
  role: Role;
}

function Monogram({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-[8px] bg-[linear-gradient(150deg,#5b62f0,#2f2ca8)] font-semibold uppercase text-white ${
        size === "sm" ? "size-6 text-[0.6875rem]" : "size-7 text-caption"
      }`}
    >
      {name.slice(0, 1)}
    </span>
  );
}

// Selector del workspace activo. El cambio es una navegación: el servidor vuelve
// a verificar la membresía y el rol en la página de destino.
export function WorkspaceSwitcher({ current, workspaces }: { current: SwitcherWorkspace; workspaces: SwitcherWorkspace[] }) {
  return (
    <MenuRoot>
      <MenuTrigger className="group flex h-9 min-w-0 items-center gap-2.5 rounded-[10px] pl-1 pr-2 transition-colors duration-[var(--dur-fast)] hover:bg-ink/[0.05] data-popup-open:bg-ink/[0.06]">
        <Monogram name={current.name} />
        <span className="min-w-0 truncate text-body font-medium text-ink">{current.name}</span>
        <span className="hidden text-small text-ink-2 sm:inline">{ROLE_LABELS[current.role]}</span>
        <svg aria-hidden viewBox="0 0 16 16" className="size-3.5 shrink-0 text-ink-2 transition-transform duration-[var(--dur-base)] group-data-popup-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="m4.5 6.5 3.5 3.5 3.5-3.5" />
        </svg>
      </MenuTrigger>
      <MenuPopup className="w-72">
        <MenuLabel>Workspaces</MenuLabel>
        {workspaces.map((ws) => {
          const active = ws.slug === current.slug;
          return (
            <MenuLinkItem key={ws.slug} href={`/w/${ws.slug}`} aria-current={active ? "page" : undefined}>
              <Monogram name={ws.name} size="sm" />
              <span className="min-w-0 flex-1 truncate">{ws.name}</span>
              {active ? (
                <svg aria-hidden viewBox="0 0 16 16" className="size-4 text-accent" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m3.5 8.5 3 3 6-7" />
                </svg>
              ) : (
                <span className="text-caption text-ink-2">{ROLE_LABELS[ws.role]}</span>
              )}
            </MenuLinkItem>
          );
        })}
        <MenuSeparator />
        <MenuLinkItem href="/w">
          <span aria-hidden className="grid size-6 place-items-center rounded-[8px] bg-pearl text-ink-2">
            <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M8 3.5v9M3.5 8h9" />
            </svg>
          </span>
          Crear o ver todos
        </MenuLinkItem>
      </MenuPopup>
    </MenuRoot>
  );
}
