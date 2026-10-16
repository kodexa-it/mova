import type { CSSProperties } from "react";

// Escenario del acceso: un campo de luz con una escena real del producto. Mova
// planificó la semana (tablero de fondo) y una pieza pasa de "Pendiente de
// aprobación" a "Aprobado" una sola vez, al cargar. Es decorativo: los lectores
// de pantalla no lo leen (el valor se cuenta en el texto de la columna).

const DAYS: { label: string; pieces: ("post" | "carrusel" | "reel" | "story")[] }[] = [
  { label: "Lun", pieces: ["post"] },
  { label: "Mar", pieces: ["story", "reel"] },
  { label: "Mié", pieces: ["post"] },
  { label: "Jue", pieces: ["carrusel"] },
  { label: "Vie", pieces: ["reel", "story"] },
  { label: "Sáb", pieces: [] },
  { label: "Dom", pieces: ["post"] },
];

const PIECE_TONE: Record<string, string> = {
  post: "bg-white/80",
  carrusel: "bg-white",
  reel: "bg-[#c9cffc]",
  story: "bg-white/55",
};

const at = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

function LightField({ id }: { id: string }) {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      {/* Base: perla arriba, índigo profundo abajo. */}
      <div className="absolute inset-0 bg-[linear-gradient(162deg,#eef0ff_0%,#c6ccfd_24%,#8590f4_52%,#4642dc_80%,#2b289c_100%)]" />
      {/* Veta cálida, como luz de la mañana. */}
      <div className="absolute -left-[18%] -top-[22%] h-[55%] w-[65%] rounded-full bg-[radial-gradient(closest-side,rgb(250_238_214/0.95),rgb(250_238_214/0.45)_55%,transparent)] blur-3xl" />
      {/* Cintas de luz con deriva lenta. */}
      <svg
        className="absolute -left-[10%] top-[8%] h-[95%] w-[130%] animate-[drift-a_28s_ease-in-out_infinite] will-change-transform"
        viewBox="0 0 800 600"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={`${id}-ribbon-a`} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#3d3ad8" stopOpacity="0" />
            <stop offset="0.45" stopColor="#5b62f0" stopOpacity="0.85" />
            <stop offset="1" stopColor="#b9c2ff" stopOpacity="0.2" />
          </linearGradient>
          <linearGradient id={`${id}-ribbon-edge`} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0.95" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <filter id={`${id}-soft`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="18" />
          </filter>
        </defs>
        <path d="M-40 610 C 160 470, 300 260, 520 150 S 760 40, 860 -20 L 860 120 C 700 170, 560 300, 420 430 S 160 640, -40 700 Z" fill={`url(#${id}-ribbon-a)`} filter={`url(#${id}-soft)`} />
        <path d="M-40 610 C 160 470, 300 260, 520 150 S 760 40, 860 -20" fill="none" stroke={`url(#${id}-ribbon-edge)`} strokeWidth="1.75" opacity="0.85" />
        <path d="M-40 640 C 170 500, 320 300, 540 190 S 770 80, 860 30" fill="none" stroke={`url(#${id}-ribbon-edge)`} strokeWidth="1" opacity="0.35" />
      </svg>
      <div className="absolute -bottom-[30%] -right-[15%] h-[80%] w-[80%] animate-[drift-b_32s_ease-in-out_infinite] rounded-full bg-[radial-gradient(closest-side,#2a27a3,transparent)] opacity-80 blur-3xl will-change-transform" />
      <div className="absolute left-[30%] top-[38%] h-[45%] w-[55%] animate-[drift-b_36s_ease-in-out_infinite_reverse] rounded-full bg-[radial-gradient(closest-side,#eef0ff,transparent)] opacity-60 blur-3xl will-change-transform" />
      {/* Grano fino: evita el bandeado de los degradados y da textura de papel. */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.08] mix-blend-overlay">
        <filter id={`${id}-grain`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#${id}-grain)`} />
      </svg>
    </div>
  );
}

