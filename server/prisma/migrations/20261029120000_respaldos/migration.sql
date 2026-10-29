-- Instituciones que respaldan el proyecto (financiamiento, patrocinio).
-- CreateTable
CREATE TABLE "backers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT,
    "logoId" TEXT,
    "logoAlt" TEXT,
    "order" INTEGER NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "backers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "backers_order_idx" ON "backers"("order");

-- AddForeignKey
ALTER TABLE "backers" ADD CONSTRAINT "backers_logoId_fkey" FOREIGN KEY ("logoId") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Ningún logo sin texto alternativo, como en el resto de las imágenes.
ALTER TABLE "backers" ADD CONSTRAINT "backers_logo_alt_required"
  CHECK ("logoId" IS NULL OR length(btrim(coalesce("logoAlt", ''))) > 0);

-- Supabase: la Data API no puede leer ni escribir la tabla (ver la migración inicial).
ALTER TABLE "backers" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE public.backers FROM anon, authenticated;
  END IF;
END $$;
