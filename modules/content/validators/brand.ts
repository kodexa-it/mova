// Reglas que dependen de la marca: palabras que evita y datos sin completar.
import { wre, type Check } from "@/modules/content/validators/report";

// La IA nunca inventa cifras: cuando falta un dato real deja {{dato}}. Una
// pieza con marcadores sin completar no se puede aprobar.
export const PLACEHOLDER_RE = /\{\{\s*([^{}]{1,80}?)\s*\}\}/g;

export function placeholdersIn(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER_RE)].map((m) => m[1]!.trim());
}

export function brandChecks(text: string, opts: { wordsToAvoid: string[] }): Check[] {
  const checks: Check[] = [];
  const placeholders = [...new Set(placeholdersIn(text))];
  checks.push(
    placeholders.length
      ? { id: "brand.placeholders", label: "Datos por completar", status: "fail", detail: `Falta completar: ${placeholders.map((p) => `{{${p}}}`).join(", ")}. Reemplazalos por datos reales o sacá la frase.` }
      : { id: "brand.placeholders", label: "Datos por completar", status: "pass", detail: "No quedan datos por completar." },
  );
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const avoided = opts.wordsToAvoid.filter((w) => w.trim() && wre(String.raw`\b${escape(w.trim())}\b`).test(text));
  if (avoided.length) checks.push({ id: "brand.avoid", label: "Palabras que la marca evita", status: "fail", detail: `Usa: ${avoided.join(", ")}.` });
  return checks;
}
