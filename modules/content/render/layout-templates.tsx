// Composiciones del catálogo (modules/content/layouts.ts) para el renderizador
// (Satori, vía next/og): solo flexbox, posiciones absolutas y SVG en línea. Cada
// composición dibuja únicamente el texto de la pieza, el nombre y el sitio de la
// marca, y formas o ilustraciones abstractas en su paleta. La composición
// "Clásico" sigue en templates.tsx sin cambios.
import type { ReactNode } from "react";

import { ICON_SHAPES } from "@/modules/content/icons";
import { domainOf, leadingFigure, lines, type Design, type IconId, type MotifId, type PieceStyle } from "@/modules/content/layouts";
import type { PlacedFrame } from "@/modules/content/render/frames";
import { Dots, Footer, PAD, titleSize } from "@/modules/content/render/templates";
import { withAlpha, type SlideTheme, type Theme } from "@/modules/content/render/theme";

interface TitleFont {
  family: string;
  weight: 400 | 600;
  spacing: number; // multiplica el interletrado negativo
}

interface Ctx {
  frame: PlacedFrame;
  design: Design;
  theme: Theme;
  brand: string;
  website: string | null;
  width: number;
  height: number;
  font: TitleFont;
  motif: MotifId;
  // Imagen generada (data URL) para las composiciones del modo premium.
  art: string | null;
}

const FONT = "Instrument Sans";
const SANS: TitleFont = { family: FONT, weight: 600, spacing: 1 };
// Preset editorial: títulos en Instrument Serif (un solo peso, regular).
const SERIF: TitleFont = { family: "Instrument Serif", weight: 400, spacing: 0.4 };

// Zonas seguras: en Stories y Reels la interfaz de Instagram tapa arriba y abajo.
function padding(ctx: Ctx) {
  return ctx.height > 1500 ? { top: 250, bottom: 360, x: PAD } : { top: PAD, bottom: PAD, x: PAD };
}

function solid(color: string) {
  // El color de texto puede venir con alfa (muted); para derivar tonos se usa el hex.
  return color.startsWith("#") ? color : "#1f2023";
}

export function Icon({ id, size, color, weight = 1.8 }: { id: IconId; size: number; color: string; weight?: number }) {
  const shape = ICON_SHAPES[id];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={weight} strokeLinecap="round" strokeLinejoin="round">
      {(shape.rects ?? []).map(([x, y, w, h, r], i) => (
        <rect key={`r${i}`} x={x} y={y} width={w} height={h} rx={r} />
      ))}
      {(shape.circles ?? []).map(([cx, cy, r], i) => (
        <circle key={`c${i}`} cx={cx} cy={cy} r={r} />
      ))}
      {(shape.paths ?? []).map((d, i) => (
        <path key={`p${i}`} d={d} />
      ))}
    </svg>
  );
}

function Frame({ ctx, t, children, gap = 0, justify = "space-between" }: { ctx: Ctx; t: SlideTheme; children: ReactNode; gap?: number; justify?: string }) {
  const p = padding(ctx);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        padding: `${p.top}px ${p.x}px ${p.bottom}px`,
        background: t.background,
        color: t.text,
        fontFamily: FONT,
        justifyContent: justify,
        gap,
      }}
    >
      {ctx.motif !== "none" ? <Motif motif={ctx.motif} t={t} width={ctx.width} height={ctx.height} /> : null}
      {children}
    </div>
  );
}

