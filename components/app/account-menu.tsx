"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { MenuItem, MenuLinkItem, MenuPopup, MenuRoot, MenuSeparator, MenuTrigger, Spinner } from "@/components/ui";
import { authClient } from "@/lib/auth/client";

import { initials } from "./initials";

export function AccountMenu({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  return (
    <MenuRoot>
      <MenuTrigger
        aria-label={`Cuenta de ${name}`}
        className="grid size-9 place-items-center rounded-full bg-pearl text-caption font-semibold text-ink-2 transition-[background-color,box-shadow] duration-[var(--dur-fast)] hover:bg-pearl-strong data-popup-open:bg-pearl-strong data-popup-open:shadow-[0_0_0_3px_rgb(61_58_216/0.18)]"
      >
        {initials(name)}
      </MenuTrigger>
      <MenuPopup align="end" className="w-64">
        <div className="px-2.5 pb-2 pt-1.5">
          <p className="truncate text-small font-medium text-ink">{name}</p>
          <p className="truncate text-caption text-ink-2">{email}</p>
        </div>
        <MenuSeparator />
        <MenuLinkItem href="/w">Tus workspaces</MenuLinkItem>
        <MenuSeparator />
        <MenuItem
          closeOnClick={false}
          disabled={leaving}
          onClick={async () => {
            setLeaving(true);
            await authClient.signOut();
            router.push("/ingresar");
            router.refresh();
          }}
        >
          {leaving ? <Spinner className="size-3.5" /> : null}
          Cerrar sesión
        </MenuItem>
      </MenuPopup>
    </MenuRoot>
  );
}
