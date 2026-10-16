// Tamaño del título según su largo. Lo comparten las plantillas y el
// validador de legibilidad (modules/content/legibility.ts).
export function titleSize(text: string, base: number) {
  const n = text.length;
  if (n <= 18) return base;
  if (n <= 32) return Math.round(base * 0.84);
  if (n <= 50) return Math.round(base * 0.7);
  return Math.round(base * 0.58);
}
