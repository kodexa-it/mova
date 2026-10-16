# ADR 0008: catálogo de composiciones (mejora visual V1a)

Estado: aceptada. Fecha: 15/10/2026.

## Contexto

Las imágenes salían de una plantilla fija por tipo de imagen: casi solo
tipografía. «Mejorar» reescribía textos pero no podía cambiar la composición,
porque el contenido no tenía ningún campo de diseño.

## Decisiones

- **El diseño es parte del contenido versionado.** Cada slide, frame, imagen de
  publicación o portada de Reel admite un campo opcional `design`
  (`{ layout, icons?, device?, proof? }`, `modules/content/layouts.ts`). No hubo
  migración: la versión ya era JSON. El hash del contenido cubre el diseño, así
  que cambiar una composición crea una versión nueva y deja sin efecto la
  aprobación con el motivo "se editó el contenido".
- **"Clásico" se guarda como ausencia de diseño** (`normalizeDesigns` antes de
  calcular el hash). Las versiones anteriores conservan su hash y sus
  aprobaciones; guardar con "Clásico" explícito no crea versión.
- **Catálogo cerrado**: portada editorial, portada con dispositivo, pasos
  numerados, lista con íconos, comparación, frase destacada, dato grande,
  navegador, teléfono y cierre con llamado. Cada uno define en qué lugar se usa
  (portada, intermedio, cierre, imagen única, story, portada de Reel), sus
  límites de texto y sus reglas. Una composición que no entra con su texto es un
  chequeo fallido: bloquea el envío a revisión y la aprobación.
- **Ninguna composición agrega texto.** Pasos, listas y comparaciones toman las
  líneas del texto del slide; la frase destacada se atribuye a la marca (no es un
  testimonio); navegador y teléfono son ilustraciones abstractas en la paleta, sin
  proyectos ni marcas de terceros; el cierre muestra el sitio cargado en la
  marca. El **dato grande** es una copia de un dato publicable (texto y fuente)
  y solo vale si su cifra ya está en el texto de la imagen; si ese dato cambia o
  se quita, la pieza aprobada vuelve a revisión (motivo `proof_changed`). Los
  datos se comparan por texto, porque guardar la sección recrea los ids.
- **Render determinista** con `next/og`, igual que antes
  (`modules/content/render/layout-templates.tsx`). Íconos propios (trazos
  geométricos dibujados para Mova, `modules/content/icons.ts`): sin licencias de
  terceros. Stories y Reels respetan zonas seguras (250 px arriba, 360 abajo).
- **Huella de aprobación por pieza** (`pieceVisualSnapshot`): lo común (versión
  de plantillas clásicas, nombre y paleta) más la versión de cada composición
  usada (`LAYOUT_VERSIONS`) y el dominio del sitio solo si alguna lo dibuja. Sin
  composiciones es idéntica a la anterior: ninguna aprobación existente cambió.
  Subir la versión de una composición solo reabre las piezas aprobadas que la
  usan, con el motivo "plantillas"; cambiar el sitio solo reabre las que lo
  dibujan.
- **Las imágenes clásicas no cambiaron**: `render.golden.test.ts` compara sus
  bytes con huellas tomadas antes del cambio. Si falla, o se revierte o se sube
  `RENDER_VERSION` a propósito.
- **«Mejorar composición»** (`POST /content/{id}/compose`):
  - `mode: "ai"`: el modelo rápido recibe, por imagen, solo las composiciones que
    entran con su texto y los datos publicables cuya cifra está en ese texto
    (por id). Responde JSON; el servidor valida con el esquema y con las mismas
    reglas del editor. Lo que no cumple se reemplaza por la sugerencia
    automática de esa imagen; una respuesta fuera del esquema no guarda nada.
  - `mode: "auto"`: reglas fijas, sin IA ni costo. La interfaz la ofrece si la
    IA no está configurada, no hay presupuesto o falla.
  - En ambos casos se verifica que, sin los diseños, la pieza nueva sea idéntica
    a la anterior antes de guardar. Autoría "Mova"; las llamadas a la IA quedan
    en Uso de IA (operación `content.compose.*`).
- **Editor**: selector visual por imagen (miniaturas esquemáticas, no el render),
  con íconos por línea, dispositivo y dato publicable según la composición.

## V1b y V1c

Implementados en el ADR 0009 (estilo de pieza, patrones, laptop, legibilidad y
modo premium con imágenes generadas).

## Ajustes del 15/10/2026 (editor de la pieza)

- **La generación de texto conserva la composición** (`carryDesigns`): cada
  imagen mantiene su composición si sigue entrando con el texto nuevo; si no,
  toma la sugerencia automática. Una pieza sin composiciones recibe la
  sugerencia completa. Sin costo extra de IA.
- **La IA nunca ve ni devuelve diseños**: el texto se le manda sin `design` y lo
  que devuelva en ese campo se descarta antes de guardar (un "dato grande" no
  puede salir de la IA).
- **Corregir sugerencias** (`POST /content/{id}/fix`, `modules/content/fixes.ts`):
  cada chequeo tiene un alcance (caption, hashtags, portada, texto alternativo,
  guion o todos los textos). La IA reescribe, pero solo se toman de su respuesta
  esos campos. Los datos por completar no se corrigen con IA. No consume una de
  las 5 propuestas; sí presupuesto. Los problemas de composición se resuelven
  sin IA, con la sugerencia automática de esa imagen.
- **Vista previa en vivo** (`POST /content/{id}/preview`, solo quien edita):
  renderiza lo que se está editando sin guardarlo, después de una pausa al
  escribir y empezando por la imagen visible. No crea versiones ni se cachea.
- **Pantalla de la pieza en dos columnas** (desde 1280 px): a la izquierda Mova
  (texto y composición), las slides con su miniatura y la composición plegada, y
  el caption; a la derecha, fija, la vista como en Instagram, la revisión, los
  comentarios y las versiones en pestañas. Las imágenes para descargar quedan
  plegadas debajo. El contenedor de la app pasó de 72 a 80 rem de ancho.
