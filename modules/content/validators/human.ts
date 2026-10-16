// Señales de texto escrito en piloto automático, en español. La estructura
// (densidad de frases hechas, huella tipográfica, variación del largo de las
// oraciones) viene de detect.py de instagram-agent-skill (MIT, (c) 2026 Jake
// Schincariol); el léxico en español es propio de Mova.
//
// No es un detector de IA: marca lo que hace que un texto suene genérico.
import { wre, type Check } from "@/modules/content/validators/report";

// Frases hechas frecuentes en textos generados en español. Mantener corta y
// concreta: cada entrada tiene que ser algo que una persona de la marca no diría.
export const STOCK_PHRASES = [
  "en el mundo actual",
  "en la era digital",
  "en el dinámico mundo",
  "en un mundo cada vez más",
  "hoy más que nunca",
  "sin lugar a dudas",
  "cabe destacar",
  "es importante destacar",
  "es fundamental",
  "no es ningún secreto",
  "en conclusión",
  "en resumen",
  "llevar al siguiente nivel",
  "lleva tu negocio al siguiente nivel",
  "un antes y un después",
  "potenciá tu",
  "potencia tu",
  "desbloqueá",
  "desbloquea",
  "sumergite",
  "sumérgete",
  "adentrémonos",
  "revolucionar",
  "revolucionario",
  "transformá tu negocio",
  "transforma tu negocio",
  "soluciones innovadoras",
  "de vanguardia",
  "a la vanguardia",
  "experiencia única",
  "game changer",
  "sinergia",
  "aprovechar al máximo",
  "el secreto mejor guardado",
  "no te lo podés perder",
  "descubrí cómo",
  "te sorprenderá",
  "imperdible",
];

const STRUCTURES: [RegExp, string][] = [
  [wre(String.raw`\bno (?:es )?solo\b[^.!?\n]{2,80}\bsino (?:también|que)\b`), "\"No solo X, sino también Y\""],
  [wre(String.raw`\bno se trata de\b[^.!?\n]{2,60}[.,;] ?se trata de\b`), "\"No se trata de X, se trata de Y\""],
  [wre(String.raw`^\s*(?:¿el resultado\?|¿lo mejor\?|¿el secreto\?)\s*$`, "m"), "Pregunta retórica de una línea"],
  [wre(String.raw`\bcomo (?:modelo de lenguaje|inteligencia artificial|ia)\b`), "Se presenta como IA"],
  [wre(String.raw`^(?:\p{Extended_Pictographic}\s?.+\n){3,}`, "m"), "Lista con un emoji por renglón"],
];

const INVISIBLE_RE = /[\u200B-\u200D\u2060\uFEFF\u00AD]/g;

export function stockPhrasesIn(text: string): string[] {
  const low = text.toLowerCase();
  return STOCK_PHRASES.filter((p) => wre(String.raw`\b${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\b`).test(low));
}

export function humanChecks(text: string): Check[] {
  const checks: Check[] = [];
  const found = stockPhrasesIn(text);
  checks.push(
    found.length
      ? { id: "human.stock", label: "Frases hechas", status: "warn", detail: `Suena genérico: ${found.slice(0, 4).map((f) => `"${f}"`).join(", ")}${found.length > 4 ? "…" : ""}.` }
      : { id: "human.stock", label: "Frases hechas", status: "pass", detail: "Sin frases hechas de la lista." },
  );
  const structures = STRUCTURES.filter(([re]) => re.test(text)).map(([, name]) => name);
  if (structures.length) checks.push({ id: "human.structure", label: "Estructuras repetidas", status: "warn", detail: `${structures.join("; ")}. Decí directamente lo que importa.` });

  const invisible = text.match(INVISIBLE_RE) ?? [];
  if (invisible.length) checks.push({ id: "human.invisible", label: "Caracteres invisibles", status: "fail", detail: `${invisible.length} carácter(es) invisible(s). Se eliminan antes de publicar.` });

  // Variación del largo de las oraciones: los textos en piloto automático escriben parejo.
  const sentences = text.split(/[.!?\n]+/).map((s) => s.trim().split(/\s+/).filter(Boolean).length).filter((n) => n > 2);
  if (sentences.length >= 4) {
    const mean = sentences.reduce((a, b) => a + b, 0) / sentences.length;
    const sd = Math.sqrt(sentences.reduce((a, b) => a + (b - mean) ** 2, 0) / sentences.length);
    const cv = mean ? sd / mean : 0;
    if (cv < 0.3) checks.push({ id: "human.rhythm", label: "Ritmo", status: "warn", detail: "Todas las oraciones tienen un largo parecido. Alterná frases cortas y largas." });
  }
  return checks;
}

export function stripInvisible(text: string): string {
  return text.replace(INVISIBLE_RE, "");
}
