import type { AnyContent, Format } from "@/modules/content/formats";
import { frameLabel, framesOf, isBlankFrame } from "@/modules/content/render/frames";
import type { ProofSnapshot } from "@/modules/content/layouts";
import { validateContent } from "@/modules/content/validators";

export interface Blocker {
  id: string;
  label: string;
  detail: string;
}

// Lo que impide enviar a revisión o aprobar una versión: chequeos fallidos
// (datos por completar {{así}}, palabras que la marca evita, caption vacío…) e
// imágenes sin texto. Se recalcula en el servidor con las reglas vigentes de la
// marca; no se confía en el reporte guardado ni en lo que diga el navegador.
export function reviewBlockers(format: Format, content: AnyContent, brand: { wordsToAvoid: string[]; proofs?: ProofSnapshot[] }): Blocker[] {
  const report = validateContent(format, content, brand);
  const blockers: Blocker[] = report.checks.filter((c) => c.status === "fail").map((c) => ({ id: c.id, label: c.label, detail: c.detail }));
  framesOf(format, content).forEach((frame, i) => {
    if (isBlankFrame(frame)) blockers.push({ id: `frame.${i}.blank`, label: "Imágenes", detail: `${frameLabel(format, frame)} no tiene texto.` });
  });
  return blockers;
}
