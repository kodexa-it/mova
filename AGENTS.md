# Mova — reglas del repositorio

Mova es un SaaS multiempresa de Kodexa para planificar, producir, aprobar y medir contenido digital. Es un producto independiente: no comparte base de datos, autenticación ni código importado con Nexo o Nodo.

## Stack

- Next.js 15 (App Router), React 19, TypeScript estricto, Tailwind CSS 4.
- PostgreSQL 17 con Prisma 7 y `@prisma/adapter-pg`.
- Better Auth (email y contraseña) solo para identidad.
- zod para validar toda entrada; vitest para tests.

## Reglas

1. PostgreSQL es la única fuente de verdad. Nada persistente en memoria del servidor ni en `localStorage`.
2. Toda tabla de negocio lleva `workspaceId`. El workspace se resuelve en el servidor desde la URL y se valida contra la membresía; nunca se acepta un `workspaceId` enviado por el cliente.
3. Los permisos se verifican en el servidor con `requirePermission` (`modules/access`). La interfaz solo oculta acciones; nunca es la protección.
4. Los route handlers son delgados: validan, resuelven el contexto y delegan en `modules/<dominio>`. La lógica de negocio vive en `modules/`.
5. React nunca importa Prisma. Todo módulo que toca la base o secretos importa `server-only`.
6. Ningún secreto en el repo. Las variables se documentan en `.env.example` sin valores reales y se validan en `lib/env.ts`.
7. Las respuestas de error no revelan detalles internos ni si un email existe.
8. Toda acción sensible (integrantes, roles, invitaciones, configuración) se registra en `AuditLog`.
9. No se simulan datos externos (publicaciones, métricas, conexiones). Cada dato guarda su fuente.
10. Las decisiones de arquitectura se registran en `docs/adr/`.

## Antes de cerrar un cambio

```bash
npm run lint
npm run typecheck
npm test
npm run test:integration   # requiere la base de test levantada
npm run build
```

## Git

- Nunca forzar push ni reescribir el remoto.
- Antes del primer push: `git fetch origin` y revisar si GitHub ya tiene commits.
- Nunca commitear `.env` ni volcados de base.
