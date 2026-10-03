# SIGNAL

Navegación interior con beacons BLE para personas con discapacidad visual.

| Carpeta                  | Qué es                                                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `server/`                | API en Express + Prisma (PostgreSQL / Supabase). Sirve la ficha de cada beacon a la app, y más adelante la API de la landing y del panel. |
| `BeaconsAndroid/`        | App Android (Kotlin + Compose). Consume `GET /beacons/:major/:minor`.                                                                     |
| `apps/web/`              | Frontend: landing pública y panel, en dos builds de Vite separados.                                                                       |
| `cms/`                   | CMS de beacons anterior (React + Vite). Se integrará al panel y luego se eliminará.                                                       |
| `BeaconsAndroid/server/` | Servidor anterior basado en `beacons.json`. **Obsoleto**; se conserva hasta terminar la migración.                                        |
| `docs/`                  | Guías de contenido (redacción de audiodescripciones).                                                                                     |

## Requisitos

- Node.js 22.12 o superior (probado con Node 25).
- PostgreSQL 17. Para desarrollo no hace falta instalarlo: `npm run db:local` levanta uno embebido.

## Puesta en marcha (desarrollo)

```bash
npm install                       # instala todo y genera el cliente de Prisma
cp server/.env.example server/.env
# Completa en server/.env las variables SEED_* (correos y contraseñas iniciales)
# y pega ahí lo que imprime `npm run secret` (ADMIN_PATH, JWT_SECRET, CSRF_SECRET).

npm run db:local                  # en otra terminal: PostgreSQL local en el puerto 5433
npm run db:deploy                 # aplica las migraciones
npm run import:beacons            # importa BeaconsAndroid/server/beacons.json
npm run seed                      # crea las cuentas, la configuración y las secciones
npm run dev                       # servidor en http://localhost:3000
npm run dev:web                   # en otra terminal: landing en http://localhost:5173
npm run dev:admin                 # en otra terminal: panel en http://localhost:5174/admin.html
```

Para producción, `npm run build` compila los dos frontends, verifica el bundle público y compila el servidor. Express sirve el panel desde `apps/web/dist/admin`.

Prueba: <http://localhost:3000/beacons/1/1>. El panel queda en `http://localhost:3000/<ADMIN_PATH>`.

Si prefieres Docker en vez de `db:local`: `docker compose up -d` (mismo puerto y credenciales).

## Variables de entorno

Todas están documentadas en [`server/.env.example`](server/.env.example). `server/.env` no se versiona.

