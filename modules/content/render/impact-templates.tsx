// Estilo «Impacto»: títulos condensados en mayúsculas (Anton), palabras
// destacadas en el color de la marca, fondos alternados (oscuro, claro y color
// de marca), etiquetas cortas y anillos finos. Se aplica a todas las imágenes
// de la pieza. Igual que el resto del catálogo: solo dibuja el texto de la
// pieza, el nombre y el sitio de la marca, y formas abstractas.
import type { ReactNode } from "react";

import { domainOf, leadingFigure, lines, richParts, type Design } from "@/modules/content/layouts";
import { impactTitleSize } from "@/modules/content/render/impact-sizes";
import { Icon } from "@/modules/content/render/layout-templates";
import type { PlacedFrame } from "@/modules/content/render/frames";
import { contrast, luminance, withAlpha, type PaletteColor } from "@/modules/content/render/theme";

const DISPLAY = "Anton";
const SANS = "Instrument Sans";

export type Surface = "dark" | "light" | "brand";

export interface ImpactPalette {
  dark: string;
  light: string;
  brand: string;
  // Texto y acentos sobre cada fondo, elegidos por contraste.
  on: Record<Surface, { fg: string; muted: string; em: string }>;
}

const VALID = /^#[0-9a-f]{6}$/i;

function chroma(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return Math.max(r!, g!, b!) - Math.min(r!, g!, b!);
}

export function impactPalette(palette: PaletteColor[]): ImpactPalette {
  const colors = palette.map((c) => c.hex.toLowerCase()).filter((h) => VALID.test(h));
  const darkest = [...colors].sort((a, b) => luminance(a) - luminance(b))[0];
  const dark = darkest && luminance(darkest) < 0.04 ? darkest : "#0e0e10";
  const light = "#f2f1ee";
  // El color de marca: el más saturado que no sea casi negro ni casi blanco.
  const brand = [...colors].filter((c) => luminance(c) > 0.05 && luminance(c) < 0.8).sort((a, b) => chroma(b) - chroma(a))[0] ?? "#3d3ad8";
  const onBrandFg = contrast(dark, brand) >= contrast("#ffffff", brand) ? dark : "#ffffff";
  return {
    dark,
    light,
    brand,
    on: {
      dark: { fg: "#ffffff", muted: "rgba(255, 255, 255, 0.72)", em: contrast(brand, dark) >= 3 ? brand : "#ffffff" },
      // Sobre claro, el acento se usa solo en texto grande (títulos): 2,5:1 mínimo.
      light: { fg: dark, muted: withAlpha(dark, 0.72), em: contrast(brand, light) >= 2.5 ? brand : dark },
      brand: { fg: onBrandFg, muted: withAlpha(onBrandFg, 0.78), em: onBrandFg === dark ? "#ffffff" : dark },
    },
  };
}

const bg = (p: ImpactPalette, s: Surface) => (s === "dark" ? p.dark : s === "light" ? p.light : p.brand);

// Fondos alternados: portada y cierre oscuros; en el medio, claro → marca →
// oscuro. Stories: oscuro y claro alternados.
export function surfaceOf(frame: PlacedFrame): Surface {
  switch (frame.kind) {
    case "cover":
    case "image":
    case "reel-cover":
      return "dark";
    case "story":
      return frame.index % 2 === 0 ? "dark" : "light";
    case "slide":
      if (frame.last) return "dark";
      return (["light", "brand", "dark"] as const)[(frame.index - 1) % 3]!;
  }
}

interface Ctx {
  frame: PlacedFrame;
  design: Design | undefined;
  p: ImpactPalette;
  surface: Surface;
  brand: string;
  website: string | null;
  width: number;
  height: number;
}

const pad = (ctx: Ctx) => (ctx.height > 1500 ? { top: 250, bottom: 360, x: 88 } : { top: 72, bottom: 72, x: 88 });

// Texto con palabras destacadas: cada palabra es un elemento (Satori no corta
// líneas dentro de spans), así el destacado puede ocupar varias líneas.
function Rich({ text, size, color, em, font = DISPLAY, upper = true, lineHeight = 1.02, box = false, boxColors }: { text: string; size: number; color: string; em: string; font?: string; upper?: boolean; lineHeight?: number; box?: boolean; boxColors?: { bg: string; fg: string } }) {
  // Con recuadro, cada frase destacada va entera en un solo recuadro.
  const words = richParts(text).flatMap((part, pi) =>
    part.em && box
      ? [{ key: `${pi}`, w: upper ? part.text.trim().toUpperCase() : part.text.trim(), em: true }]
      : part.text
          .split(/\s+/)
          .filter(Boolean)
          .map((w, wi) => ({ key: `${pi}-${wi}`, w: upper ? w.toUpperCase() : w, em: part.em })),
  );
  const gap = Math.round(size * (font === DISPLAY ? 0.22 : 0.26));
  return (
    <div style={{ display: "flex", flexWrap: "wrap", columnGap: gap, fontFamily: font, fontSize: size, lineHeight, color, ...(font === SANS ? { fontWeight: 400 } : {}) }}>
      {words.map((x) =>
        x.em && box && boxColors ? (
          <span key={x.key} style={{ background: boxColors.bg, color: boxColors.fg, padding: `0 ${Math.round(size * 0.12)}px` }}>
            {x.w}
          </span>
        ) : (
          <span key={x.key} style={x.em ? { color: em } : {}}>
            {x.w}
          </span>
        ),
      )}
    </div>
  );
}

