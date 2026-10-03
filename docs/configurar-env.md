# Rellenar `server/.env` y encender la página, paso a paso

Esta guía deja funcionando en tu computador la página pública, el panel de administración y el endpoint de la app Android, todos servidos por el mismo servidor en `http://localhost:3000`.

Al final hay una sección con lo que cambia en producción.

> `server/.env` guarda contraseñas y secretos. Git lo ignora: **nunca lo subas al repositorio ni lo compartas por chat**. Cada entorno (tu computador, el servidor de producción) tiene su propio `.env` con valores distintos.

## 0. Antes de empezar

1. Instala **Node.js 22.12 o superior**. Compruébalo con:

   ```bash
   node -v
   ```

2. En la **raíz del repositorio**, instala las dependencias:

   ```bash
   npm ci
   ```

Todos los comandos de esta guía se ejecutan desde la raíz del repositorio, salvo que se indique otra cosa.

## 1. Crear el archivo

Copia la plantilla:

- **macOS o Linux:**

  ```bash
  cp server/.env.example server/.env
  ```

- **Windows (PowerShell o CMD):**

  ```bash
  copy server\.env.example server\.env
  ```

Abre `server/.env` con tu editor. Verás muchas variables comentadas: **la mayoría ya trae un valor por defecto que sirve**. Solo tienes que completar cuatro cosas: los secretos (paso 2), la base de datos (paso 3), las cuentas iniciales (paso 4) y la base de pruebas (paso 5, opcional).

## 2. Generar los tres secretos

El servidor no arranca sin estas tres variables. Genéralas con:

```bash
npm run secret
```

Imprime algo así (tus valores serán otros):

```
# Pega estas líneas en server/.env (cada entorno con sus propios valores):
ADMIN_PATH=Xq3...24 caracteres o más...
JWT_SECRET=hT9...64 caracteres...
CSRF_SECRET=pL2...64 caracteres...
```

En `server/.env`, busca las líneas vacías `ADMIN_PATH=`, `JWT_SECRET=` y `CSRF_SECRET=` y **reemplázalas** por las tres que imprimió el comando. No dejes las vacías: si una variable aparece dos veces, cuenta la última.

Qué es cada una:

| Variable      | Qué es                                                                                                          | Reglas                                                     |
| ------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `ADMIN_PATH`  | La ruta secreta del panel: el panel solo existe en `http://localhost:3000/<ADMIN_PATH>`. Cualquier otra ruta da 404. | Entre 24 y 128 caracteres: letras, números, `-` o `_`.    |
| `JWT_SECRET`  | Firma las sesiones del panel.                                                                                   | Al menos 32 caracteres.                                    |
| `CSRF_SECRET` | Firma los tokens que protegen los formularios del panel.                                                        | Al menos 32 caracteres y **distinto** de `JWT_SECRET`.    |

**Guarda tu `ADMIN_PATH`**: es la dirección por la que entrarás al panel.

## 3. Elegir la base de datos

Elige **una** de las dos opciones.

### Opción A: base local (lo más rápido para probar)

No hay que instalar PostgreSQL: el proyecto trae uno embebido.

1. Abre **otra terminal**, ve a la raíz del repositorio y ejecuta:

   ```bash
   npm run db:local
   ```

2. Espera a ver `PostgreSQL local escuchando en localhost:5433` y **deja esa terminal abierta** mientras uses la página. Para detenerlo, `Ctrl+C`.
3. En `server/.env` no tienes que cambiar nada: la plantilla ya trae

   ```bash
   DATABASE_URL="postgresql://postgres:postgres@localhost:5433/signal"
   ```

Si prefieres Docker, `docker compose up -d` levanta lo mismo en el mismo puerto.

### Opción B: Supabase

Sigue la guía [`docs/supabase.md`](supabase.md) hasta el paso 4: ahí se explica cómo obtener `DATABASE_URL` y `DIRECT_URL` y cómo escribirlas en este mismo archivo. Después vuelve aquí, al paso 4.

## 4. Las cuentas iniciales del panel

El comando `npm run seed` crea dos cuentas para entrar al panel: una de **administración** (puede hacer todo) y una de **edición** (redacta noticias y contenido, pero no publica ni toca beacons, identidad visual ni usuarios).

En `server/.env`, completa:

```bash
SEED_ADMIN_EMAIL=tu-correo@dominio.cl
SEED_ADMIN_PASSWORD=UnaClaveTemporal2026
SEED_ADMIN_NAME=Administración SIGNAL
SEED_EDITOR_EMAIL=editor@dominio.cl
SEED_EDITOR_PASSWORD=OtraClaveTemporal2026
SEED_EDITOR_NAME=Equipo editorial
```

- Las contraseñas deben tener **12 caracteres o más**.
- Los dos correos deben ser **distintos**.
- Son contraseñas **temporales**: el panel obliga a cambiarlas en el primer ingreso.
- Si una cuenta ya existe, el seed no la toca (ni su contraseña).

