-- Suscripciones al boletín, con el consentimiento y la baja de cada persona.

-- CreateTable
CREATE TABLE "subscribers" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "consentText" TEXT NOT NULL,
    "unsubscribedAt" TIMESTAMP(3),
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscribers_email_key" ON "subscribers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "subscribers_token_key" ON "subscribers"("token");

-- CreateIndex
CREATE INDEX "subscribers_createdAt_idx" ON "subscribers"("createdAt");

-- El correo se guarda siempre en minúsculas: dos formas de escribirlo no son dos personas.
ALTER TABLE "subscribers" ADD CONSTRAINT "subscribers_email_lower"
  CHECK ("email" = lower("email"));

-- Supabase: la Data API no puede leer ni escribir la tabla (ver la migración inicial).
-- Son datos personales: nunca deben quedar expuestos fuera del servidor.
ALTER TABLE "subscribers" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE public.subscribers FROM anon, authenticated;
  END IF;
END $$;
