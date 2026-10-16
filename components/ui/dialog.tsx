"use client";

import { Dialog } from "@base-ui/react/dialog";
import type { ReactNode } from "react";

// Diálogo genérico con vidrio. Para confirmar acciones irreversibles usar
// useConfirm (AlertDialog).
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  size = "md",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  size?: "md" | "lg";
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fade fixed inset-0 z-40 bg-ink/20 backdrop-blur-[2px]" />
        <Dialog.Popup
          className={`pop glass fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-full -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[var(--radius-sheet)] p-6 outline-none ${
            size === "lg" ? "max-w-[min(40rem,calc(100vw-2rem))]" : "max-w-[min(28rem,calc(100vw-2rem))]"
          }`}
        >
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-title font-semibold text-ink">{title}</Dialog.Title>
              {description ? <Dialog.Description className="mt-1.5 text-body text-ink-2">{description}</Dialog.Description> : null}
            </div>
            <Dialog.Close aria-label="Cerrar" className="grid size-8 shrink-0 place-items-center rounded-[9px] text-ink-2 transition-colors hover:bg-ink/[0.06] hover:text-ink">
              <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <path d="m4 4 8 8M12 4l-8 8" />
              </svg>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
