import { FORMAT_LABELS, type AnyContent, type Format, type FormatContent } from "@/modules/content/formats";
import { LAYOUT_SPECS, PRESET_LABELS, richParts, slotsOf, stripMarks, styleOf, type Slot } from "@/modules/content/layouts";
import { frameLabel, framesOf, sizeOf } from "@/modules/content/render/frames";

// Brief de diseño de una pieza: todo lo que necesita un diseñador (o la IA que
// la persona prefiera) para hacer las imágenes finales sin inventar nada. Se
// arma con los datos de la marca y el texto de la versión; no usa IA ni cuesta.

export interface BriefInput {
  brand: {
    name: string;
    industry: string;
    website: string | null;
    audiences: string[];
    palette: { name: string; hex: string }[];
    headingFont: string;
    bodyFont: string;
    imageStyle: string;
  };
  item: { title: string; format: Format; pillar: string | null; goal: string | null; angle: string };
  content: AnyContent;
  references: { file: string; label: string }[];
}

const emphasis = (text: string) => richParts(text).filter((p) => p.em).map((p) => p.text);

function slotLines(slot: Slot) {
  const out: string[] = [];
  if (slot.kicker) out.push(`Etiqueta: ${slot.kicker.toUpperCase()}`);
  if (slot.title.trim()) out.push(`Título: ${stripMarks(slot.title)}`);
  if (slot.body.trim()) out.push(`Texto: ${stripMarks(slot.body).replace(/\n/g, " / ")}`);
  const em = [...emphasis(slot.title), ...emphasis(slot.body)];
  if (em.length) out.push(`Destacar en el color de acento: ${em.map((e) => `"${e}"`).join(", ")}`);
  return out;
}

