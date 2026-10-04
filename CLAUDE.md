# SIGNAL: guía para Claude

SIGNAL es navegación interior con beacons BLE para personas con discapacidad visual. Antes de tocar nada, lee en el [README](README.md) las secciones «Estado», «Despliegue» y «Criterios de aceptación».

- `server/`: Express 5 y Prisma 7 sobre PostgreSQL (Supabase). API pública (`/api/public`), API del panel (`/api/admin`), landing con datos iniciales en el HTML y el endpoint de la app Android.
- `apps/web/`: dos builds de Vite. `index.html` es la landing y la PWA (`dist/public`); `admin.html` es el panel (`dist/admin`), servido solo bajo `/<ADMIN_PATH>`.
- `BeaconsAndroid/`: app Android en Kotlin y Jetpack Compose.
- `e2e/`: Playwright y axe. `lighthouserc.cjs`: Lighthouse CI móvil.
- `docs/`: guías ([`.env`](docs/configurar-env.md), [Supabase](docs/supabase.md)) y [diagramas](docs/diagramas/README.md).

## Reglas que no se rompen

1. **Contrato de la app Android.** `GET /beacons/:major/:minor` responde `{ titulo, descripcion, ubicacion }` y un 404 `{ error: "No hay información para el beacon M-m" }`, en el puerto 3000. No cambia; `server/test/legacy-beacons.test.ts` lo verifica.
2. **Nada del panel en el bundle público.** `ADMIN_PATH` vive solo en `server/.env`, nunca en variables `VITE_*`. `apps/web/scripts/check-public-bundle.mjs` corre en cada build.
3. **Accesibilidad WCAG 2.1 AA.** Un `h1` por página, foco visible y gestionado, labels, errores con `aria-live`, objetivos de 44 px, `prefers-reduced-motion` y nada que dependa solo del color. axe con 0 violaciones críticas o graves.
4. **Español.** Textos de interfaz, comentarios y commits en español. Los commits terminan con la línea `Co-Authored-By` que indique la sesión.
5. **Antes de cada commit:** `npm run lint && npm run typecheck && npm run format:check && npm test && npm run build -w apps/web`.
6. **CI.** No bajes los umbrales de Lighthouse (rendimiento ≥ 90, accesibilidad ≥ 95) sin pedirlo. Trabaja en `develop`; nunca hagas push a `main`.
7. **Credenciales.** Nunca pidas credenciales de Supabase por el chat ni las escribas en archivos versionados.

## Paleta de colores: una sola para la app y la web

La fuente de verdad es la app Android: `BeaconsAndroid/app/src/main/java/com/example/proyectobeacons/SignalColors.kt`. La web la replica en `server/src/content/theme.ts` (`DEFAULT_PALETTE`), con el nombre del color de Android comentado al lado de cada token.

| Uso                     | Claro     | Oscuro    | En `SignalColors.kt`                |
| ----------------------- | --------- | --------- | ----------------------------------- |
| Fondo                   | `#FFF4EB` | `#150C14` | `SurfaceLight` / `SurfaceDark`      |
| Tarjetas (superficie)   | `#FFFFFF` | `#221521` | `CardLight` / `CardDark`            |
| Texto                   | `#3D1534` | `#F2E6DC` | `TextPrimaryL` / `TextPrimaryD`     |
| Texto secundario        | `#6B4F63` | `#D3C1CC` | `TextSecondaryL` / `TextSecondaryD` |
| Primario, enlaces, foco | `#004AAD` | `#9DC2F7` | `Blue` / `BlueLight`                |
| Bordes                  | `#ECDCC4` | `#3D2A39` | `BlueBorder` / `BorderDark`         |
| Bordes de campos        | `#8A7D84` | `#A6919E` | `TextMutedL` / `TextMutedD`         |
| Error                   | `#C0392B` | `#F0796A` | `error` de `SignalTheme`            |

- Si cambias un color, cámbialo **en los dos lados** en el mismo commit y ejecuta `npm run gen:theme -w server`.
- Toda paleta nueva debe pasar `checkPaletteContrast` (en `theme.ts`). Si un color de Android no llega al contraste en la web, se ajusta en ambos lados; no se rompe la accesibilidad para calzar un color.
- No escribas colores sueltos en CSS: usa las variables `--color-*` (editables desde Identidad visual) o los tokens de `apps/web/src/shared/styles/tokens.css`.
- `apps/web/public/offline.html`, `index.html` (`theme-color`), el manifest de `vite.public.config.ts` y `apps/web/scripts/gen-icons.mjs` tienen colores fijos: mantenlos alineados.
- Las tipografías son Atkinson Hyperlegible Next (cuerpo) y Bricolage Grotesque (títulos), autoalojadas. No se cambian sin pedirlo.

## Lenguaje visual y movimiento

- El motivo es **la señal del beacon**: punto de luz, ondas concéntricas, barras que barren. Un componente nuevo usa ese vocabulario antes que inventar otro.
- Movimiento al apuntar: siempre dentro de `@media (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)`, solo `transform` y `opacity`, curva `--curva` y duración `--dur-*` (≤ 300 ms). Presionar: `scale(0.97)`.
- Lo único que se mueve solo es la entrada de las ondas del hero, una vez. El panel es sobrio: se usa a diario.
- Nada de texto subrayado plano ni acciones que parezcan texto: los enlaces del texto llevan la barra inferior de `base.css` y las acciones son botones (`.btn--fantasma` es una ficha, no un enlace).

## Skills de diseño, UX y animación

Están instaladas en [`.claude/skills/`](.claude/skills/README.md). Son copias de repositorios externos: **no las edites**; para actualizarlas, vuelve a copiarlas desde su origen.

