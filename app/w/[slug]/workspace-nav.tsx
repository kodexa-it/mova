"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
}

const ICONS = {
  home: <path d="M3 7.5 8 3.25l5 4.25V12a.75.75 0 0 1-.75.75H9.75V9.5h-3.5v3.25H3.75A.75.75 0 0 1 3 12V7.5Z" />,
  brand: (
    <>
      <path d="M8 2.75a5.25 5.25 0 1 0 0 10.5c.7 0 1-.45 1-1 0-.6-.5-.85-.5-1.4 0-.6.45-1 1.1-1h1.4a2.25 2.25 0 0 0 2.25-2.25C13.25 4.9 10.9 2.75 8 2.75Z" />
      <circle cx="5.5" cy="7" r=".75" fill="currentColor" stroke="none" />
      <circle cx="8" cy="5.25" r=".75" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="7" r=".75" fill="currentColor" stroke="none" />
    </>
  ),
  content: (
    <>
      <rect x="2.75" y="2.75" width="10.5" height="10.5" rx="2" />
      <path d="M5.5 6h5M5.5 8.5h5M5.5 11h3" />
    </>
  ),
  people: (
    <>
      <circle cx="6" cy="5.75" r="2.25" />
      <path d="M2.25 12.75c.4-2 1.9-3.25 3.75-3.25s3.35 1.25 3.75 3.25M10.5 3.75a2.25 2.25 0 0 1 0 4.25M11.75 9.75c1 .45 1.7 1.45 2 3" />
    </>
  ),
  settings: (
    <>
      <circle cx="8" cy="8" r="2" />
      <path d="M8 2.25v1.5M8 12.25v1.5M13.75 8h-1.5M3.75 8h-1.5M12.07 3.93l-1.06 1.06M4.99 11.01l-1.06 1.06M12.07 12.07l-1.06-1.06M4.99 4.99 3.93 3.93" />
    </>
  ),
  calendar: (
    <>
      <rect x="2.75" y="3.5" width="10.5" height="9.75" rx="2" />
      <path d="M2.75 6.5h10.5M5.5 2.25v2.5M10.5 2.25v2.5" />
    </>
  ),
  chart: <path d="M2.75 13.25h10.5M4.5 11V8.5M7.25 11V5.5M10 11V7M12.75 11V3.75" />,
  spark: <path d="M8 2.5 9.3 6.7 13.5 8 9.3 9.3 8 13.5 6.7 9.3 2.5 8l4.2-1.3L8 2.5Z" />,
  audit: <path d="M4.25 2.75h5.5l2.5 2.5v8h-8v-10.5ZM9.5 2.75v2.75h2.75M6.25 8h3.5M6.25 10.5h3.5" />,
};

// Secciones del workspace: columna en escritorio, fila deslizable en móvil.
export function WorkspaceNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Secciones del workspace" className="min-w-0 md:sticky md:top-28 md:self-start">
      <ul className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 md:flex-col md:pb-0">
        {items.map((item) => {
          const active = item.href.split("/").length > 3 ? pathname.startsWith(item.href) : pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2.5 whitespace-nowrap rounded-[10px] px-3 py-2 text-small transition-[background-color,color,box-shadow] duration-[var(--dur-fast)] ${
                  active ? "bg-surface font-medium text-ink shadow-raised" : "text-ink-2 hover:bg-ink/[0.04] hover:text-ink"
                }`}
              >
                <svg aria-hidden viewBox="0 0 16 16" className={`size-4 shrink-0 ${active ? "text-accent" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  {ICONS[item.icon]}
                </svg>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
