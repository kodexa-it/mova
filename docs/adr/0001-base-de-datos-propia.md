# ADR 0001 — Base de datos propia, PostgreSQL local en desarrollo

- Estado: aceptada (2026-10-13)

## Contexto

Nexo y Nodo comparten un proyecto de Supabase con datos reales, sin staging ni backups automáticos configurados, y comparten tablas de identidad que Nexo migra por su cuenta. Mova debe ser un producto independiente.

## Decisión

- Mova usa su propia base PostgreSQL. No lee ni escribe tablas de Nexo o Nodo.
- En desarrollo: PostgreSQL 17 en Docker (`docker-compose.yml`), puerto 5433, con dos bases: `mova` (desarrollo) y `mova_test` (tests de integración).
- Esquema y migraciones con Prisma 7 y `@prisma/adapter-pg`. Las migraciones se versionan en `prisma/migrations`; nunca `prisma db push` sobre una base con datos.
- La aplicación solo conoce `DATABASE_URL`. No se usa ninguna función específica de un proveedor, para poder pasar a PostgreSQL administrado cambiando la variable y corriendo `prisma migrate deploy`.

## Consecuencias

- Los usuarios de Nexo o Nodo se registran por separado en Mova. Una cuenta única de Kodexa queda para más adelante, por API, sin compartir base.
- Antes de producción hay que elegir proveedor administrado con backups y restauración a un punto en el tiempo.
