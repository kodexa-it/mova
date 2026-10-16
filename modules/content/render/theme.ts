// Colores de las plantillas a partir de la paleta de la marca. El texto
// siempre se elige por contraste (WCAG): nunca queda texto ilegible aunque la
// marca cargue colores difíciles.

export interface PaletteColor {
  name: string;
  hex: string;
}

export interface SlideTheme {
  background: string;
  text: string;
  muted: string;
  accent: string;
}

export interface Theme {
  strong: SlideTheme; // portada y cierre: fondo de color
  light: SlideTheme; // slides intermedios: fondo claro
}

const INK = "#1f2023";
const PAPER = "#fbfaf8";
const WHITE = "#ffffff";

function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (l1 + 0.05) / (l2 + 0.05);
}

function bestText(background: string, candidates: string[]): string {
  return [...candidates].sort((a, b) => contrast(b, background) - contrast(a, background))[0]!;
}

export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = rgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const VALID = /^#[0-9a-f]{6}$/i;

export function themeFrom(palette: PaletteColor[]): Theme {
  const colors = palette.map((c) => c.hex.toLowerCase()).filter((h) => VALID.test(h));
  const primary = colors[0] ?? INK;
  const darkest = [...colors, INK].sort((a, b) => luminance(a) - luminance(b))[0]!;
  const lightest = [...colors].sort((a, b) => luminance(b) - luminance(a))[0];
  const lightBg = lightest && luminance(lightest) > 0.75 ? lightest : PAPER;

  const strongText = bestText(primary, [WHITE, INK, lightBg, darkest]);
  const strongAccent = colors.slice(1).find((c) => contrast(c, primary) >= 3) ?? strongText;

  const lightText = contrast(darkest, lightBg) >= 7 ? darkest : INK;
  const lightAccent = [primary, ...colors.slice(1)].find((c) => contrast(c, lightBg) >= 3) ?? lightText;

  return {
    strong: { background: primary, text: strongText, muted: withAlpha(strongText, 0.72), accent: strongAccent },
    light: { background: lightBg, text: lightText, muted: withAlpha(lightText, 0.68), accent: lightAccent },
  };
}

// ─── Presets de estilo (V1b) ────────────────────────────────────────────────
// Solo los usan las composiciones del catálogo. "marca" es themeFrom tal cual.
export type PresetName = "marca" | "claro" | "oscuro" | "editorial" | "impacto";

export function themeFor(palette: PaletteColor[], preset: PresetName = "marca"): Theme {
  const base = themeFrom(palette);
  if (preset === "claro") return { strong: base.light, light: base.light };
  if (preset === "oscuro") {
    const colors = palette.map((c) => c.hex.toLowerCase()).filter((h) => VALID.test(h));
    const darkest = [...colors].sort((a, b) => luminance(a) - luminance(b))[0];
    const background = darkest && luminance(darkest) < 0.06 ? darkest : "#17171b";
    const text = bestText(background, [WHITE, PAPER]);
    const accent = colors.find((c) => contrast(c, background) >= 3) ?? text;
    const dark: SlideTheme = { background, text, muted: withAlpha(text, 0.72), accent };
    return { strong: dark, light: dark };
  }
  return base;
}
