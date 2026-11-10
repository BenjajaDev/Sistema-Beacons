# Bitácora: propuesta web de SIGNAL

Registro cronológico de lo que se hizo para llevar el sitio hacia la [propuesta](plan.md): qué se decidió, qué se construyó, cómo se comprobó y qué problemas aparecieron. Cada entrada se escribe cuando se termina el paso, no al final.

## Paso 0: lectura del documento y análisis

**Qué se hizo.** Se leyó la propuesta completa y se contrastó con el código actual: catálogo de secciones, modelos de datos, rutas públicas y controles de accesibilidad.

**Qué se encontró.**

- La paleta del documento ya es la del sitio; el único valor distinto es el Azul Claro (`#79ACF0` frente a `#9DC2F7` de la app).
- Las cifras de contraste del documento son correctas (cobalto sobre crema 7,51:1; violeta sobre crema 14,3:1).
- No existen: «En cifras», línea de tiempo, comité y estudiantes, repositorio de recursos, categorías de prensa, compartir, kit de prensa, galería, boletín, contacto segmentado, WhatsApp, alto contraste, fuente para dislexia ni guía de lectura.
- Glacial Indifference y Garet no están disponibles como paquete autoalojable; Red Hat Display y OpenDyslexic sí, con licencia libre.

**Decisiones.** Ver el [plan](plan.md#3-decisiones-de-diseño). Las cuatro abiertas (tipografías, azul claro, recursos y boletín) no bloquean la etapa 1, así que se mantiene lo existente.

## Paso 1: panel de accesibilidad

**Qué pedía el documento.** Una barra con tamaño de letra, modo de alto contraste (amarillo sobre negro), fuente para dislexia y guía de lectura lineal.

**Qué se construyó.**

- Botón **«Accesibilidad»** en el encabezado que despliega un panel con: tema de colores (claro, oscuro, según el sistema y **alto contraste**), interruptor de **fuente para dislexia**, interruptor de **guía de lectura** y «Restablecer todo». El zoom de la página se queda en el encabezado, a la vista, porque con el menú plegado hay que poder deshacerlo (ya existía así).
- **Alto contraste** como tercer tema: tema oscuro más el atributo `data-contraste`. Los colores salen de `HIGH_CONTRAST` en `server/src/content/theme.ts` y se generan en `theme-default.css`, igual que la paleta editable. Texto amarillo `#FFFF00` sobre negro (19,6:1), enlaces cian, foco cian, bordes amarillos.
- **Fuente para dislexia:** OpenDyslexic (`@fontsource/opendyslexic`, licencia libre), autoalojada. Reemplaza las dos familias del sitio y afloja el espaciado.
- **Guía de lectura:** oscurece la página salvo una franja que sigue al puntero (también al dedo) y, con teclado, al elemento enfocado. Es decorativa, no intercepta clics y no se anima.
- Las preferencias se guardan en `localStorage` (con respaldo en memoria si el navegador lo bloquea), se aplican antes del primer pintado con `theme-init.js` y todos los controles se actualizan solos al restablecer.
- El panel de administración ofrece también el alto contraste: comparte `localStorage` con el sitio, así que quien lo elige allí no se encuentra con un panel en un tema que no puede cambiar.

**Decisiones y por qué.**

- **Panel en el flujo de la página, no una barra flotante.** Una barra fija tapa contenido con zoom al 200 % y en móvil; el panel empuja el contenido y se recorre con Tab en orden. Escape lo cierra y devuelve el foco al botón.
- **Alto contraste ≠ modo oscuro.** El oscuro conserva la identidad de la marca; el alto contraste prioriza la lectura. Por eso no es editable desde Identidad visual.
- **OpenDyslexic como opción, no por defecto.** La evidencia de que mejore la lectura es limitada y Atkinson Hyperlegible ya está diseñada para baja visión.
- **La guía atenúa el resto de la página** (no la oculta): se acepta que el texto fuera de la franja pierda contraste porque la persona la activa a propósito para concentrarse; la franja conserva el contraste completo.

**Cómo se comprobó.**

- `HIGH_CONTRAST` cumple las reglas de contraste de la paleta editable y, además, **7:1 (AAA)** en texto, enlaces y estados (test en `server/test/content.test.ts`).
- Pruebas de unidad: selector de tema, restablecer, `theme-init.js`, panel (abrir, Escape, interruptores) y guía (siguen al puntero, desaparece al apagarla).
- e2e con axe: las cuatro páginas en alto contraste con la fuente para dislexia, a 320 px y con el panel abierto, sin desborde horizontal.
- Capturas en claro, oscuro, alto contraste, con la guía y en móvil.

**Problemas y cómo se resolvieron.**

- El contenedor de trabajo era nuevo y le faltaban dependencias (`zod`, `prisma`, `eslint`…): se reinstaló con `npm ci` y se recrearon `server/.env` y la base local.
- Las fuentes de dislexia (235 KB) entraron al precache del service worker y lo subieron de 614 a 896 KiB. Se excluyeron del precache y se guardan en caché solo la primera vez que alguien las usa.
- Las cuatro opciones de tema quedaban en filas desparejas en móvil: ahora van en cuadrícula.
