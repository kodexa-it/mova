# Mova

Mova es el SaaS de Kodexa para planificar, producir, aprobar y medir la comunicación digital de una empresa, empezando por Instagram.

Estado: **etapa 2 (marca y gateway de IA)**. Incluye cuentas con verificación de email y recuperación de contraseña, workspaces multiempresa, roles con permisos aplicados en el servidor, invitaciones, auditoría, el perfil de marca guiado y el gateway de IA con costo por llamada y presupuesto mensual. Incluye también piezas (publicación, carrusel, Reel y Stories) con versiones inmutables y revisión automática en español. Con una clave de IA, Mova escribe y mejora piezas con el contexto de la marca. Todavía no incluye plantillas visuales, calendario, aprobación ni métricas.

## Requisitos

- Node.js 22 (ver `.nvmrc`).
- Docker Desktop (en Windows, con WSL 2) para PostgreSQL y la bandeja de email local.
- Puertos libres: 5433 (PostgreSQL), 1025 y 8025 (Mailpit), 3000 (la app).

## Primer arranque

```bash
# 1. Variables de entorno
cp .env.example .env
#    Completá BETTER_AUTH_SECRET con un valor aleatorio:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# 2. Dependencias
npm install

# 3. Base de datos y bandeja de email
npm run db:up        # PostgreSQL 17 en localhost:5433 y Mailpit
npm run db:migrate   # aplica las migraciones
npm run db:seed      # opcional: datos de prueba

# 4. App
npm run dev          # http://localhost:3000
```

Los emails (verificación, recuperación, invitaciones) no salen a internet: llegan a Mailpit en http://localhost:8025.

### Evaluación de piezas

Con `ANTHROPIC_API_KEY` cargada: `npm run eval:content -- --kodexa=<slug>` genera los 30 casos de `eval/cases.json`, corre los validadores y deja en `eval/results/` una tabla para marcar qué piezas se aprobarían sin editar, con el costo de cada una.

### IA (opcional)

Sin configurar nada, Mova funciona completo y el asistente de marca aparece desactivado. Para activarlo, cargá `ANTHROPIC_API_KEY` en `.env` (solo se usa en el servidor) y reiniciá `npm run dev`. Cada llamada queda en **Uso de IA** con tokens y costo; el presupuesto por workspace es de USD 2 por mes y se controla antes de llamar al modelo ([ADR 0005](docs/adr/0005-gateway-de-ia.md)).

**Imágenes con IA (modo premium, opcional).** Para activarlas, cargá `GEMINI_API_KEY` en `.env` (Google AI Studio, con facturación activa: el modelo de imágenes no tiene capa gratuita) y reiniciá. Cada pieza tiene el interruptor «Generación visual con IA» (apagado por defecto). Cada imagen muestra su costo estimado (USD 0,067 en 1K y USD 0,101 en 2K, precio publicado por Google el 15/10/2026) y se genera solo después de confirmarla. El límite mensual de imágenes es de USD 1 por workspace; el Dueño lo cambia en **Uso de IA** ([ADR 0009](docs/adr/0009-modo-visual-premium.md)).

**Estrategia semanal y tareas en segundo plano.** En el Calendario, con el foco de la semana guardado, «Proponer la semana con IA» arma la estrategia; al aprobarla, Mova crea las piezas y las escribe en segundo plano, y avisa a Aprobadores y Dueños (campana y email). En local las tareas corren solas después de aprobar; si reiniciás el servidor a mitad, `npm run worker` termina las pendientes ([ADR 0010](docs/adr/0010-estrategia-cola-avisos-metricas.md)).

### Datos de prueba (`npm run db:seed`)

Contraseña de todos: `mova-local-1234`.

