-- Galería de fotos del proyecto. Cada foto lleva siempre su texto alternativo.

-- AlterEnum
ALTER TYPE "Page" ADD VALUE 'GALERIA';

-- CreateTable
CREATE TABLE "gallery_items" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "credit" TEXT,
    "mediaId" TEXT NOT NULL,
    "alt" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gallery_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gallery_items_order_idx" ON "gallery_items"("order");

-- AddForeignKey
ALTER TABLE "gallery_items" ADD CONSTRAINT "gallery_items_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Ninguna foto sin texto alternativo, como en el resto de las imágenes.
ALTER TABLE "gallery_items" ADD CONSTRAINT "gallery_items_alt_required"
  CHECK (length(btrim("alt")) > 0);

-- Supabase: la Data API no puede leer ni escribir la tabla (ver la migración inicial).
ALTER TABLE "gallery_items" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE public.gallery_items FROM anon, authenticated;
  END IF;
END $$;
