# ADR 0009: estilo, legibilidad y modo visual premium (V1b, V1c e imágenes con IA)

Estado: aceptada. Fecha: 15/10/2026.

## Contexto

V1a dejó un catálogo de composiciones. Faltaban recursos de marca (patrones,
presets, tipografía), una validación de legibilidad que bloquee lo que no se lee
en el teléfono, y un modo opcional con imágenes generadas por IA, con control de
costos y aprobación atada a los archivos exactos.

## V1b: estilo de la pieza

- Campo opcional `style: { preset, motif }` en el contenido versionado. El
  estilo por defecto ("de la marca", sin patrón) se guarda como ausencia: las
  versiones anteriores conservan su hash.
- Presets: de la marca, claro, oscuro (tono más oscuro de la paleta, contraste
  calculado) y editorial (títulos en Instrument Serif, OFL, ver
  `assets/fonts/README.md`). Se sugiere uno a partir de la tipografía de títulos
  y del `imageStyle` de la marca (`suggestStyle`).
- Patrones de marca: puntos, grilla, arcos, ondas y bloques. Se dibujan solo en
  los márgenes (fuera de la columna de texto, de 96 a 984 px) o como textura muy
  tenue: nunca compiten con el texto.
- Laptop como tercer dispositivo de la portada con dispositivo.
- El estilo se aplica solo a las composiciones del catálogo. La clásica no
  cambia (las huellas de `render.golden.test.ts` siguen iguales).
- Stories: las composiciones ya no dibujan barras de progreso (las pone
  Instagram). Por eso `quote` y `stat` pasan a la versión 2: las piezas aprobadas
  que las usan vuelven a revisión con el motivo "plantillas". La Story clásica
  conserva sus barras para no invalidar todas las aprobaciones; queda un aviso de
  zona segura en la revisión automática.
- La huella de aprobación incluye el estilo (con `STYLE_VERSION`) solo si la
  pieza usa composiciones.

## V1c: legibilidad en el teléfono

`modules/content/legibility.ts` estima, sin renderizar, el alto del texto de cada
imagen con los mismos tamaños de las plantillas (`render/sizes.ts`) y lo compara
con el espacio que deja la composición (con zonas seguras de 250 y 360 px en
formatos verticales). Bloquean el envío y la aprobación:

- texto que no entra (`legibility.fit.N`); aviso desde el 92 % del espacio;
- texto que se vería por debajo de 11 pt (14 pt los títulos) en un teléfono de
  390 pt (`legibility.size.N`);
- más de 45 palabras en una imagen vertical u horizontal 4:5, más de 40 en 9:16
  (`legibility.density.N`); aviso desde 35 y 28.

Los límites por campo ya evitan casi todos los desbordes; la estimación es una
red de seguridad conservadora. «Corregir con Mova» puede acortar esos textos.

## Modo premium: imágenes generadas con IA

### Proveedor

Google Gemini API, modelo `gemini-3.1-flash-image` (Nano Banana 2, estable).
Precio publicado (ai.google.dev/gemini-api/docs/pricing, consultado el
15/10/2026): USD 60 por millón de tokens de imagen, equivalente a USD 0,067 por
imagen 1K y USD 0,101 por imagen 2K; entrada USD 0,50 por millón. Se eligió
porque publica un precio por imagen (estimación previa confiable), devuelve el
consumo en cada respuesta (costo real), admite 4:5 y 9:16, y es estable.
Alternativas evaluadas: OpenAI gpt-image-2 y 2.5 (sin precio publicado por
imagen para tamaños a medida) y FLUX.2 de Black Forest Labs (precio por megapíxel
que no se pudo verificar en la página oficial).

### Garantías

- **Modo por pieza** (`ContentItem.visualMode`, estándar por defecto). El
  interruptor «Generación visual con IA» está en la creación y en el editor;
  activarlo no genera nada.
- **Nada pago sin confirmación**: `POST /content/{id}/art/quote` devuelve el
  costo estimado, el límite disponible y las imágenes reutilizables, sin llamar
  al proveedor. `POST /content/{id}/art` exige el costo confirmado (si cambió,
  409 `estimate_changed`) y una clave única por confirmación: un doble clic o un
  reintento devuelven la misma imagen sin volver a cobrar.
- **Límite mensual de imágenes** por workspace (`imageMonthlyBudgetMicros`,
  USD 1 por defecto, separado del de texto). Lo edita el Dueño en Uso de IA, con
  auditoría. Se reserva la estimación más un 25 % bajo un lock; si no alcanza, se
  registra `BLOCKED` y no se llama.
- **Registro**: `ImageGeneration` guarda proveedor, modelo, medida, pedido,
  estimación, reserva, tokens, costo real (`costSource: usage`) o la estimación si
  el proveedor no informó consumo, duración y error. Los fallos no cobran.
- **Seguridad**: la clave solo en `GEMINI_API_KEY` del servidor; el modelo en
  `IMAGE_MODEL`, que tiene que estar en la tabla de precios. El navegador nunca
  elige proveedor ni modelo, solo una dirección de arte opcional de 300
  caracteres.
- **Pedido**: lo arma el servidor (`modules/images/prompt.ts`) con el texto de
  la imagen, la paleta, el rubro, el público y el `imageStyle`. Prohíbe texto,
  logos, marcas, personas reconocibles, capturas, trabajos de clientes y
  resultados o testimonios inventados; pide imágenes conceptuales.
- **Composiciones**: `art-cover` (imagen a sangre con velo oscuro y el texto de
  Mova encima; 2K) y `art-panel` (texto arriba e imagen en un panel; 1K). El
  título, el texto, la marca y el llamado los dibuja siempre Mova. Ni la IA de
  texto ni la sugerencia automática las eligen, y «Mejorar composición» no las
  toca.
- **Archivos** (`ImageAsset`): bytes en PostgreSQL por ahora, inmutables, con
  sha256. Se leen solo dentro del workspace. Una versión solo puede referenciar
  imágenes de la misma pieza con la huella exacta (400 `art_not_found`).
- **Vista previa antes de guardar**: generar no crea versión. La imagen aparece
  en la vista previa en vivo; se guarda con «Guardar versión».
- **Aprobación**: la huella incluye cada imagen (posición, id, sha256) y la
  versión de su composición. Cambiar una imagen crea una versión nueva y deja la
  aprobación sin efecto con el motivo explícito `art_changed`; cambiar solo la
  composición o el estilo, `design_changed`.
- **Volver al estándar**: si el proveedor no está configurado, falla o no hay
  límite, la interfaz lo dice y ofrece volver al modo estándar, que reemplaza en
  el editor las composiciones con imagen por la sugerencia automática.

## Pendiente

- Probar una generación real (requiere `GEMINI_API_KEY` con facturación activa).
- Mover los archivos a un almacenamiento de objetos al desplegar (Netlify Blobs).
- Barras de la Story clásica: decidir si se quitan subiendo `RENDER_VERSION`.
