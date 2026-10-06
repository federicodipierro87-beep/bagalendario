-- AlterTable
ALTER TABLE "Performance" ALTER COLUMN "stato" SET DEFAULT 'CONFERMATO';


-- Gli slot inseriti dallo staff sono già confermati: niente più conferma da parte del DJ.
UPDATE "Performance" SET "stato" = 'CONFERMATO' WHERE "stato" = 'PROPOSTO';
