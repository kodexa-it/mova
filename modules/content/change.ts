import type { AnyContent, Format } from "@/modules/content/formats";
import { contentHash } from "@/modules/content/hash";
import { artRefsOf, withoutDesigns } from "@/modules/content/layouts";
import type { StaleReason } from "@/modules/review/approval";

// Qué cambió entre dos versiones, para el motivo explícito de la aprobación
// que queda sin efecto: el texto, solo la composición o el estilo, o una
// imagen generada con IA.
export function changeReason(format: Format, before: unknown, after: AnyContent): StaleReason {
  if (!before) return "content_changed";
  const plain = (c: unknown) => contentHash(withoutDesigns(format, c as Record<string, unknown>));
  if (plain(before) !== plain(after)) return "content_changed";
  const arts = (c: unknown) => JSON.stringify(artRefsOf(format, c as Record<string, unknown>));
  return arts(before) !== arts(after) ? "art_changed" : "design_changed";
}
