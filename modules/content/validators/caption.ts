// Validador de captions. Adaptado al español de caption.py de
// instagram-agent-skill (MIT, (c) 2026 Jake Schincariol). Ver THIRD_PARTY_NOTICES.md.
import { concreteMarkers, wre, type Check } from "@/modules/content/validators/report";

export const CAPTION_LIMIT = 2200; // Límite duro de Instagram.
export const FEED_WINDOW = 125; // Aproximado: lo que se ve antes de "... más".
export const HASHTAG_LIMIT = 5; // Tope de Instagram desde diciembre de 2025.

const HASHTAG_RE = /(?:^|\s)(#[\p{L}\p{N}_]+)/gu;
const LINK_RE = /https?:\/\/\S+|\bwww\.\S+|\b[a-z0-9-]+\.(?:com|com\.ar|ar|io|net|org|ai|app)\/\S*/gi;
const EMOJI_RE = /\p{Extended_Pictographic}/gu;

// Pedidos a la audiencia. Más de uno diluye la acción.
const ASKS: [RegExp, string][] = [
  [wre(String.raw`\bcoment[aá]\b|\bdejanos (?:un|tu) comentario\b|\bescrib[ií] (?:la palabra|"?\p{Lu}{3,})`, "i"), "comentar"],
  [wre(String.raw`\b(?:escribinos|mandanos|envianos) (?:un )?(?:dm|mensaje|privado|whatsapp)\b|\bpor (?:dm|privado|mensaje)\b`, "i"), "escribir por mensaje"],
  [wre(String.raw`\bguard[aá] (?:este|esta|el|la)\b|\bguardalo\b|\bguardala\b`, "i"), "guardar"],
  [wre(String.raw`\bcompart[ií] (?:este|esta|con)\b|\bcompartilo\b|\bcompartila\b`, "i"), "compartir"],
  [wre(String.raw`\bseguinos\b|\bseguí (?:a|la cuenta)\b`, "i"), "seguir la cuenta"],
  [wre(String.raw`\blink en (?:la )?bio\b|\benlace en (?:la )?bio\b`, "i"), "ir al link de la bio"],
  [wre(String.raw`\b(?:desliz[aá]|pas[aá]) (?:para|a la)\b`, "i"), "deslizar"],
  [wre(String.raw`\bcontanos\b|(?:qué|cuál) (?:opinás|preferís|elegís)\b`, "i"), "responder una pregunta"],
  [wre(String.raw`\b(?:pedí|reservá|agendá|consultá|solicitá)\b`, "i"), "consultar o reservar"],
];

// Etiquetas genéricas que no describen nada.
const FILLER_TAGS = new Set([
  "#viral", "#fyp", "#parati", "#foryou", "#explore", "#explorar", "#trending", "#tendencia",
  "#instagood", "#love", "#follow", "#seguidores", "#like4like", "#likes", "#reels", "#reelsinstagram",
  "#instadaily", "#argentina",
]);

export function captionChecks(caption: string, hashtags: string[] = []): Check[] {
  const text = caption.trim();
  const checks: Check[] = [];
  const add = (id: string, label: string, status: Check["status"], detail: string) => checks.push({ id, label, status, detail });

  const inline = [...text.matchAll(HASHTAG_RE)].map((m) => m[1]!.toLowerCase());
  const tags = [...new Set([...inline, ...hashtags.map((t) => (t.startsWith("#") ? t : `#${t}`).toLowerCase())])];
  const window = text.length <= FEED_WINDOW ? text : text.slice(0, FEED_WINDOW);
  const firstLine = text.split("\n")[0]?.trim() ?? "";

  add(
    "caption.length",
    "Largo",
    !text ? "fail" : text.length > CAPTION_LIMIT ? "fail" : "pass",
    !text ? "El caption está vacío." : `${text.length} de ${CAPTION_LIMIT} caracteres.`,
  );

  if (!firstLine) add("caption.first-line", "Primera línea", "fail", "Empieza con una línea en blanco.");
  else if (firstLine.startsWith("#") || firstLine.startsWith("@"))
    add("caption.first-line", "Primera línea", "fail", "Empieza con un hashtag o una mención: es el lugar más valioso del caption.");
  else if (firstLine.length > FEED_WINDOW)
    add("caption.first-line", "Primera línea", "warn", `${firstLine.length} caracteres: el feed la corta a los ${FEED_WINDOW}. Que el corte deje intriga, no media frase.`);
  else add("caption.first-line", "Primera línea", "pass", `${firstLine.length} caracteres, se ve completa.`);

  const concrete = concreteMarkers(window);
  add(
    "caption.concrete",
    "Gancho concreto",
    concrete.length ? "pass" : "warn",
    concrete.length ? `Antes del "más" hay algo concreto: ${concrete.slice(0, 2).join(", ")}.` : "Antes del \"más\" no hay ninguna cifra ni nombre: nada que invite a seguir leyendo.",
  );

  const filler = tags.filter((t) => FILLER_TAGS.has(t));
  if (tags.length > HASHTAG_LIMIT)
    add("caption.hashtags", "Hashtags", "fail", `${tags.length} hashtags: Instagram toma hasta ${HASHTAG_LIMIT}. Elegí los temas, no la cantidad.`);
  else if (filler.length)
    add("caption.hashtags", "Hashtags", "warn", `${filler.length} genérico(s) (${filler.slice(0, 3).join(", ")}): no describen el tema.`);
  else add("caption.hashtags", "Hashtags", "pass", tags.length ? `${tags.length}: ${tags.join(" ")}.` : "Sin hashtags.");

  if (inline.some((t) => window.toLowerCase().includes(t)))
    add("caption.tag-placement", "Lugar de los hashtags", "warn", "Hay un hashtag en la parte visible: ocupa el espacio del gancho.");

  const links = text.match(LINK_RE) ?? [];
  if (links.length) add("caption.links", "Enlaces", "warn", "Los enlaces en el caption no se pueden tocar. Llevalos a la bio o a un mensaje.");

  const asks = ASKS.filter(([re]) => re.test(text)).map(([, name]) => name);
  if (asks.length === 1) add("caption.ask", "Llamado a la acción", "pass", `Uno: ${asks[0]}.`);
  else if (!asks.length) add("caption.ask", "Llamado a la acción", "warn", "No hay un pedido claro. Definí qué querés que haga quien lee.");
  else add("caption.ask", "Llamado a la acción", "warn", `${asks.length} pedidos (${asks.join(", ")}): dos pedidos valen lo mismo que ninguno.`);

  const emoji = text.match(EMOJI_RE) ?? [];
  const density = (emoji.length * 100) / Math.max(text.length, 1);
  if (density > 4) add("caption.emoji", "Emojis", "warn", `${emoji.length} emojis, ${density.toFixed(1)} cada 100 caracteres: se leen como decoración.`);

  return checks;
}
