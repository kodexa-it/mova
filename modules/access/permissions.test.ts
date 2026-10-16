import { describe, expect, it } from "vitest";

import { can, PERMISSIONS, permissionsFor, ROLES, type Permission } from "@/modules/access/permissions";

// Matriz esperada escrita a mano, independiente de la implementación: si
// alguien cambia un permiso, este test obliga a hacerlo a propósito.
const EXPECTED: Record<Permission, Record<(typeof ROLES)[number], boolean>> = {
  "workspace.read": { OWNER: true, EDITOR: true, APPROVER: true, VIEWER: true },
  "workspace.update": { OWNER: true, EDITOR: false, APPROVER: false, VIEWER: false },
  "workspace.delete": { OWNER: true, EDITOR: false, APPROVER: false, VIEWER: false },
  "members.read": { OWNER: true, EDITOR: true, APPROVER: true, VIEWER: true },
  "members.manage": { OWNER: true, EDITOR: false, APPROVER: false, VIEWER: false },
  "audit.read": { OWNER: true, EDITOR: false, APPROVER: false, VIEWER: false },
  "brand.update": { OWNER: true, EDITOR: false, APPROVER: false, VIEWER: false },
  "plan.write": { OWNER: true, EDITOR: true, APPROVER: false, VIEWER: false },
  "content.write": { OWNER: true, EDITOR: true, APPROVER: false, VIEWER: false },
  "content.comment": { OWNER: true, EDITOR: true, APPROVER: true, VIEWER: false },
  "content.requestChanges": { OWNER: true, EDITOR: false, APPROVER: true, VIEWER: false },
  "content.approve": { OWNER: true, EDITOR: false, APPROVER: true, VIEWER: false },
  "content.publishManual": { OWNER: true, EDITOR: true, APPROVER: true, VIEWER: false },
  "metrics.writeManual": { OWNER: true, EDITOR: true, APPROVER: false, VIEWER: false },
  "learnings.review": { OWNER: true, EDITOR: true, APPROVER: true, VIEWER: false },
  "integrations.manage": { OWNER: true, EDITOR: false, APPROVER: false, VIEWER: false },
  "usage.read": { OWNER: true, EDITOR: false, APPROVER: false, VIEWER: false },
};

describe("matriz de permisos", () => {
  it("cubre exactamente los permisos definidos", () => {
    expect(Object.keys(EXPECTED).sort()).toEqual(Object.keys(PERMISSIONS).sort());
  });

  for (const permission of Object.keys(EXPECTED) as Permission[]) {
    for (const role of ROLES) {
      it(`${role} ${EXPECTED[permission][role] ? "puede" : "no puede"} ${permission}`, () => {
        expect(can(role, permission)).toBe(EXPECTED[permission][role]);
      });
    }
  }

  it("el Lector no puede modificar nada", () => {
    expect(permissionsFor("VIEWER").sort()).toEqual(["members.read", "workspace.read"]);
  });

  it("el Dueño tiene todos los permisos", () => {
    expect(permissionsFor("OWNER")).toHaveLength(Object.keys(PERMISSIONS).length);
  });
});