| Variable                                             | Para qué                                                                                                   |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `PORT`, `HOST`                                       | La app Android apunta al puerto 3000. `HOST=0.0.0.0` permite que un teléfono de la misma red se conecte.   |
| `DATABASE_URL`                                       | Conexión que usa el servidor. En Supabase, el pooler en modo transacción (puerto 6543, `?pgbouncer=true`). |
| `DIRECT_URL`                                         | Solo para migraciones. En Supabase, la conexión de sesión (puerto 5432).                                   |
| `ADMIN_PATH`                                         | Ruta secreta del panel. Solo existe en `/<ADMIN_PATH>`; nunca va en variables `VITE_*`.                    |
| `JWT_SECRET`, `CSRF_SECRET`                          | Firma de sesiones y de tokens CSRF. Genera los tres valores con `npm run secret`.                          |
| `COOKIE_SECURE`, `SESSION_TTL_HOURS`                 | Cookies solo por HTTPS (obligatorio en producción) y duración de la sesión.                                |
| `LOGIN_*`, `API_RATE_LIMIT`                          | Bloqueo de cuenta por intentos fallidos y límites de peticiones por IP.                                    |
| `SITE_URL`                                           | Dominio público (https://…) para el sitemap, el canonical y Open Graph.                                    |
| `CORS_ORIGINS`, `TRUST_PROXY`, `CSP_IMG_HOSTS`       | Orígenes extra permitidos, proxy delante del servidor y hosts de imágenes para la CSP.                     |
| `STORAGE_DRIVER`, `UPLOAD_*`, `SUPABASE_*`           | Dónde se guardan las imágenes: disco local en desarrollo, Supabase Storage en producción.                  |
| `SEED_ADMIN_*`, `SEED_EDITOR_*`                      | Cuentas iniciales que crea `npm run seed`.                                                                 |
| `BACKUP_DIR`, `BACKUP_INTERVAL_HOURS`, `BACKUP_KEEP` | Respaldos locales automáticos.                                                                             |
| `BEACON_SNAPSHOT_PATH`                               | Copia local de los beacons para cuando la base de datos no responde.                                       |
| `TEST_DATABASE_URL`                                  | Base para pruebas de integración. Se borra en cada ejecución; su nombre debe terminar en `_test`.          |

## Supabase

1. En Supabase, **Project Settings → Database → Connection string**, copia la URL del pooler en modo transacción en `DATABASE_URL` y la de sesión en `DIRECT_URL`.
2. Ejecuta `npm run db:deploy`, `npm run import:beacons` y `npm run seed`.
3. Para las imágenes, crea un bucket **público** en Storage (por defecto `media`) y define `STORAGE_DRIVER=supabase`, `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`. La service role key solo vive en el servidor.

Supabase publica el schema `public` a través de su Data API. La migración inicial **activa RLS sin políticas en todas las tablas** y revoca los permisos de los roles `anon` y `authenticated`. Así nadie puede leer los datos (incluidos los hashes de contraseña) con la clave pública del proyecto. Prisma se conecta como dueño de las tablas y no se ve afectado. **Toda migración que cree tablas nuevas debe activar RLS en ellas**; la prueba de integración `todas las tablas del schema public tienen RLS activado` lo verifica.

## Panel y seguridad

La ruta oculta evita que el panel aparezca a simple vista, pero **no es la seguridad**. Lo que protege el panel:

- **Ruta oculta:** el panel se sirve solo bajo `/<ADMIN_PATH>`, con `X-Robots-Tag: noindex`. `/admin`, `/login` o cualquier otra ruta responden 404, sin redirigir. La ruta tampoco aparece en los logs de acceso.
- **Sesión:** JWT en la cookie `__Host-signal_session` (httpOnly, Secure, SameSite=Strict). Cada petición verifica que la cuenta siga activa y que el token no haya sido revocado. Cambiar la contraseña o cerrar sesión invalida todas las sesiones de esa cuenta.
- **CSRF:** token de doble envío firmado y atado a la sesión, en la cabecera `X-CSRF-Token`. Además se comprueba la cabecera `Origin`.
- **Roles:** cada ruta de `/api/admin` declara qué roles la pueden usar. Sin sesión responde 401 y con un rol insuficiente, 403. `test/integration/permissions.test.ts` recorre todas las rutas automáticamente y exige que bitácora, usuarios, beacons, identidad visual, equipo y publicación sean solo de administración.
- **Login:** el error es el mismo para un correo inexistente y una contraseña incorrecta. Tras `LOGIN_MAX_ATTEMPTS` fallos la cuenta se bloquea `LOGIN_LOCK_MINUTES` minutos, y hay un límite de intentos por IP. En el primer inicio de sesión se obliga a cambiar la contraseña.
- **Cabeceras:** helmet aplica CSP estricta, nosniff, prohibición de iframes y HSTS en producción. CORS queda cerrado salvo los orígenes de `CORS_ORIGINS`.
- **Bitácora:** `audit_logs` registra quién, qué, cuándo, la IP y el navegador (inicios de sesión, bloqueos, cambios de contraseña y cada cambio de contenido, con los campos modificados). Se consulta en `GET /api/admin/audit`.

## API

Todas las respuestas de error tienen la forma `{ error, code, campos? }`. `error` es un mensaje para la persona que usa el sitio y `campos` indica el error de cada input del formulario.

**Pública** (`/api/public`, solo lectura, caché de 60 s): `GET /site`, `GET /pages/:page` (`inicio`, `nosotros`, `noticias` o `contacto`), `GET /news?pagina&porPagina&categoria`, `GET /news/:slug`, `GET /team` y `GET /collaborators`, más `POST /contact` (limitado a 5 por hora por IP y con campo trampa contra bots). Solo entrega lo visible y lo publicado.

**Panel** (`/api/admin`, con sesión y CSRF):

| Módulo                                                                                    | Editor                                                                | Administrador                                                  |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------- |
| Noticias                                                                                  | Crea, edita sus borradores, los envía a revisión y ve la vista previa | Además publica, devuelve con observaciones, despublica y borra |
| Secciones                                                                                 | Edita borradores y los envía a revisión                               | Además publica, devuelve, oculta y ordena                      |
| Imágenes                                                                                  | Sube y lista                                                          | Además borra (si no están en uso)                              |
| Equipo, colaboradores, identidad visual, contacto, beacons, usuarios, mensajes y bitácora | —                                                                     | Todo                                                           |

Garantías que impone el servidor, no solo la interfaz:

- **Texto enriquecido:** el servidor valida el documento del editor (solo los nodos de la barra) y genera él mismo el HTML, escapando todo. Un `<script>`, un `onerror=` o un `javascript:` no pueden llegar a la landing.
- **Accesibilidad:** una nota no se envía a revisión ni se publica si le faltan bajada o categoría, si tiene imágenes sin texto alternativo o si el cuerpo está vacío. Los saltos de nivel en los subtítulos, los enlaces tipo «clic aquí» y los párrafos muy largos se advierten sin bloquear.
- **Identidad visual:** una paleta que no cumple el contraste de WCAG 2.1 AA, en claro o en oscuro, se rechaza indicando qué combinación falla.
- **Imágenes:** ninguna se guarda sin texto alternativo; lo exige también un CHECK en la base de datos.
- **Usuarios:** nadie puede desactivarse ni quitarse el rol de administrador a sí mismo, y el sitio nunca queda sin una cuenta administradora activa, ni siquiera si dos admins se quitan el rol al mismo tiempo.
- **Beacons:** cambiar major/minor es una sola operación atómica, y cada cambio actualiza el snapshot que usa la app si la base de datos no responde.

## Frontend

`apps/web` tiene **dos entradas y dos builds de Vite independientes**:

| Entrada                     | Build         | Se sirve en                  |
| --------------------------- | ------------- | ---------------------------- |
| `index.html` → `src/public` | `dist/public` | `/` (landing)                |
| `admin.html` → `src/admin`  | `dist/admin`  | solo `/<ADMIN_PATH>` (panel) |

- **Nada del panel llega al bundle público.** ESLint prohíbe que `src/public` y `src/shared` importen código de `src/admin`, y `scripts/check-public-bundle.mjs` (corre en cada build y en CI) falla si `dist/public` contiene el marcador del panel, `/api/admin`, la ruta secreta o source maps.
- **La ruta secreta no está en ningún build:** el del panel usa rutas relativas y Express inyecta `<base href>` al servirlo.
- **Tema:** los colores y las fuentes son variables CSS. El servidor inyecta los de Identidad visual en el HTML antes del primer pintado. `theme-default.css` es el respaldo, generado desde el servidor con `npm run gen:theme -w server`, y un test verifica que esté sincronizado.
- **Preferencias de la persona:** tema claro, oscuro o del sistema, y tamaño de texto (A−/A+ de 87,5 % a 150 %). Se guardan en el navegador y se aplican antes de pintar con `theme-init.js`, un script externo porque la CSP no permite scripts inline.
- **Componentes accesibles** en `src/shared/ui`: botones con estado de carga, campos con label y error asociados, resumen de errores, avisos con regiones `aria-live`, diálogo de confirmación sobre `<dialog>` nativo, y estados de carga, vacío y error. Cada uno tiene tests con axe-core.
- **Animaciones** de 150 a 300 ms. Con `prefers-reduced-motion` se desactivan todas.
- **Fuentes autoalojadas** (Atkinson Hyperlegible Next y Bricolage Grotesque): sin dependencia de Google Fonts y disponibles offline.

## Landing y PWA

Express sirve la landing en sus rutas: `/`, `/nosotros`, `/noticias`, `/noticias/:slug` y `/contacto`.

- **Datos incluidos en el HTML:** cada página sale con su `<title>`, meta description, Open Graph, canonical, el tema de Identidad visual y los datos iniciales en `<script type="application/json" id="datos-iniciales">`. El primer render no espera a la API, y el JSON va escapado para que ningún texto pueda cerrar el `<script>`.
- **Sin contenido fijo en el código:** secciones, textos, noticias, equipo, colaboradores, logos, colores y contacto salen de la base de datos. Lo publicado en el panel se ve al recargar, sin redeploy.
- **404 real:** cualquier otra ruta (incluidas `/admin` o `/login`) responde 404 con la página «no encontrada», también cuando la base de datos no responde. Una noticia en borrador o inexistente también es 404.
- **SEO:** `/robots.txt` y `/sitemap.xml` se generan en el servidor. Solo listan lo publicado y no mencionan el panel.
- **Accesibilidad:**
  - un solo `<h1>` por página (el título de su primera sección) y foco en él al navegar;
  - landmarks, enlace «Saltar al contenido» y menú móvil con `aria-expanded` que se cierra con Escape;
  - tarjetas de noticia con un solo enlace, paginación con `aria-current` e indicador de «sin conexión»;
  - el formulario de contacto valida en línea, muestra un resumen de errores enfocable, conserva un borrador y muestra los errores del servidor junto a cada campo.
- **PWA** (`vite-plugin-pwa`, solo en el build público):
  - manifest instalable con íconos (`node apps/web/scripts/gen-icons.mjs` los regenera desde el isotipo);
  - service worker que precarga la landing y guarda en caché las páginas visitadas, el contenido, las noticias publicadas y las imágenes;
  - sin conexión, las páginas ya visitadas cargan completas y las demás muestran `offline.html`;
  - el service worker solo atiende una lista de rutas de la landing, así que la del panel nunca pasa por él.
- **Medición** (Lighthouse 13, perfil móvil, servidor local con compresión): rendimiento 96–97 y accesibilidad, buenas prácticas y SEO en 100, en Inicio, Nosotros, Noticias y Contacto.

## Panel de administración

Se abre en `/<ADMIN_PATH>` (en desarrollo: `npm run dev:admin`, en http://localhost:5174/admin.html, con el servidor corriendo). El menú lateral muestra solo lo que permite el rol y en el teléfono pasa a un cajón modal.

| Vista                                                            | Editor                                                           | Administrador                                                           |
| ---------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Resumen                                                          | Sus borradores y notas en revisión                               | Notas por revisar, secciones pendientes, mensajes y beacons incompletos |
| Noticias                                                         | Escribe, guarda y envía a revisión                               | Además publica, devuelve con observaciones, despublica y borra          |
| Secciones                                                        | Edita borradores con vista previa en vivo y los envía a revisión | Además publica, muestra u oculta y reordena                             |
| Equipo, Identidad visual, Contacto, Beacons, Usuarios y Bitácora | — (verá «sin acceso» si entra por URL)                           | Todo                                                                    |

- **Editor de texto enriquecido** (TipTap):
  - solo ofrece lo que acepta el servidor; `apps/web/test/editor.test.ts` valida su salida contra el esquema del servidor;
  - barra `role="toolbar"` que se recorre con las flechas, botones con `aria-pressed` y atajos;
  - diálogos de enlace e imagen con validación, y la imagen exige texto alternativo;
  - al pegar desde Word se limpia el formato y un H1 pasa a H2.
- **No se pierde lo escrito:** las noticias guardan una copia local mientras se editan (y ofrecen recuperarla) y el panel avisa antes de salir con cambios sin guardar.
- **Revisión de accesibilidad** en cada nota: lo que impide publicar y las recomendaciones. La vista previa usa los mismos componentes que la landing.
- **Identidad visual:** paleta clara y oscura con verificación de contraste WCAG en vivo y vista previa de ambos temas. Una paleta que no cumple no se guarda.
- **Beacons:** el CMS anterior integrado como módulo, con fichas completas e incompletas, conteo por ubicación, búsqueda, cambio de major/minor en un solo paso y botón para escuchar la descripción como la leerá la app.
- **Usuarios:** cuentas con contraseña temporal que se muestra una sola vez; desactivar o restablecer la contraseña cierra las sesiones de esa persona.

**Prueba de punta a punta** (`e2e/panel.mjs`, en Chrome real con axe-core, hasta que pase a Playwright en la fase 7):

- **Flujo editorial:** el editor escribe una nota y la envía a revisión; la administradora la publica y aparece en la API pública.
- **Permisos:** el editor no entra a Beacons ni por URL.
- **App Android:** un beacon creado en el panel llega a `GET /beacons/:major/:minor`.
- **Accesibilidad:** axe sin violaciones críticas ni graves en todas las vistas del panel y de la landing, en tema claro y oscuro.
- **Móvil:** cajón operable con teclado y sin scroll horizontal a 320 px.

## Cuentas y seed

- No hay registro público. `npm run seed` crea una cuenta de administrador y una de editor con los datos de `server/.env`.
- Es idempotente: si una cuenta ya existe no cambia su contraseña ni su rol, y no pisa la configuración ni el contenido de las secciones ya editadas.
- Las contraseñas se guardan con argon2id y deben tener al menos 12 caracteres. Al primer inicio de sesión se obliga a cambiarlas.

## Respaldos locales

| Comando                                    | Qué hace                                                                                                          |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `npm run backup`                           | Exporta toda la base a `server/backups/signal-backup-<fecha>.json.gz` y conserva los `BACKUP_KEEP` más recientes. |
| `npm run restore`                          | Lista los respaldos disponibles.                                                                                  |
| `npm run restore -- <archivo>`             | Muestra qué contiene un respaldo, sin cambiar nada.                                                               |
| `npm run restore -- <archivo> --confirmar` | Reemplaza la base completa por el respaldo, en una transacción. Antes respalda el estado actual.                  |

El servidor también hace un respaldo cada `BACKUP_INTERVAL_HOURS` horas. Los respaldos incluyen hashes de contraseña: trata la carpeta `server/backups/` como información sensible.

## Contrato con la app Android

`GET /beacons/:major/:minor` responde `{ titulo, descripcion, ubicacion }`, o un 404 `{ "error": "No hay información para el beacon <major>-<minor>" }`.

- **No se puede cambiar** sin actualizar la app. `test/legacy-beacons.test.ts` comprueba que cada entrada del `beacons.json` original se responde de forma idéntica.
- Si la base de datos no responde, el servidor contesta desde el snapshot local (`BEACON_SNAPSHOT_PATH`), que se actualiza al arrancar, al importar y en cada respaldo.
- El listado (`GET /beacons`) y la escritura sin autenticación (`POST` y `DELETE`) se eliminaron. La edición pasará al panel, en `/api/admin/beacons`, solo para administradores.

## Tests y calidad

```bash
npm test          # unitarios + integración (si TEST_DATABASE_URL está definida)
npm run typecheck
npm run lint
npm run format:check
```

El CI (`.github/workflows/ci.yml`) ejecuta todo lo anterior contra un PostgreSQL 17.

## Estado

- [x] **Fase 0:** saneamiento del repo, workspaces, TypeScript, ESLint, Prettier y CI.
- [x] **Fase 1:** modelo de datos, migraciones con RLS, importación de beacons, seed idempotente, respaldos y paridad con la app Android.
- [x] **Fase 2:** autenticación, roles, CSRF, rate limit, bitácora y ruta oculta del panel.
- [x] **Fase 3:** API de administración y API pública.
- [x] **Fase 4:** base del frontend (dos builds de Vite, tokens y kit de UI).
- [x] **Fase 5:** landing y PWA.
- [x] **Fase 6:** panel de administración.
- [ ] **Fase 7:** QA, accesibilidad en CI, Lighthouse y despliegue.