export function buildBrief(input: BriefInput): { designer: string; prompt: string; fileName: string } {
  const { brand, item, content } = input;
  const frames = framesOf(item.format, content);
  const slots = slotsOf(item.format, content as unknown as Record<string, unknown>);
  const size = frames[0] ? sizeOf(frames[0]) : { width: 1080, height: 1350 };
  const vertical = size.height > 1500;
  const style = styleOf(content as unknown as Record<string, unknown>);
  const palette = brand.palette.filter((c) => /^#[0-9a-f]{6}$/i.test(c.hex));

  const identity = [
    palette.length ? `Paleta: ${palette.map((c, i) => `${c.name || "color"} ${c.hex.toUpperCase()}${i === 0 ? " (principal)" : ""}`).join(", ")}.` : "Paleta: no cargada.",
    `Tipografía de títulos: ${brand.headingFont || "a elección (sans moderna)"}. Textos: ${brand.bodyFont || "a elección (legible)"}.`,
    brand.imageStyle ? `Estilo visual de la marca: ${brand.imageStyle}.` : "",
    style ? `Estilo de Mova elegido para esta pieza: ${PRESET_LABELS[style.preset].label} (${PRESET_LABELS[style.preset].hint})` : "",
  ].filter(Boolean);

  const references = input.references.length
    ? [`Usá SOLO estas imágenes como referencia visual (van adjuntas): ${input.references.map((r, i) => `${i + 1}) ${r.file}${r.label ? ` — ${r.label}` : ""}`).join("; ")}. No copies textos ni marcas de las referencias: tomá el estilo (tipografía, color, composición, ritmo).`]
    : ["La marca no cargó referencias visuales: seguí la identidad visual de arriba."];

  const rules = [
    "Usá el texto exactamente como está (podés partirlo en líneas). No agregues textos, cifras, precios, clientes, testimonios, logos de terceros ni resultados que no estén en este brief.",
    "Si una imagen muestra un sitio, una app o un buscador, que sea esquemático y sin marcas de terceros, o con el sitio de la marca.",
    "Legibilidad en el teléfono: textos de al menos 30 px y títulos de al menos 44 px a 1080 de ancho, con contraste alto.",
    vertical ? "Zonas seguras: dejá libres 250 px arriba y 360 px abajo (ahí Instagram pone su interfaz)." : "Dejá un margen de al menos 80 px en los bordes.",
    "Mantené el mismo sistema en todas las imágenes (márgenes, tipografías, color) para que se lean como una serie.",
  ];

  const perImage = frames.map((frame, i) => {
    const slot = slots[i]!.slot;
    const design = slots[i]!.design;
    const comp = design && design.layout !== "classic" && design.layout !== "upload" ? `${LAYOUT_SPECS[design.layout].label}: ${LAYOUT_SPECS[design.layout].hint}` : null;
    const extra = item.format === "STORY" ? (() => {
      const f = (content as FormatContent<"STORY">).frames[i];
      return f && f.sticker !== "NONE" ? [`Sticker (se agrega al publicar, dejá el lugar): ${f.sticker}${f.stickerText ? ` — ${f.stickerText}` : ""}`] : [];
    })() : [];
    return [`### ${i + 1} · ${frameLabel(item.format, frame)}`, ...slotLines(slot), ...extra, comp ? `Composición sugerida: ${comp}` : ""].filter(Boolean).join("\n");
  });

  const header = [
    `Marca: ${brand.name}${brand.industry ? ` (${brand.industry})` : ""}${brand.website ? ` · ${brand.website}` : ""}`,
    `Pieza: ${FORMAT_LABELS[item.format]} de ${frames.length} ${frames.length === 1 ? "imagen" : "imágenes"}, ${size.width}×${size.height} px (${vertical ? "9:16" : "4:5"}), PNG o JPG.`,
    brand.audiences.length ? `Público: ${brand.audiences.join(", ")}.` : "",
    item.goal ? `Objetivo: ${item.goal}.` : "",
    item.pillar ? `Pilar: ${item.pillar}.` : "",
    item.angle ? `Ángulo: ${item.angle}` : "",
  ].filter(Boolean);

  const designer = [
    `# Brief de diseño: ${item.title}`,
    header.join("\n"),
    `## Identidad visual\n${identity.map((l) => `- ${l}`).join("\n")}`,
    `## Referencias\n${references.join("\n")}`,
    `## Reglas\n${rules.map((r) => `- ${r}`).join("\n")}`,
    `## Imágenes\n${perImage.join("\n\n")}`,
    content.caption.trim() ? `## Caption (no va en la imagen, para contexto)\n${stripMarks(content.caption)}` : "",
    "## Entrega\nUna imagen por posición, en orden. Se suben en Mova, en la pieza, con la composición «Diseño propio», y pasan por la aprobación de la marca antes de publicarse.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const prompt = [
    `Actuá como diseñador gráfico senior de redes sociales. Diseñá ${frames.length === 1 ? "una imagen" : `${frames.length} imágenes`} para Instagram de ${size.width}×${size.height} px (${vertical ? "9:16" : "4:5"}) para la marca ${brand.name}${brand.industry ? `, ${brand.industry}` : ""}.`,
    input.references.length ? `Te adjunto ${input.references.length} ${input.references.length === 1 ? "imagen" : "imágenes"} de referencia: son la ÚNICA referencia visual. Tomá su estilo (tipografía, color, composición, ritmo) sin copiar sus textos.` : "",
    `Identidad:\n${identity.map((l) => `- ${l}`).join("\n")}`,
    `Reglas:\n${rules.map((r) => `- ${r}`).join("\n")}`,
    `Contenido de cada imagen (texto literal):\n\n${perImage.join("\n\n")}`,
    "Si generás código (HTML/CSS o SVG), hacé un lienzo por imagen con esa medida exacta. Si generás imágenes, una por posición y en orden. Mostrame el resultado y esperá mis comentarios antes de cambiar el texto.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const fileName = `brief-${item.title.toLowerCase().normalize("NFD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 50) || "pieza"}.md`;
  return { designer, prompt, fileName };
}
