// Genera los íconos de la PWA y el favicon.
//
//   node scripts/gen-icons.mjs
//
// El ícono es un dibujo vectorial cuadrado basado en el isotipo (scripts/isotipo.png,
// que es horizontal): el beacon con su luz azul emitiendo ondas, sobre azul marino.
// Al ser vectorial queda nítido en todos los tamaños, también en el favicon.
//
// - icon-*: esquinas redondeadas y fondo transparente fuera de ellas.
// - maskable-512: fondo a sangre; Android lo recorta y el dibujo queda dentro de
//   la zona segura (círculo del 80 % central).
// - apple-touch-icon: cuadrado opaco a sangre; iOS redondea las esquinas.
// - favicon-48: sin facetas y con el dibujo más grande, para que se lea a 48 px.

import path from "node:path";
import sharp from "sharp";

const DESTINO = path.resolve(import.meta.dirname, "../public/icons");

// Colores del brief.
const MARINO = "#0D1B3E";
const AZUL = "#1A56DB";
const AZUL_CLARO = "#5B8EFF";
const BORDE = "#C0D0F5";

// Arco de onda centrado en (cx, cy), abierto hacia la derecha.
function arco(cx, cy, r, grados) {
  const a = (grados * Math.PI) / 180;
  const x = (cx + r * Math.cos(a)).toFixed(1);
  const arriba = (cy - r * Math.sin(a)).toFixed(1);
  const abajo = (cy + r * Math.sin(a)).toFixed(1);
  return `M ${x} ${arriba} A ${r} ${r} 0 0 1 ${x} ${abajo}`;
}

// Lienzo de 512 × 512. El dibujo mide unos 275 × 220 y se centra en (256, 256);
// «escala» lo agranda o achica para dejar el margen de cada variante.
function svg({ escala, radio = 0, facetas = true }) {
  const piedra = "M160 190 L205 196 L228 240 L225 304 L195 336 L148 334 L123 300 L125 233 Z";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${radio}" fill="${MARINO}"/>
  <g transform="translate(256 256) scale(${escala}) translate(-251 -262)">
    <path d="${piedra}" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="18" stroke-linejoin="round"/>
    ${
      facetas
        ? `<path d="M172 252 L125 233 M172 252 L228 240 M172 252 L195 336" fill="none" stroke="${BORDE}" stroke-width="3" stroke-linecap="round"/>`
        : ""
    }
    <circle cx="203" cy="222" r="12" fill="${AZUL}"/>
    <g fill="none" stroke="${AZUL_CLARO}" stroke-width="24" stroke-linecap="round">
      <path d="${arco(236, 262, 60, 38)}"/>
      <path d="${arco(236, 262, 100, 40)}"/>
      <path d="${arco(236, 262, 140, 42)}"/>
    </g>
  </g>
</svg>`;
}

async function icono(nombre, lado, opciones) {
  await sharp(Buffer.from(svg(opciones)))
    .resize(lado, lado)
    .png({ compressionLevel: 9 })
    .toFile(path.join(DESTINO, nombre));
  console.log(`  ${nombre} (${lado}×${lado})`);
}

console.log("Íconos:");
await icono("icon-192.png", 192, { escala: 1.2, radio: 112 });
await icono("icon-512.png", 512, { escala: 1.2, radio: 112 });
await icono("maskable-512.png", 512, { escala: 1 });
await icono("apple-touch-icon.png", 180, { escala: 1.15 });
await icono("favicon-48.png", 48, { escala: 1.45, radio: 96, facetas: false });