function WeekBoard() {
  return (
    <div
      className="glass-veil w-full max-w-[30rem] animate-[float-in_900ms_var(--ease-standard)_both] rounded-[22px] p-5"
      style={at(280)}
    >
      <div className="flex items-baseline justify-between text-ink">
        <p className="text-small font-medium">Plan de la semana</p>
        <p className="tabular text-caption text-ink-2">13 al 19 de octubre</p>
      </div>
      <div className="mt-4 grid grid-cols-7 gap-2">
        {DAYS.map((day) => {
          const featured = day.label === "Jue";
          return (
            <div
              key={day.label}
              className={`flex h-28 flex-col gap-1.5 rounded-[12px] p-1.5 ${featured ? "bg-white/70 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.9),0_6px_16px_-6px_rgb(30_28_120/0.3)]" : "bg-white/30"}`}
            >
              <span className={`px-0.5 text-caption ${featured ? "font-semibold text-ink" : "text-ink-2"}`}>{day.label}</span>
              {day.pieces.map((piece, index) => (
                <span key={index} className={`flex h-5 items-center gap-1 rounded-[6px] px-1 ${PIECE_TONE[piece]}`}>
                  <span className="relative size-1.5 shrink-0 rounded-full bg-ink/25">
                    {featured ? (
                      <span className="absolute -inset-px animate-[state-in_360ms_var(--ease-standard)_both] rounded-full bg-success" style={at(2150)} />
                    ) : null}
                  </span>
                  <span className="h-1 flex-1 rounded-full bg-ink/15" />
                </span>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CarouselThumb() {
  return (
    <div className="relative size-[68px] shrink-0">
      <span className="absolute inset-0 translate-x-2 rotate-[6deg] rounded-[12px] bg-[#c9cffc]" />
      <span className="absolute inset-0 translate-x-1 rotate-[3deg] rounded-[12px] bg-[#a8b1fa]" />
      <span className="absolute inset-0 flex flex-col justify-end gap-1 rounded-[12px] bg-[linear-gradient(150deg,#5b62f0,#2f2ca8)] p-2">
        <span className="h-1 w-8 rounded-full bg-white/90" />
        <span className="h-1 w-5 rounded-full bg-white/60" />
      </span>
    </div>
  );
}

function ApprovalCard({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`glass-light w-full animate-[float-in_900ms_var(--ease-spring)_both] rounded-[22px] ${compact ? "max-w-[22rem] p-4" : "max-w-[24rem] p-5"}`}
      style={at(compact ? 200 : 520)}
    >
      <div className="flex gap-4">
        <CarouselThumb />
        <div className="min-w-0 pt-0.5">
          <p className="text-caption text-ink-2">Carrusel para el jueves, 10:00</p>
          <p className="mt-1 text-body font-medium leading-snug text-ink">Cómo elegimos el café de esta temporada</p>
        </div>
      </div>
      <div className="mt-4 flex h-8 items-center justify-between">
        <span className="relative inline-flex h-7 items-center overflow-hidden whitespace-nowrap rounded-full bg-warning-soft px-3 text-caption font-medium text-warning animate-[pill-tint_300ms_var(--ease-standard)_both,pill-width_420ms_var(--ease-spring)_both]" style={{ animationDelay: "1950ms, 1900ms" }}>
          {/* Los dos estados ocupan el mismo lugar: uno sale y el otro entra. */}
          <span className="animate-[state-out_260ms_var(--ease-exit)_both]" style={at(1880)}>
            Pendiente de aprobación
          </span>
          <span className="absolute inset-0 flex items-center gap-1.5 px-3 animate-[state-in_360ms_var(--ease-standard)_both]" style={at(2000)}>
            <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="m2.5 6.2 2.3 2.3 4.7-5" strokeDasharray="14" className="animate-[check-draw_360ms_var(--ease-standard)_both]" style={at(2120)} />
            </svg>
            Aprobado
          </span>
        </span>
        <span className="relative">
          <span
            className="inline-flex h-8 items-center rounded-[9px] bg-accent px-3 text-caption font-medium text-white shadow-[0_1px_2px_rgb(61_58_216/0.3)] animate-[press_260ms_var(--ease-standard)_both,fade-out_240ms_var(--ease-exit)_both]"
            style={{ animationDelay: "1640ms, 1960ms" }}
          >
            Aprobar
          </span>
          <span className="absolute inset-y-0 right-0 flex items-center whitespace-nowrap text-caption text-ink-2 animate-[state-in_360ms_var(--ease-standard)_both]" style={at(2200)}>
            Lista para programar
          </span>
        </span>
      </div>
    </div>
  );
}

export function AuthStage() {
  return (
    <div aria-hidden className="relative h-full overflow-hidden rounded-[28px] animate-[stage-in_1100ms_var(--ease-standard)_both]">
      <LightField id="stage" />
      <div className="relative flex h-full flex-col justify-between p-10 xl:p-14">
        <div />
        <div className="relative mx-auto flex w-full max-w-[30rem] flex-col items-center">
          <WeekBoard />
          <div className="-mt-16 w-full pl-10 xl:pl-16">
            <ApprovalCard />
          </div>
        </div>
        <p className="max-w-[24rem] animate-enter text-lead font-medium text-white [--i:6]">
          Mova propone la semana de tu marca. Tu equipo aprueba cada pieza antes de que se publique.
        </p>
      </div>
    </div>
  );
}

// Versión para pantallas angostas: una franja de luz con la tarjeta de aprobación.
export function AuthStageCompact() {
  return (
    <div aria-hidden className="relative overflow-hidden rounded-[22px] animate-[stage-in_900ms_var(--ease-standard)_both]">
      <LightField id="stage-compact" />
      <div className="relative flex justify-center px-5 py-7">
        <ApprovalCard compact />
      </div>
    </div>
  );
}
