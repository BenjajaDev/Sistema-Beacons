# Backend del Proyecto Beacons

Servidor sencillo (Node.js + Express) que almacena la información de cada beacon
en `beacons.json` y la entrega a la app Android.

## Arrancar

```bash
cd server
npm install
npm start
```

Quedará escuchando en `http://localhost:3000`.

Pruébalo en el navegador del PC: <http://localhost:3000/beacons/1/1>

## Endpoints

| Método | Ruta                       | Descripción                                  |
|--------|----------------------------|----------------------------------------------|
| GET    | `/beacons/:major/:minor`   | Devuelve la info del beacon (JSON).          |
| POST   | `/beacons/:major/:minor`   | Crea/actualiza la info (cuerpo JSON).        |

Ejemplo de respuesta GET:

```json
{
  "titulo": "Entrada principal",
  "descripcion": "Bienvenido al edificio...",
  "ubicacion": "Planta baja - Vestíbulo"
}
```

## Conectar la app

- **Emulador Android** → la app ya apunta a `http://10.0.2.2:3000/` (alias del PC).
- **Teléfono físico** (misma WiFi que el PC):
  1. En Windows ejecuta `ipconfig` y copia tu *Dirección IPv4* (ej. `192.168.1.100`).
  2. Cambia `BASE_URL` en `RetrofitClient.kt` a `http://192.168.1.100:3000/`.
  3. Añade esa IP en `app/src/main/res/xml/network_security_config.xml`.
  4. Asegúrate de que el firewall de Windows permite el puerto 3000.

## Editar la información

Edita `beacons.json` y guarda: los cambios se reflejan sin reiniciar el servidor.
La clave de cada beacon es `"major-minor"`.
