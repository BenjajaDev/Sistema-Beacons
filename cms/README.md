# CMS de Beacons (React + Vite)

Panel web para crear, editar y borrar la información de cada beacon. Se conecta al
backend Express que hay en `../BeaconsAndroid/server`.

## Requisitos

- Node.js instalado.
- El backend arrancado en el puerto 3000:

  ```bash
  cd ../BeaconsAndroid/server
  npm install
  npm start
  ```

## Arrancar el CMS

```bash
cd cms
npm install
npm run dev
```

Abre <http://localhost:5173>.

> En desarrollo, Vite redirige las peticiones `/beacons` al backend
> (`http://localhost:3000`), así que no hay problemas de CORS.

## Qué hace

- **Lista** todos los beacons (`GET /beacons`).
- **Crea / actualiza** un beacon (`POST /beacons/:major/:minor`).
- **Borra** un beacon (`DELETE /beacons/:major/:minor`).

Cada beacon se identifica por su `major-minor` y guarda `titulo`, `descripcion`
y `ubicacion` — los mismos campos que consume la app Android.

## Build de producción

```bash
npm run build
```

Genera la web estática en `dist/`. Si la sirves desde un origen distinto al
backend, recuerda habilitar CORS en el servidor o servir ambos tras el mismo dominio.
