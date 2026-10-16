import type { Role } from "@prisma/client";

import { Badge } from "@/components/ui";
import { ROLE_LABELS } from "@/modules/access/permissions";

// El rol no es un estado: todos en neutro, salvo Dueño que se distingue con el acento.
export function RoleBadge({ role }: { role: Role }) {
  return <Badge tone={role === "OWNER" ? "accent" : "neutral"}>{ROLE_LABELS[role]}</Badge>;
}
