import { describe, expect, it } from "vitest";

import { generateInvitationToken, hashInvitationToken, isPlausibleToken, normalizeEmail } from "@/modules/invitations/token";

describe("tokens de invitación", () => {
  it("genera tokens únicos con formato válido", () => {
    const tokens = new Set(Array.from({ length: 50 }, generateInvitationToken));
    expect(tokens.size).toBe(50);
    for (const token of tokens) expect(isPlausibleToken(token)).toBe(true);
  });

  it("el hash es determinístico y no contiene el token", () => {
    const token = generateInvitationToken();
    expect(hashInvitationToken(token)).toBe(hashInvitationToken(token));
    expect(hashInvitationToken(token)).not.toContain(token);
  });

  it("rechaza tokens con formato inválido", () => {
    expect(isPlausibleToken("corto")).toBe(false);
    expect(isPlausibleToken("a".repeat(42) + "$")).toBe(false);
  });

  it("normaliza emails", () => {
    expect(normalizeEmail("  Ana@Ejemplo.COM ")).toBe("ana@ejemplo.com");
  });
});
