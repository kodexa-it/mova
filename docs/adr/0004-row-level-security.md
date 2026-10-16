# ADR 0004 — Row Level Security en PostgreSQL

- Estado: aceptada (2026-10-14)
- Prueba técnica: `scripts/spikes/rls-spike.mts`

## Contexto

En la etapa 1 el aislamiento entre workspaces se aplica en la aplicación: toda consulta de negocio filtra por `workspaceId` resuelto en el servidor y hay tests de integración que lo verifican endpoint por endpoint. Se evaluó agregar RLS como segunda barrera.

## Prueba realizada (2026-10-14)

PostgreSQL 17.10 local, Prisma 7.8 con `@prisma/adapter-pg`, rol `mova_app` sin superusuario ni `BYPASSRLS`, RLS forzado en `AuditLog` con la política `"workspaceId" = current_setting('app.workspace_id', true)` para lectura y escritura.

| Prueba | Resultado medido |
|---|---|
| Consulta sin contexto de workspace | 0 filas |
| Transacción interactiva con `set_config(..., true)` | 3 filas, todas del workspace A |
| Transacción en lote `[set_config, consulta]` | 3 filas, todas del workspace B |
| Insertar en B con contexto A | Bloqueado: `new row violates row-level security policy` |
| 10 consultas con contexto y luego 10 sin contexto en el mismo pool | Las 10 sin contexto devuelven 0: el valor local no queda en la conexión |
| Costo por lectura simple, 300 repeticiones | 0,944 ms sin RLS (rol administrador) contra 2,989 ms con RLS en lote |

El costo extra viene de las idas y vueltas adicionales (BEGIN, `set_config`, COMMIT). Contra una base remota será mayor en tiempo absoluto; hay que medirlo de nuevo al elegir proveedor.

## Decisión

1. **No se activa RLS en la etapa 1.** Las tablas de la etapa 1 son de identidad y tenancy (`user`, `session`, `Workspace`, `Membership`, `Invitation`), y se consultan antes de conocer el workspace: resolver la membresía por usuario o listar los workspaces de una persona. Protegerlas con RLS exige políticas por usuario además de por workspace, y la ganancia no compensa la complejidad hoy. La protección sigue siendo la capa de aplicación y sus tests de integración.
2. **Se activa RLS desde la etapa 2** en las tablas de negocio con `workspaceId` (perfil de marca, contenido, planes, métricas) y en `AuditLog`. El acceso pasa por un helper `withWorkspace(ctx, fn)` que abre una transacción interactiva y fija `app.workspace_id` con `set_config(..., true)`.
3. **En producción habrá dos roles de base:** uno dueño del esquema para migraciones y otro de aplicación sin `BYPASSRLS`. En desarrollo se usa un solo rol hasta la etapa 2.
4. Cada tabla nueva con RLS suma un test de integración que verifica 0 filas sin contexto y bloqueo de escritura cruzada.

## Consecuencias

- La etapa 1 queda protegida solo por la aplicación, cubierta por los tests de `tests/integration/tenancy.int.test.ts` y `roles.int.test.ts`.
- La etapa 2 tiene que crear el rol de aplicación, el helper y las políticas antes de la primera tabla de negocio.
- El patrón de transacción local es compatible con poolers en modo transacción, porque el valor vive solo dentro de cada transacción.
