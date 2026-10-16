# Sistema visual de Mova

Estado: paso 1 de 3 (tokens y componentes base) más la segunda iteración del acceso. Los tokens viven en `app/globals.css`
(`@theme`) y los componentes en `components/ui`. Ninguna pantalla define colores,
radios ni sombras propios: si falta algo, se agrega acá primero.

## Principios

- Claro, sereno y preciso. La interfaz se retira y deja ver el contenido.
- Un solo acento de acción (índigo). El color de estado solo comunica estado.
- Superficies sólidas para el contenido; vidrio solo en capas flotantes
  (modales, toasts, popovers, menús), a partir del paso 2.
- Movimiento corto y con propósito, siempre respetando `prefers-reduced-motion`.

## Color

| Token | Valor | Uso |
| --- | --- | --- |
| `canvas` | `#FBFAF8` | Fondo de la aplicación |
| `surface` | `#FFFFFF` | Tarjetas y campos |
| `pearl` / `pearl-strong` | `#F2F1EE` / `#E7E6E2` | Zonas hundidas, hover, presionado |
| `line` / `line-strong` | `#E9E8E4` / `#D6D5D0` | Divisores y bordes |
| `ink` | `#1F2023` | Texto principal |
| `ink-2` | `#62656D` | Texto secundario (5,16:1 sobre perla; AA) |
| `ink-3` | `#8B8E95` | Solo placeholders y deshabilitados (no pasa AA para texto) |
| `accent` | `#3D3AD8` | Acción principal, foco, selección |
| `accent-hover` / `accent-press` / `accent-soft` | `#322FBF` / `#2A27A3` / `#EEEEFC` | Estados del acento |
| `success` / `warning` / `danger` | `#177049` / `#8A5A12` / `#C2382F` | Estados, con su variante `-soft` de fondo |
| `kodexa` | `#FE6A00` | Firma del ecosistema. Ver abajo |

### Naranja Kodexa (evaluación)

Contraste 2,89:1 sobre blanco: no alcanza AA ni para texto ni para controles. Por eso
**nunca** se usa en texto, botones, enlaces, estados ni foco. Su único uso aprobado
es el trazo de movimiento del logotipo, como firma de pertenencia a Kodexa. Si en el
futuro se necesita otro uso decorativo (por ejemplo, una ilustración), se decide caso
por caso y se documenta acá.

## Logotipo

`components/brand/wordmark.tsx` (y `public/brand/mova-wordmark.svg` para usos
fuera de la app). "mova" en Instrument Sans peso 600, convertido a trazos, con
espaciado óptico ajustado a mano: m-o más cerrado, o-v y v-a un poco más abiertos
que el espaciado por defecto. El trazo naranja es una onda suave del ancho exacto
de la "o", a una distancia fija de la línea de base y con un grosor cercano al de
los trazos finos de las letras. Alto en la app: 18 px en la barra, 20 px en el
acceso (prop `height`). Fondo mínimo para el SVG suelto: claro.

## Tipografía

Instrument Sans variable, servida desde el propio dominio con
`@fontsource-variable/instrument-sans` (sin CDN, compatible con la CSP).
Las cifras que se comparan (fechas, conteos, métricas) usan la utilidad `tabular`.

| Token | Tamaño / interlínea | Uso |
| --- | --- | --- |
| `text-caption` | 12 / 16 | Etiquetas, insignias |
| `text-small` | 13 / 18 | Texto secundario, ayudas, navegación |
| `text-body` | 15 / 22 | Texto base |
| `text-lead` | 17 / 24 | Títulos de tarjeta y sección |
| `text-title` | 22 / 28 | Títulos de página compactos |
| `text-display` | 30 / 36 | Título principal de página |

## Forma, profundidad y movimiento

- Radios: `badge` 6, `control` 10, `card` 14, `sheet` 20.
- Sombras: `hairline`, `raised` (tarjetas y campos), `floating` (popovers), `overlay` (modales).
- Duraciones: `--dur-fast` 120 ms, `--dur-base` 200 ms, `--dur-slow` 320 ms.
  Curvas: `--ease-standard`, `--ease-exit`, `--ease-spring`.