### Precedencia

Cuando una skill choque con este archivo, **gana este archivo**, en este orden:

1. Accesibilidad (regla 3) y el contrato de la app Android.
2. La paleta de Android y las tipografías del proyecto.
3. Los tokens existentes (`tokens.css`: espacios, radios, duraciones `--dur-*` y curva `--curva`).
4. Recién después, el criterio de la skill.

Por ejemplo, `frontend-design` pide elegir tipografías y paletas «distintivas» y `ui-ux-pro-max` propone paletas por industria: aquí sirven para la composición, la jerarquía y el ritmo, **no para cambiar colores ni fuentes**.

### Cuándo usar cada una

| Skill                          | Úsala para                                                                                       | En SIGNAL                                                                                                                                                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend-design`              | Definir la dirección visual antes de diseñar o rediseñar una pantalla de la landing o del panel. | Dentro de la paleta y las fuentes fijadas arriba.                                                                                                                                                                                         |
| `ui-ux-pro-max`                | Consultar patrones UX, reglas de accesibilidad, jerarquía tipográfica y validar decisiones.      | Ejecuta su buscador desde la raíz: `python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<consulta>" --domain <dominio>`. Su SKILL.md asume la ruta de plugin (`${CLAUDE_PLUGIN_ROOT}`); aquí no aplica. Ignora sus paletas sugeridas. |
| `emil-design-eng`              | Revisar o pulir componentes e interacciones: estados, detalles, criterio de producto.            | Primera opción para pulir el panel y la landing.                                                                                                                                                                                          |
| `pick-ui-library`              | Antes de instalar **cualquier** librería de UI (toasts, modales, gestos, listas).                | Consulta primero con la persona usuaria. Ya existen `Toast` y `Dialog` propios y accesibles en `apps/web/src/shared/ui/`: prefiérelos.                                                                                                    |
| `ask-sonner`                   | Dudas sobre la librería Sonner.                                                                  | Solo si se decide adoptar Sonner. Hoy los avisos usan el `Toast` propio; no migres sin pedirlo.                                                                                                                                           |
| `prototype`                    | Prototipos rápidos de pantallas para explorar ideas.                                             | Fuera de `apps/web/src` (por ejemplo, en el scratchpad o `docs/prototipos/`). Un prototipo nunca entra al bundle público.                                                                                                                 |
| `animate`                      | Implementar animaciones web.                                                                     | Con los tokens `--dur-*` (150 a 300 ms) y `--curva`, y siempre con alternativa en `prefers-reduced-motion`.                                                                                                                               |
| `animation-vocabulary`         | Ponerle nombre preciso a un efecto antes de pedirlo o implementarlo.                             | Sin restricciones.                                                                                                                                                                                                                        |
| `find-animation-opportunities` | Detectar dónde falta o sobra animación. Es de solo lectura.                                      | Descarta lo que distraiga o mueva contenido sin que la persona lo pida: el público usa lector de pantalla y magnificación.                                                                                                                |
| `improve-animations`           | Mejorar animaciones existentes.                                                                  | Mismas restricciones que `animate`.                                                                                                                                                                                                       |
| `review-animations`            | Revisar animaciones contra estándares.                                                           | **Obligatoria** antes de commitear cualquier cambio de movimiento.                                                                                                                                                                        |
| `animate-expo`                 | Animaciones en React Native o Expo.                                                              | **No aplica hoy**: la app es Kotlin y Compose, y la web es React DOM. Solo si se crea una app en React Native.                                                                                                                            |
| `apple-design`                 | Criterios de diseño de Apple para iOS o React Native.                                            | **No aplica hoy**. Úsala solo si se crea una app iOS o React Native.                                                                                                                                                                      |
| `write-swift`                  | Código nativo iOS.                                                                               | **No aplica hoy**. Úsala solo si se crea una app iOS.                                                                                                                                                                                     |

### Flujo recomendado para un cambio de diseño

1. **Dirección:** `frontend-design` (o `emil-design-eng` si es pulir algo que ya existe), respetando la precedencia.
2. **Validación:** `ui-ux-pro-max` para patrones y accesibilidad; contraste con `checkPaletteContrast`.
3. **Librerías:** si hace falta una nueva, `pick-ui-library` y la aprobación de la persona usuaria antes de instalar.
4. **Movimiento:** `animation-vocabulary`, luego `animate` o `improve-animations`, y al final `review-animations`.
5. **Verificación:** los chequeos de la regla 5, más `npm run e2e` (axe en claro y oscuro, 320 px y texto al 200 %) y `npm run lighthouse`.

## Trampas conocidas

- Zod 4: `.partial()` aplica los `.default()`; por eso hay esquemas separados de creación y edición (`server/src/routes/admin/team.ts`).
- Workbox copia como texto las funciones `urlPattern` dentro de `sw.js`: no pueden usar variables de `vite.public.config.ts`.
- Node 25 rompe el `localStorage` de jsdom: `apps/web/test/setup.ts` lo reemplaza.
- Los tests de integración vacían la base de `TEST_DATABASE_URL`; su nombre debe terminar en `_test`.
- `server/prisma/data/beacons.json` está excluido de Prettier: son datos.
- `e2e/pwa.spec.ts` usa un perfil persistente: en incógnito Chrome no permite instalar la PWA.
- Los textos `.visually-hidden` dentro de contenedores con scroll necesitan un ancestro con `position: relative`.
- La paleta de una base existente vive en `site_settings`: un cambio de `DEFAULT_PALETTE` solo afecta a bases nuevas. En las existentes, usa «Volver a los colores y tipografías por defecto» en Identidad visual y guarda.
