// Prompts de producción de piezas. La metodología editorial (ventana de 125
// caracteres, un solo pedido, hasta 5 hashtags, portada corta, una idea por
// slide, tres hooks de fórmulas distintas, pedido en el frame 4, nunca inventar
// datos) se adapta de instagram-agent-skill (MIT, (c) 2026 Jake Schincariol).
// Ver THIRD_PARTY_NOTICES.md. Versión del prompt: se guarda con cada llamada.
import { DIALS, EMOJI_LABELS } from "@/modules/brand/sections";
import { FORMAT_LABELS, type Format } from "@/modules/content/formats";

export const PROMPT_VERSION = "piezas-2026-10-16";

export interface BrandContext {
  name: string;
  industry: string;
  description: string;
  website: string | null;
  offerings: { name: string; description: string }[];
  audiences: { name: string; description: string; painPoints: string[] }[];
  goals: { title: string; kpi: string; target: string }[];
  pillars: { name: string; description: string; weight: number }[];
  proofs: { statement: string; source: string }[];
  rules: { kind: "ALWAYS" | "NEVER"; text: string }[];
  voice: {
    formality: number;
    humor: number;
    technicality: number;
    enthusiasm: number;
    wordsToUse: string[];
    wordsToAvoid: string[];
    emojiPolicy: "NONE" | "FEW" | "FREE";
    examples: string[];
  } | null;
}

export const SYSTEM_PROMPT = [
  "Sos el redactor de contenido de Mova para Instagram. Escribís para empresas de Argentina, en español rioplatense (voseo), con la voz de cada marca.",
  "Reglas que no se rompen:",
  "1. Nunca inventes cifras, porcentajes, clientes, testimonios, premios ni resultados. Solo podés usar los datos de la lista \"Datos reales\". Si una idea necesita un dato que no está, escribí un marcador {{qué dato falta}} para que la persona lo complete.",
  "2. Respetá las reglas de la marca y no uses sus palabras a evitar.",
  "3. Un ángulo concreto por pieza, no un tema general.",
  "4. Nada de frases hechas (\"en el mundo actual\", \"llevá tu negocio al siguiente nivel\", \"no solo X sino también Y\").",
  "5. Respondé solo con un objeto JSON válido con la forma pedida, sin texto antes ni después.",
].join("\n");

const FORMAT_RULES: Record<Format, string> = {
  FEED_IMAGE: [
    "Publicación de una imagen.",
    "- headline: titular en la imagen, 4 a 8 palabras, algo concreto.",
    "- subline: bajada opcional, una frase.",
    "- visualNotes: qué foto o recurso usar (fotos reales de la marca, nada de bancos de imágenes genéricos).",
  ].join("\n"),
  CAROUSEL: [
    "Carrusel de 5 a 8 slides (máximo 10).",
    "- slides[0].title es la portada: 6 palabras o menos, con algo concreto o en juego.",
    "- Una sola idea por slide: title corto y body de hasta 2 frases.",
    "- El último slide resume y cierra con el pedido.",
    "- kicker (opcional): etiqueta de 1 a 3 palabras sobre el título, que nombra el tipo de idea (por ejemplo: PREGUNTA INCÓMODA, EN INSTAGRAM, LO QUE NADIE TE DICE). Usala en la portada y donde ordene la serie; no en todas.",
    "- En title (y a veces en body) marcá entre *asteriscos* de 1 a 4 palabras clave que se pintan en el color de la marca. Una sola marca por slide. En el cierre, marcá la palabra que la persona tiene que comentar o hacer (por ejemplo: Comentá *WEB*).",
  ].join("\n"),
  REEL: [
    "Guion de Reel. La marca graba el video; vos escribís qué se dice y qué se lee.",
    "- hooks: 3 opciones de primera línea con fórmulas distintas (dato, error, contraste, pregunta concreta). 5 a 12 palabras, sin saludos ni \"en este video\".",
    "- selectedHook: índice (0, 1 o 2) del hook que recomendás.",
    "- script: líneas cortas en orden; la primera repite el hook elegido. Cada línea se dice en menos de 4 segundos (unas 10 palabras). onScreen es el texto en pantalla de esa línea (puede ir vacío).",
    "- La duración total tiene que aproximarse a targetSeconds (150 palabras por minuto).",
    "- coverText: texto de portada, 5 palabras o menos.",
  ].join("\n"),
  STORY: [
    "Secuencia de Stories de 4 a 6 frames.",
    "- Cada frame: text breve. El pedido principal va en el frame 4.",
    "- sticker: NONE, POLL, QUESTION, QUIZ, LINK o COUNTDOWN; stickerText es el texto del sticker. Usá stickers solo donde suman.",
  ].join("\n"),
};

