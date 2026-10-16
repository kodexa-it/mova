// Puntaje de hooks (primera línea de un Reel o portada de un carrusel).
// Adaptado al español de hookscore.py de instagram-agent-skill (MIT, (c) 2026
// Jake Schincariol). Ver THIRD_PARTY_NOTICES.md.
//
// Qué mide y qué no: separa bien un hook flojo (saludo, preámbulo, nada
// concreto, demasiado largo) de uno aceptable. NO predice cuál de dos hooks
// buenos va a funcionar mejor: en el original, AUC 0,56 entre aciertos y
// fracasos del mismo creador. Se usa como filtro de errores, no como predictor.
import { clamp, concreteMarkers, words, wre, type Check } from "@/modules/content/validators/report";

// Velocidad de habla en español rioplatense: ~150 palabras por minuto.
// A calibrar con grabaciones reales de Kodexa.
export const SPOKEN_WPS = 150 / 60;

const STAKES = new Set([
  "nunca", "jamás", "error", "errores", "equivocado", "perdí", "perdés", "perder", "perdimos", "cuesta", "costó", "caro",
  "gratis", "pagar", "pagás", "nadie", "no", "dejá", "dejar", "sin", "solo", "sólo", "antes", "después", "hasta",
  "pero", "salvo", "problema", "riesgo", "cuidado", "secreto", "verdad", "mentira", "peor", "mejor", "ahorrá",
  "ahorramos", "ahorrar", "evitá", "evitar", "falla", "fallan", "frena", "frenan", "pierden", "multas", "multa",
  "todavía", "ya", "realmente", "deberías", "vs", "versus", "contra", "primero", "primera",
]);

const WEAK_OPENERS = [
  "hola", "buenas", "bueno", "che", "ok", "okey", "hoy", "en este", "en el video", "les quiero", "te quiero contar",
  "quiero", "vamos a", "les cuento", "te cuento", "como sabrán", "sabías que", "alguna vez", "hay muchas", "hay una",
  "esto es", "este es", "es importante", "en el mundo", "en la era",
];

const IMPERATIVES = new Set([
  "dejá", "evitá", "probá", "mirá", "guardá", "usá", "hacé", "revisá", "frená", "empezá", "cambiá", "copiá", "pedí",
  "elegí", "calculá", "preguntá", "nunca", "siempre",
]);

const DEALBREAKERS: [RegExp, string][] = [
  [wre(String.raw`^\s*(?:no (?:sigas|pases|scrollees))`, "i"), "Empieza pidiendo atención (\"no sigas de largo\"): pedirla demuestra que no se la ganó."],
  [wre(String.raw`\b(?:en este (?:video|reel|post)|les voy a (?:mostrar|contar)|te voy a (?:mostrar|contar))\b`, "i"), "Preámbulo. Borralo y empezá por lo que importa."],
  [wre(String.raw`^\s*(?:hola|buenas|¿?qué tal)\b`, "i"), "Saludo. Nadie entra al feed para que lo saluden."],
  [wre(String.raw`(?:^|\s)#\p{L}`, ""), "Hashtag en el hook. Los hashtags van al final del caption."],
  [wre(String.raw`\p{Extended_Pictographic}`, ""), "Emoji en el hook: en texto grande en pantalla entran palabras o emojis, no ambos."],
];

// Voseo: "perdés", "tenés", "podés" le hablan a quien mira. Se excluyen
// palabras comunes con la misma terminación que no son verbos.
const NOT_VOSEO = new Set([
  "más", "además", "después", "detrás", "atrás", "jamás", "quizás", "demás", "país", "inglés", "francés",
  "interés", "través", "cortés", "mes", "res", "japonés", "portugués", "estrés", "revés", "anís", "maís",
]);

function hasVoseo(lowWords: string[]): boolean {
  return lowWords.some((w) => /^\p{L}{2,}(?:ás|és|ís)$/u.test(w) && !NOT_VOSEO.has(w));
}

export interface HookScore {
  score: number;
  verdict: "fuerte" | "aceptable" | "flojo";
  checks: { id: string; label: string; score: number; detail: string }[];
  dealbreakers: string[];
}

