import type { Role } from "@prisma/client";

// Matriz única de permisos (ADR 0002). Se define completa ahora para que las
// etapas siguientes no cambien el modelo; la etapa 1 usa los de workspace,
// integrantes y auditoría. La interfaz consulta esta misma matriz, pero la
// protección real es requirePermission en el servidor.
export const ROLES = ["OWNER", "EDITOR", "APPROVER", "VIEWER"] as const satisfies readonly Role[];

export const PERMISSIONS = {
  "workspace.read": ["OWNER", "EDITOR", "APPROVER", "VIEWER"],
  "workspace.update": ["OWNER"],
  "workspace.delete": ["OWNER"],
  "members.read": ["OWNER", "EDITOR", "APPROVER", "VIEWER"],
  "members.manage": ["OWNER"],
  "audit.read": ["OWNER"],
  // Etapas siguientes
  "brand.update": ["OWNER"],
  "plan.write": ["OWNER", "EDITOR"],
  "content.write": ["OWNER", "EDITOR"],
  "content.comment": ["OWNER", "EDITOR", "APPROVER"],
  "content.requestChanges": ["OWNER", "APPROVER"],
  "content.approve": ["OWNER", "APPROVER"],
  "content.publishManual": ["OWNER", "EDITOR", "APPROVER"],
  "metrics.writeManual": ["OWNER", "EDITOR"],
  "learnings.review": ["OWNER", "EDITOR", "APPROVER"],
  "integrations.manage": ["OWNER"],
  "usage.read": ["OWNER"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export function permissionsFor(role: Role): Permission[] {
  return (Object.keys(PERMISSIONS) as Permission[]).filter((permission) => can(role, permission));
}

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Dueño",
  EDITOR: "Editor",
  APPROVER: "Aprobador",
  VIEWER: "Lector",
};