function Kicker({ ctx, text, style }: { ctx: Ctx; text: string; style: "bracket" | "slash" }) {
  const c = ctx.p.on[ctx.surface];
  return <div style={{ display: "flex", fontFamily: SANS, fontWeight: 600, fontSize: 24, letterSpacing: 3, color: c.em }}>{style === "bracket" ? `[ ${text.toUpperCase()} ]` : `// ${text.toUpperCase()}`}</div>;
}

function Orbits({ ctx }: { ctx: Ctx }) {
  const c = ctx.p.on[ctx.surface];
  const stroke = withAlpha(c.em.startsWith("#") ? c.em : "#ffffff", ctx.surface === "brand" ? 0.55 : 0.45);
  const i = ctx.frame.kind === "slide" || ctx.frame.kind === "story" ? ctx.frame.index : 0;
  const spots = [
    [ctx.width * 0.92, ctx.height * 0.12, 260],
    [ctx.width * 0.05, ctx.height * 0.78, 300],
    [ctx.width * 0.85, ctx.height * 0.7, 230],
  ] as const;
  const [cx, cy, r] = spots[i % spots.length]!;
  return (
    <svg style={{ position: "absolute", left: 0, top: 0 }} width={ctx.width} height={ctx.height} viewBox={`0 0 ${ctx.width} ${ctx.height}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={stroke} strokeWidth={2} />
      <circle cx={ctx.width - cx * 0.4} cy={ctx.height - cy * 0.5} r={r * 0.7} fill="none" stroke={stroke} strokeWidth={1.5} />
    </svg>
  );
}

function counter(frame: PlacedFrame) {
  if (frame.kind === "cover" || frame.kind === "slide") return `[ ${String(frame.index + 1).padStart(2, "0")} / ${String(frame.total).padStart(2, "0")} ]`;
  return "";
}

function Shell({ ctx, children, footer }: { ctx: Ctx; children: ReactNode; footer?: ReactNode }) {
  const c = ctx.p.on[ctx.surface];
  const p = pad(ctx);
  const story = ctx.frame.kind === "story" || ctx.frame.kind === "reel-cover";
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", position: "relative", overflow: "hidden", background: bg(ctx.p, ctx.surface), color: c.fg, fontFamily: SANS, padding: `${p.top}px ${p.x}px ${p.bottom}px` }}>
      <Orbits ctx={ctx} />
      {!story ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: 30, letterSpacing: 1, color: c.fg }}>{ctx.brand.toUpperCase()}</div>
          <div style={{ display: "flex", fontSize: 22, letterSpacing: 3, color: c.em }}>{counter(ctx.frame)}</div>
        </div>
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", position: "relative" }}>{children}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", minHeight: 40 }}>
        {footer ?? <div style={{ display: "flex" }} />}
        {ctx.frame.kind === "cover" || (ctx.frame.kind === "slide" && !ctx.frame.last) ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: DISPLAY, fontSize: 30, color: c.em }}>
            {ctx.frame.kind === "cover" ? <div style={{ display: "flex" }}>DESLIZÁ</div> : null}
            <Icon id="arrow" size={34} color={c.em} weight={2.4} />
          </div>
        ) : (
          <div style={{ display: "flex" }} />
        )}
      </div>
    </div>
  );
}

function Body({ ctx, text, size = 34 }: { ctx: Ctx; text: string; size?: number }) {
  const c = ctx.p.on[ctx.surface];
  if (!text.trim()) return null;
  // En el cuerpo, lo destacado va en un recuadro (como un subrayado fuerte).
  return <Rich text={text} size={size} color={c.muted} em={c.fg} font={SANS} upper={false} lineHeight={1.35} box boxColors={{ bg: c.fg, fg: bg(ctx.p, ctx.surface) }} />;
}

// ─── Variantes ──────────────────────────────────────────────────────────────

function Statement(ctx: Ctx, base: number) {
  const c = ctx.p.on[ctx.surface];
  const { title, body, kicker } = ctx.frame.rich;
  const isCover = ctx.frame.kind === "cover" || ctx.frame.kind === "image" || ctx.frame.kind === "reel-cover";
  const main = title.trim() || body.trim();
  const sub = title.trim() ? body : "";
  // El número acompaña a la etiqueta (series: "01 // LO QUE INSTAGRAM NO TE DA").
  const number = ctx.frame.kind === "slide" && !ctx.frame.last && kicker ? String(ctx.frame.index).padStart(2, "0") : null;
  return (
    <Shell ctx={ctx} footer={isCover && sub.trim() ? undefined : undefined}>
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        {number || kicker ? (
          <div style={{ display: "flex", alignItems: "baseline", gap: 18 }}>
            {number ? <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: 56, color: c.em, lineHeight: 1 }}>{number}</div> : null}
            {kicker ? <Kicker ctx={ctx} text={kicker} style={isCover ? "bracket" : "slash"} /> : null}
          </div>
        ) : null}
        <Rich text={main} size={impactTitleSize(main.replace(/\*/g, ""), base)} color={c.fg} em={c.em} />
        {sub.trim() ? <Body ctx={ctx} text={sub} /> : null}
      </div>
    </Shell>
  );
}

function List(ctx: Ctx) {
  const c = ctx.p.on[ctx.surface];
  const items = lines(ctx.frame.rich.body);
  const boxBg = ctx.surface === "dark" ? "#1b1b20" : ctx.p.dark;
  const boxEm = contrast(ctx.p.brand, boxBg) >= 3 ? ctx.p.brand : "#ffffff";
  const size = items.length > 4 ? 40 : 48;
  return (
    <Shell ctx={ctx}>
      <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
        {ctx.frame.rich.kicker ? <Kicker ctx={ctx} text={ctx.frame.rich.kicker} style="slash" /> : null}
        {ctx.frame.rich.title.trim() ? <Rich text={ctx.frame.rich.title} size={impactTitleSize(ctx.frame.slot.title, 110)} color={c.fg} em={c.em} /> : null}
        <div style={{ display: "flex", flexDirection: "column", background: boxBg, padding: "18px 36px", border: ctx.surface === "dark" ? `2px solid ${withAlpha("#ffffff", 0.12)}` : "none" }}>
          {items.map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 22, padding: "18px 0", borderTop: i ? `1px solid ${withAlpha("#ffffff", 0.14)}` : "none" }}>
              <div style={{ display: "flex", fontSize: 24, letterSpacing: 2, color: withAlpha("#ffffff", 0.6), width: 40 }}>{String(i + 1).padStart(2, "0")}</div>
              <Rich text={item} size={size} color={boxEm} em="#ffffff" />
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}

function Compare(ctx: Ctx) {
  const c = ctx.p.on[ctx.surface];
  const [no = "", yes = ""] = lines(ctx.frame.rich.body);
  const onBrand = ctx.p.on.brand;
  return (
    <Shell ctx={ctx}>
      <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
        {ctx.frame.rich.kicker ? <Kicker ctx={ctx} text={ctx.frame.rich.kicker} style="slash" /> : null}
        {ctx.frame.rich.title.trim() ? <Rich text={ctx.frame.rich.title} size={impactTitleSize(ctx.frame.slot.title, 110)} color={c.fg} em={c.em} /> : null}
        <div style={{ display: "flex", gap: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1, padding: 30, border: `2px solid ${withAlpha(c.fg.startsWith("#") ? c.fg : "#ffffff", 0.25)}` }}>
            <Icon id="x" size={34} color={c.muted} weight={2.4} />
            <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: 44, lineHeight: 1.05, color: c.muted, textDecoration: "line-through" }}>{no.replace(/\*/g, "").toUpperCase()}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1, padding: 30, background: ctx.surface === "brand" ? ctx.p.dark : ctx.p.brand }}>
            <Icon id="check" size={34} color={ctx.surface === "brand" ? ctx.p.brand : onBrand.fg} weight={2.6} />
            <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: 44, lineHeight: 1.05, color: ctx.surface === "brand" ? "#ffffff" : onBrand.fg }}>{yes.replace(/\*/g, "").toUpperCase()}</div>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function Stat(ctx: Ctx) {
  const c = ctx.p.on[ctx.surface];
  const statement = ctx.design?.proof?.statement ?? "";
  const figure = leadingFigure(statement) ?? "";
  return (
    <Shell ctx={ctx}>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {ctx.frame.rich.kicker ? <Kicker ctx={ctx} text={ctx.frame.rich.kicker} style="slash" /> : null}
        <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: figure.length <= 4 ? 340 : figure.length <= 7 ? 250 : 180, lineHeight: 0.9, color: c.em }}>{figure}</div>
        <div style={{ display: "flex", fontSize: 40, lineHeight: 1.3, color: c.fg }}>{statement}</div>
      </div>
    </Shell>
  );
}

// Buscador y resultado esquemáticos: sin marcas de terceros ni búsquedas
// inventadas. Solo muestra el sitio y el nombre de la marca.
function Search(ctx: Ctx) {
  const c = ctx.p.on[ctx.surface];
  const domain = domainOf(ctx.website);
  const ink = ctx.p.dark;
  return (
    <Shell ctx={ctx}>
      <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
        {ctx.frame.rich.kicker ? <Kicker ctx={ctx} text={ctx.frame.rich.kicker} style="slash" /> : null}
        <Rich text={ctx.frame.rich.title} size={impactTitleSize(ctx.frame.slot.title, 120)} color={c.fg} em={c.em} />
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18, height: 76, padding: "0 30px", borderRadius: 38, background: "#ffffff" }}>
            <Icon id="globe" size={30} color={withAlpha(ink, 0.6)} />
            <div style={{ display: "flex", width: 280, height: 14, borderRadius: 7, background: withAlpha(ink, 0.18) }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 18, padding: "24px 30px", background: withAlpha(ink, ctx.surface === "dark" ? 0.0 : 0.92), border: `2px solid ${withAlpha(ctx.p.brand, 0.8)}` }}>
            <div style={{ display: "flex", fontSize: 22, color: withAlpha("#ffffff", 0.6) }}>{domain ?? ""}</div>
            <div style={{ display: "flex", fontSize: 34, fontWeight: 600, color: ctx.p.brand }}>{ctx.brand}</div>
            <div style={{ display: "flex", gap: 12 }}>
              {[160, 120, 140].map((w, i) => (
                <div key={i} style={{ display: "flex", width: w, height: 12, borderRadius: 6, background: withAlpha("#ffffff", 0.3) }} />
              ))}
            </div>
          </div>
        </div>
        {ctx.frame.rich.body.trim() ? <Body ctx={ctx} text={ctx.frame.rich.body} size={32} /> : null}
      </div>
    </Shell>
  );
}

// Cierre: la palabra destacada en gigante (por ejemplo, COMENTÁ *WEB*) y el
// texto en una pastilla si es corto.
function Cta(ctx: Ctx) {
  const c = ctx.p.on[ctx.surface];
  const parts = richParts(ctx.frame.rich.title);
  const keyword = parts.find((x) => x.em)?.text ?? "";
  const lead = parts.filter((x) => !x.em).map((x) => x.text).join(" ").trim();
  const body = ctx.frame.rich.body.replace(/\*/g, "").trim();
  const pill = body && body.length <= 42;
  const domain = domainOf(ctx.website);
  return (
    <Shell ctx={ctx} footer={domain ? <div style={{ display: "flex", fontSize: 24, color: c.muted }}>{domain}</div> : undefined}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, textAlign: "center" }}>
        {ctx.frame.rich.kicker ? <Kicker ctx={ctx} text={ctx.frame.rich.kicker} style="bracket" /> : null}
        {keyword ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            {lead ? <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: impactTitleSize(lead, 120), lineHeight: 1, color: c.fg }}>{lead.toUpperCase()}</div> : null}
            <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: keyword.length <= 5 ? 300 : keyword.length <= 9 ? 220 : 150, lineHeight: 0.95, color: c.em }}>{keyword.toUpperCase()}</div>
          </div>
        ) : (
          <Rich text={ctx.frame.rich.title} size={impactTitleSize(ctx.frame.slot.title, 140)} color={c.fg} em={c.em} />
        )}
        {pill ? (
          <div style={{ display: "flex", marginTop: 18, padding: "18px 40px", borderRadius: 999, background: ctx.p.brand, color: ctx.p.on.brand.fg, fontFamily: DISPLAY, fontSize: 36 }}>{body.toUpperCase()}</div>
        ) : body ? (
          <div style={{ display: "flex", fontSize: 34, lineHeight: 1.35, color: c.muted, textAlign: "center" }}>{body}</div>
        ) : null}
      </div>
    </Shell>
  );
}

export function ImpactTemplate({ frame, palette, brand, website, width, height }: { frame: PlacedFrame; palette: PaletteColor[]; brand: string; website: string | null; width: number; height: number }) {
  const p = impactPalette(palette);
  const ctx: Ctx = { frame, design: frame.design, p, surface: surfaceOf(frame), brand, website, width, height };
  switch (frame.design?.layout) {
    case "steps":
    case "icon-list":
      return List(ctx);
    case "compare":
      return Compare(ctx);
    case "stat":
      return Stat(ctx);
    case "browser":
    case "cover-device":
    case "phone":
      return Search(ctx);
    case "cta":
      return Cta(ctx);
    default: {
      if (frame.kind === "slide" && frame.last) return Cta(ctx);
      const base = frame.kind === "cover" || frame.kind === "image" ? 170 : frame.kind === "reel-cover" || frame.kind === "story" ? 150 : 140;
      return Statement(ctx, base);
    }
  }
}
