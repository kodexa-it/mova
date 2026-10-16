import { z } from "zod";

import type { Format } from "@/modules/content/formats";

// Catálogo cerrado de composiciones. Un layout solo decide cómo se dibuja el
// texto que ya tiene la pieza: nunca agrega texto propio. Los datos de "Dato
// grande" salen de los datos publicables de la marca (una copia fija en la
// versión), no de la IA. "Clásico" es la composición original y se guarda como
// ausencia de diseño, para que las versiones anteriores conserven su hash.

export const LAYOUTS = ["classic", "cover-editorial", "cover-device", "steps", "icon-list", "compare", "quote", "stat", "browser", "phone", "cta", "art-cover", "art-panel", "upload"] as const;
export type LayoutId = (typeof LAYOUTS)[number];

// Composiciones del modo premium: combinan una imagen generada con IA (sin
// texto) con el texto, la marca y los elementos de Mova. Nunca las elige la IA
// de texto ni la sugerencia automática: solo una persona, con el modo
// «Generación visual con IA» activado y una imagen generada y confirmada.
export const ART_LAYOUTS = ["art-cover", "art-panel"] as const satisfies readonly LayoutId[];
// Composiciones que muestran un archivo de imagen guardado (generado o subido).
// Todas quedan atadas a la huella del archivo en la aprobación.
export const FILE_LAYOUTS = ["art-cover", "art-panel", "upload"] as const satisfies readonly LayoutId[];
export const usesFile = (layout: LayoutId | undefined) => (FILE_LAYOUTS as readonly string[]).includes(layout ?? "");
export type ArtLayoutId = (typeof ART_LAYOUTS)[number];
export const isArtLayout = (layout: LayoutId | undefined): layout is ArtLayoutId => (ART_LAYOUTS as readonly string[]).includes(layout ?? "");

// Íconos propios (trazos geométricos simples, sin licencia de terceros).
export const ICONS = ["check", "x", "arrow", "clock", "chat", "phone", "globe", "chart", "star", "users", "calendar", "pin", "spark", "shield", "gear", "bulb", "cart", "heart"] as const;
export type IconId = (typeof ICONS)[number];

export const DEVICES = ["browser", "phone", "laptop"] as const;
export type DeviceId = (typeof DEVICES)[number];

export const ICON_LABELS: Record<IconId, string> = {
  check: "Tilde",
  x: "Cruz",
  arrow: "Flecha",
  clock: "Reloj",
  chat: "Mensaje",
  phone: "Teléfono",
  globe: "Web",
  chart: "Gráfico",
  star: "Estrella",
  users: "Personas",
  calendar: "Calendario",
  pin: "Ubicación",
  spark: "Destello",
  shield: "Escudo",
  gear: "Engranaje",
  bulb: "Idea",
  cart: "Carrito",
  heart: "Corazón",
};

export const proofSnapshotSchema = z.object({
  id: z.string().min(1).max(40),
  statement: z.string().max(300),
  source: z.string().max(200),
});
export type ProofSnapshot = z.infer<typeof proofSnapshotSchema>;

// Imagen generada con IA: referencia inmutable (id y huella de sus bytes). El
// archivo vive en la base, dentro del workspace; la versión solo guarda esto.
export const artRefSchema = z.object({
  assetId: z.string().regex(/^[a-z0-9]{8,40}$/i),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});
export type ArtRef = z.infer<typeof artRefSchema>;

export const designSchema = z.object({
  layout: z.enum(LAYOUTS),
  icons: z.array(z.enum(ICONS)).max(5).optional(),
  device: z.enum(DEVICES).optional(),
  proof: proofSnapshotSchema.optional(),
  art: artRefSchema.optional(),
});
export type Design = z.infer<typeof designSchema>;

// ─── Estilo de la pieza (V1b) ───────────────────────────────────────────────
// Se aplica a las composiciones del catálogo (no a la clásica, que no cambia).
// "marca" sin motivo es el estilo por defecto y se guarda como ausencia.