// Recursos gráficos de marca: patrones y formas con el acento de la paleta.
// Solo ocupan los márgenes (fuera del área de texto, que va de 96 a 984 px) o
// son una textura muy tenue (grilla): nunca compiten con el texto.
function Motif({ motif, t, width, height }: { motif: MotifId; t: SlideTheme; width: number; height: number }) {
  const color = solid(t.accent);
  const layer = { display: "flex", position: "absolute" as const, left: 0, top: 0, width, height };
  switch (motif) {
    case "dots": {
      // Dos columnas de puntos en el margen derecho, entre el encabezado y el pie.
      const dots: [number, number][] = [];
      for (let y = 190; y < height - 190; y += 40) for (const x of [width - 52, width - 26]) dots.push([x, y]);
      return (
        <svg style={layer} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          {dots.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={4.5} fill={withAlpha(color, 0.35)} />
          ))}
        </svg>
      );
    }
    case "grid": {
      const step = 90;
      return (
        <svg style={layer} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          {Array.from({ length: Math.floor(width / step) }, (_, i) => (
            <path key={`v${i}`} d={`M${(i + 1) * step} 0V${height}`} stroke={withAlpha(color, 0.08)} strokeWidth={2} />
          ))}
          {Array.from({ length: Math.floor(height / step) }, (_, i) => (
            <path key={`h${i}`} d={`M0 ${(i + 1) * step}H${width}`} stroke={withAlpha(color, 0.08)} strokeWidth={2} />
          ))}
        </svg>
      );
    }
    case "arcs":
      // Arcos concéntricos en dos esquinas opuestas, dentro del margen.
      return (
        <svg style={layer} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          {[34, 58, 82].map((r, i) => (
            <circle key={`a${i}`} cx={0} cy={0} r={r} fill="none" stroke={withAlpha(color, 0.4 - i * 0.1)} strokeWidth={6} />
          ))}
          {[34, 58, 82].map((r, i) => (
            <circle key={`b${i}`} cx={width} cy={height} r={r} fill="none" stroke={withAlpha(color, 0.4 - i * 0.1)} strokeWidth={6} />
          ))}
        </svg>
      );
    case "waves":
      return (
        <svg style={layer} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          {[0, 1, 2].map((i) => {
            // Pegadas al borde inferior, por debajo del pie.
            const y = height - 26 - i * 22;
            return <path key={i} d={`M0 ${y} C ${width * 0.25} ${y - 30}, ${width * 0.5} ${y + 30}, ${width * 0.75} ${y} S ${width} ${y - 20}, ${width} ${y - 20}`} fill="none" stroke={withAlpha(color, 0.3 - i * 0.08)} strokeWidth={6} strokeLinecap="round" />;
          })}
        </svg>
      );
    case "blocks":
      // Bloques redondeados que asoman por dos esquinas.
      return (
        <svg style={layer} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          <rect x={width - 70} y={-70} width={150} height={150} rx={34} fill={withAlpha(color, 0.22)} transform={`rotate(14 ${width} 0)`} />
          <rect x={-60} y={height - 80} width={130} height={130} rx={30} fill="none" stroke={withAlpha(color, 0.32)} strokeWidth={6} transform={`rotate(-12 0 ${height})`} />
        </svg>
      );
    default:
      return null;
  }
}

// Encabezado y pie comunes: marca, posición en el carrusel y puntos.
function Top({ ctx, t }: { ctx: Ctx; t: SlideTheme }) {
  const f = ctx.frame;
  const right = f.kind === "cover" ? `1/${f.total}` : f.kind === "slide" ? String(f.index + 1).padStart(2, "0") : undefined;
  // En Stories, Instagram ya dibuja las barras de progreso arriba: la imagen no
  // las repite (desde la versión 2 de las composiciones que se usan en Stories).
  if (f.kind === "story") return <div style={{ display: "flex" }} />;
  return <Footer t={t} brand={ctx.brand} right={right} />;
}

function Bottom({ ctx, t }: { ctx: Ctx; t: SlideTheme }) {
  const f = ctx.frame;
  if (f.kind === "slide") {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Footer t={t} brand={ctx.brand} />
        <Dots t={t} index={f.index} total={f.total} />
      </div>
    );
  }
  if (f.kind === "cover") return <div style={{ display: "flex", fontSize: 30, color: t.muted }}>Deslizá</div>;
  if (f.kind === "story") return <Footer t={t} brand={ctx.brand} />;
  return <div style={{ display: "flex" }} />;
}

function Title({ text, base, t, font = SANS, max = 0 }: { text: string; base: number; t: SlideTheme; font?: TitleFont; max?: number }) {
  return (
    <div style={{ display: "flex", fontFamily: font.family, fontSize: titleSize(text, base), fontWeight: font.weight, lineHeight: 1.04, letterSpacing: -2.5 * font.spacing, color: t.text, ...(max ? { maxWidth: max } : {}) }}>
      {text}
    </div>
  );
}

function Body({ text, size, t }: { text: string; size: number; t: SlideTheme }) {
  return <div style={{ display: "flex", fontSize: size, lineHeight: 1.35, color: t.muted }}>{text}</div>;
}

// ─── Ilustraciones abstractas ───────────────────────────────────────────────
// Bloques en la paleta de la marca: sugieren un sitio o una app sin mostrar
// ningún proyecto real ni textos inventados.