export function scoreHook(hook: string): HookScore {
  const text = hook.trim();
  const w = words(text);
  const low = w.map((x) => x.toLowerCase());

  // Largo: que se diga en unos dos segundos (5 a 12 palabras).
  const n = w.length;
  let length = n >= 5 && n <= 12 ? 100 : n < 5 ? 100 - (5 - n) * 20 : 100 - (n - 12) * 11;
  if (text.length > 60) length -= 12;
  const lengthDetail = `${n} palabras, ~${(n / SPOKEN_WPS).toFixed(1)} s dichas (ideal: 5 a 12).`;

  // Especificidad: una cosa concreta.
  const concrete = concreteMarkers(text);
  const specificity = concrete.length ? clamp(45 + concrete.length * 30) : 15;

  // Tensión: algo que se puede perder o ganar.
  const markers = [...new Set(low.filter((x) => STAKES.has(x)))];
  if (/\$\s?\d/.test(text)) markers.push("un precio");
  const stakes = markers.length === 0 ? 20 : markers.length === 1 ? 70 : 100;

  // Lo importante adelante.
  const opener = low.slice(0, 3).join(" ");
  const weak = WEAK_OPENERS.find((o) => opener.startsWith(o));
  const payload = low.findIndex((x, i) => STAKES.has(x) || /^\$?\d/.test(w[i]!) || (i > 0 && /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}$/.test(w[i]!)));
  const base = payload === -1 ? 30 : payload <= 3 ? 100 : payload <= 6 ? 70 : 40;
  const frontload = clamp(base - (weak ? 30 : 0));

  // A quién le habla.
  const address = wre(String.raw`\b(vos|te|tu|tus|usted|ustedes)\b`).test(text) || hasVoseo(low)
    ? 100
    : IMPERATIVES.has(low[0] ?? "")
      ? 90
      : wre(String.raw`\b(yo|mi|mis|nosotros|nuestro|nuestra|nuestros|nuestras)\b`).test(text)
        ? 70
        : 35;

  const checks = [
    { id: "hook.length", label: "Largo", score: clamp(length), detail: lengthDetail },
    { id: "hook.specificity", label: "Algo concreto", score: specificity, detail: concrete.length ? `Tiene: ${concrete.slice(0, 2).join(", ")}.` : "Sin cifra ni nombre: nada comprobable." },
    { id: "hook.stakes", label: "Tensión", score: stakes, detail: markers.length ? `Marcas: ${markers.slice(0, 3).join(", ")}.` : "No hay nada en juego en la frase." },
    {
      id: "hook.frontload",
      label: "Lo importante adelante",
      score: frontload,
      detail: (payload === -1 ? "No hay palabra fuerte en la frase." : `Palabra fuerte en la posición ${payload + 1}.`) + (weak ? ` Arranque flojo: "${weak}".` : ""),
    },
    { id: "hook.address", label: "A quién le habla", score: address, detail: address === 100 ? "Le habla a quien mira." : address === 90 ? "Arranca con un imperativo." : address === 70 ? "Primera persona, sin nombrar a quien mira." : "Tercera persona: no le habla a nadie." },
  ];
  const dealbreakers = DEALBREAKERS.filter(([re]) => re.test(text)).map(([, msg]) => msg);
  const scores = checks.map((c) => c.score);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const score = Math.round(clamp(mean * 0.6 + Math.min(...scores) * 0.4 - dealbreakers.length * 15));
  const verdict = score >= 70 && Math.min(...scores) >= 55 && !dealbreakers.length ? "fuerte" : score >= 50 ? "aceptable" : "flojo";
  return { score, verdict, checks, dealbreakers };
}

export function hookChecks(hook: string, label = "Hook"): Check[] {
  if (!hook.trim()) return [{ id: "hook", label, status: "fail", detail: "Falta el hook." }];
  const result = scoreHook(hook);
  const weakest = [...result.checks].sort((a, b) => a.score - b.score)[0]!;
  const out: Check[] = [
    {
      id: "hook",
      label,
      status: result.verdict === "flojo" ? "warn" : "pass",
      detail: `Puntaje ${result.score} (${result.verdict}).${result.verdict === "fuerte" ? "" : ` Lo más débil: ${weakest.label.toLowerCase()}. ${weakest.detail}`}`,
    },
  ];
  for (const d of result.dealbreakers) out.push({ id: "hook.dealbreaker", label, status: "warn", detail: d });
  return out;
}
