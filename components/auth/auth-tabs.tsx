"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/ingresar", label: "Iniciar sesión" },
  { href: "/registro", label: "Crear cuenta" },
];

// Control segmentado entre login y registro. El indicador se desliza al cambiar
// de pantalla porque el layout persiste entre ambas rutas.
export function AuthTabs() {
  const pathname = usePathname();
  const active = TABS.findIndex((tab) => pathname.startsWith(tab.href));
  if (active === -1) return null;

  return (
    <nav aria-label="Acceso" className="animate-enter relative mb-10 grid grid-cols-2 rounded-[12px] bg-pearl p-1 [--i:1]">
      <span
        aria-hidden
        className="absolute bottom-1 left-1 top-1 w-[calc(50%-4px)] rounded-[9px] bg-surface shadow-[0_1px_2px_rgb(20_20_25/0.08),0_0_0_1px_rgb(20_20_25/0.04)] transition-transform duration-[var(--dur-slow)] ease-[var(--ease-spring)]"
        style={{ transform: `translateX(${active * 100}%)` }}
      />
      {TABS.map((tab, index) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={index === active ? "page" : undefined}
          className={`relative z-10 flex h-9 items-center justify-center rounded-[9px] text-small font-medium transition-colors duration-[var(--dur-base)] ${
            index === active ? "text-ink" : "text-ink-2 hover:text-ink"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
