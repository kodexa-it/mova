# ADR 0007: plan semanal, calendario y aprobación (etapa 4)

Estado: en curso (módulos 4.1 y 4.2 implementados). Fecha: 15/10/2026.

## 4.1 Plan semanal y calendario

- **Fecha de una pieza**: `ContentItem.scheduledFor` (ya existía) guarda el
  instante en UTC. El calendario trabaja con días y horas en la zona horaria del
  público de la marca (`Brand.audienceTimezone`, la misma que ya se usaba para
  proponer horarios); sin marca, Buenos Aires. Conversión con `Intl`, sin
  dependencias (`lib/time.ts`), con cambios de horario cubiertos por tests.
- **Plan semanal**: `ContentPlan`, uno por workspace y semana (lunes a domingo,
  único en la base). Guarda el foco de la semana y su origen (`MANUAL` o `AI`).
  Una pieza con fecha pertenece al plan de la semana de esa fecha (`planId`); al
  moverla cambia de plan y al quitarle la fecha queda sin plan. El plan se crea
  solo, sin duplicados aunque lleguen pedidos simultáneos
  (`createMany` con `skipDuplicates`).
- **Sin generación automática del plan** todavía: se arma a mano hasta validar la
  generación de piezas con el modelo real (criterio de la etapa 3). `source = AI`
  queda reservado para el planificador.
- **Permisos**: poner o cambiar fechas y editar el foco exige `plan.write`
  (Dueño y Editor); ver el calendario, `workspace.read`. Las piezas publicadas,
  en publicación o archivadas no cambian de fecha (`schedule_locked`). El estado
  `SCHEDULED` queda para la publicación automática (etapa 6): en el flujo manual
  una pieza aprobada con fecha sigue en `APPROVED`.
- **Vistas**: semana (columnas por día, foco editable, resumen de estados y
  bandeja de piezas sin fecha) y mes (6 semanas como máximo). Filtros por formato,
  estado y pilar en la URL. La API (`GET /api/w/{slug}/calendar?from&to`) acepta
  hasta 42 días.
- **Auditoría**: `content.scheduled` y `plan.updated`.

Cambiar la fecha no invalida una aprobación: la aprobación se ata al contenido y
sus imágenes (4.2). Si más adelante se aprueba también el horario, se agrega a la
huella de la aprobación.

## 4.2 Revisión y aprobación por versión

- **Flujo**: borrador → en revisión (`content.write`) → aprobada (`content.approve`)
  o de vuelta a borrador con un pedido de cambios (`content.requestChanges`, motivo
  obligatorio). Comentarios con `content.comment`; el Lector solo lee.
- **Qué se aprueba**: `ApprovalDecision` guarda la versión, el hash del contenido,
  la huella visual (paleta, nombre de la marca y `RENDER_VERSION` de las
  plantillas) y el SHA-256 de cada imagen renderizada al aprobar. Un test
  comprueba que volver a renderizar da exactamente esos bytes: la exportación
  podrá verificar que entrega lo aprobado.
- **Regla única** (`modules/review/approval.ts`): una aprobación vale solo si
  apunta a la versión vigente con el mismo contenido, la misma apariencia y las
  mismas plantillas, y no fue invalidada. La usan la revisión, la exportación y el
  registro de publicación.
- **Invalidación**, en la misma transacción que el cambio: editar (nueva
  versión), archivar, o cambiar la paleta o el nombre de la marca. En este último
  caso las piezas aprobadas vuelven a "Pendiente de aprobación" (el texto no
  cambió, las imágenes sí) y queda `approval.invalidated` en la auditoría.
  Renombrar un color no cuenta: no cambia las imágenes.
- **Bloqueos**: no se envía a revisión ni se aprueba con chequeos fallidos
  (datos `{{por completar}}`, palabras que la marca evita, caption vacío…) ni con
  imágenes sin texto. El servidor recalcula con las reglas vigentes de la marca.
- **Concurrencia**: la aprobación indica la versión que la persona vio; si la
  pieza cambió mientras tanto, responde `version_changed`. Las imágenes se
  renderizan fuera de la transacción y adentro se vuelve a comprobar todo con la
  fila bloqueada.
- Se permite aprobar contenido propio (ADR 0002).
