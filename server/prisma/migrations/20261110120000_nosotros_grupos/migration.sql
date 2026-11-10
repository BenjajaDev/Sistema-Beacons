-- Grupos del equipo (equipo, comité consultivo, estudiantes), filiación de cada
-- persona y tipo de cada organización colaboradora. Todo lo existente queda en el
-- grupo «equipo» y como colaborador de tipo «otro».

-- CreateEnum
CREATE TYPE "TeamCategory" AS ENUM ('CORE', 'ADVISORY', 'STUDENTS');

-- CreateEnum
CREATE TYPE "CollaboratorType" AS ENUM ('ACADEMIC', 'CIVIL_SOCIETY', 'PUBLIC_SECTOR', 'COMPANY', 'OTHER');

-- AlterTable
ALTER TABLE "team_members" ADD COLUMN "affiliation" TEXT,
ADD COLUMN "category" "TeamCategory" NOT NULL DEFAULT 'CORE';

-- AlterTable
ALTER TABLE "collaborators" ADD COLUMN "type" "CollaboratorType" NOT NULL DEFAULT 'OTHER';
