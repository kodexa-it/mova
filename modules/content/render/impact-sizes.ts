// Tamaño del título en el estilo Impacto (Anton es condensada: entra más que
// una sans). Lo comparten las plantillas y el validador de legibilidad.
export function impactTitleSize(text: string, base: number) {
  const n = text.length;
  if (n <= 16) return base;
  if (n <= 28) return Math.round(base * 0.84);
  if (n <= 45) return Math.round(base * 0.76);
  if (n <= 65) return Math.round(base * 0.66);
  return Math.round(base * 0.58);
}
