// Backend sencillo para el Proyecto Beacons.
// Almacena la información de cada beacon en beacons.json y la sirve por HTTP.
//
// Cómo arrancar:
//   1) Instala Node.js (https://nodejs.org)
//   2) En esta carpeta (server/) ejecuta:  npm install
//   3) Arranca con:                        npm start
//   El servidor quedará escuchando en http://localhost:3000
//
// La app Android lo consulta en:  GET /beacons/{major}/{minor}

const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;
const DB_PATH = path.join(__dirname, "beacons.json");

app.use(express.json());

// Lee el "almacén" (archivo JSON) en cada petición para poder editarlo en caliente.
function leerBeacons() {
  return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
}

// GET /beacons  ->  todos los beacons (lo usa el CMS para listarlos)
app.get("/beacons", (req, res) => {
  res.json(leerBeacons());
});

// GET /beacons/:major/:minor  ->  info de un beacon concreto
app.get("/beacons/:major/:minor", (req, res) => {
  const { major, minor } = req.params;
  const clave = `${major}-${minor}`;
  const beacons = leerBeacons();

  if (beacons[clave]) {
    console.log(`✅ Servida info del beacon ${clave}`);
    res.json(beacons[clave]);
  } else {
    console.log(`⚠️  Beacon ${clave} no encontrado`);
    res.status(404).json({ error: `No hay información para el beacon ${clave}` });
  }
});

// (Opcional) POST /beacons/:major/:minor  ->  crear/actualizar info desde un "gestor"
app.post("/beacons/:major/:minor", (req, res) => {
  const { major, minor } = req.params;
  const clave = `${major}-${minor}`;
  const beacons = leerBeacons();
  beacons[clave] = req.body;
  fs.writeFileSync(DB_PATH, JSON.stringify(beacons, null, 2), "utf-8");
  console.log(`💾 Guardada info del beacon ${clave}`);
  res.json({ ok: true, clave, info: req.body });
});

// DELETE /beacons/:major/:minor  ->  borrar un beacon (lo usa el CMS)
app.delete("/beacons/:major/:minor", (req, res) => {
  const { major, minor } = req.params;
  const clave = `${major}-${minor}`;
  const beacons = leerBeacons();

  if (!beacons[clave]) {
    return res.status(404).json({ error: `No existe el beacon ${clave}` });
  }
  delete beacons[clave];
  fs.writeFileSync(DB_PATH, JSON.stringify(beacons, null, 2), "utf-8");
  console.log(`🗑  Borrado el beacon ${clave}`);
  res.json({ ok: true, clave });
});

// Escucha en 0.0.0.0 para que un teléfono físico de la misma WiFi pueda conectarse.
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor de beacons en http://localhost:${PORT}`);
  console.log(`Prueba:  http://localhost:${PORT}/beacons/1/1`);
});
