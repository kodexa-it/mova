# ADR 0006: producción de contenido (etapa 3)

Estado: aceptada en parte (falta la evaluación con el modelo real). Fecha: 15/10/2026.

## Decisiones

- **Pieza y versiones**: `ContentItem` guarda formato, tema, pilar y objetivo (como
  texto, porque la marca reemplaza sus listas al editarse) y su estado.
  `ContentVersion` es inmutable: contenido JSON validado por formato, hash SHA-256
  del contenido canónico, autor (equipo o IA, con la llamada que lo produjo) y el
  reporte de los validadores.
- **Estados**: transiciones en `modules/content/status.ts`. Editar algo pendiente,
  aprobado o programado lo devuelve a borrador: la aprobación (etapa 4) valdrá
  para una versión exacta.
- **Validadores determinísticos en español** (`modules/content/validators`):
  caption, hook, ritmo de Reel, frases hechas, palabras que la marca evita y datos
  sin completar `{{dato}}` (bloquean la aprobación). Adaptan ideas y umbrales de
  instagram-agent-skill (MIT, ver THIRD_PARTY_NOTICES.md). El puntaje de hooks es
  un filtro de errores, no un predictor.
- **Generación**: el mismo gateway de la etapa 2. Prompts versionados
  (`PROMPT_VERSION`), con el contexto completo de la marca, los datos reales con
  su fuente y la regla de usar `{{marcador}}` cuando falta un dato. Modelo rápido
  (`AI_MODEL_FAST`). La salida se valida contra el esquema del formato; si no
  cumple, no se guarda. Tope de 5 propuestas por pieza. El costo de cada versión
  escrita por la IA se muestra en el historial.
- **Sincrónico por ahora**: una pieza tarda segundos con el modelo rápido, dentro
  del límite de 60 s de las funciones de Netlify. La cola en PostgreSQL (ADR 0003)
  se construye cuando haya trabajos largos (plan semanal, métricas).
- **Set de evaluación**: `eval/cases.json` (30 casos: Kodexa y dos marcas de prueba
  ficticias) y `npm run eval:content`, que genera, valida, mide el costo y deja una
  tabla para que una persona de Kodexa marque cuáles aprobaría sin editar.

## Pendiente para cerrar la etapa 3

- Correr la evaluación con una clave real y la marca de Kodexa cargada; criterio:
  cada formato pasa los validadores y al menos 7 de cada 10 piezas se aprueban sin
  editar, con el costo por pieza medido.
- Plantillas visuales de marca para renderizar las imágenes.
- Calibrar la velocidad de habla (150 palabras por minuto) con un Reel real.
