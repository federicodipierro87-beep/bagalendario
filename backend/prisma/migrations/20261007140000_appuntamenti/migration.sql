-- CreateEnum
CREATE TYPE "AppointmentType" AS ENUM ('MATRIMONIO', 'PERSONALE', 'MEDICO');

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "tipo" "AppointmentType" NOT NULL,
    "titolo" TEXT NOT NULL,
    "inizio" TIMESTAMP(3) NOT NULL,
    "fine" TIMESTAMP(3) NOT NULL,
    "tuttoIlGiorno" BOOLEAN NOT NULL DEFAULT false,
    "luogo" TEXT,
    "medico" TEXT,
    "contatto" TEXT,
    "compenso" DECIMAL(10,2),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Appointment_inizio_idx" ON "Appointment"("inizio");

-- CreateIndex
CREATE INDEX "Appointment_tipo_inizio_idx" ON "Appointment"("tipo", "inizio");


-- Vincolo custom (non generato da Prisma): la fine segue l'inizio.
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_fine_dopo_inizio" CHECK ("fine" > "inizio");