function PageSketch({ theme, compact = false }: { theme: Theme; compact?: boolean }) {
  const ink = solid(theme.light.text);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? 14 : 20, padding: compact ? 22 : 34, flex: 1, background: theme.light.background }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", width: compact ? 70 : 110, height: compact ? 14 : 18, borderRadius: 9, background: theme.strong.background }} />
        <div style={{ display: "flex", gap: 12 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ display: "flex", width: compact ? 26 : 54, height: compact ? 8 : 10, borderRadius: 5, background: withAlpha(ink, 0.18) }} />
          ))}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: compact ? 10 : 14, padding: compact ? 20 : 34, borderRadius: compact ? 14 : 20, background: theme.strong.background }}>
        <div style={{ display: "flex", width: "72%", height: compact ? 16 : 26, borderRadius: 13, background: withAlpha(solid(theme.strong.text), 0.92) }} />
        <div style={{ display: "flex", width: "48%", height: compact ? 10 : 14, borderRadius: 7, background: withAlpha(solid(theme.strong.text), 0.55) }} />
        <div style={{ display: "flex", width: compact ? 70 : 150, height: compact ? 22 : 40, marginTop: compact ? 4 : 8, borderRadius: 999, background: theme.strong.accent }} />
      </div>
      <div style={{ display: "flex", gap: compact ? 10 : 18 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, padding: compact ? 10 : 16, borderRadius: compact ? 10 : 14, background: withAlpha(ink, 0.06) }}>
            <div style={{ display: "flex", width: compact ? 20 : 34, height: compact ? 20 : 34, borderRadius: 999, background: withAlpha(solid(theme.light.accent), 0.85) }} />
            <div style={{ display: "flex", width: "80%", height: compact ? 7 : 10, borderRadius: 5, background: withAlpha(ink, 0.2) }} />
            <div style={{ display: "flex", width: "55%", height: compact ? 7 : 10, borderRadius: 5, background: withAlpha(ink, 0.12) }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function BrowserMock({ theme, website, width, height }: { theme: Theme; website: string | null; width: number; height: number }) {
  const ink = solid(theme.light.text);
  return (
    <div style={{ display: "flex", flexDirection: "column", width, height, borderRadius: 26, overflow: "hidden", background: theme.light.background, boxShadow: `0 30px 80px ${withAlpha("#141419", 0.28)}`, border: `2px solid ${withAlpha(ink, 0.08)}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, height: 64, padding: "0 24px", background: withAlpha(ink, 0.06) }}>
        <div style={{ display: "flex", gap: 10 }}>
          {[0.5, 0.35, 0.22].map((a, i) => (
            <div key={i} style={{ display: "flex", width: 16, height: 16, borderRadius: 8, background: withAlpha(ink, a) }} />
          ))}
        </div>
        <div style={{ display: "flex", flex: 1, height: 34, alignItems: "center", padding: "0 18px", borderRadius: 17, background: theme.light.background, fontSize: 20, color: withAlpha(ink, 0.6) }}>
          {domainOf(website) ?? ""}
        </div>
      </div>
      <PageSketch theme={theme} />
    </div>
  );
}

export function PhoneMock({ theme, width, height }: { theme: Theme; width: number; height: number }) {
  const ink = solid(theme.light.text);
  return (
    <div style={{ display: "flex", flexDirection: "column", width, height, padding: 16, borderRadius: 64, background: "#16161a", boxShadow: `0 30px 80px ${withAlpha("#141419", 0.3)}` }}>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, borderRadius: 50, overflow: "hidden", background: theme.light.background, position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 16, paddingBottom: 6 }}>
          <div style={{ display: "flex", width: 110, height: 30, borderRadius: 15, background: "#16161a" }} />
        </div>
        <PageSketch theme={theme} compact />
        <div style={{ display: "flex", justifyContent: "center", paddingBottom: 12 }}>
          <div style={{ display: "flex", width: 120, height: 6, borderRadius: 3, background: withAlpha(ink, 0.3) }} />
        </div>
      </div>
    </div>
  );
}

// Laptop abierta: pantalla con un sitio esquemático y la base. Igual que el
// navegador, no muestra ningún proyecto real.
export function LaptopMock({ theme, website, width }: { theme: Theme; website: string | null; width: number }) {
  const ink = solid(theme.light.text);
  const screenW = Math.round(width * 0.86);
  const screenH = Math.round(screenW * 0.62);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width }}>
      <div style={{ display: "flex", flexDirection: "column", width: screenW, height: screenH, padding: 14, borderRadius: 26, background: "#1b1b20", boxShadow: `0 30px 80px ${withAlpha("#141419", 0.28)}` }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, borderRadius: 14, overflow: "hidden", background: theme.light.background }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, height: 40, padding: "0 16px", background: withAlpha(ink, 0.06) }}>
            {[0.5, 0.35, 0.22].map((a, i) => (
              <div key={i} style={{ display: "flex", width: 11, height: 11, borderRadius: 6, background: withAlpha(ink, a) }} />
            ))}
            <div style={{ display: "flex", flex: 1, height: 24, marginLeft: 8, alignItems: "center", padding: "0 12px", borderRadius: 12, background: theme.light.background, fontSize: 15, color: withAlpha(ink, 0.6) }}>
              {domainOf(website) ?? ""}
            </div>
          </div>
          <PageSketch theme={theme} compact />
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "center", width, height: 30, borderRadius: "4px 4px 22px 22px", background: "#d9d9de", boxShadow: `0 18px 40px ${withAlpha("#141419", 0.22)}` }}>
        <div style={{ display: "flex", width: 150, height: 12, borderRadius: "0 0 10px 10px", background: "#bdbdc4" }} />
      </div>
    </div>
  );
}

// ─── Composiciones ──────────────────────────────────────────────────────────

function quoteText(ctx: Ctx) {
  const s = ctx.frame.slot;
  return s.body.trim() || s.title.trim();
}

function CoverEditorial(ctx: Ctx) {
  const t = ctx.theme.strong;
  const title = ctx.frame.slot.title;
  const big = ctx.height > 1500;
  return (
    <Frame ctx={ctx} t={t}>
      <div style={{ display: "flex", position: "absolute", right: -260, top: big ? -120 : -280, width: 820, height: 820, borderRadius: 410, background: withAlpha(solid(t.accent), 0.2) }} />
      <div style={{ display: "flex", position: "absolute", right: -120, top: big ? 40 : -120, width: 520, height: 520, borderRadius: 260, border: `3px solid ${withAlpha(solid(t.accent), 0.55)}` }} />
      <Top ctx={ctx} t={t} />
      <div style={{ display: "flex", flexDirection: "column", gap: 44 }}>
        <div style={{ display: "flex", width: 120, height: 12, borderRadius: 6, background: t.accent }} />
        <Title text={title} base={big ? 140 : 132} t={t} font={ctx.font} />
      </div>
      <Bottom ctx={ctx} t={t} />
    </Frame>
  );
}

function CoverDevice(ctx: Ctx) {
  const t = ctx.theme.strong;
  const big = ctx.height > 1500;
  const deviceH = big ? 900 : 640;
  return (
    <Frame ctx={ctx} t={t} gap={40} justify="flex-start">
      <div style={{ display: "flex", position: "absolute", left: -200, bottom: -260, width: 900, height: 900, borderRadius: 450, background: withAlpha(solid(t.accent), 0.16) }} />
      <Top ctx={ctx} t={t} />
      <Title text={ctx.frame.slot.title} base={big ? 112 : 100} t={t} font={ctx.font} />
      <div style={{ display: "flex", flex: 1, alignItems: "flex-end", justifyContent: "center" }}>
        {ctx.design.device === "phone" ? (
          <PhoneMock theme={ctx.theme} width={Math.round(deviceH * 0.5)} height={deviceH} />
        ) : ctx.design.device === "laptop" ? (
          <LaptopMock theme={ctx.theme} website={ctx.website} width={ctx.width - PAD * 2} />
        ) : (
          <BrowserMock theme={ctx.theme} website={ctx.website} width={ctx.width - PAD * 2} height={big ? 760 : 600} />
        )}
      </div>
    </Frame>
  );
}

function ListLayout(ctx: Ctx, kind: "steps" | "icons") {
  const t = ctx.theme.light;
  const items = lines(ctx.frame.slot.body);
  const textSize = items.length > 4 ? 38 : 42;
  return (
    <Frame ctx={ctx} t={t}>
      <Top ctx={ctx} t={t} />
      <div style={{ display: "flex", flexDirection: "column", gap: 56 }}>
        {ctx.frame.slot.title.trim() ? <Title text={ctx.frame.slot.title} base={76} t={t} font={ctx.font} /> : null}
        <div style={{ display: "flex", flexDirection: "column", gap: items.length > 4 ? 26 : 34 }}>
          {items.map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 30 }}>
              {kind === "steps" ? (
                <div style={{ display: "flex", flexShrink: 0, width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center", background: t.accent, color: contrastOn(t.accent), fontSize: 36, fontWeight: 600 }}>
                  {String(i + 1)}
                </div>
              ) : (
                <div style={{ display: "flex", flexShrink: 0, width: 84, height: 84, borderRadius: 24, alignItems: "center", justifyContent: "center", background: withAlpha(solid(t.accent), 0.13) }}>
                  <Icon id={ctx.design.icons?.[i] ?? "check"} size={46} color={t.accent} />
                </div>
              )}
              <div style={{ display: "flex", flex: 1, fontSize: textSize, lineHeight: 1.3, color: t.text }}>{item}</div>
            </div>
          ))}
        </div>
      </div>
      <Bottom ctx={ctx} t={t} />
    </Frame>
  );
}

// Texto blanco o grafito sobre un color, el de más contraste.
function contrastOn(hex: string): string {
  const h = solid(hex).replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const l = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return 1.05 / (l + 0.05) >= (l + 0.05) / 0.0637 ? "#ffffff" : "#1f2023";
}

function Compare(ctx: Ctx) {
  const t = ctx.theme.light;
  const [no, yes] = lines(ctx.frame.slot.body) as [string, string];
  const ink = solid(t.text);
  const card = (text: string, good: boolean) => (
    <div style={{ display: "flex", alignItems: "center", gap: 30, padding: "40px 44px", borderRadius: 32, background: good ? withAlpha(solid(t.accent), 0.13) : withAlpha(ink, 0.05) }}>
      <div style={{ display: "flex", flexShrink: 0, width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", background: good ? t.accent : withAlpha(ink, 0.12) }}>
        <Icon id={good ? "check" : "x"} size={40} color={good ? contrastOn(t.accent) : withAlpha(ink, 0.7)} weight={2.4} />
      </div>
      <div style={{ display: "flex", flex: 1, fontSize: 42, lineHeight: 1.3, color: good ? t.text : withAlpha(ink, 0.72) }}>{text}</div>
    </div>
  );
  return (
    <Frame ctx={ctx} t={t}>
      <Top ctx={ctx} t={t} />
      <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
        {ctx.frame.slot.title.trim() ? <Title text={ctx.frame.slot.title} base={76} t={t} font={ctx.font} /> : null}
        {card(no, false)}
        {card(yes, true)}
      </div>
      <Bottom ctx={ctx} t={t} />
    </Frame>
  );
}

function Quote(ctx: Ctx) {
  const t = ctx.theme.strong;
  const text = quoteText(ctx);
  const kicker = ctx.frame.slot.body.trim() && ctx.frame.slot.title.trim() ? ctx.frame.slot.title.trim() : "";
  const size = text.length <= 70 ? 84 : text.length <= 120 ? 72 : 62;
  return (
    <Frame ctx={ctx} t={t}>
      <Top ctx={ctx} t={t} />
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        {kicker ? <div style={{ display: "flex", fontSize: 32, fontWeight: 600, color: t.muted }}>{kicker}</div> : null}
        <div style={{ display: "flex", fontSize: 260, lineHeight: 0.8, height: 150, fontWeight: 600, color: t.accent }}>“</div>
        <div style={{ display: "flex", fontFamily: ctx.font.family, fontSize: size, fontWeight: ctx.font.weight, lineHeight: 1.16, letterSpacing: -1.5 * ctx.font.spacing, color: t.text }}>{text}</div>
        <div style={{ display: "flex", fontSize: 32, color: t.muted }}>{`— ${ctx.brand}`}</div>
      </div>
      <Bottom ctx={ctx} t={t} />
    </Frame>
  );
}

function Stat(ctx: Ctx) {
  const t = ctx.theme.strong;
  const statement = ctx.design.proof?.statement ?? "";
  const figure = leadingFigure(statement) ?? "";
  const size = figure.length <= 4 ? 300 : figure.length <= 7 ? 220 : 160;
  return (
    <Frame ctx={ctx} t={t}>
      <Top ctx={ctx} t={t} />
      <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
        {ctx.frame.slot.title.trim() && ctx.frame.kind !== "story" ? <div style={{ display: "flex", fontSize: 40, fontWeight: 600, color: t.muted }}>{ctx.frame.slot.title}</div> : null}
        <div style={{ display: "flex", fontSize: size, fontWeight: 600, lineHeight: 0.95, letterSpacing: -8, color: t.accent }}>{figure}</div>
        <div style={{ display: "flex", width: 120, height: 10, borderRadius: 5, background: withAlpha(solid(t.text), 0.4) }} />
        <div style={{ display: "flex", fontSize: 46, lineHeight: 1.28, color: t.text }}>{statement}</div>
      </div>
      <Bottom ctx={ctx} t={t} />
    </Frame>
  );
}

function Browser(ctx: Ctx) {
  const t = ctx.theme.light;
  const { title, body } = ctx.frame.slot;
  return (
    <Frame ctx={ctx} t={t} gap={36} justify="flex-start">
      <Top ctx={ctx} t={t} />
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <Title text={title} base={72} t={t} font={ctx.font} />
        {body.trim() ? <Body text={body} size={38} t={t} /> : null}
      </div>
      <div style={{ display: "flex", flex: 1, alignItems: "flex-end" }}>
        <BrowserMock theme={ctx.theme} website={ctx.website} width={ctx.width - PAD * 2} height={body.trim() ? 560 : 680} />
      </div>
      {ctx.frame.kind === "slide" ? <Bottom ctx={ctx} t={t} /> : null}
    </Frame>
  );
}

function Phone(ctx: Ctx) {
  const t = ctx.theme.light;
  const { title, body } = ctx.frame.slot;
  return (
    <Frame ctx={ctx} t={t}>
      <Top ctx={ctx} t={t} />
      <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 26, flex: 1 }}>
          <Title text={title} base={68} t={t} font={ctx.font} />
          {body.trim() ? <Body text={body} size={36} t={t} /> : null}
        </div>
        <PhoneMock theme={ctx.theme} width={360} height={720} />
      </div>
      <Bottom ctx={ctx} t={t} />
    </Frame>
  );
}

function Cta(ctx: Ctx) {
  const t = ctx.theme.strong;
  const { title, body } = ctx.frame.slot;
  const domain = domainOf(ctx.website);
  return (
    <Frame ctx={ctx} t={t}>
      <div style={{ display: "flex", position: "absolute", right: -300, bottom: -300, width: 900, height: 900, borderRadius: 450, background: withAlpha(solid(t.accent), 0.18) }} />
      <Top ctx={ctx} t={t} />
      <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
        <Title text={title} base={112} t={t} font={ctx.font} />
        {body.trim() ? <Body text={body} size={42} t={t} /> : null}
        <div style={{ display: "flex", alignItems: "center", alignSelf: "flex-start", gap: 20, height: 96, padding: domain ? "0 40px 0 44px" : "0 28px", borderRadius: 48, background: t.accent, color: contrastOn(t.accent), fontSize: 38, fontWeight: 600 }}>
          {domain ? <div style={{ display: "flex" }}>{domain}</div> : null}
          <Icon id="arrow" size={44} color={contrastOn(t.accent)} weight={2.4} />
        </div>
      </div>
      {ctx.frame.kind === "slide" ? (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Dots t={t} index={ctx.frame.index} total={ctx.frame.total} />
        </div>
      ) : (
        <div style={{ display: "flex" }} />
      )}
    </Frame>
  );
}

// ─── Modo premium: imagen generada + texto de Mova ──────────────────────────
// La imagen nunca trae texto: el título, el texto, la marca y el llamado los
// dibuja Mova encima o al lado, con contraste garantizado por un velo oscuro.

const SCRIM = "#121216";

function artTheme(theme: Theme): SlideTheme {
  const accent = [theme.strong.background, theme.strong.accent, theme.light.accent].find((c) => c.startsWith("#") && contrastRatio(c, SCRIM) >= 3) ?? "#ffffff";
  return { background: SCRIM, text: "#ffffff", muted: "rgba(255, 255, 255, 0.82)", accent };
}

function contrastRatio(a: string, b: string) {
  const lum = (hex: string) => {
    const h = hex.replace("#", "");
    const [r, g, bl] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (l1 + 0.05) / (l2 + 0.05);
}

function ArtImage({ src, width, height, radius = 0 }: { src: string; width: number; height: number; radius?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} width={width} height={height} alt="" style={{ width, height, objectFit: "cover", borderRadius: radius }} />;
}

function ArtCover(ctx: Ctx) {
  const t = artTheme(ctx.theme);
  const { title, body } = ctx.frame.slot;
  const main = title.trim() || body.trim();
  const sub = title.trim() ? body.trim() : "";
  const big = ctx.height > 1500;
  const p = padding(ctx);
  return (
    <div style={{ display: "flex", width: "100%", height: "100%", position: "relative", overflow: "hidden", background: SCRIM, fontFamily: FONT, color: t.text }}>
      {ctx.art ? (
        <div style={{ display: "flex", position: "absolute", left: 0, top: 0 }}>
          <ArtImage src={ctx.art} width={ctx.width} height={ctx.height} />
        </div>
      ) : null}
      <div style={{ display: "flex", position: "absolute", left: 0, top: 0, width: ctx.width, height: ctx.height, backgroundImage: `linear-gradient(180deg, ${withAlpha(SCRIM, 0.5)} 0%, ${withAlpha(SCRIM, 0)} 22%, ${withAlpha(SCRIM, 0)} 38%, ${withAlpha(SCRIM, 0.72)} 66%, ${withAlpha(SCRIM, 0.92)} 100%)` }} />
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", height: "100%", padding: `${p.top}px ${p.x}px ${p.bottom}px`, position: "relative" }}>
        <Top ctx={ctx} t={t} />
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          <div style={{ display: "flex", width: 120, height: 12, borderRadius: 6, background: t.accent }} />
          <Title text={main} base={big ? 128 : 120} t={t} font={ctx.font} />
          {sub ? <Body text={sub} size={40} t={t} /> : null}
          {ctx.frame.kind === "cover" ? <div style={{ display: "flex", fontSize: 30, color: t.muted }}>Deslizá</div> : null}
          {ctx.frame.kind === "story" || ctx.frame.kind === "image" ? <Footer t={t} brand={ctx.brand} /> : null}
        </div>
      </div>
    </div>
  );
}

function ArtPanel(ctx: Ctx) {
  const t = ctx.frame.kind === "slide" && ctx.frame.last ? ctx.theme.strong : ctx.theme.light;
  const { title, body } = ctx.frame.slot;
  const panelW = ctx.width - PAD * 2;
  const panelH = body.trim() ? 560 : 680;
  return (
    <Frame ctx={ctx} t={t} gap={36} justify="flex-start">
      <Top ctx={ctx} t={t} />
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <Title text={title} base={72} t={t} font={ctx.font} />
        {body.trim() ? <Body text={body} size={38} t={t} /> : null}
      </div>
      <div style={{ display: "flex", flex: 1, alignItems: "flex-end" }}>
        <div style={{ display: "flex", width: panelW, height: panelH, borderRadius: 32, overflow: "hidden", background: withAlpha(solid(t.text), 0.08) }}>
          {ctx.art ? <ArtImage src={ctx.art} width={panelW} height={panelH} radius={32} /> : null}
        </div>
      </div>
      {ctx.frame.kind === "slide" ? <Bottom ctx={ctx} t={t} /> : null}
    </Frame>
  );
}

export function LayoutTemplate({
  frame,
  theme,
  brand,
  website,
  width,
  height,
  style,
  art = null,
}: {
  frame: PlacedFrame;
  theme: Theme;
  brand: string;
  website: string | null;
  width: number;
  height: number;
  style?: PieceStyle;
  art?: string | null;
}) {
  const design = frame.design!;
  const ctx: Ctx = { frame, design, theme, brand, website, width, height, font: style?.preset === "editorial" ? SERIF : SANS, motif: style?.motif ?? "none", art };
  switch (design.layout) {
    case "cover-editorial":
      return CoverEditorial(ctx);
    case "cover-device":
      return CoverDevice(ctx);
    case "steps":
      return ListLayout(ctx, "steps");
    case "icon-list":
      return ListLayout(ctx, "icons");
    case "compare":
      return Compare(ctx);
    case "quote":
      return Quote(ctx);
    case "stat":
      return Stat(ctx);
    case "browser":
      return Browser(ctx);
    case "phone":
      return Phone(ctx);
    case "cta":
      return Cta(ctx);
    case "art-cover":
      return ArtCover(ctx);
    case "art-panel":
      return ArtPanel(ctx);
    default:
      return null;
  }
}
