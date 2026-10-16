import { describe, expect, it } from "vitest";

import { extractJson } from "@/modules/ai/json";
import { costMicros, estimateMaxMicros, formatUsd } from "@/modules/ai/pricing";

describe("costo por llamada", () => {
  it("calcula el costo de Haiku 5.5 en micro-dólares", () => {
    // 1.000 tokens de entrada a USD 0,10/MTok + 500 de salida a USD 0,50/MTok = USD 0,00035
    expect(costMicros("claude-haiku-5-5", 1000, 500)).toBe(350);
  });

  it("aplica el precio de contexto largo de Haiku 5.5 por encima de 100.000 tokens", () => {
    expect(costMicros("claude-haiku-5-5", 100_000, 0)).toBe(10_000);
    expect(costMicros("claude-haiku-5-5", 100_001, 0)).toBe(50_001);
  });

  it("calcula Sonnet 5.5", () => {
    expect(costMicros("claude-sonnet-5-5", 2000, 1000)).toBe(14_000);
  });

  it("no inventa precios para un modelo desconocido", () => {
    expect(() => costMicros("modelo-x", 1, 1)).toThrow();
  });

  it("la reserva previa nunca es menor que el costo real de la misma llamada", () => {
    const text = "x".repeat(3000);
    const reserve = estimateMaxMicros("claude-haiku-5-5", text.length, 1500);
    // 3.000 caracteres son a lo sumo ~1.000 tokens en español; la salida está acotada a 1.500.
    expect(reserve).toBeGreaterThanOrEqual(costMicros("claude-haiku-5-5", 1000, 1500));
  });

  it("formatea en dólares con precisión suficiente para montos chicos", () => {
    expect(formatUsd(350)).toBe("USD 0,0004");
    expect(formatUsd(2_000_000)).toBe("USD 2,00");
  });
});

describe("lectura de la respuesta del modelo", () => {
  it("extrae JSON plano o dentro de un bloque de código", () => {
    expect(extractJson('{"items":[]}')).toEqual({ items: [] });
    expect(extractJson('Acá va:\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("devuelve null si no hay JSON válido", () => {
    expect(extractJson("No sé")).toBeNull();
    expect(extractJson("{roto")).toBeNull();
  });
});
