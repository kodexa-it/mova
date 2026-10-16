import type { ReactNode } from "react";

import { AuthStage, AuthStageCompact } from "@/components/auth/auth-stage";
import { AuthTabs } from "@/components/auth/auth-tabs";
import { Wordmark } from "@/components/brand/wordmark";

// Acceso: una columna editorial angosta y un escenario de luz con una escena del
// producto. En pantallas angostas el escenario se vuelve una franja arriba.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-dvh bg-canvas lg:grid lg:grid-cols-[minmax(28rem,0.85fr)_minmax(0,1.15fr)]">
      <div className="flex min-h-dvh flex-col px-5 pb-6 pt-5 sm:px-10 sm:pt-8 lg:px-14 xl:px-20">
        <header className="animate-enter [--i:0]">
          <Wordmark height={20} />
        </header>
        <div className="mt-6 lg:hidden">
          <AuthStageCompact />
        </div>
        <div className="flex flex-1 flex-col justify-center pb-10 pt-8 lg:py-16">
          <div className="mx-auto w-full max-w-[23rem]">
            <AuthTabs />
            {children}
          </div>
        </div>
        <footer className="animate-enter flex items-center justify-between text-caption text-ink-2 [--i:8]">
          <span>Un producto de Kodexa</span>
        </footer>
      </div>
      <div className="sticky top-0 hidden h-dvh p-3 lg:block">
        <AuthStage />
      </div>
    </main>
  );
}