## 5. La base de pruebas (opcional)

Solo hace falta si vas a ejecutar `npm test`, `npm run e2e` o `npm run lighthouse`. Con la opción A del paso 3, busca esta línea y **quítale el `#`**:

```bash
TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5433/signal_test"
```

**Las pruebas borran esa base en cada ejecución.** Por eso su nombre debe terminar en `_test` y **nunca debe apuntar a Supabase ni a una base con datos reales**.

## 6. El resto de las variables

Para encender la página en tu computador **no hace falta tocar nada más**. Esto es lo que hace cada una por si quieres ajustarla:

| Variable                                     | Valor de la plantilla       | Cuándo cambiarla                                                                                                     |
| -------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                   | `development`               | `production` en el servidor real.                                                                                    |
| `PORT`                                       | `3000`                      | No la cambies: la app Android apunta al puerto 3000.                                                                 |
| `HOST`                                       | `0.0.0.0`                   | Así un teléfono en tu misma red Wi-Fi puede conectarse. `127.0.0.1` lo limita a tu computador.                       |
| `LOG_LEVEL`                                  | `info`                      | `debug` para ver más detalle; `warn` para ver menos.                                                                 |
| `COOKIE_SECURE`                              | `true`                      | Déjalo en `true`: los navegadores aceptan cookies seguras en `http://localhost`. Ver el paso 9 para usar el panel desde otro equipo. |
| `SESSION_TTL_HOURS`                          | `8`                         | Horas que dura una sesión del panel.                                                                                 |
| `SITE_URL`                                   | vacía                       | En producción, tu dominio: `https://tu-dominio.cl`.                                                                  |
| `LOGIN_MAX_ATTEMPTS`, `LOGIN_LOCK_MINUTES`   | `5`, `15`                   | Intentos fallidos antes de bloquear una cuenta, y por cuántos minutos.                                               |
| `LOGIN_RATE_LIMIT`, `API_RATE_LIMIT`         | `20`, `300`                 | Límites de peticiones por IP.                                                                                        |
| `CORS_ORIGINS`                               | vacía                       | Déjala vacía: el servidor sirve la página y el panel desde el mismo origen.                                          |
| `TRUST_PROXY`                                | `false`                     | `1` en producción si hay un proxy o balanceador delante (Render, Railway, Nginx…).                                   |
| `CSP_IMG_HOSTS`                              | vacía                       | Solo si muestras imágenes de otro dominio.                                                                           |
| `STORAGE_DRIVER`                             | `local`                     | `supabase` para guardar las imágenes en Supabase Storage ([`docs/supabase.md`](supabase.md), paso 7).                |
| `UPLOAD_DIR`, `UPLOAD_MAX_MB`                | `uploads`, `5`              | Carpeta y tamaño máximo de las imágenes subidas en modo `local`.                                                     |
| `BACKUP_INTERVAL_HOURS`, `BACKUP_KEEP`       | `24`, `14`                  | Cada cuántas horas se respalda la base y cuántos respaldos se conservan. `0` desactiva el automático.                |
| `ADMIN_DIST_DIR`, `PUBLIC_DIST_DIR`, `BACKUP_DIR`, `BEACON_SNAPSHOT_PATH` | rutas del proyecto | No las cambies.                                                                       |

## 7. Preparar la base y compilar la página

Con la base de datos funcionando (paso 3), ejecuta en orden:

```bash
npm run db:deploy
npm run import:beacons
npm run seed
npm run build -w apps/web
```

| Comando                      | Qué hace                                                                                                    | Cuándo repetirlo                                  |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `npm run db:deploy`          | Crea las tablas. Debe terminar con `All migrations have been successfully applied.`                         | Cada vez que bajes cambios con migraciones nuevas. |
| `npm run import:beacons`     | Carga los beacons históricos. No duplica los que ya existen.                                                | Solo la primera vez.                              |
| `npm run seed`               | Crea las cuentas del paso 4, la identidad visual y las secciones del sitio. Termina con `Seed completo.`    | Solo la primera vez (es seguro repetirlo).        |
| `npm run build -w apps/web`  | Compila la página pública y el panel. Termina con `✓ dist/public no contiene referencias al panel`.          | Cada vez que cambies el código del frontend.      |

## 8. Encender el servidor

```bash
npm run dev
```

Cuando veas estas líneas, la página está encendida:

```
Servidor SIGNAL en http://localhost:3000
Prueba de la app: http://localhost:3000/beacons/1/1
```

Abre en el navegador:

| Dirección                                | Qué deberías ver                                                                          |
| ---------------------------------------- | ----------------------------------------------------------------------------------------- |
| `http://localhost:3000`                  | La página pública de SIGNAL.                                                              |
| `http://localhost:3000/<ADMIN_PATH>`     | El ingreso al panel. Entra con una cuenta del paso 4 y crea la contraseña definitiva.     |
| `http://localhost:3000/beacons/1/1`      | La ficha JSON de un beacon, igual a la que recibe la app Android.                          |
| `http://localhost:3000/api/health`       | `{"ok":true,"db":"ok"}`: el servidor y la base de datos están conectados.                 |

