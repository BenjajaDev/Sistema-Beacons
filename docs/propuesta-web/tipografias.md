# Tipografías de la propuesta: qué está hecho y qué falta

La propuesta define tres familias, cada una con su papel:

| Familia               | Papel en el documento                           | Estado en el sitio                                                  |
| --------------------- | ----------------------------------------------- | ------------------------------------------------------------------- |
| Glacial Indifference  | Títulos H1 y H2 (Bold o Semi-Bold, +0,5 px)     | **Pendiente:** falta el archivo con licencia.                       |
| Garet                 | Subtítulos H3 y H4, botones y navegación        | **Pendiente:** falta el archivo con licencia.                       |
| Red Hat Display       | Texto de párrafo (16 a 17 px, interlineado 1,6) | **Hecha.** Autoalojada (licencia OFL). Hoy es también la de títulos. |

El cuerpo (17 px) y el interlineado (1,6) ya son los que pide el documento; los títulos usan escalas fluidas (H1 de 34 a 52 px, H2 de 28 a 36 px) que contienen los rangos del documento (36 a 44 px y 28 a 32 px).

## Por qué faltan dos

Glacial Indifference y Garet no existen como paquete de npm (no están en Fontsource) y el sitio solo carga fuentes **autoalojadas**: sin Google Fonts ni CDN, para que funcione sin conexión y no filtre visitas. Descargarlas de un sitio de fuentes sin revisar su licencia no es una opción. Las debe aportar el equipo, con su licencia a la vista.

## Qué hacer cuando estén los archivos

1. Confirmar que la licencia permite el uso web (autoalojar y servir desde el sitio) y guardarla junto a los archivos.
2. Convertirlas a `woff2` (solo los pesos del documento: Glacial Bold y Semi-Bold; Garet Medium y Heavy) y copiarlas a `apps/web/public/fonts/`.
3. Declarar sus `@font-face` en `apps/web/src/shared/styles/index.css`, con `font-display: swap`.
4. Agregarlas a `FONT_OPTIONS` en `server/src/content/theme.ts` y a la lista de `apps/web/src/admin/views/Identidad.tsx` (el selector sale de ahí). Usar Red Hat Display como alternativa en el `stack`.
5. Para el papel de Garet (H3, H4 y botones) hace falta una tercera ranura de tipografía, además de «Texto» y «Títulos»: `--font-subheading` en `fontsToCss`, la clave `subtitulos` en `fontsSchema` (opcional, para no invalidar lo ya guardado) y un tercer selector en Identidad visual.
6. Si Glacial Indifference queda como fuente de títulos, aplicar su `letter-spacing: 0.5px` solo a H1 y H2.
7. Verificar: `npm run build -w apps/web`, `npm run e2e` (el ancho distinto de la fuente puede desbordar a 320 px) y `npm run lighthouse` (rendimiento ≥ 90).