- Con `prefers-reduced-motion: reduce` las duraciones pasan a 0, salvo elementos
  marcados con `.motion-essential` (por ejemplo, el spinner).
- `glass`: fondo translúcido con desenfoque de 20 px, con alternativa sólida si el
  navegador no soporta `backdrop-filter` o el usuario pide menos transparencia.

## Componentes (`components/ui`)

- `Button`: variantes `primary`, `secondary`, `quiet`, `danger`; tamaños `md` y `sm`;
  `loading` muestra spinner, bloquea el botón y marca `aria-busy`.
- `Field` + `Input` / `Select` (`controlSize` `md` o `sm`): etiqueta asociada por `id`; ayuda o error conectados
  con `describedBy()`; `aria-invalid` pinta el borde de error.
- `Notice`: avisos `info`, `success`, `warning`, `error` con icono. Los errores usan
  `role="alert"`; el resto `role="status"`.
- `Badge`: tonos `neutral`, `accent`, `success`, `warning`, `danger`.
- `Card`, `CardHeader`, `PageHeader`, `EmptyState`.
- `Spinner`.
- `Button` tamaño `lg` (46 px) e `Input` variante `filled` (perla que se aclara al
  enfocarlo): para pantallas abiertas como el acceso.
- `PasswordInput`: contraseña con botón para mostrarla u ocultarla (`aria-pressed`).

## Acceso (iteración 2)

- Columna editorial angosta a la izquierda y un **escenario de luz** a la derecha
  (`components/auth/auth-stage.tsx`): cintas de índigo, pervinca y perla con una
  veta cálida y grano fino contra el bandeado. En móvil se vuelve una franja arriba.
- El escenario muestra una escena real del producto: el plan de la semana y una
  pieza que pasa de "Pendiente de aprobación" a "Aprobado". Es el único momento
  animado sin acción de la persona y ocurre una sola vez al cargar.
- Vidrio solo en esos elementos flotantes: `glass-light` (tarjeta nítida) y
  `glass-veil` (tablero de fondo). Se declaran solo con `backdrop-filter`: el
  compilador agrega el prefijo `-webkit-`; si se escriben los dos, descarta el
  estándar y Chrome deja de desenfocar.
- Control segmentado entre login y registro con indicador que se desliza
  (`components/auth/auth-tabs.tsx`). Entrada escalonada con `animate-enter` y
  `--i`. Temblor breve del formulario ante un error (`useShake`).
- Todo el movimiento se anula con `prefers-reduced-motion`; la escena queda en su
  estado final.

## Capas flotantes (Base UI 1.8)

Vidrio (`glass`) solo en lo que flota sobre el contenido: diálogos, menús,
notificaciones y la barra superior fija. Entran y salen con `pop` (escala y
opacidad desde su origen) o `fade`.

- `useConfirm()`: diálogo de confirmación para acciones que no se deshacen.
  Reemplaza a `window.confirm`; el foco arranca en "Cancelar".
- `useToast()`: notificaciones `success`, `error`, `info`, apiladas abajo a la
  derecha, se cierran solas a los 4,5 s o deslizando. Se usan para confirmar lo
  que pasó (guardado, enviado, quitado). Los errores que hay que corregir van
  junto al formulario, no en una notificación.
- `MenuRoot`, `MenuTrigger`, `MenuPopup`, `MenuItem`, `MenuLinkItem`,
  `MenuSeparator`, `MenuLabel`: menús desplegables (selector de workspace y menú
  de cuenta).
- `Skeleton` y `loading.tsx`: forma de la página mientras carga. `error.tsx`:
  falla inesperada con "Reintentar".

## Próximos pasos

- Pasos 2 y 3 hechos (capas flotantes, barra, navegación, carga y error).
- Cada módulo nuevo (perfil de marca, calendario) usa estos componentes; si
  falta uno, se agrega acá antes de usarlo.