Para apagarlo, `Ctrl+C` en esa terminal. La próxima vez solo necesitas `npm run db:local` (si usas la opción A) y `npm run dev`.

`npm run dev` se reinicia solo cuando cambias código del servidor. Si vas a trabajar en el diseño de la página o del panel, en otra terminal usa `npm run dev:web` (página en `http://localhost:5173`) o `npm run dev:admin` (panel en `http://localhost:5174/admin.html`), que recargan al instante.

## 9. Abrir la página desde el teléfono

1. Averigua la IP de tu computador en la red local: `ipconfig` en Windows, `ipconfig getifaddr en0` en macOS, `hostname -I` en Linux.
2. Con el teléfono en la **misma red Wi-Fi**, abre `http://<IP-de-tu-computador>:3000`.
3. La página pública funciona tal cual. **El panel, no**: por `http://` y fuera de `localhost`, el navegador rechaza las cookies seguras y el ingreso falla. Solo para probar el panel desde otro equipo de tu red, pon `COOKIE_SECURE=false`, reinicia `npm run dev` y **vuelve a `true` al terminar**. En producción tiene que ser `true`.

## 10. En producción

Un `.env` de producción parte del mismo archivo, con estos cambios:

1. `NODE_ENV=production`.
2. Secretos **nuevos**: ejecuta otra vez `npm run secret` y usa esos valores. Nunca reutilices los de tu computador.
3. `DATABASE_URL` y `DIRECT_URL` de Supabase ([`docs/supabase.md`](supabase.md)).
4. `STORAGE_DRIVER=supabase`, `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`, para que las imágenes no se pierdan en cada despliegue.
5. `SITE_URL=https://tu-dominio.cl`.
6. `TRUST_PROXY=1` si la plataforma pone un proxy delante (casi siempre).
7. `COOKIE_SECURE=true` (el servidor no arranca en producción sin ella) y el sitio servido por **HTTPS**.
8. Sin `TEST_DATABASE_URL`.
9. `SEED_*` con correos reales y contraseñas temporales; bórralas después del primer ingreso.

En plataformas como Render o Railway no se sube el archivo: se crean las mismas variables en su panel de variables de entorno. Los comandos de compilación y arranque están en la sección [Despliegue](../README.md#despliegue) del README.

## Problemas frecuentes

| Mensaje o síntoma                                                                 | Qué hacer                                                                                                          |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `Configuración inválida en server/.env:` seguido de una lista                      | Cada línea de la lista nombra la variable con problema y qué falta. Corrígelas y vuelve a arrancar.                 |
| `ADMIN_PATH debe tener entre 24 y 128 caracteres...` o `JWT_SECRET debe tener al menos 32 caracteres...` | No pegaste el resultado de `npm run secret` (paso 2): las líneas siguen vacías, o quedó otra con el mismo nombre más abajo (cuenta la última). |
| `CSRF_SECRET debe ser distinto de JWT_SECRET.` | Sale junto a los anteriores cuando los dos están vacíos. Si sale solo, copiaste el mismo valor en ambas: pega las tres líneas tal como las imprime `npm run secret`. |
| `Falta ADMIN_PATH.`, `Falta JWT_SECRET.` o `Falta CSRF_SECRET.` | La línea no existe en el archivo o está comentada con `#`. Agrégala con el valor de `npm run secret`. |
| `Falta DATABASE_URL (ver server/.env.example).`                                   | La línea está comentada con `#` o el archivo no está en `server/.env`.                                             |
| `Can't reach database server` o `ECONNREFUSED ...:5433`                           | La base local no está encendida: abre otra terminal con `npm run db:local` (paso 3).                               |
| `SEED_ADMIN_PASSWORD debe tener al menos 12 caracteres.`                           | Alarga las contraseñas del paso 4.                                                                                 |
| La página dice `La landing no está compilada...`                                  | Falta compilar: `npm run build -w apps/web` y reinicia el servidor.                                                |
| `EADDRINUSE: address already in use :::3000`                                      | Ya hay un servidor encendido en el puerto 3000. Ciérralo (`Ctrl+C` en su terminal) antes de abrir otro.            |
| `/<ADMIN_PATH>` responde 404                                                      | Copia el `ADMIN_PATH` exacto de tu `.env` (distingue mayúsculas). Si lo cambiaste, reinicia el servidor.            |
| El ingreso al panel no funciona desde otro equipo                                 | Es por las cookies seguras sobre `http://`. Ver el paso 9.                                                          |
| Una cuenta quedó bloqueada                                                        | Tras 5 intentos fallidos se bloquea 15 minutos (`LOGIN_MAX_ATTEMPTS`, `LOGIN_LOCK_MINUTES`). Espera y reintenta.    |