| Usuario | Kodexa | Empresa demo |
|---|---|---|
| ana@mova.local | Dueña | Lectora |
| eva@mova.local | Editora | Dueña |
| ale@mova.local | Aprobador | — |
| leo@mova.local | Lector | — |

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | App en modo desarrollo |
| `npm run lint` / `npm run typecheck` | ESLint y TypeScript |
| `npm test` | Tests unitarios (sin base) |
| `npm run test:integration` | Tests contra PostgreSQL real; usa `TEST_DATABASE_URL` y la borra en cada corrida |
| `npm run build` / `npm start` | Build de producción y servidor |
| `npm run check:bundle` | Después del build: verifica que ningún secreto llegue al navegador |
| `npm run smoke` | Con `npm start` corriendo y `EMAIL_TRANSPORT=console`: recorre el flujo por HTTP |
| `npm run db:migrate` / `db:deploy` / `db:reset` | Migraciones en desarrollo, en despliegue, o reiniciar la base local |

Antes de dar un cambio por terminado: `npm run lint && npm run typecheck && npm test && npm run test:integration && npm run build`.

## Estructura

```
app/            páginas y API (route handlers delgados)
modules/        lógica de dominio: access (permisos), workspaces, members, invitations, audit
lib/            infraestructura: env, prisma, auth, email, http
components/     interfaz compartida: ui (sistema visual), app (barra, insignias), brand (logotipo)
prisma/         esquema, migraciones y semilla
tests/          helpers y tests de integración
docs/adr/       decisiones de arquitectura
docs/design/    sistema visual (tokens, tipografía, componentes)
scripts/        chequeos y pruebas técnicas
```

## Decisiones

- [ADR 0001](docs/adr/0001-base-de-datos-propia.md): base propia, independiente de Nexo y Nodo.
- [ADR 0002](docs/adr/0002-multiempresa-y-permisos.md): multiempresa, roles y permisos en el servidor.
- [ADR 0003](docs/adr/0003-tareas-en-segundo-plano.md): tareas en segundo plano (propuesta para la etapa 3).
- [ADR 0004](docs/adr/0004-row-level-security.md): Row Level Security desde la etapa 2.
- [ADR 0005](docs/adr/0005-gateway-de-ia.md): gateway de IA, costo por llamada y presupuesto mensual.
- [ADR 0006](docs/adr/0006-produccion-de-contenido.md): piezas, versiones, validadores, generación y evaluación.
- [Sistema visual](docs/design/sistema-visual.md): colores, tipografía, movimiento y componentes base.

## Créditos

Los validadores de contenido adaptan ideas y umbrales de instagram-agent-skill (MIT). Ver [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Seguridad

- `.env` nunca se versiona; `.env.example` documenta las variables sin valores reales.
- Toda mutación exige la misma origin que la app; los permisos se verifican en cada endpoint.
- El límite de intentos de login se guarda en la base.

## Problemas comunes

Primero corré `npm run doctor`: revisa `.env`, la base, las migraciones pendientes, el cliente de Prisma, los usuarios de prueba y Mailpit, y dice cómo resolver cada falla (nunca muestra secretos).

- **No puedo iniciar sesión ni registrarme**: casi siempre es la base apagada (Docker Desktop cerrado), sin migrar (`npm run db:migrate`) o sin datos de prueba (`npm run db:seed`). La terminal de `npm run dev` muestra el error real.
- **Después de actualizar el código, algo falla con `Cannot read properties of undefined (reading 'findMany')`**: faltan aplicar migraciones nuevas o regenerar el cliente de Prisma. Pará `npm run dev` y corré `npm run db:migrate` (aplica las migraciones y regenera el cliente; con Prisma 7 `prisma migrate dev` solo ya no lo regenera). `npm run doctor` lo detecta.
- **Dice que la dirección no está autorizada**: abrí la app desde la dirección de `APP_URL` (`http://localhost:3000`), no desde la dirección de red que muestra Next.
- **El puerto 5433 está ocupado**: cambiá el puerto en `docker-compose.yml` y en las URLs de `.env`.
- **`npm install` falla resolviendo dependencias**: el repo incluye `.npmrc` con `legacy-peer-deps=true`; corré el comando desde la carpeta del proyecto.
- **No llega el email**: revisá que Mailpit esté corriendo (`docker compose ps`) y que `EMAIL_TRANSPORT=smtp`.
