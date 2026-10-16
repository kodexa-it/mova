// Ritmo de un guion de Reel: tiempos por línea, hook a tiempo, beats largos y
// tramos sin nada concreto. Adaptado al español de beats.py de
// instagram-agent-skill (MIT, (c) 2026 Jake Schincariol). Ver THIRD_PARTY_NOTICES.md.
import { SPOKEN_WPS } from "@/modules/content/validators/hook";
import { concreteMarkers, words, type Check } from "@/modules/content/validators/report";

export const HOOK_WINDOW = 3; // segundos: después, el pulgar ya decidió.
export const MAX_BEAT = 4; // segundos en una idea sin cambio en pantalla.
export const ABSTRACT_RUN = 3; // líneas seguidas sin nada comprobable.

export interface Beat {
  start: number;
  duration: number;
  text: string;
  concrete: boolean;
}

// Estimación por cantidad de palabras: sirve para planificar la edición, no
// reemplaza grabarlo.
export function timeline(lines: string[]): Beat[] {
  let clock = 0;
  return lines
    .map((l) => l.trim())
    .filter(Boolean)
    .map((text) => {
      const duration = words(text).length / SPOKEN_WPS;
      const beat = { start: clock, duration, text, concrete: concreteMarkers(text).length > 0 };
      clock += duration;
      return beat;
    });
}

export function reelChecks(lines: string[], targetSeconds: number): Check[] {
  const beats = timeline(lines);
  if (!beats.length) return [{ id: "reel.script", label: "Guion", status: "fail", detail: "El guion está vacío." }];
  const checks: Check[] = [];
  const total = beats.reduce((n, b) => n + b.duration, 0);
  const first = beats[0]!;

  checks.push(
    first.duration > HOOK_WINDOW
      ? { id: "reel.hook-time", label: "Hook a tiempo", status: "warn", detail: `La primera línea tarda ${first.duration.toFixed(1)} s en decirse. Bajala a ${Math.floor(HOOK_WINDOW * SPOKEN_WPS)} palabras o menos.` }
      : { id: "reel.hook-time", label: "Hook a tiempo", status: "pass", detail: `Se dice en ${first.duration.toFixed(1)} s.` },
  );

  const long = beats.map((b, i) => [b, i + 1] as const).filter(([b]) => b.duration > MAX_BEAT).map(([, n]) => n);
  if (long.length)
    checks.push({ id: "reel.long-beats", label: "Ritmo", status: "warn", detail: `Línea(s) ${long.join(", ")} pasan los ${MAX_BEAT} s: partila o cambiá lo que se ve en pantalla.` });

  let run = 0;
  let runStart = 0;
  for (const [i, b] of beats.entries()) {
    if (b.concrete) {
      run = 0;
      continue;
    }
    if (run === 0) runStart = i + 1;
    run += 1;
    if (run === ABSTRACT_RUN) {
      checks.push({ id: "reel.abstract", label: "Algo concreto", status: "warn", detail: `Las líneas ${runStart} a ${i + 1} no tienen ninguna cifra ni nombre. Sumá un dato en alguna.` });
      break;
    }
  }

  const diff = total - targetSeconds;
  const tolerance = Math.max(3, targetSeconds * 0.2);
  checks.push(
    Math.abs(diff) <= tolerance
      ? { id: "reel.duration", label: "Duración", status: "pass", detail: `~${Math.round(total)} s para un objetivo de ${targetSeconds} s.` }
      : { id: "reel.duration", label: "Duración", status: "warn", detail: `~${Math.round(total)} s dichos, objetivo ${targetSeconds} s: ${diff > 0 ? "sobran" : "faltan"} unos ${Math.abs(Math.round(diff))} s.` },
  );
  return checks;
}
