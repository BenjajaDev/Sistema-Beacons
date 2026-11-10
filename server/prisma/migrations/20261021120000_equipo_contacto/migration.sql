-- Datos opcionales de cada integrante del equipo, para la card de la landing:
-- correo de contacto (público), área y formación. Las filas existentes quedan en NULL.
-- AlterTable
ALTER TABLE "team_members" ADD COLUMN     "area" TEXT,
ADD COLUMN     "education" TEXT,
ADD COLUMN     "email" TEXT;
