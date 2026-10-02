// Genera valores aleatorios para ADMIN_PATH, JWT_SECRET y CSRF_SECRET.
//
//   npm run secret

import { randomBytes } from "node:crypto";

const valor = (bytes: number) => randomBytes(bytes).toString("base64url");

console.log("# Pega estas líneas en server/.env (cada entorno con sus propios valores):");
console.log(`ADMIN_PATH=${valor(24)}`);
console.log(`JWT_SECRET=${valor(48)}`);
console.log(`CSRF_SECRET=${valor(48)}`);
