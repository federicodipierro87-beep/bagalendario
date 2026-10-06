# Bagalendario — regole di lavoro

- Nessun ambiente locale (niente DB/server): ogni modifica si verifica dopo il deploy
  (backend su Railway, frontend su Netlify, deploy automatico su push a `main`).
- Prima di ogni commit: `npm run lint` e `npm run build` nella cartella toccata.
- Al termine di ogni step: `git add`, `git commit` (Conventional Commits), `git push` su `main`.
- Mai segreti nel codice: variabili d'ambiente + aggiornare i `.env.example`.
- Configurazioni su Railway/Netlify/GitHub: fermarsi e dare istruzioni passo passo all'utente.
- UI in italiano, fuso orario Europe/Rome; date salvate in UTC.
- DJ e BAND si distinguono solo tramite `Artist.tipo`: niente logiche hardcoded per i DJ.
- Migrazioni Prisma senza DB: generare l'SQL con `prisma migrate diff`.
- Versioni: TypeScript 6.0 (typescript-eslint non supporta ancora TS 7), Prisma 6, ESLint 9.

## Nuove migrazioni Prisma (senza database)

1. Modifica `backend/prisma/schema.prisma`.
2. Genera l'SQL come differenza rispetto allo schema dell'ultimo commit:
   ```bash
   cd backend
   git show HEAD:backend/prisma/schema.prisma > /tmp/old.prisma
   npx prisma migrate diff --from-schema-datamodel /tmp/old.prisma \
     --to-schema-datamodel prisma/schema.prisma --script \
     > prisma/migrations/<YYYYMMDDHHMMSS>_<nome>/migration.sql
   ```
3. I vincoli custom (exclusion constraint `btree_gist` per artista, CHECK) sono solo nell'SQL: non rimuoverli.
4. Per verificare una migrazione senza DB: PGlite (`@electric-sql/pglite` + `pglite-socket`, estensione btree_gist)
   con `DATABASE_URL=...?sslmode=disable&connection_limit=1&pgbouncer=true`, poi `prisma migrate diff --from-url`.

## Modello

- Le serate hanno un Locale (`Venue`); `Performance.venueId` è una copia del locale della serata,
  mantenuta dal backend (serve per il controllo sovrapposizioni per locale).
