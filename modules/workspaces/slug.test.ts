import { describe, expect, it } from "vitest";

import { slugify, withSuffix } from "@/modules/workspaces/slug";

describe("slugify", () => {
  it("normaliza acentos, espacios y símbolos", () => {
    expect(slugify("Kodexa · Comunicación Ñandú")).toBe("kodexa-comunicacion-nandu");
  });

  it("garantiza un mínimo de 3 caracteres", () => {
    expect(slugify("A")).toBe("workspace-a");
    expect(slugify("!!!")).toBe("workspace");
  });

  it("limita a 40 caracteres sin guion final", () => {
    const slug = slugify("a".repeat(39) + " b c");
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("agrega un sufijo respetando el largo máximo", () => {
    expect(withSuffix("x".repeat(40), "abc123")).toHaveLength(40);
  });
});
