"use client";

import { useCallback, useRef } from "react";

// Relanza la animación de temblor sobre un elemento sin volver a montarlo
// (así el formulario conserva lo que la persona escribió).
export function useShake<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const shake = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.remove("animate-shake");
    void el.offsetWidth;
    el.classList.add("animate-shake");
  }, []);
  return [ref, shake] as const;
}
