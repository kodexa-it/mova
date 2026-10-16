"use client";

import { Menu } from "@base-ui/react/menu";
import type { ComponentProps, ReactNode } from "react";

// Menús desplegables con vidrio. Root y Trigger son los de Base UI; este módulo
// define el aspecto de la capa flotante y de sus ítems.
export const MenuRoot = Menu.Root;
export const MenuTrigger = Menu.Trigger;

export function MenuPopup({
  children,
  align = "start",
  className = "",
}: {
  children: ReactNode;
  align?: "start" | "center" | "end";
  className?: string;
}) {
  return (
    <Menu.Portal>
      <Menu.Positioner sideOffset={8} align={align} className="z-50 outline-none">
        <Menu.Popup className={`pop glass min-w-[14rem] rounded-[14px] p-1.5 outline-none ${className}`}>{children}</Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  );
}

const itemClass =
  "flex w-full cursor-default select-none items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-small text-ink outline-none " +
  "data-highlighted:bg-ink/[0.06] data-disabled:text-ink-3";

export function MenuItem({ className = "", ...props }: ComponentProps<typeof Menu.Item>) {
  return <Menu.Item className={`${itemClass} ${className}`} {...props} />;
}

export function MenuLinkItem({ className = "", ...props }: ComponentProps<typeof Menu.LinkItem>) {
  return <Menu.LinkItem className={`${itemClass} ${className}`} {...props} />;
}

export function MenuSeparator() {
  return <Menu.Separator className="mx-1 my-1.5 h-px bg-ink/[0.08]" />;
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <Menu.Group>
      <Menu.GroupLabel className="px-2.5 pb-1 pt-1.5 text-caption text-ink-2">{children}</Menu.GroupLabel>
    </Menu.Group>
  );
}
