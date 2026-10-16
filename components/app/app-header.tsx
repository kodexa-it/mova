import Link from "next/link";

import { AccountMenu } from "@/components/app/account-menu";
import { NotificationBell } from "@/components/app/notification-bell";
import { WorkspaceSwitcher, type SwitcherWorkspace } from "@/components/app/workspace-switcher";
import { Wordmark } from "@/components/brand/wordmark";

// Barra superior. Queda fija al hacer scroll con un velo translúcido: es la
// única superficie de la interfaz que flota sobre el contenido de forma
// permanente, por eso lleva vidrio.
export function AppHeader({
  user,
  current,
  workspaces = [],
  unread,
}: {
  user: { name: string; email: string };
  current?: SwitcherWorkspace;
  workspaces?: SwitcherWorkspace[];
  // Avisos sin leer del workspace actual (solo dentro de un workspace).
  unread?: number;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-ink/[0.06] bg-canvas/80 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <Link href="/w" aria-label="Mova: tus workspaces" className="block shrink-0 rounded-[var(--radius-badge)]">
            <Wordmark />
          </Link>
          {current ? (
            <>
              <span aria-hidden className="h-5 w-px shrink-0 bg-line-strong" />
              <WorkspaceSwitcher current={current} workspaces={workspaces} />
            </>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5">
          {current && unread !== undefined ? <NotificationBell slug={current.slug} unread={unread} /> : null}
          <AccountMenu name={user.name} email={user.email} />
        </div>
      </div>
    </header>
  );
}
