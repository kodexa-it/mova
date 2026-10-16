# ADR 0011: estilo Impacto, brief de diseño y diseños propios

Estado: aceptada. Fecha: 16/10/2026.

## Estilo «Impacto» (preset de pieza)

- Basado en los carruseles de referencia de Kodexa: títulos en Anton (OFL,
  `assets/fonts/Anton-Regular.woff`) en mayúsculas, palabras destacadas en el
  color de la marca, etiquetas cortas («[ PREGUNTA INCÓMODA ]», «// EN
  INSTAGRAM»), contador «[ 01 / 08 ]», anillos finos y fondos alternados
  (oscuro, claro y color de marca). Plantillas en
  `modules/content/render/impact-templates.tsx`.
- Se aplica a todas las imágenes de la pieza, también a las clásicas. Por eso
  su huella de aprobación incluye el estilo aunque la pieza no use
  composiciones (`IMPACT_VERSION`). Sin el estilo, nada cambió: las huellas de
  `render.golden.test.ts` siguen iguales.
- Contenido: cada slide admite `kicker` (etiqueta, opcional) y el texto puede
  marcar palabras entre *asteriscos*. Fuera de Impacto las marcas no se ven
  (`stripMarks`). La IA de texto escribe etiquetas y marcas
  (`PROMPT_VERSION piezas-2026-10-16`).
- El primer borrador generado toma el estilo que sugiere la marca: Impacto si
  su tipografía de títulos o su estilo visual lo indican (Anton, Bebas, Oswald,
  «audaz», «condensada»…).
- El buscador del estilo es esquemático: sin marcas de terceros ni búsquedas
  inventadas, solo el sitio y el nombre de la marca.

## Brief de diseño

`modules/content/brief.ts`, sin IA ni costo. Arma, para cada pieza, el prompt
para la IA que prefiera la persona y la versión para un diseñador: medidas,
identidad visual, reglas (texto literal, no inventar datos, legibilidad, zonas
seguras), el texto de cada imagen con lo que hay que destacar y la composición
sugerida. Pide usar solo las referencias visuales de la marca
(`BrandReference`, Marca → Identidad visual, hasta 12, solo el Dueño las
carga).

## Diseños propios

- Composición «Diseño propio» (`upload`): la imagen final la hace un diseñador
  u otra herramienta y se sube por posición. Se valida el tipo real del archivo
  (PNG, JPEG o WebP), la proporción del formato (4:5 o 9:16), 1000 px de ancho
  como mínimo y 8 MB como máximo.
- Se guarda como `ImageAsset` con `source = UPLOAD`. Se renderiza tal cual,
  sin nada encima, en la vista previa, la descarga y la aprobación.
- La aprobación queda atada al sha256 del archivo. Reemplazarlo crea una
  versión nueva y la deja sin efecto con el motivo `art_changed`. Un archivo de
  otra pieza o de otro workspace no se puede usar.
- Su texto no se mide con el validador de legibilidad: lo dibujó otra persona
  y lo revisa quien aprueba.
