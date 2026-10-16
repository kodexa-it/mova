"use client";

import { Toast } from "@base-ui/react/toast";
import type { ReactNode } from "react";

// Notificaciones de Mova: confirman lo que acaba de pasar (guardado, enviado,
// quitado). Los errores que la persona tiene que corregir se muestran junto al
// formulario, no acá.
export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <Toast.Provider timeout={4500} limit={3}>
      {children}
      <Toast.Portal>
        <Toast.Viewport className="fixed bottom-4 right-4 z-50 mx-auto w-[calc(100vw-2rem)] outline-none sm:bottom-6 sm:right-6 sm:w-[22rem]">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

const ICONS: Record<string, ReactNode> = {
  success: <path d="m5.25 8.25 1.9 1.9 3.6-4.1M14.25 8a6.25 6.25 0 1 1-12.5 0 6.25 6.25 0 0 1 12.5 0Z" />,
  error: <path d="M8 5v3.5M8 10.75h.01M14.25 8a6.25 6.25 0 1 1-12.5 0 6.25 6.25 0 0 1 12.5 0Z" />,
  info: <path d="M8 7.25v3.5M8 5.25h.01M14.25 8a6.25 6.25 0 1 1-12.5 0 6.25 6.25 0 0 1 12.5 0Z" />,
};

const ICON_TONE: Record<string, string> = {
  success: "text-success",
  error: "text-danger",
  info: "text-accent",
};

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return toasts.map((toast) => {
    const type = toast.type ?? "info";
    return (
      <Toast.Root key={toast.id} toast={toast} className="toast glass focus-visible:shadow-[var(--focus-ring)]">
        <Toast.Content className="toast-content flex items-start gap-3 py-3.5 pl-4 pr-2.5">
          <svg
            aria-hidden
            viewBox="0 0 16 16"
            className={`mt-0.5 size-[18px] shrink-0 ${ICON_TONE[type] ?? "text-accent"}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {ICONS[type] ?? ICONS.info}
          </svg>
          <div className="min-w-0 flex-1">
            <Toast.Title className="text-body font-medium text-ink" />
            <Toast.Description className="mt-0.5 text-small text-ink-2 empty:hidden" />
          </div>
          <Toast.Close
            aria-label="Cerrar"
            className="grid size-7 shrink-0 place-items-center rounded-[8px] text-ink-2 transition-colors hover:bg-ink/5 hover:text-ink"
          >
            <svg aria-hidden viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="m4 4 8 8M12 4l-8 8" />
            </svg>
          </Toast.Close>
        </Toast.Content>
      </Toast.Root>
    );
  });
}

// Atajo para mostrar notificaciones desde cualquier componente cliente.
export function useToast() {
  const manager = Toast.useToastManager();
  return {
    success: (title: string, description?: string) => manager.add({ title, description, type: "success" }),
    error: (title: string, description?: string) => manager.add({ title, description, type: "error", priority: "high" }),
    info: (title: string, description?: string) => manager.add({ title, description, type: "info" }),
  };
}
