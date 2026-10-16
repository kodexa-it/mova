import { describe, expect, it } from "vitest";

import { computeLearnings, shortcodeOf, type MeasuredPost } from "@/modules/metrics/model";
import { parseApifyItems } from "@/modules/metrics/apify";
import { strategyFromAnswer, strategyPrompt } from "@/modules/plans/strategy-model";

const ctx = { weekStart: "2026-10-19", today: "2026-10-20", count: 4, pillars: ["Casos", "Consejos"], goals: ["Conseguir consultas"], newKey: (() => { let i = 0; return () => `key${String(++i).padStart(4, "0")}`; })() };

describe("estrategia: respuesta de la IA", () => {
  it("descarta días pasados, fuera de la semana y formatos inválidos; ordena por fecha", () => {
    const result = strategyFromAnswer(
      {
        summary: "Semana de web propia",
        slots: [
          { date: "2026-10-23", time: "19:00", format: "REEL", pillar: "casos", goal: "x", title: "B" },
          { date: "2026-10-19", time: "10:00", format: "CAROUSEL", title: "Ayer" },
          { date: "2026-10-27", format: "CAROUSEL", title: "Otra semana" },
          { date: "2026-10-21", time: "25:00", format: "CAROUSEL", pillar: "Consejos", goal: "Conseguir consultas", title: "A" },
          { date: "2026-10-22", format: "VIDEO", title: "Formato malo" },
        ],
      },
      ctx,
    )!;
    expect(result.dropped).toBe(3);
    expect(result.strategy.slots.map((s) => [s.date, s.time, s.title, s.pillar, s.goal])).toEqual([
      ["2026-10-21", "10:00", "A", "Consejos", "Conseguir consultas"],
      ["2026-10-23", "19:00", "B", "Casos", null],
    ]);
  });

  it("no pasa de la cantidad pedida y devuelve null si no queda nada", () => {
    const slots = Array.from({ length: 6 }, (_, i) => ({ date: "2026-10-22", format: "STORY", title: `T${i}` }));
    expect(strategyFromAnswer({ slots }, { ...ctx, count: 3 })!.strategy.slots).toHaveLength(3);
    expect(strategyFromAnswer({ slots: [] }, ctx)).toBeNull();
    expect(strategyFromAnswer("no es json", ctx)).toBeNull();
  });

  it("el pedido lleva foco, días disponibles y avisa cuando no hay aprendizajes", () => {
    const prompt = strategyPrompt({
      brand: { name: "Kodexa", industry: "Software", description: "", website: null, offerings: [], audiences: [], goals: [], pillars: [{ name: "Casos", description: "", weight: 60 }], proofs: [], rules: [], voice: null },
      weekStart: "2026-10-19",
      today: "2026-10-21",
      focus: "Web propia",
      count: 3,
      instructions: "",
      scheduled: [],
      recent: [],
      learnings: [],
    });
    expect(prompt).toContain("Foco de la semana: Web propia");
    expect(prompt).toContain("Días disponibles: 2026-10-21, 2026-10-22");
    expect(prompt).not.toContain("2026-10-20,");
    expect(prompt).toContain("Todavía no hay resultados medidos suficientes.");
    expect(prompt).toContain("Casos (60 %)");
  });
});

describe("métricas", () => {
  it("lee el código de la publicación del enlace", () => {
    expect(shortcodeOf("https://www.instagram.com/p/ABC_def-1/")).toBe("ABC_def-1");
    expect(shortcodeOf("https://instagram.com/reel/XYZ12345/?igsh=1")).toBe("XYZ12345");
    expect(shortcodeOf("https://www.instagram.com/kodexa.it/p/QWE12345/")).toBe("QWE12345");
    expect(shortcodeOf("https://example.com/p/ABC")).toBeNull();
  });

  it("sin 6 publicaciones medidas no hay conclusiones", () => {
    const post: MeasuredPost = { format: "CAROUSEL", pillar: "Casos", likes: 10, comments: 1, saves: null, shares: null, reach: null, inquiries: null };
    expect(computeLearnings(Array(5).fill(post))).toEqual({ lines: [], measured: 5, enough: false });
  });

  it("compara formatos y pilares con la cantidad de casos", () => {
    const posts: MeasuredPost[] = [
      ...Array.from({ length: 3 }, () => ({ format: "CAROUSEL" as const, pillar: "Casos", likes: 100, comments: 10, saves: 5, shares: null, reach: null, inquiries: 1 })),
      ...Array.from({ length: 3 }, () => ({ format: "REEL" as const, pillar: "Consejos", likes: 20, comments: 2, saves: null, shares: null, reach: null, inquiries: 0 })),
    ];
    const { lines, enough } = computeLearnings(posts);
    expect(enough).toBe(true);
    expect(lines[0]).toMatch(/n=6/);
    expect(lines.join("\n")).toMatch(/Formato con más interacciones: Carrusel \(115 en promedio, n=3\); el de menos: Reel \(22, n=3\)/);
    expect(lines.join("\n")).toMatch(/Pilar con más interacciones: Casos/);
    expect(lines.join("\n")).toMatch(/Consultas comerciales registradas: 3 en 6 publicaciones; la mayoría llegó desde carrusel/);
  });

  it("Apify: toma el ítem sin error y no confía en me gusta ocultos", () => {
    expect(parseApifyItems([{ shortCode: "A", likesCount: -1, commentsCount: 3, videoPlayCount: 50 }])).toEqual({ likes: null, comments: 3, plays: 50, shortcode: "A" });
    expect(() => parseApifyItems([{ error: "not_found" }])).toThrow();
  });
});
