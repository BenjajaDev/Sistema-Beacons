// Genera valores aleatorios para ADMIN_PATH, JWT_SECRET, CSRF_SECRET y
// EDGE_PROXY_SECRET.
//
//   npm run secret

import { randomBytes } from "node:crypto";

const valor = (bytes: number) => randomBytes(bytes).toString("base64url");

console.log("# Pega estas líneas en server/.env (cada entorno con sus propios valores):");
console.log(`ADMIN_PATH=${valor(24)}`);
console.log(`JWT_SECRET=${valor(48)}`);
console.log(`CSRF_SECRET=${valor(48)}`);
console.log(
  "# Solo detrás de Cloudflare Pages: el mismo valor va en la Function (ver docs/cloudflare-pages.md).",
);
console.log(`EDGE_PROXY_SECRET=${valor(48)}`);
