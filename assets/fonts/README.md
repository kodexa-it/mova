# Tipografías del renderizador

Todas con licencia SIL Open Font License 1.1 (se pueden incluir en el producto).

| Archivo | Familia | Origen | Licencia |
|---|---|---|---|
| InstrumentSans-Regular.ttf, InstrumentSans-SemiBold.ttf | Instrument Sans | github.com/Instrument/instrument-sans | OFL.txt |
| InstrumentSerif-Regular.woff | Instrument Serif (subconjunto latino, incluye acentos y ñ) | paquete npm @fontsource/instrument-serif 5.3.0 | OFL-InstrumentSerif.txt |

Cambiar un archivo cambia cómo se ven las imágenes: subir `RENDER_VERSION`
(o la versión de las composiciones que lo usan) en
`modules/content/render/fingerprint.ts`.
