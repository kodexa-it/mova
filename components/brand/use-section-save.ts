"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useToast } from "@/components/ui";
import { apiRequest } from "@/lib/errors";
import { nextSection, SECTIONS, type SectionKey } from "@/modules/brand/sections";

export type FieldErrors = Record<string, string>;

// Valida con el mismo esquema que el servidor, guarda la sección y avanza a la
// siguiente. Los errores quedan indexados por ruta ("items.0.name").
export function useSectionSave(slug: string, section: SectionKey) {
  const router = useRouter();
  const toast = useToast();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save(data: unknown, { advance }: { advance: boolean }) {
    const parsed = SECTIONS[section].schema.safeParse(data);
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");
        next[key] ??= issue.message;
      }
      setErrors(next);
      setFormError("Revisá los campos marcados.");
      return false;
    }
    setErrors({});
    setFormError(null);
    setPending(true);
    const result = await apiRequest(`/api/w/${slug}/brand/${section}`, { method: "PUT", body: parsed.data });
    setPending(false);
    if (!result.ok) {
      setFormError(result.message);
      return false;
    }
    toast.success(`${SECTIONS[section].title}: guardado`);
    const next = nextSection(section);
    router.push(advance && next ? `/w/${slug}/marca/${next}` : `/w/${slug}/marca`);
    router.refresh();
    return true;
  }

  return { save, errors, formError, pending };
}
