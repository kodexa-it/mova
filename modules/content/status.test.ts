import { describe, expect, it } from "vitest";

import { canTransition, statusAfterEdit, TRANSITIONS } from "@/modules/content/status";

describe("estados de una pieza", () => {
  it("nada se publica sin pasar por aprobado", () => {
    expect(canTransition("DRAFT", "PUBLISHED")).toBe(false);
    expect(canTransition("PENDING_APPROVAL", "PUBLISHED")).toBe(false);
    expect(canTransition("DRAFT", "SCHEDULED")).toBe(false);
    expect(canTransition("APPROVED", "PUBLISHED")).toBe(true);
  });

  it("una pieza publicada no cambia de estado", () => {
    expect(TRANSITIONS.PUBLISHED).toEqual([]);
  });

  it("editar una pieza aprobada o programada la devuelve a borrador", () => {
    expect(statusAfterEdit("APPROVED")).toBe("DRAFT");
    expect(statusAfterEdit("SCHEDULED")).toBe("DRAFT");
    expect(statusAfterEdit("PENDING_APPROVAL")).toBe("DRAFT");
  });

  it("no se puede editar algo publicado, publicándose o archivado", () => {
    expect(statusAfterEdit("PUBLISHED")).toBe("locked");
    expect(statusAfterEdit("PUBLISHING")).toBe("locked");
    expect(statusAfterEdit("ARCHIVED")).toBe("locked");
  });

  it("cada estado solo pasa a estados definidos", () => {
    for (const [from, targets] of Object.entries(TRANSITIONS)) {
      for (const to of targets) expect(Object.keys(TRANSITIONS)).toContain(to);
      expect(targets).not.toContain(from);
    }
  });
});
