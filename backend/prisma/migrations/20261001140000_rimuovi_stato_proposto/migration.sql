-- Gli slot nascono già confermati: lo stato PROPOSTO non esiste più.
-- Per sicurezza porta a CONFERMATO eventuali slot ancora proposti.
UPDATE "Performance" SET "stato" = 'CONFERMATO' WHERE "stato" = 'PROPOSTO';

-- Il vincolo di esclusione dipende dai valori dell'enum: va tolto prima di cambiare tipo.
ALTER TABLE "Performance" DROP CONSTRAINT "Performance_artista_no_sovrapposizioni";

-- AlterEnum
BEGIN;
CREATE TYPE "PerformanceStatus_new" AS ENUM ('CONFERMATO', 'RIFIUTATO', 'ANNULLATO');
ALTER TABLE "Performance" ALTER COLUMN "stato" DROP DEFAULT;
ALTER TABLE "Performance" ALTER COLUMN "stato" TYPE "PerformanceStatus_new" USING ("stato"::text::"PerformanceStatus_new");
ALTER TYPE "PerformanceStatus" RENAME TO "PerformanceStatus_old";
ALTER TYPE "PerformanceStatus_new" RENAME TO "PerformanceStatus";
DROP TYPE "PerformanceStatus_old";
ALTER TABLE "Performance" ALTER COLUMN "stato" SET DEFAULT 'CONFERMATO';
COMMIT;

-- Uno stesso artista non può avere due slot attivi sovrapposti
ALTER TABLE "Performance" ADD CONSTRAINT "Performance_artista_no_sovrapposizioni"
  EXCLUDE USING gist ("artistId" WITH =, tsrange("inizio", "fine", '[)') WITH &&)
  WHERE ("stato" = 'CONFERMATO');