export const PRESETS = ["marca", "claro", "oscuro", "editorial", "impacto"] as const;
export type PresetId = (typeof PRESETS)[number];
export const PRESET_LABELS: Record<PresetId, { label: string; hint: string }> = {
  marca: { label: "De la marca", hint: "Portadas y cierres con el color principal; el resto, claro." },
  claro: { label: "Claro", hint: "Todo sobre fondo claro, con el color de la marca como acento." },
  oscuro: { label: "Oscuro", hint: "Todo sobre el tono más oscuro de la paleta." },
  editorial: { label: "Editorial", hint: "Títulos con tipografía serif (Instrument Serif) y más aire." },
  impacto: { label: "Impacto", hint: "Títulos condensados en mayúsculas, palabras destacadas en el color de la marca y fondos alternados. Aplica a todas las imágenes." },
};

// Recursos gráficos de marca: patrones y formas dibujados con la paleta.
export const MOTIFS = ["none", "dots", "grid", "arcs", "waves", "blocks"] as const;
export type MotifId = (typeof MOTIFS)[number];
export const MOTIF_LABELS: Record<MotifId, string> = {
  none: "Sin patrón",
  dots: "Puntos",
  grid: "Grilla",
  arcs: "Arcos",
  waves: "Ondas",
  blocks: "Bloques",
};

export const pieceStyleSchema = z.object({ preset: z.enum(PRESETS), motif: z.enum(MOTIFS) });
export type PieceStyle = z.infer<typeof pieceStyleSchema>;

export function cleanStyle(style: PieceStyle | undefined): PieceStyle | undefined {
  if (!style || (style.preset === "marca" && style.motif === "none")) return undefined;
  return { preset: style.preset, motif: style.motif };
}

// Sugerencia de estilo a partir de la marca: si su tipografía de títulos es
// serif, el preset editorial; si su estilo de imagen pide algo oscuro, oscuro.
export function suggestStyle(brand: { headingFont?: string | null; imageStyle?: string | null }): PieceStyle {
  const font = (brand.headingFont ?? "").toLowerCase();
  const mood = (brand.imageStyle ?? "").toLowerCase();
  const preset: PresetId = /impacto|audaz|bold|condensad|mayúscul|anton|bebas|oswald/.test(`${mood} ${font}`) ? "impacto" : /serif|garamond|playfair|lora|georgia|times|didot|bodoni/.test(font) && !/sans/.test(font) ? "editorial" : /oscur|dark|noche|negro/.test(mood) ? "oscuro" : /clar|luminos|blanco|minimal/.test(mood) ? "claro" : "marca";
  const motif: MotifId = /geom|tecno|tech|digital|grilla|grid/.test(mood) ? "grid" : /orgán|natural|suave|curv/.test(mood) ? "waves" : "none";
  return { preset, motif };
}

// Lugar que ocupa una imagen dentro de la pieza: define qué layouts admite.
export type SlotRole = "cover" | "middle" | "last" | "single" | "story" | "reel-cover";

export interface Slot {
  role: SlotRole;
  title: string;
  body: string;
  // Etiqueta corta sobre el título ("PREGUNTA INCÓMODA"). Solo carruseles.
  kicker?: string;
  // Stories: con sticker solo se usa la composición clásica (deja el lugar del sticker).
  hasSticker?: boolean;
}

export interface LayoutContext {
  // Datos publicables vigentes de la marca. Sin lista (por ejemplo, en el
  // navegador antes de cargarla), no se comprueba que el dato siga existiendo.
  proofs?: ProofSnapshot[];
}

interface LayoutSpec {
  label: string;
  hint: string;
  roles: readonly SlotRole[];
  // Devuelve por qué no sirve para este texto, o null si sirve.
  check: (slot: Slot, design: Design, ctx: LayoutContext) => string | null;
}

// Palabras destacadas: el texto puede marcar entre *asteriscos* las palabras
// que se pintan en el color de la marca (solo en el estilo Impacto). En el
// resto de las plantillas las marcas no se ven.
export const stripMarks = (text: string) => text.replace(/\*([^*\n]+)\*/g, "$1").replace(/\*/g, "");

export function richParts(text: string): { text: string; em: boolean }[] {
  const parts: { text: string; em: boolean }[] = [];
  const re = /\*([^*\n]+)\*/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index).replace(/\*/g, ""), em: false });
    parts.push({ text: m[1]!, em: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last).replace(/\*/g, ""), em: false });
  return parts.filter((p) => p.text.length);
}

export const lines = (text: string) =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

