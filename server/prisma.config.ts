import { defineConfig } from "prisma/config";

// Prisma 7 no lee el .env por su cuenta. Se carga aquí con la API nativa de Node
// para que `prisma migrate` use las mismas variables que el servidor.
try {
  process.loadEnvFile(".env");
} catch {
  // Sin .env (CI o producción): las variables vienen del entorno.
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // Las migraciones necesitan una conexión directa. En Supabase, DATABASE_URL apunta
  // al pooler en modo transacción (puerto 6543), que no sirve para migrar; por eso
  // se usa DIRECT_URL cuando existe.
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL,
  },
});
