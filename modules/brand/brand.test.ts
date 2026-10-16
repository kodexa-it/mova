import { describe, expect, it } from "vitest";

import { brandProgress, sectionStatus, type BrandShape } from "@/modules/brand/completeness";
import { identitySchema, pillarsSchema, SECTION_KEYS, SECTIONS, visualSchema } from "@/modules/brand/sections";
import { sectionValues } from "@/modules/brand/values";

const COMPLETE: BrandShape = {
  name: "Kodexa",
  industry: "Software",
  description: "Desarrollamos productos digitales para pymes de servicios.",
  hasVoice: true,
  paletteCount: 2,
  offerings: 2,
  audiences: 1,
  goals: 1,
  pillarWeights: [40, 30, 30],
  proofs: 0,
  rules: 0,
};

describe("avance del perfil de marca", () => {
  it("sin marca, todas las secciones necesarias están pendientes", () => {
    const progress = brandProgress(null);
    expect(progress).toMatchObject({ completed: 0, total: 7, isComplete: false, nextIncomplete: "identidad" });
    expect(sectionStatus(null, "datos")).toBe("optional");
  });

  it("una marca con las siete secciones necesarias está completa aunque falten las opcionales", () => {
    expect(brandProgress(COMPLETE)).toMatchObject({ completed: 7, isComplete: true, nextIncomplete: null });
    expect(sectionStatus(COMPLETE, "reglas")).toBe("optional");
  });

  it("los pilares solo cuentan si suman 100", () => {
    expect(sectionStatus({ ...COMPLETE, pillarWeights: [50, 40] }, "pilares")).toBe("incomplete");
    expect(sectionStatus({ ...COMPLETE, pillarWeights: [100] }, "pilares")).toBe("incomplete");
  });

  it("la identidad necesita una descripción de al menos 20 caracteres", () => {
    expect(sectionStatus({ ...COMPLETE, description: "Corto" }, "identidad")).toBe("incomplete");
  });

  it("indica la primera sección pendiente en el orden del asistente", () => {
    expect(brandProgress({ ...COMPLETE, goals: 0, hasVoice: false }).nextIncomplete).toBe("objetivos");
  });
});

describe("validación de secciones", () => {
  it("rechaza pilares que no suman 100, con un mensaje en español", () => {
    const result = pillarsSchema.safeParse({ items: [{ name: "Casos", description: "", weight: 50 }, { name: "Consejos", description: "", weight: 40 }] });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Los porcentajes tienen que sumar 100.");
  });

  it("acepta pilares que suman 100", () => {
    expect(pillarsSchema.safeParse({ items: [{ name: "Casos", description: "", weight: 60 }, { name: "Consejos", description: "", weight: 40 }] }).success).toBe(true);
  });

  it("exige colores en formato #RRGGBB", () => {
    expect(visualSchema.safeParse({ palette: [{ name: "Principal", hex: "naranja" }], headingFont: "", bodyFont: "", imageStyle: "" }).success).toBe(false);
    expect(visualSchema.safeParse({ palette: [{ name: "Principal", hex: "#FE6A00" }], headingFont: "", bodyFont: "", imageStyle: "" }).success).toBe(true);
  });

  it("el sitio web es opcional, pero si se carga tiene que ser una dirección http(s)", () => {
    const base = { name: "Kodexa", industry: "Software", description: "Desarrollamos productos digitales.", audienceTimezone: "America/Argentina/Buenos_Aires" };
    expect(identitySchema.safeParse({ ...base, website: "" }).success).toBe(true);
    expect(identitySchema.safeParse({ ...base, website: "https://kodexa.com.ar" }).success).toBe(true);
    expect(identitySchema.safeParse({ ...base, website: "javascript:alert(1)" }).success).toBe(false);
  });

  it("recorta espacios y no acepta campos obligatorios vacíos", () => {
    const result = identitySchema.safeParse({ name: "   ", industry: "Software", description: "Desarrollamos productos digitales.", website: "", audienceTimezone: "America/Argentina/Buenos_Aires" });
    expect(result.success).toBe(false);
  });

  it("los valores iniciales de una marca vacía son aceptados por el esquema salvo los campos que la persona tiene que completar", () => {
    for (const key of SECTION_KEYS) {
      const values = sectionValues(null, key, "Kodexa");
      const result = SECTIONS[key].schema.safeParse(values);
      // Voz, visual y las opcionales arrancan válidas; el resto pide completar texto.
      expect(result.success).toBe(["voz", "visual", "datos", "reglas"].includes(key));
    }
  });
});
