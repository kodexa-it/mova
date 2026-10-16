# ADR 0003 — Tareas en segundo plano

- Estado: propuesta; se decide al empezar la etapa 3

## Contexto

El hosting previsto es Netlify. Límites documentados (2026-10-13): funciones síncronas 60 s, funciones programadas 30 s, funciones en segundo plano 15 min con reintentos a 1 y 2 minutos. Ninguno se puede ampliar. Netlify no ofrece procesos siempre encendidos.

La etapa 1 no necesita tareas en segundo plano. Las necesitan la generación con IA, el plan semanal, los recordatorios y las mediciones con Apify (etapas 3 a 5).

## Propuesta

- Tabla `Job` propia en PostgreSQL: estado, intentos, `runAt`, clave de idempotencia; los trabajos se toman con `FOR UPDATE SKIP LOCKED`.
- En local: `npm run worker` consume la cola.
- En Netlify: una función programada despierta cada pocos minutos y dispara funciones en segundo plano (hasta 15 min) por trabajo.
- Se descarta pg-boss porque requiere un proceso siempre encendido.

## Fuentes

- https://docs.netlify.com/build/functions/configuration.md
- https://docs.netlify.com/build/functions/scheduled-functions/
- https://docs.netlify.com/build/functions/background-functions/
