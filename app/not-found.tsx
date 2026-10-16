import Link from "next/link";

import { Wordmark } from "@/components/brand/wordmark";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <Wordmark height={22} />
      <div>
        <h1 className="text-title font-semibold text-ink">No encontramos esta página</h1>
        <p className="mt-2 text-body text-ink-2">Puede que no exista o que no tengas acceso.</p>
      </div>
      <Link
        href="/w"
        className="inline-flex h-10 items-center rounded-[var(--radius-control)] bg-surface px-4 font-medium text-ink shadow-raised transition-colors hover:bg-pearl"
      >
        Ir a tus workspaces
      </Link>
    </main>
  );
}
