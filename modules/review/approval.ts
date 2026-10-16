import { RENDER_VERSION } from "@/modules/content/render/fingerprint";

export type StaleReason = "content_changed" | "design_changed" | "art_changed" | "visual_changed" | "templates_changed" | "proof_changed" | "archived";

export interface ApprovalLike {
  id: string;
  versionId: string;
  contentHash: string;
  visualHash: string;
  renderVersion: string;
  invalidatedAt: Date | null;
  invalidReason: string | null;
  // Snapshot de la apariencia aprobada (para saber qué cambió).
  visual?: unknown;
}

export type ApprovalState<D extends ApprovalLike> =
  | { kind: "none" }
  | { kind: "valid"; decision: D }
  | { kind: "stale"; decision: D; reason: StaleReason };

// ¿La última aprobación sigue valiendo para lo que hoy es la pieza? Vale solo
// si apunta a la versión vigente, con el mismo contenido, la misma apariencia
// y las mismas plantillas. Es la única regla: la usan la revisión, la
// exportación y el registro de publicación.
export function approvalStateOf<D extends ApprovalLike>(
  latest: D | null,
  current: { versionId: string | null; contentHash: string | null; visualHash: string; visual?: unknown },
): ApprovalState<D> {
  if (!latest) return { kind: "none" };
  if (latest.invalidatedAt) return { kind: "stale", decision: latest, reason: (latest.invalidReason as StaleReason | null) ?? "content_changed" };
  if (latest.versionId !== current.versionId || latest.contentHash !== current.contentHash) return { kind: "stale", decision: latest, reason: "content_changed" };
  if (latest.renderVersion !== RENDER_VERSION) return { kind: "stale", decision: latest, reason: "templates_changed" };
  if (latest.visualHash !== current.visualHash) {
    // Mismo contenido (mismas composiciones): si cambió la versión de alguna
    // composición fueron las plantillas; si no, la marca (paleta, nombre, sitio).
    const layoutsOf = (v: unknown) => JSON.stringify((v as { layouts?: unknown } | null | undefined)?.layouts ?? null);
    const reason = current.visual !== undefined && layoutsOf(latest.visual) !== layoutsOf(current.visual) ? "templates_changed" : "visual_changed";
    return { kind: "stale", decision: latest, reason };
  }
  return { kind: "valid", decision: latest };
}

export const STALE_TEXT: Record<StaleReason, string> = {
  content_changed: "se editó el contenido después de aprobarlo",
  design_changed: "cambió la composición o el estilo de las imágenes después de aprobarla",
  art_changed: "se reemplazó o quitó una imagen generada con IA después de aprobarla",
  visual_changed: "cambió la paleta, el nombre o el sitio de la marca, y con eso las imágenes",
  templates_changed: "se actualizaron las plantillas de imágenes de Mova",
  proof_changed: "cambió o se quitó un dato publicable que muestra la pieza",
  archived: "la pieza se archivó",
};
