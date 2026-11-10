-- Motivo de la consulta del formulario de contacto. Los mensajes que ya existen
-- quedan como «otro».

-- CreateEnum
CREATE TYPE "ContactReason" AS ENUM ('SPACE', 'COLLABORATION', 'PRESS', 'RESEARCH', 'SUPPORT', 'OTHER');

-- AlterTable
ALTER TABLE "contact_messages" ADD COLUMN "reason" "ContactReason" NOT NULL DEFAULT 'OTHER';
