# SIGNAL

Navegación interior con beacons BLE para personas con discapacidad visual.

| Carpeta                  | Qué es                                                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `server/`                | API en Express + Prisma (PostgreSQL / Supabase). Sirve la ficha de cada beacon a la app, y más adelante la API de la landing y del panel. |
| `BeaconsAndroid/`        | App Android (Kotlin + Compose). Consume `GET /beacons/:major/:minor`.                                                                     |
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
```

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
| `CORS_ORIGINS`, `TRUST_PROXY`, `CSP_IMG_HOSTS`       | Orígenes extra permitidos, proxy delante del servidor y hosts de imágenes para la CSP.                     |
| `SEED_ADMIN_*`, `SEED_EDITOR_*`                      | Cuentas iniciales que crea `npm run seed`.                                                                 |
| `BACKUP_DIR`, `BACKUP_INTERVAL_HOURS`, `BACKUP_KEEP` | Respaldos locales automáticos.                                                                             |
| `BEACON_SNAPSHOT_PATH`                               | Copia local de los beacons para cuando la base de datos no responde.                                       |
| `TEST_DATABASE_URL`                                  | Base para pruebas de integración. Se borra en cada ejecución; su nombre debe terminar en `_test`.          |

## Supabase

1. En Supabase, **Project Settings → Database → Connection string**, copia la URL del pooler en modo transacción en `DATABASE_URL` y la de sesión en `DIRECT_URL`.
2. Ejecuta `npm run db:deploy`, `npm run import:beacons` y `npm run seed`.

Supabase publica el schema `public` a través de su Data API. La migración inicial **activa RLS sin políticas en todas las tablas** y revoca los permisos de los roles `anon` y `authenticated`. Así nadie puede leer los datos (incluidos los hashes de contraseña) con la clave pública del proyecto. Prisma se conecta como dueño de las tablas y no se ve afectado. **Toda migración que cree tablas nuevas debe activar RLS en ellas**; la prueba de integración `todas las tablas del schema public tienen RLS activado` lo verifica.

## Panel y seguridad

La ruta oculta evita que el panel aparezca a simple vista, pero **no es la seguridad**. Lo que protege el panel:

- **Ruta oculta:** el panel se sirve solo bajo `/<ADMIN_PATH>`, con `X-Robots-Tag: noindex`. `/admin`, `/login` o cualquier otra ruta responden 404, sin redirigir. La ruta tampoco aparece en los logs de acceso.
- **Sesión:** JWT en la cookie `__Host-signal_session` (httpOnly, Secure, SameSite=Strict). Cada petición verifica que la cuenta siga activa y que el token no haya sido revocado. Cambiar la contraseña o cerrar sesión invalida todas las sesiones de esa cuenta.
- **CSRF:** token de doble envío firmado y atado a la sesión, en la cabecera `X-CSRF-Token`. Además se comprueba la cabecera `Origin`.
- **Roles:** cada ruta de `/api/admin` declara qué roles la pueden usar. Sin sesión responde 401 y con un rol insuficiente, 403. `test/integration/permissions.test.ts` recorre todas las rutas automáticamente y exige que bitácora, usuarios, beacons, identidad visual, equipo y publicación sean solo de administración.
- **Login:** el error es el mismo para un correo inexistente y una contraseña incorrecta. Tras `LOGIN_MAX_ATTEMPTS` fallos la cuenta se bloquea `LOGIN_LOCK_MINUTES` minutos, y hay un límite de intentos por IP. En el primer inicio de sesión se obliga a cambiar la contraseña.
- **Cabeceras:** helmet aplica CSP estricta, nosniff, prohibición de iframes y HSTS en producción. CORS queda cerrado salvo los orígenes de `CORS_ORIGINS`.
- **Bitácora:** `audit_logs` registra quién, qué, cuándo, la IP y el navegador (inicios de sesión, bloqueos, cambios de contraseña y, más adelante, cada cambio de contenido). Se consulta en `GET /api/admin/audit`.

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
- [ ] **Fase 3:** API de administración.
- [ ] **Fase 4:** base del frontend (dos builds de Vite, tokens y kit de UI).
- [ ] **Fase 5:** landing y PWA.
- [ ] **Fase 6:** panel de administración.
- [ ] **Fase 7:** QA, accesibilidad en CI, Lighthouse y despliegue.
