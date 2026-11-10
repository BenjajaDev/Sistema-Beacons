-- Configuración del audiodescriptor del sitio: idioma, voz preferida y velocidad.
-- {} = valores por defecto (ver src/content/voice.ts).
-- AlterTable
ALTER TABLE "site_settings" ADD COLUMN     "voice" JSONB NOT NULL DEFAULT '{}';
