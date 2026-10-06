-- Le "sale" diventano "locali" (Venue) e il locale si sceglie a livello di serata.
-- Migrazione conservativa: nessun dato viene eliminato.
BEGIN;

-- Room → Venue
ALTER TABLE "Room" RENAME TO "Venue";
ALTER TABLE "Venue" RENAME CONSTRAINT "Room_pkey" TO "Venue_pkey";
ALTER INDEX "Room_nome_key" RENAME TO "Venue_nome_key";
ALTER TABLE "Venue" RENAME COLUMN "attiva" TO "attivo";
ALTER TABLE "Venue" ADD COLUMN "indirizzo" TEXT;

-- Performance.roomId → venueId (copia del locale della serata).
-- Il vincolo DB di non sovrapposizione per sala viene rimosso: la sovrapposizione per locale
-- è controllata dall'applicazione (così la migrazione non può fallire su dati esistenti).
ALTER TABLE "Performance" DROP CONSTRAINT "Performance_sala_no_sovrapposizioni";
ALTER TABLE "Performance" RENAME COLUMN "roomId" TO "venueId";
ALTER TABLE "Performance" RENAME CONSTRAINT "Performance_roomId_fkey" TO "Performance_venueId_fkey";
ALTER INDEX "Performance_roomId_inizio_idx" RENAME TO "Performance_venueId_inizio_idx";

-- Event.venueId: dal primo slot della serata; altrimenti il primo locale esistente;
-- se non esiste nessun locale ne viene creato uno ("Locale principale").
ALTER TABLE "Event" ADD COLUMN "venueId" TEXT;

UPDATE "Event" e
SET "venueId" = (
  SELECT p."venueId" FROM "Performance" p WHERE p."eventId" = e."id" ORDER BY p."inizio" LIMIT 1
);

INSERT INTO "Venue" ("id", "nome", "attivo")
SELECT 'locale_principale', 'Locale principale', true
WHERE EXISTS (SELECT 1 FROM "Event" WHERE "venueId" IS NULL)
  AND NOT EXISTS (SELECT 1 FROM "Venue");

UPDATE "Event"
SET "venueId" = (SELECT "id" FROM "Venue" ORDER BY "attivo" DESC, "nome" LIMIT 1)
WHERE "venueId" IS NULL;

ALTER TABLE "Event" ALTER COLUMN "venueId" SET NOT NULL;

-- Gli slot seguono il locale della propria serata.
UPDATE "Performance" p
SET "venueId" = e."venueId"
FROM "Event" e
WHERE p."eventId" = e."id" AND p."venueId" <> e."venueId";

ALTER TABLE "Event" ADD CONSTRAINT "Event_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Event_venueId_inizio_idx" ON "Event"("venueId", "inizio");

COMMIT;
