"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { MenuLinkItem, MenuPopup, MenuRoot, MenuSeparator, MenuTrigger, Spinner } from "@/components/ui";
import { apiRequest } from "@/lib/errors";

interface Item {
  id: string;
  title: string;
  body: string;
  href: string;
  readAt: string | null;
  createdAt: string;
}

const when = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

// Avisos del workspace para la persona: por ejemplo, piezas generadas que
// esperan revisión. Al abrir la lista se marcan como leídos.
export function NotificationBell({ slug, unread: initialUnread }: { slug: string; unread: number }) {
  const router = useRouter();
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<Item[] | null>(null);
  useEffect(() => setUnread(initialUnread), [initialUnread]);

  // Mientras la pestaña está abierta, revisa si hay avisos nuevos cada minuto.
  useEffect(() => {
    const timer = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const result = await apiRequest<{ unread: number }>(`/api/w/${slug}/notifications`);
      if (result.ok) setUnread(result.data.unread);
    }, 60_000);
    return () => clearInterval(timer);
  }, [slug]);

  async function onOpenChange(open: boolean) {
    if (!open) return;
    const result = await apiRequest<{ items: Item[]; unread: number }>(`/api/w/${slug}/notifications`);
    if (!result.ok) return setItems([]);
    setItems(result.data.items);
    if (result.data.unread) {
      await apiRequest(`/api/w/${slug}/notifications/read`, { method: "POST", body: { ids: "all" } });
      setUnread(0);
      router.refresh();
    }
  }

  return (
    <MenuRoot onOpenChange={onOpenChange}>
      <MenuTrigger
        aria-label={unread ? `Avisos: ${unread} sin leer` : "Avisos"}
        className="relative grid size-9 place-items-center rounded-full text-ink-2 transition-colors hover:bg-pearl hover:text-ink data-popup-open:bg-pearl"
      >
        <svg aria-hidden viewBox="0 0 16 16" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6.5a4 4 0 0 1 8 0c0 2.5.8 3.8 1.5 4.5h-11C3.2 10.3 4 9 4 6.5Z" />
          <path d="M6.5 13a1.6 1.6 0 0 0 3 0" />
        </svg>
        {unread ? <span className="absolute right-0.5 top-0.5 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-4 text-white tabular">{unread > 9 ? "9+" : unread}</span> : null}
      </MenuTrigger>
      <MenuPopup align="end" className="w-80">
        <p className="px-2.5 pb-1.5 pt-1 text-small font-medium text-ink">Avisos</p>
        <MenuSeparator />
        {items === null ? (
          <div className="flex justify-center py-4">
            <Spinner className="size-4" />
          </div>
        ) : items.length === 0 ? (
          <p className="px-2.5 py-3 text-caption text-ink-2">No hay avisos.</p>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {items.map((n) => (
              <MenuLinkItem key={n.id} href={n.href} className="flex-col items-start! gap-0.5!">
                <span className="flex w-full items-center gap-2">
                  {!n.readAt ? <span aria-label="Sin leer" className="size-1.5 shrink-0 rounded-full bg-accent" /> : null}
                  <span className="min-w-0 flex-1 truncate font-medium">{n.title}</span>
                  <span className="shrink-0 text-caption text-ink-3">{when.format(new Date(n.createdAt))}</span>
                </span>
                {n.body ? <span className="line-clamp-2 text-caption text-ink-2">{n.body}</span> : null}
              </MenuLinkItem>
            ))}
          </div>
        )}
      </MenuPopup>
    </MenuRoot>
  );
}