const tooLong = (text: string, max: number, what: string) => (text.trim().length > max ? `${what}: hasta ${max} caracteres (tiene ${text.trim().length}).` : null);
const first = (...results: (string | null)[]) => results.find((r) => r !== null) ?? null;

function listCheck(slot: Slot, maxLine: number) {
  const items = lines(slot.body);
  if (items.length < 2 || items.length > 5) return `Necesita de 2 a 5 líneas en el texto, una por punto (tiene ${items.length}).`;
  const long = items.findIndex((l) => l.length > maxLine);
  if (long >= 0) return `La línea ${long + 1} es larga: hasta ${maxLine} caracteres por punto.`;
  return tooLong(slot.title, 60, "Título");
}

// Primera cifra de un texto ("120", "35 %", "$18.000", "3,5").
export function leadingFigure(text: string): string | null {
  const match = text.match(/\$\s?\d[\d.,]*|\d[\d.,]*\s?%?/);
  return match ? match[0].trim() : null;
}

const digits = (s: string) => s.replace(/[^\d]/g, "");

// El dato solo se muestra en grande si la cifra también está en el texto de la
// imagen: así la composición no agrega una afirmación nueva.
export function proofMatchesSlot(proof: ProofSnapshot, slot: Slot): boolean {
  const figure = leadingFigure(proof.statement);
  if (!figure) return false;
  const wanted = digits(figure);
  const text = `${slot.title} ${slot.body}`;
  return (text.match(/\d[\d.,]*/g) ?? []).some((n) => digits(n) === wanted);
}

