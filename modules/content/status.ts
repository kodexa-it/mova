import type { ContentStatus } from "@prisma/client";

// Única fuente de las transiciones de estado de una pieza (ADR 0002 y etapa 4).
export const TRANSITIONS: Record<ContentStatus, readonly ContentStatus[]> = {
  DRAFT: ["PENDING_APPROVAL", "ARCHIVED"],
  PENDING_APPROVAL: ["DRAFT", "APPROVED", "ARCHIVED"],
  APPROVED: ["SCHEDULED", "DRAFT", "PUBLISHED", "ARCHIVED"],
  SCHEDULED: ["APPROVED", "PUBLISHING", "PUBLISHED", "DRAFT", "ARCHIVED"],
  PUBLISHING: ["PUBLISHED", "FAILED"],
  FAILED: ["SCHEDULED", "DRAFT", "ARCHIVED"],
  PUBLISHED: [],
  ARCHIVED: ["DRAFT"],
};

export function canTransition(from: ContentStatus, to: ContentStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

// Editar una pieza crea una versión nueva. Si estaba pendiente, aprobada o
// programada, vuelve a borrador: la aprobación vale para una versión exacta.
export function statusAfterEdit(current: ContentStatus): ContentStatus | "locked" {
  if (current === "PUBLISHING" || current === "PUBLISHED") return "locked";
  if (current === "ARCHIVED") return "locked";
  return "DRAFT";
}

export const STATUS_LABELS: Record<ContentStatus, string> = {
  DRAFT: "Borrador",
  PENDING_APPROVAL: "Pendiente de aprobación",
  APPROVED: "Aprobado",
  SCHEDULED: "Programado",
  PUBLISHING: "Publicando",
  PUBLISHED: "Publicado",
  FAILED: "Falló",
  ARCHIVED: "Archivado",
};

export const STATUS_TONES: Record<ContentStatus, "neutral" | "accent" | "success" | "warning" | "danger"> = {
  DRAFT: "neutral",
  PENDING_APPROVAL: "warning",
  APPROVED: "success",
  SCHEDULED: "accent",
  PUBLISHING: "accent",
  PUBLISHED: "success",
  FAILED: "danger",
  ARCHIVED: "neutral",
};
