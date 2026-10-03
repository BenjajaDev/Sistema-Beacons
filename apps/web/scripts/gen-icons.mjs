// Genera los íconos de la PWA y el favicon a partir del isotipo.
//
//   node scripts/gen-icons.mjs [ruta-al-isotipo.png]
//
// El isotipo es horizontal: se centra sobre fondo blanco. El ícono "maskable"
// deja más margen porque Android lo recorta (zona segura: 80 % central).

import path from "node:path";
import sharp from "sharp";

const RAIZ = path.resolve(import.meta.dirname, "..");
const ORIGEN = process.argv[2] ?? path.join(import.meta.dirname, "isotipo.png");
const DESTINO = path.join(RAIZ, "public/icons");
const FONDO = { r: 255, g: 255, b: 255, alpha: 1 };

async function icono(nombre, lado, proporcionLogo) {
  const logo = await sharp(ORIGEN)
    .resize({
      width: Math.round(lado * proporcionLogo),
      height: Math.round(lado * proporcionLogo),
      fit: "inside",
    })
    .toBuffer();
  await sharp({ create: { width: lado, height: lado, channels: 4, background: FONDO } })
    .composite([{ input: logo, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(DESTINO, nombre));
  console.log(`  ${nombre} (${lado}×${lado})`);
}

console.log(`Íconos desde ${ORIGEN}:`);
await icono("icon-192.png", 192, 0.82);
await icono("icon-512.png", 512, 0.82);
await icono("maskable-512.png", 512, 0.62);
await icono("apple-touch-icon.png", 180, 0.8);
await icono("favicon-48.png", 48, 0.92);