export const LAYOUT_SPECS: Record<LayoutId, LayoutSpec> = {
  classic: { label: "Clásico", hint: "La composición original: título y texto.", roles: ["cover", "middle", "last", "single", "story", "reel-cover"], check: () => null },
  "cover-editorial": {
    label: "Portada editorial",
    hint: "Título grande con una forma de la marca.",
    roles: ["cover", "single", "reel-cover"],
    check: (s) => (!s.title.trim() ? "Necesita un título." : tooLong(s.title, 60, "Título")),
  },
  "cover-device": {
    label: "Portada con dispositivo",
    hint: "Título y un navegador, laptop o teléfono ilustrado.",
    roles: ["cover", "single", "reel-cover"],
    check: (s, d) => (!s.title.trim() ? "Necesita un título." : !d.device ? "Elegí navegador, laptop o teléfono." : tooLong(s.title, 50, "Título")),
  },
  steps: { label: "Pasos numerados", hint: "Cada línea del texto es un paso.", roles: ["middle"], check: (s) => listCheck(s, 90) },
  "icon-list": {
    label: "Lista con íconos",
    hint: "Cada línea del texto con un ícono.",
    roles: ["middle"],
    check: (s, d) => first(listCheck(s, 80), (d.icons?.length ?? 0) !== lines(s.body).length ? "Elegí un ícono para cada línea." : null),
  },
  compare: {
    label: "Comparación",
    hint: "Dos líneas: lo que no conviene y lo que sí.",
    roles: ["middle"],
    check: (s) => {
      const items = lines(s.body);
      if (items.length !== 2) return `Necesita exactamente 2 líneas en el texto (tiene ${items.length}).`;
      return first(tooLong(items[0]!, 120, "Primera línea"), tooLong(items[1]!, 120, "Segunda línea"), tooLong(s.title, 60, "Título"));
    },
  },
  quote: {
    label: "Frase destacada",
    hint: "Una frase de la marca, grande. No es un testimonio.",
    roles: ["middle", "single", "story"],
    check: (s) => {
      const text = (s.body.trim() || s.title.trim());
      if (!text) return "Necesita una frase.";
      if (text.includes("\n")) return "La frase va en un solo párrafo.";
      if (text.length < 20) return "La frase es muy corta para destacarla.";
      return first(tooLong(text, 180, "Frase"), s.hasSticker ? "Con sticker, usá la composición clásica." : null);
    },
  },
  stat: {
    label: "Dato grande",
    hint: "Una cifra de los datos publicables, que también esté en el texto.",
    roles: ["middle", "single", "story"],
    check: (s, d, ctx) => {
      if (s.hasSticker) return "Con sticker, usá la composición clásica.";
      if (!d.proof) return "Elegí un dato publicable de la marca.";
      // Se compara por el texto: guardar la sección de datos recrea los ids.
      if (ctx.proofs && !ctx.proofs.some((p) => p.statement === d.proof!.statement)) return "El dato ya no coincide con los datos publicables de la marca.";
      if (!leadingFigure(d.proof.statement)) return "Ese dato no tiene una cifra para destacar.";
      if (!proofMatchesSlot(d.proof, s)) return "La cifra del dato tiene que aparecer en el texto de esta imagen.";
      return tooLong(s.title, 60, "Título");
    },
  },
  browser: {
    label: "Navegador",
    hint: "Texto y un sitio web ilustrado (sin capturas reales todavía).",
    roles: ["middle", "single"],
    check: (s) => (!s.title.trim() ? "Necesita un título." : first(tooLong(s.title, 60, "Título"), tooLong(s.body, 160, "Texto"))),
  },
  phone: {
    label: "Teléfono",
    hint: "Texto al lado de un teléfono ilustrado.",
    roles: ["middle", "single"],
    check: (s) => (!s.title.trim() ? "Necesita un título." : first(tooLong(s.title, 50, "Título"), tooLong(s.body, 140, "Texto"))),
  },
  cta: {
    label: "Cierre con llamado",
    hint: "Cierre con el pedido destacado y el sitio de la marca.",
    roles: ["last"],
    check: (s) => (!s.title.trim() ? "Necesita un título con el pedido." : first(tooLong(s.title, 60, "Título"), tooLong(s.body, 140, "Texto"))),
  },
  "art-cover": {
    label: "Imagen IA de fondo",
    hint: "Imagen generada con IA a sangre, con el texto de Mova encima.",
    roles: ["cover", "single", "story", "reel-cover"],
    check: (s, d) => {
      if (s.hasSticker) return "Con sticker, usá la composición clásica.";
      const text = s.title.trim() || s.body.trim();
      if (!text) return "Necesita un título.";
      return first(s.title.trim() ? tooLong(s.title, 60, "Título") : tooLong(s.body, 140, "Texto"), s.title.trim() ? tooLong(s.body, 120, "Texto") : null, d.art ? null : "Generá la imagen con IA o elegí una ya generada.");
    },
  },
  upload: {
    label: "Diseño propio",
    hint: "La imagen final la hace un diseñador u otra herramienta y se sube acá. Mova no le agrega nada.",
    roles: ["cover", "middle", "last", "single", "story", "reel-cover"],
    check: (_s, d) => (d.art ? null : "Subí la imagen final de esta posición."),
  },
  "art-panel": {
    label: "Imagen IA con texto",
    hint: "Texto arriba y la imagen generada con IA en un panel.",
    roles: ["middle", "single", "last"],
    check: (s, d) => (!s.title.trim() ? "Necesita un título." : first(tooLong(s.title, 60, "Título"), tooLong(s.body, 160, "Texto"), d.art ? null : "Generá la imagen con IA o elegí una ya generada.")),
  },
};

export function layoutsFor(role: SlotRole): LayoutId[] {
  return LAYOUTS.filter((id) => LAYOUT_SPECS[id].roles.includes(role));
}

export function checkDesign(slot: Slot, design: Design | undefined, ctx: LayoutContext): string | null {
  if (!design || design.layout === "classic") return null;
  const spec = LAYOUT_SPECS[design.layout];
  if (!spec.roles.includes(slot.role)) return `"${spec.label}" no se usa en esta posición.`;
  return spec.check(slot, design, ctx);
}

// ─── Lugares de cada formato ────────────────────────────────────────────────

type Content = Record<string, unknown>;
interface SlideLike {
  title: string;
  body: string;
  kicker?: string;
  design?: Design;
}
interface FrameLike {
  text: string;
  sticker: string;
  design?: Design;
}

export interface SlotRef {
  index: number;
  slot: Slot;
  design: Design | undefined;
}

