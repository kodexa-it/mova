# ADR 0010: estrategia semanal con IA, cola en segundo plano, avisos y métricas

Estado: aceptada. Fecha: 16/10/2026.

## Estrategia semanal

- A partir del foco guardado de la semana, `POST /plans/{semana}/strategy`
  pide al modelo "smart" una propuesta: por cada pieza, día, hora, formato,
  pilar, objetivo, tema, ángulo y por qué (`modules/plans/strategy-model.ts`).
  El prompt incluye la marca, los pesos de los pilares, lo que ya tiene fecha
  esa semana, los temas de las últimas 6 semanas y los aprendizajes medidos.
- El servidor valida la respuesta: fechas dentro de la semana y desde hoy,
  formatos del catálogo, pilares y objetivos de la marca (si no coinciden
  quedan vacíos), hasta la cantidad pedida (1 a 7). Lo que no cumple se
  descarta y se informa.
- La persona edita la propuesta (día, hora, formato, tema, ángulo, pilar,
  objetivo, quitar filas) y la aprueba. Proponer y aprobar requieren
  `plan.write` (Dueño y Editor).
- Aprobar crea una pieza por fila (borrador, con su fecha, en el plan de la
  semana) y encola su generación, en una sola transacción con el plan
  bloqueado: aprobar dos veces no duplica nada.

## Cola en segundo plano (`Job`)

- Tabla en PostgreSQL, sin servicios extra. Una tarea se toma con
  `FOR UPDATE SKIP LOCKED`. Si el proceso muere, el lock vence a los 10 minutos
  y otra ejecución la retoma. Hasta 2 intentos, con espera entre ellos; los
  errores permanentes (sin permiso, sin presupuesto, quien aprobó ya no es
  integrante) no se reintentan.
- La tarea corre con el rol actual de quien aprobó la estrategia (se vuelve a
  leer al ejecutar) y usa su presupuesto de IA. Si la pieza ya tiene texto de
  la IA (un reintento después de un corte), no se vuelve a pagar.
- La pieza pasa a revisión solo si no tiene nada bloqueante (datos por
  completar, composiciones que no entran, textos ilegibles). Si no, queda en
  borrador.
- Quién la ejecuta: en local, el mismo servidor después de responder (`after`
  de Next) y `npm run worker`. Desplegado, un programador llama a
  `POST /api/jobs/run` con `Authorization: Bearer CRON_SECRET` (sin secreto, el
  endpoint queda cerrado).

## Avisos (`Notification`)

- Cuando termina la última tarea de la semana, un único aviso (lo garantiza
  `strategyNotifiedAt`) a quienes pueden aprobar (Aprobadores y Dueños) y a
  quien aprobó la estrategia: cuántas piezas están para revisar y cuántas
  necesitan correcciones. En la app (campana en el encabezado) y por email,
  con la infraestructura existente. El email nunca rompe la operación.
- Cada persona ve y marca como leídos solo sus avisos.

## Publicación y métricas

- `Publication`: registro manual (fecha y enlace). Solo con la aprobación
  vigente de la versión actual; queda atada a esa versión y aprobación, y la
  pieza pasa a Publicado (ya no se edita). Descargar no es publicar. El mismo
  enlace no se registra dos veces.
- `MetricSnapshot`: cada medición con su fuente. MANUAL (alcance, guardados,
  compartidos, visitas, consultas comerciales, desde las estadísticas de
  Instagram) o APIFY_PUBLIC (me gusta, comentarios, reproducciones). Apify se
  usa solo a pedido y con confirmación, con tope de USD 0,01 por ejecución.
  Se registra la estimación medida en la prueba (USD 0,0027), porque Apify
  informa el costo final más tarde.
- Aprendizajes (`modules/metrics/model.ts`): comparaciones deterministas de
  promedios a 7 días por formato y pilar, y consultas comerciales, siempre con
  la cantidad de casos. Sin 6 publicaciones medidas a 7 días no hay
  conclusiones. Son los que recibe la IA al proponer la semana siguiente.
