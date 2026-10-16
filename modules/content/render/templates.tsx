// Plantillas de piezas para el renderizador de imágenes (Satori, vía next/og).
// Solo flexbox y estilos en línea. Tipografía: Instrument Sans para todas las
// marcas por ahora (las tipografías propias de cada marca, más adelante).
import type { Frame } from "@/modules/content/render/frames";
import { titleSize } from "@/modules/content/render/sizes";
import type { SlideTheme, Theme } from "@/modules/content/render/theme";

export const PAD = 96;

export { titleSize } from "@/modules/content/render/sizes";

export function Footer({ t, brand, right }: { t: SlideTheme; brand: string; right?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 28, color: t.muted }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 14, height: 14, borderRadius: 7, background: t.accent }} />
        <div style={{ display: "flex" }}>{brand}</div>
      </div>
      {right ? <div style={{ display: "flex" }}>{right}</div> : <div style={{ display: "flex" }} />}
    </div>
  );
}

export function Dots({ t, index, total }: { t: SlideTheme; index: number; total: number }) {
  return (
    <div style={{ display: "flex", gap: 10 }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{ width: i === index ? 36 : 12, height: 12, borderRadius: 6, background: i === index ? t.accent : t.muted, opacity: i === index ? 1 : 0.35 }} />
      ))}
    </div>
  );
}

export function FrameTemplate({ frame, theme, brand }: { frame: Frame; theme: Theme; brand: string }) {
  const base = { display: "flex", flexDirection: "column" as const, width: "100%", height: "100%", padding: PAD, fontFamily: "Instrument Sans" };

  switch (frame.kind) {
    case "cover": {
      const t = theme.strong;
      return (
        <div style={{ ...base, background: t.background, color: t.text, justifyContent: "space-between" }}>
          <Footer t={t} brand={brand} right={`1/${frame.total}`} />
          <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
            <div style={{ width: 120, height: 12, borderRadius: 6, background: t.accent }} />
            <div style={{ display: "flex", fontSize: titleSize(frame.title, 120), fontWeight: 600, lineHeight: 1.02, letterSpacing: -3 }}>{frame.title}</div>
          </div>
          <div style={{ display: "flex", fontSize: 30, color: t.muted }}>Deslizá</div>
        </div>
      );
    }
    case "slide": {
      const t = frame.last ? theme.strong : theme.light;
      return (
        <div style={{ ...base, background: t.background, color: t.text, justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 120, fontWeight: 600, color: t.accent, letterSpacing: -4, lineHeight: 1 }}>{String(frame.index + 1).padStart(2, "0")}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
            <div style={{ display: "flex", fontSize: titleSize(frame.title, 84), fontWeight: 600, lineHeight: 1.06, letterSpacing: -2 }}>{frame.title}</div>
            {frame.body ? <div style={{ display: "flex", fontSize: 42, lineHeight: 1.35, color: t.muted }}>{frame.body}</div> : null}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Footer t={t} brand={brand} />
            <Dots t={t} index={frame.index} total={frame.total} />
          </div>
        </div>
      );
    }
    case "image": {
      const t = theme.strong;
      return (
        <div style={{ ...base, background: t.background, color: t.text, justifyContent: "space-between" }}>
          <Footer t={t} brand={brand} />
          <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
            <div style={{ display: "flex", fontSize: titleSize(frame.headline, 112), fontWeight: 600, lineHeight: 1.03, letterSpacing: -3 }}>{frame.headline}</div>
            {frame.subline ? <div style={{ display: "flex", fontSize: 44, lineHeight: 1.3, color: t.muted }}>{frame.subline}</div> : null}
          </div>
          <div style={{ width: 120, height: 12, borderRadius: 6, background: t.accent }} />
        </div>
      );
    }
    case "story": {
      const t = frame.index % 2 === 0 ? theme.strong : theme.light;
      return (
        <div style={{ ...base, padding: "220px 96px", background: t.background, color: t.text, justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 10 }}>
            {Array.from({ length: frame.total }, (_, i) => (
              <div key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: t.text, opacity: i <= frame.index ? 0.9 : 0.25 }} />
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 56, alignItems: "flex-start" }}>
            <div style={{ display: "flex", fontSize: titleSize(frame.text, 88), fontWeight: 600, lineHeight: 1.12, letterSpacing: -1.5 }}>{frame.text}</div>
            {frame.sticker ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "28px 36px", borderRadius: 28, border: `4px dashed ${t.muted}` }}>
                <div style={{ display: "flex", fontSize: 30, color: t.muted }}>{`Sticker: ${frame.sticker} (se agrega al publicar)`}</div>
                {frame.stickerText ? <div style={{ display: "flex", fontSize: 40, fontWeight: 600 }}>{frame.stickerText}</div> : null}
              </div>
            ) : null}
          </div>
          <Footer t={t} brand={brand} />
        </div>
      );
    }
    case "reel-cover": {
      const t = theme.strong;
      return (
        <div style={{ ...base, padding: "260px 96px", background: t.background, color: t.text, justifyContent: "center", gap: 48 }}>
          <div style={{ width: 120, height: 12, borderRadius: 6, background: t.accent }} />
          <div style={{ display: "flex", fontSize: titleSize(frame.text, 128), fontWeight: 600, lineHeight: 1.02, letterSpacing: -3 }}>{frame.text}</div>
        </div>
      );
    }
  }
}