export function slotsOf(format: Format, content: Content): SlotRef[] {
  switch (format) {
    case "CAROUSEL": {
      const slides = content.slides as SlideLike[];
      return slides.map((s, i) => ({
        index: i,
        slot: { role: i === 0 ? "cover" : i === slides.length - 1 ? "last" : "middle", title: s.title, body: s.body, ...(s.kicker?.trim() ? { kicker: s.kicker.trim() } : {}) },
        design: s.design,
      }));
    }
    case "FEED_IMAGE":
      return [{ index: 0, slot: { role: "single", title: String(content.headline ?? ""), body: String(content.subline ?? "") }, design: content.design as Design | undefined }];
    case "STORY":
      return (content.frames as FrameLike[]).map((f, i) => ({ index: i, slot: { role: "story", title: "", body: f.text, hasSticker: f.sticker !== "NONE" }, design: f.design }));
    case "REEL": {
      const hooks = (content.hooks as string[]) ?? [];
      const title = String(content.coverText || hooks[Number(content.selectedHook) || 0] || "");
      return [{ index: 0, slot: { role: "reel-cover", title, body: "" }, design: content.design as Design | undefined }];
    }
  }
}

// Asigna diseños por lugar. Devuelve una copia: solo cambia `design`.
export function withDesigns<T extends Content>(format: Format, content: T, designs: (Design | undefined)[]): T {
  const pick = (i: number, current: Design | undefined) => (i < designs.length ? designs[i] : current);
  switch (format) {
    case "CAROUSEL":
      return { ...content, slides: (content.slides as SlideLike[]).map((s, i) => setDesign(s, pick(i, s.design))) };
    case "STORY":
      return { ...content, frames: (content.frames as FrameLike[]).map((f, i) => setDesign(f, pick(i, f.design))) };
    default:
      return setDesign(content, pick(0, content.design as Design | undefined));
  }
}

function setDesign<T extends object>(target: T, design: Design | undefined): T {
  const next = { ...target } as T & { design?: Design };
  delete next.design;
  const clean = cleanDesign(design);
  if (clean) next.design = clean;
  return next;
}

// Deja solo los parámetros que usa cada layout. "Clásico" no se guarda.
export function cleanDesign(design: Design | undefined): Design | undefined {
  if (!design || design.layout === "classic") return undefined;
  const out: Design = { layout: design.layout };
  if (design.layout === "icon-list" && design.icons) out.icons = design.icons;
  if (design.layout === "cover-device" && design.device) out.device = design.device;
  if (design.layout === "stat" && design.proof) out.proof = design.proof;
  if (usesFile(design.layout) && design.art) out.art = { assetId: design.art.assetId, sha256: design.art.sha256 };
  return out;
}

function withStyle<T extends Content>(content: T, style: PieceStyle | undefined): T {
  const next = { ...content } as T & { style?: PieceStyle };
  delete next.style;
  const clean = cleanStyle(style);
  if (clean) next.style = clean;
  return next;
}

export function styleOf(content: Content): PieceStyle | undefined {
  return cleanStyle(content.style as PieceStyle | undefined);
}

// Normaliza todos los diseños y el estilo de una pieza (antes de calcular su hash).
export function normalizeDesigns<T extends Content>(format: Format, content: T): T {
  return withStyle(withDesigns(format, content, slotsOf(format, content).map((s) => s.design)), styleOf(content));
}

// La pieza sin ningún diseño ni estilo: para comprobar que una mejora de
// composición no tocó nada más, y para mandarle a la IA solo el texto.
export function withoutDesigns<T extends Content>(format: Format, content: T): T {
  return withStyle(withDesigns(format, content, slotsOf(format, content).map(() => undefined)), undefined);
}

// Imágenes generadas que usa una pieza (para validar que existen y para la huella).
export function artRefsOf(format: Format, content: Content): { index: number; art: ArtRef }[] {
  return slotsOf(format, content).flatMap((r) => (r.design && usesFile(r.design.layout) && r.design.art ? [{ index: r.index, art: r.design.art }] : []));
}

export function usedLayouts(format: Format, content: Content): LayoutId[] {
  return [...new Set(slotsOf(format, content).map((s) => s.design?.layout ?? "classic"))].filter((l) => l !== "classic").sort();
}

// "https://www.kodexa.ar/" → "kodexa.ar". Es lo único del sitio que se dibuja.
export function domainOf(url: string | null | undefined): string | null {
  if (!url) return null;
  const host = url.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0];
  return host || null;
}

// ─── Sugerencia determinista (sin IA, sin costo) ────────────────────────────

