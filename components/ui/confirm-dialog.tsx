"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { useCallback, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

export interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
}

// Diálogo de confirmación para acciones que no se deshacen. Reemplaza a
// window.confirm: usa el sistema visual, atrapa el foco y se cierra con Escape.
//
//   const [confirm, dialog] = useConfirm();
//   if (await confirm({ title: "¿Quitar a Eva?", confirmLabel: "Quitar", tone: "danger" })) { ... }
//   return <>{dialog}...</>;
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [open, setOpen] = useState(false);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((next: ConfirmOptions) => {
    setOptions(next);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOpen(false);
  };

  const dialog = (
    <AlertDialog.Root open={open} onOpenChange={(next) => (next ? setOpen(true) : settle(false))}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fade fixed inset-0 z-40 bg-ink/20 backdrop-blur-[2px]" />
        <AlertDialog.Popup className="pop glass fixed left-1/2 top-1/2 z-50 w-[26rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-sheet)] p-6 outline-none">
          {options ? (
            <>
              <AlertDialog.Title className="text-title font-semibold text-ink">{options.title}</AlertDialog.Title>
              {options.description ? (
                <AlertDialog.Description className="mt-2 text-body text-ink-2">{options.description}</AlertDialog.Description>
              ) : null}
              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <AlertDialog.Close render={<Button variant="secondary" />}>{options.cancelLabel ?? "Cancelar"}</AlertDialog.Close>
                <Button variant={options.tone === "danger" ? "danger" : "primary"} onClick={() => settle(true)}>
                  {options.confirmLabel}
                </Button>
              </div>
            </>
          ) : null}
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );

  return [confirm, dialog] as const;
}
