-- Pie de página editable desde el panel. Las filas existentes quedan con {} y el
-- servidor usa el pie por defecto (src/content/footer.ts) hasta que se guarde uno.
-- AlterTable
ALTER TABLE "site_settings" ADD COLUMN     "footer" JSONB NOT NULL DEFAULT '{}';