const ICON_WORDS: [IconId, RegExp][] = [
  ["clock", /\b(hora|horas|tiempo|rápid|minuto|día|días|tarde|espera)/i],
  ["chat", /\b(mensaje|consulta|whatsapp|chat|respond|contest|escrib)/i],
  ["globe", /\b(web|sitio|página|online|internet|google|dominio)/i],
  ["phone", /\b(teléfono|celular|llamad|app|móvil)/i],
  ["chart", /\b(venta|resultado|crec|métrica|conversi|aument)/i],
  ["users", /\b(cliente|equipo|persona|usuario|gente|público)/i],
  ["calendar", /\b(fecha|turno|agenda|reserva|semana|mes)/i],
  ["shield", /\b(segur|protec|respaldo|garant)/i],
  ["bulb", /\b(idea|consejo|tip|truco)/i],
  ["cart", /\b(compra|carrito|tienda|pedido|precio|presupuesto)/i],
  ["star", /\b(calidad|mejor|premium|destac)/i],
  ["pin", /\b(ubicaci|local|barrio|dirección|zona)/i],
  ["gear", /\b(automatiz|proceso|sistema|integraci|herramienta)/i],
  ["heart", /\b(cuidado|amor|favorit|gusta)/i],
];

export function iconFor(text: string): IconId {
  return ICON_WORDS.find(([, re]) => re.test(text))?.[0] ?? "check";
}

const WEB_RE = /\b(web|sitio|página|landing|online|tienda online|google)/i;
const PHONE_RE = /\b(app|aplicación|celular|whatsapp|móvil|teléfono)/i;
const CONTRAST_RE = /^(no |sin |antes|en vez|evitá|nunca)/i;

function fits(slot: Slot, design: Design, ctx: LayoutContext) {
  return checkDesign(slot, design, ctx) === null;
}

// Una propuesta razonable sin IA: portada y cierre con su composición, pasos o
// íconos para listas, comparación para contrastes, el dato grande solo si la
// cifra está en el texto, y una sola frase destacada para dar ritmo.
// Ritmo: dos imágenes seguidas no repiten la misma composición (ni la misma
// ilustración: un navegador después de una portada con navegador cuenta como
// repetición) y hay como máximo una frase destacada por pieza.
export function familyOf(design: Design | undefined): string | null {
  // Las imágenes generadas las elige una persona: no cuentan para el ritmo.
  if (!design || design.layout === "classic" || usesFile(design.layout)) return null;
  if (design.layout === "browser" || (design.layout === "cover-device" && design.device !== "phone")) return "browser";
  if (design.layout === "phone" || design.layout === "cover-device") return "phone";
  return design.layout;
}

export function breaksRhythm(design: Design | undefined, previous: Design | undefined, quoteUsed: boolean): boolean {
  const family = familyOf(design);
  if (!family) return false;
  return family === familyOf(previous) || (design?.layout === "quote" && quoteUsed);
}

export function suggestDesigns(format: Format, content: Content, ctx: LayoutContext): (Design | undefined)[] {
  const proofs = ctx.proofs ?? [];
  let quoteUsed = false;
  let previous: Design | undefined;
  return slotsOf(format, content).map(({ slot }) => {
    const text = `${slot.title} ${slot.body}`;
    const tryDesigns: Design[] = [];
    const proof = proofs.find((p) => proofMatchesSlot(p, slot));
    if (proof) tryDesigns.push({ layout: "stat", proof });
    switch (slot.role) {
      case "cover":
      case "reel-cover":
        if (WEB_RE.test(text)) tryDesigns.push({ layout: "cover-device", device: "browser" });
        if (PHONE_RE.test(text)) tryDesigns.push({ layout: "cover-device", device: "phone" });
        tryDesigns.push({ layout: "cover-editorial" });
        break;
      case "last":
        tryDesigns.push({ layout: "cta" });
        break;
      case "middle": {
        const items = lines(slot.body);
        if (items.length === 2 && CONTRAST_RE.test(items[0]!)) tryDesigns.push({ layout: "compare" });
        if (items.length >= 2 && (/\bpaso|cómo\b/i.test(slot.title) || items.every((l) => /^\d/.test(l)))) tryDesigns.push({ layout: "steps" });
        if (items.length >= 2) tryDesigns.push({ layout: "icon-list", icons: items.map(iconFor) });
        if (WEB_RE.test(text)) tryDesigns.push({ layout: "browser" });
        if (PHONE_RE.test(text)) tryDesigns.push({ layout: "phone" });
        if (!quoteUsed) tryDesigns.push({ layout: "quote" });
        break;
      }
      case "single":
        if (WEB_RE.test(text)) tryDesigns.push({ layout: "browser" });
        if (PHONE_RE.test(text)) tryDesigns.push({ layout: "phone" });
        tryDesigns.push({ layout: "cover-editorial" });
        break;
      case "story":
        if (!quoteUsed) tryDesigns.push({ layout: "quote" });
        break;
    }
    const chosen = cleanDesign(tryDesigns.find((d) => fits(slot, d, ctx) && !breaksRhythm(d, previous, quoteUsed)));
    if (chosen?.layout === "quote") quoteUsed = true;
    previous = chosen;
    return chosen;
  });
}

