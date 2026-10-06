-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'STAFF', 'ARTIST');

-- CreateEnum
CREATE TYPE "ArtistType" AS ENUM ('DJ', 'BAND');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('BOZZA', 'PUBBLICATO', 'ANNULLATO');

-- CreateEnum
CREATE TYPE "PerformanceStatus" AS ENUM ('PROPOSTO', 'CONFERMATO', 'RIFIUTATO', 'ANNULLATO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ruolo" "Role" NOT NULL DEFAULT 'STAFF',
    "artistId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Artist" (
    "id" TEXT NOT NULL,
    "nomeArte" TEXT NOT NULL,
    "tipo" "ArtistType" NOT NULL DEFAULT 'DJ',
    "email" TEXT,
    "telefono" TEXT,
    "genereMusicale" TEXT,
    "note" TEXT,
    "attivo" BOOLEAN NOT NULL DEFAULT true,
    "icalToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Artist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BandProfile" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "numeroMembri" INTEGER,
    "backline" TEXT,
    "technicalRider" JSONB,

    CONSTRAINT "BandProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "attiva" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "titolo" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "inizio" TIMESTAMP(3) NOT NULL,
    "fine" TIMESTAMP(3) NOT NULL,
    "stato" "EventStatus" NOT NULL DEFAULT 'BOZZA',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Performance" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "inizio" TIMESTAMP(3) NOT NULL,
    "fine" TIMESTAMP(3) NOT NULL,
    "stato" "PerformanceStatus" NOT NULL DEFAULT 'PROPOSTO',
    "compenso" DECIMAL(10,2),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Performance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Availability" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "disponibile" BOOLEAN NOT NULL,
    "note" TEXT,

    CONSTRAINT "Availability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_artistId_key" ON "User"("artistId");

-- CreateIndex
CREATE UNIQUE INDEX "Artist_icalToken_key" ON "Artist"("icalToken");

-- CreateIndex
CREATE INDEX "Artist_tipo_attivo_idx" ON "Artist"("tipo", "attivo");

-- CreateIndex
CREATE UNIQUE INDEX "BandProfile_artistId_key" ON "BandProfile"("artistId");

-- CreateIndex
CREATE UNIQUE INDEX "Room_nome_key" ON "Room"("nome");

-- CreateIndex
CREATE INDEX "Event_data_idx" ON "Event"("data");

-- CreateIndex
CREATE INDEX "Performance_artistId_inizio_idx" ON "Performance"("artistId", "inizio");

-- CreateIndex
CREATE INDEX "Performance_roomId_inizio_idx" ON "Performance"("roomId", "inizio");

-- CreateIndex
CREATE INDEX "Performance_eventId_idx" ON "Performance"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Availability_artistId_data_key" ON "Availability"("artistId", "data");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BandProfile" ADD CONSTRAINT "BandProfile_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Performance" ADD CONSTRAINT "Performance_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Performance" ADD CONSTRAINT "Performance_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Performance" ADD CONSTRAINT "Performance_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Vincoli personalizzati (non esprimibili nello schema Prisma)
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Event" ADD CONSTRAINT "Event_fine_dopo_inizio" CHECK ("fine" > "inizio");
ALTER TABLE "Performance" ADD CONSTRAINT "Performance_fine_dopo_inizio" CHECK ("fine" > "inizio");

-- Uno stesso artista non può avere due slot attivi sovrapposti
ALTER TABLE "Performance" ADD CONSTRAINT "Performance_artista_no_sovrapposizioni"
  EXCLUDE USING gist ("artistId" WITH =, tsrange("inizio", "fine", '[)') WITH &&)
  WHERE ("stato" IN ('PROPOSTO', 'CONFERMATO'));

-- Una stessa sala non può avere due slot attivi sovrapposti
ALTER TABLE "Performance" ADD CONSTRAINT "Performance_sala_no_sovrapposizioni"
  EXCLUDE USING gist ("roomId" WITH =, tsrange("inizio", "fine", '[)') WITH &&)
  WHERE ("stato" IN ('PROPOSTO', 'CONFERMATO'));
