import type { IconId } from "@/modules/content/layouts";

// Íconos propios de Mova: trazos geométricos simples sobre una grilla de 24,
// dibujados para este proyecto (sin licencias de terceros). Son datos para que
// los use tanto el renderizador de imágenes como el editor.
export interface IconShape {
  paths?: string[];
  circles?: [number, number, number][];
  rects?: [number, number, number, number, number][];
}

export const ICON_SHAPES: Record<IconId, IconShape> = {
  check: { paths: ["M5 12.5l4.5 4.5L19 7.5"] },
  x: { paths: ["M6.5 6.5l11 11M17.5 6.5l-11 11"] },
  arrow: { paths: ["M4.5 12h15M13.5 6l6 6-6 6"] },
  clock: { circles: [[12, 12, 8.5]], paths: ["M12 7.5V12l3 2"] },
  chat: { paths: ["M4.5 5.5h15v10h-9l-4.5 3.5v-3.5h-1.5z"] },
  phone: { rects: [[7, 3, 10, 18, 2.5]], paths: ["M11 17.5h2"] },
  globe: { circles: [[12, 12, 8.5]], paths: ["M3.5 12h17", "M12 3.5c2.6 3 2.6 14 0 17", "M12 3.5c-2.6 3-2.6 14 0 17"] },
  chart: { paths: ["M5.5 19.5v-7", "M12 19.5V5.5", "M18.5 19.5v-10", "M3.5 19.5h17"] },
  star: { paths: ["M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.7L12 16.8l-5.1 2.7 1-5.7-4.1-4 5.7-.8z"] },
  users: { circles: [[9, 8.5, 3.2]], paths: ["M3.5 19.5c.6-3.3 2.8-5 5.5-5s4.9 1.7 5.5 5", "M15.5 5.3a3.2 3.2 0 0 1 0 6.4", "M17.5 14.6c1.7.6 2.7 2.2 3 4.9"] },
  calendar: { rects: [[3.5, 5, 17, 15, 2.5]], paths: ["M3.5 10h17", "M8 3v4", "M16 3v4"] },
  pin: { circles: [[12, 9.8, 2.4]], paths: ["M12 20.5s-6.5-5.7-6.5-10.7a6.5 6.5 0 0 1 13 0c0 5-6.5 10.7-6.5 10.7z"] },
  spark: { paths: ["M12 3.5l2 6.5 6.5 2-6.5 2-2 6.5-2-6.5-6.5-2 6.5-2z"] },
  shield: { paths: ["M12 3.5l7.5 2.8v5.6c0 4.3-3.2 7.6-7.5 8.6-4.3-1-7.5-4.3-7.5-8.6V6.3z", "M9 12l2.2 2.2L15.5 10"] },
  gear: { circles: [[12, 12, 3.2]], paths: ["M12 3v2.8", "M12 18.2V21", "M3 12h2.8", "M18.2 12H21", "M5.6 5.6l2 2", "M16.4 16.4l2 2", "M5.6 18.4l2-2", "M16.4 7.6l2-2"] },
  bulb: { paths: ["M9.5 17.5h5", "M10.5 20.5h3", "M12 3.5a5.8 5.8 0 0 0-3.4 10.5c.6.5 1 1.2 1 2v.5h4.8V16c0-.8.4-1.5 1-2A5.8 5.8 0 0 0 12 3.5z"] },
  cart: { circles: [[9.5, 19.5, 1.4], [17, 19.5, 1.4]], paths: ["M3 4.5h2.4l2.2 11h10.6l2.3-7.5H7"] },
  heart: { paths: ["M12 19.5s-7.5-4.5-7.5-10a4.2 4.2 0 0 1 7.5-2.6 4.2 4.2 0 0 1 7.5 2.6c0 5.5-7.5 10-7.5 10z"] },
};