// Layouts que sirven hoy para un lugar (con sus parámetros posibles), para
// ofrecérselos a la IA como opciones cerradas.
export function optionsFor(slot: Slot, ctx: LayoutContext) {
  const proofs = (ctx.proofs ?? []).filter((p) => proofMatchesSlot(p, slot));
  return layoutsFor(slot.role).filter((id) => {
    if (id === "classic") return true;
    if (usesFile(id)) return false;
    if (id === "stat") return proofs.some((p) => fits(slot, { layout: "stat", proof: p }, ctx));
    if (id === "icon-list") return fits(slot, { layout: id, icons: lines(slot.body).map(() => "check" as IconId) }, ctx);
    if (id === "cover-device") return fits(slot, { layout: id, device: "browser" }, ctx);
    return fits(slot, { layout: id }, ctx);
  });
}

export const LAYOUT_USES: Record<LayoutId, string> = {
  classic: "cuando ningún otro aporta",
  "cover-editorial": "portada con un título fuerte",
  "cover-device": "portada sobre sitios, apps o servicios digitales",
  steps: "solo si las líneas son una secuencia real de pasos",
  "icon-list": "puntos sueltos, cada uno con un ícono",
  compare: "solo si la primera línea es lo que no conviene y la segunda lo que sí",
  quote: "una frase de la marca para dar ritmo (como máximo una por pieza)",
  stat: "una cifra real que ya está en el texto",
  browser: "cuando el texto habla de un sitio o una página",
  phone: "cuando el texto habla de una app, WhatsApp o el celular",
  cta: "cierre con el pedido a quien lee",
  "art-cover": "solo con imagen generada por IA (no la elige la IA de texto)",
  "art-panel": "solo con imagen generada por IA (no la elige la IA de texto)",
  upload: "solo con un diseño final subido por el equipo (no la elige la IA de texto)",
};

// Al reescribir el texto de una pieza (con IA o al corregir una sugerencia),
// la composición no se pierde: cada imagen conserva la que tenía si sigue
// entrando con el texto nuevo; si no, toma la sugerencia automática. Si la
// pieza nunca tuvo composiciones, recibe la sugerencia completa. Respeta el
// ritmo (sin repeticiones seguidas, una sola frase destacada).
export function carryDesigns<T extends Content>(format: Format, previous: Content | null, next: T, ctx: LayoutContext): T {
  const before = previous ? slotsOf(format, previous).map((s) => s.design) : [];
  const composed = before.some((d) => d && d.layout !== "classic");
  const plain = withoutDesigns(format, next);
  const suggested = suggestDesigns(format, plain, ctx);
  const refs = slotsOf(format, plain);
  const designs: (Design | undefined)[] = refs.map((ref, i) => {
    if (!composed) return suggested[i];
    const kept = before[i];
    if (!kept) return undefined;
    return checkDesign(ref.slot, kept, ctx) === null ? kept : suggested[i];
  });
  let quoteUsed = false;
  for (let i = 0; i < designs.length; i++) {
    if (breaksRhythm(designs[i], designs[i - 1], quoteUsed)) designs[i] = breaksRhythm(suggested[i], designs[i - 1], quoteUsed) ? undefined : suggested[i];
    if (designs[i]?.layout === "quote") quoteUsed = true;
  }
  return withStyle(withDesigns(format, plain, designs), previous ? styleOf(previous) : undefined);
}
