# ADR 0005: gateway de IA, costos y presupuesto

Estado: aceptada (etapa 2). Fecha: 14/10/2026.

## Contexto

La etapa 2 se cierra cuando cada llamada a la IA queda registrada con tokens y
costo, y un workspace sin créditos queda bloqueado antes de llamar al modelo.
Todavía no hay planes pagos (etapa 7c) ni facturación.

## Decisión

- **Una sola puerta**: `modules/ai/gateway.ts` (`runAi`). Ningún módulo llama a un
  proveedor directamente.
- **Proveedor intercambiable**: interfaz `AiProvider` (`modules/ai/providers`). El
  único adaptador real es Anthropic, con `fetch` y sin SDK. Se activa solo si
  `ANTHROPIC_API_KEY` está definida en el servidor; sin clave, el asistente se
  muestra apagado y el resto de Mova funciona igual.
- **Modelos**: `AI_MODEL_FAST` (por defecto `claude-haiku-5-5`) para proponer y
  redactar; `AI_MODEL_SMART` (`claude-sonnet-5-5`) reservado para planificar.
- **Costo**: tabla `PRICES` en `modules/ai/pricing.ts`, tomada de la página oficial
  de precios de Anthropic el 14/10/2026. Se guarda en micro-dólares enteros
  (1 USD = 1.000.000) para no acumular errores de redondeo. Un modelo sin precio
  en la tabla no se puede usar: no se inventan costos.
- **Presupuesto**: `Workspace.aiMonthlyBudgetMicros`, por defecto USD 2 por mes.
  Reemplaza a los "créditos por plan" hasta que existan los planes. El mes es el
  mes calendario en UTC.
- **Control antes de llamar**: bajo `pg_advisory_xact_lock` por workspace se suma
  el gasto del mes (costo real de lo terminado + reserva de lo pendiente) y el
  costo máximo posible de esta llamada (entrada estimada a 3 caracteres por token
  y el máximo de salida). Si no alcanza, se registra `BLOCKED` y no se llama al
  modelo. Si alcanza, se reserva ese máximo (`PENDING`) y al terminar se guarda el
  costo real (`SUCCEEDED`) o se libera (`FAILED`).
- **Registro**: `LlmCall` con operación, modelo, tokens, costo, duración y un código
  de error estable (nunca el mensaje crudo del proveedor).
- **Sin simulaciones en la app**: el proveedor programado existe solo en tests
  (`setProviderForTests` falla fuera de `NODE_ENV=test`).

## Asistente de marca

- Propone servicios, públicos, objetivos, voz, pilares y reglas. La respuesta se
  valida con el mismo esquema que el formulario; si no cumple, no llega a la
  persona (se registra `invalid_output` y el costo igual).
- La propuesta nunca se guarda sola: completa el formulario y la persona decide.
- Identidad e identidad visual son decisiones de la marca. Los datos publicables
  tienen que ser reales: la IA nunca los propone.
- Solo el Dueño (permiso `brand.update`); el uso del mes lo ve el Dueño (`usage.read`).

## Pendiente

- Probar el adaptador con una clave real y comparar tokens y costo con la consola
  de Anthropic.
- Créditos por plan cuando existan los planes (etapa 7c).

## Ajuste del 15/10/2026 (primera prueba con el modelo real)

- Los modelos 5.5 rechazan `temperature` (400 "temperature is deprecated for this
  model"): el gateway ya no la envía.
- Por defecto el modelo razona antes de responder y esos tokens cuentan dentro de
  `max_tokens`. En las piezas cortas en JSON eso triplicaba el costo y cortaba
  algunos Reels a la mitad. El adaptador envía `thinking: { type: "disabled" }`.
  Resultado con `claude-haiku-5-5` (4 piezas de prueba, un formato cada una):
  todas válidas, entre USD 0,0003 y 0,0005 por pieza y de 2,5 a 5 segundos.
- Los errores del proveedor tienen códigos y mensajes específicos (clave inválida,
  sin crédito, pedido rechazado, demasiados pedidos) y el detalle del proveedor
  se escribe en el log del servidor (`[ia] …`), nunca en la base ni en el navegador.
  Una respuesta cortada por `max_tokens` también queda en el log.
