import type { AnyContent, Format, FormatContent } from "@/modules/content/formats";
import type { Check } from "@/modules/content/validators/report";

// Qué campos puede tocar la IA para resolver cada sugerencia de la revisión
// automática. Una corrección nunca cambia otra cosa: el servidor toma de la
// respuesta solo estos campos y deja el resto como estaba.
export type FixScope = "caption" | "hashtags" | "cover" | "altText" | "script" | "text";

export function scopesFor(check: Pick<Check, "id">, format: Format): FixScope[] | null {
  const id = check.id;
  if (id === "brand.placeholders") return null; // los datos reales los completa una persona
  if (id.startsWith("layout")) return null; // la composición se cambia sin IA
  if (id === "story.stickers") return null;
  // Texto que no entra, muy chico o demasiado denso: la IA lo acorta.
  if (id === "legibility.safe-zone" || id === "legibility") return null;
  if (id.startsWith("legibility.")) return ["text"];
  if (id === "caption.hashtags" || id === "caption.tag-placement") return ["caption", "hashtags"];
  if (id.startsWith("caption.")) return ["caption"];
  if (id === "alt-text") return ["altText"];
  if (id === "hook" || id.startsWith("hook.") || id === "carousel.cover") return format === "STORY" ? null : ["cover"];
  if (id === "reel.hook-time") return ["cover", "script"];
  if (id.startsWith("reel.")) return ["script"];
  if (id.startsWith("human.") || id === "brand.avoid") return ["text"];
  return null;
}

export function isFixable(check: Check, format: Format): boolean {
  return check.status !== "pass" && scopesFor(check, format) !== null;
}

// Copia en `current` solo los campos permitidos desde `proposal`.
export function mergeScopes(format: Format, current: AnyContent, proposal: AnyContent, scopes: FixScope[]): AnyContent {
  const all = scopes.includes("text");
  const out = { ...current } as Record<string, unknown>;
  const prop = proposal as unknown as Record<string, unknown>;
  if (all || scopes.includes("caption")) out.caption = prop.caption;
  if (all || scopes.includes("hashtags")) out.hashtags = prop.hashtags;
  if (all || scopes.includes("altText")) out.altText = prop.altText;
  switch (format) {
    case "CAROUSEL": {
      const cur = current as FormatContent<"CAROUSEL">;
      const next = proposal as FormatContent<"CAROUSEL">;
      if (all && next.slides.length === cur.slides.length) out.slides = cur.slides.map((s, i) => ({ ...s, title: next.slides[i]!.title, body: next.slides[i]!.body }));
      else if (scopes.includes("cover")) out.slides = cur.slides.map((s, i) => (i === 0 ? { ...s, title: next.slides[0]?.title ?? s.title } : s));
      break;
    }
    case "FEED_IMAGE": {
      const next = proposal as FormatContent<"FEED_IMAGE">;
      if (all || scopes.includes("cover")) out.headline = next.headline;
      if (all) out.subline = next.subline;
      break;
    }
    case "REEL": {
      const next = proposal as FormatContent<"REEL">;
      if (all || scopes.includes("cover")) {
        out.hooks = next.hooks;
        out.selectedHook = next.selectedHook;
        out.coverText = next.coverText;
      }
      if (all || scopes.includes("script")) out.script = next.script;
      break;
    }
    case "STORY": {
      const cur = current as FormatContent<"STORY">;
      const next = proposal as FormatContent<"STORY">;
      if (all && next.frames.length === cur.frames.length) out.frames = cur.frames.map((f, i) => ({ ...f, text: next.frames[i]!.text, stickerText: next.frames[i]!.stickerText }));
      break;
    }
  }
  return out as unknown as AnyContent;
}