const SHAPES: Record<Format, string> = {
  FEED_IMAGE: '{"caption":"","altText":"","hashtags":[],"headline":"","subline":"","visualNotes":""}',
  CAROUSEL: '{"caption":"","altText":"","hashtags":[],"slides":[{"kicker":"","title":"","body":""}]}',
  REEL: '{"caption":"","altText":"","hashtags":[],"hooks":["","",""],"selectedHook":0,"script":[{"say":"","onScreen":""}],"targetSeconds":30,"coverText":""}',
  STORY: '{"caption":"","altText":"","hashtags":[],"frames":[{"text":"","sticker":"NONE","stickerText":""}]}',
};

const CAPTION_RULES = [
  "Caption:",
  "- La primera línea es el gancho y se lee completa en los primeros 125 caracteres.",
  "- Un solo pedido claro a quien lee (guardar, escribir, consultar…), no dos.",
  "- Sin enlaces en el texto. Hashtags: entre 0 y 5, sobre el tema, sin el símbolo # (van en el campo hashtags).",
  "- altText describe la imagen o el video para quien usa lector de pantalla.",
].join("\n");

function dialText(value: number, low: string, high: string) {
  return value <= 2 ? low.toLowerCase() : value >= 4 ? high.toLowerCase() : `entre ${low.toLowerCase()} y ${high.toLowerCase()}`;
}

export function brandBlock(b: BrandContext): string {
  const lines: string[] = [
    `Marca: ${b.name} (${b.industry}).`,
    `Qué hace: ${b.description}`,
    b.offerings.length ? `Servicios: ${b.offerings.map((o) => (o.description ? `${o.name} (${o.description})` : o.name)).join("; ")}.` : "",
    b.audiences.length
      ? `Público: ${b.audiences.map((a) => `${a.name}${a.painPoints.length ? `, le preocupa: ${a.painPoints.join(", ")}` : ""}`).join("; ")}.`
      : "",
    b.goals.length ? `Objetivos: ${b.goals.map((g) => (g.kpi ? `${g.title} (se mide por ${g.kpi})` : g.title)).join("; ")}.` : "",
  ];
  if (b.voice) {
    lines.push(`Voz: ${DIALS.map((d) => dialText(b.voice![d.key], d.low, d.high)).join(", ")}. Emojis: ${EMOJI_LABELS[b.voice.emojiPolicy].toLowerCase()}.`);
    if (b.voice.wordsToUse.length) lines.push(`Palabras que usa: ${b.voice.wordsToUse.join(", ")}.`);
    if (b.voice.wordsToAvoid.length) lines.push(`Palabras que NUNCA usa: ${b.voice.wordsToAvoid.join(", ")}.`);
    if (b.voice.examples.length) lines.push(`Textos reales de la marca, para imitar el tono:\n${b.voice.examples.map((e) => `"""${e}"""`).join("\n")}`);
  }
  const always = b.rules.filter((r) => r.kind === "ALWAYS").map((r) => r.text);
  const never = b.rules.filter((r) => r.kind === "NEVER").map((r) => r.text);
  if (always.length) lines.push(`Siempre: ${always.join("; ")}.`);
  if (never.length) lines.push(`Nunca: ${never.join("; ")}.`);
  lines.push(
    b.proofs.length
      ? `Datos reales (los únicos que podés usar):\n${b.proofs.map((p) => `- ${p.statement} (fuente: ${p.source})`).join("\n")}`
      : "Datos reales: no hay ninguno cargado. Cualquier cifra o resultado va como {{marcador}}.",
  );
  return lines.filter(Boolean).join("\n");
}

export interface PieceBrief {
  format: Format;
  title: string;
  pillar: string | null;
  goal: string | null;
  angle: string;
  instructions: string;
  currentContent: string | null;
}

export function piecePrompt(brand: BrandContext, brief: PieceBrief): string {
  return [
    `# Marca\n${brandBlock(brand)}`,
    `# Pieza\nFormato: ${FORMAT_LABELS[brief.format]}.\nTema de trabajo: ${brief.title}.${brief.pillar ? `\nPilar: ${brief.pillar}.` : ""}${brief.goal ? `\nObjetivo: ${brief.goal}.` : ""}${brief.angle ? `\nÁngulo: ${brief.angle}.` : ""}`,
    `# Reglas del formato\n${FORMAT_RULES[brief.format]}\n\n${CAPTION_RULES}`,
    brief.currentContent ? `# Versión actual\nMejorá esta versión; conservá lo que ya funciona.\n${brief.currentContent}` : "",
    brief.instructions ? `# Indicaciones de la persona\n${brief.instructions}` : "",
    `# Forma de la respuesta\n${SHAPES[brief.format]}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}
