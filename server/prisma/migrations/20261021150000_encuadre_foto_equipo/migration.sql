-- Encuadre de la foto de cada integrante: punto de enfoque (x, y en %) y zoom.
-- No recorta el archivo: la landing lo aplica con object-position y escala.
-- NULL = centrada y sin zoom.
-- AlterTable
ALTER TABLE "team_members" ADD COLUMN     "photoFrame" JSONB;
