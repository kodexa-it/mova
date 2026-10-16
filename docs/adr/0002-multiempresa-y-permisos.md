# ADR 0002 — Multiempresa, roles y permisos en el servidor

- Estado: aceptada (2026-10-13)

## Decisión

- Better Auth se usa solo para identidad (usuarios, sesiones, cuentas, verificaciones, límite de intentos).
- Los workspaces, membresías, invitaciones y la auditoría son tablas propias de Mova. Se descartó el plugin de organizaciones de Better Auth para no atar el modelo de tenancy a un plugin.
- Una persona puede pertenecer a varios workspaces con un rol distinto en cada uno (`Membership` única por usuario y workspace).
- El workspace activo viaja en la URL (`/w/[slug]`). En cada request el servidor resuelve sesión → membresía → rol. El rol se lee de la base en cada request; no se guarda en la sesión, así un cambio de rol o una baja aplica de inmediato.
- Roles: `OWNER` (Dueño), `EDITOR`, `APPROVER` (Aprobador), `VIEWER` (Lector).
- Los permisos viven en una sola matriz (`modules/access/permissions.ts`). Cada route handler llama a `requirePermission` antes de tocar datos y responde 403 si no alcanza.
- Sin email verificado no se puede crear un workspace ni aceptar invitaciones.

## Reglas adicionales

- Un workspace siempre tiene al menos un Dueño.
- Nadie cambia su propio rol.
- Las invitaciones se atan a un email y un rol, vencen a los 7 días, se guardan con el token hasheado (SHA-256) y solo las acepta la cuenta con ese email verificado.
- Toda acción sobre integrantes, roles, invitaciones y configuración queda en `AuditLog`.

## Decisiones por defecto, a confirmar

- Solo el Dueño edita el perfil de marca (etapa 2).
- Se permite aprobar contenido propio (etapa 4).
- El Lector no comenta.
