-- Repositorio de recursos abiertos: documentos que se descargan o se consultan en un
-- repositorio externo (DOI). Cada recurso tiene su archivo, su DOI o su enlace.

-- AlterEnum
ALTER TYPE "Page" ADD VALUE 'RECURSOS';

-- CreateEnum
CREATE TYPE "ResourceKind" AS ENUM ('REPORT', 'ARTICLE', 'GUIDE', 'PRESS_KIT', 'OTHER');

-- CreateTable
CREATE TABLE "resources" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "kind" "ResourceKind" NOT NULL DEFAULT 'OTHER',
    "authors" TEXT,
    "publishedOn" DATE,
    "doi" TEXT,
    "externalUrl" TEXT,
    "license" TEXT,
    "fileId" TEXT,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "resources_publishedOn_idx" ON "resources"("publishedOn");

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Un recurso sin archivo, DOI ni enlace no lleva a ninguna parte.
ALTER TABLE "resources" ADD CONSTRAINT "resources_con_acceso"
  CHECK ("fileId" IS NOT NULL OR "doi" IS NOT NULL OR "externalUrl" IS NOT NULL);

-- Supabase: la Data API no puede leer ni escribir la tabla (ver la migración inicial).
ALTER TABLE "resources" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE public.resources FROM anon, authenticated;
  END IF;
END $$;
