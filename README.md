# Bagalendario

- App: https://bagalendario.netlify.app
- API: https://bagalendario-production.up.railway.app (health: `/health`)

Calendario condiviso per gestire le serate della discoteca: artisti (DJ oggi, band domani),
locali, serate, slot e feed iCal.

## Funzionalità

- Login email/password (JWT), ruoli ADMIN / STAFF / ARTIST
- Anagrafica artisti (DJ e BAND tramite il campo `tipo`), locali, serate e slot
- Il locale si sceglie quando si registra la serata; in creazione si possono selezionare i DJ (slot divisi equamente)
- Calendario mese / settimana / lista in Europe/Rome, filtri per stato, tipo, locale e artista
- Controllo conflitti: stesso artista o stesso locale non possono avere slot attivi sovrapposti
  (controllo applicativo con dettaglio; per l'artista anche exclusion constraint PostgreSQL)
- Area artista: le proprie date (già confermate all'inserimento) in lista e in calendario
- Feed iCal per artista (`GET /ical/<token>.ics`) da aggiungere a Google/Apple Calendar

## API principali

| Metodo | Percorso | Ruoli |
|---|---|---|
| POST | `/auth/login`, GET `/auth/me`, POST `/auth/change-password` | tutti |
| CRUD | `/artists`, `/events`, `/venues` (GET anche ARTIST), `/performances` (GET anche ARTIST, solo propri) | ADMIN, STAFF |
| CRUD | `/users` | ADMIN |
| GET | `/me/artist`, POST `/me/ical-token` | ARTIST |
| GET | `/ical/:token.ics` | pubblico con token |

## Struttura

```
.railway/          Infrastruttura Railway come codice
backend/            API REST — Node.js, TypeScript, Express, Prisma, PostgreSQL (deploy: Railway)
frontend/           SPA — React, Vite, TypeScript, FullCalendar (deploy: Netlify)
.github/workflows/  CI: lint + build di backend e frontend a ogni push
netlify.toml        Configurazione Netlify (base = frontend, redirect SPA)
```

`backend` e `frontend` sono pacchetti npm indipendenti, ciascuno con il proprio `package-lock.json`.

## Deploy

Railway e Netlify fanno il deploy automatico a ogni push su `main`.
Non esiste un ambiente locale di riferimento: ogni modifica si verifica dopo il deploy.

### Backend (Railway)

La configurazione dell'infrastruttura è in `.railway/railway.ts` (Railway Infrastructure as Code):
Root Directory `/backend`, build, pre-deploy (`prisma migrate deploy`), health check `GET /health`,
variabili non segrete. I segreti (`JWT_SECRET`, `ADMIN_PASSWORD`) si impostano da dashboard o CLI.

```bash
npm install            # nella root: installa l'SDK "railway"
railway config plan    # anteprima delle modifiche
railway config apply   # applica
```

Il deploy parte solo quando la GitHub Action "CI" è verde.

| Variabile | Descrizione |
|---|---|
| `DATABASE_URL` | Connessione PostgreSQL (riferimento al servizio Postgres di Railway) |
| `JWT_SECRET` | Segreto per firmare i token JWT |
| `CORS_ORIGIN` | URL del sito Netlify (più valori separati da virgola) |
| `PORT` | Porta HTTP (impostata da Railway) |
| `PUBLIC_API_URL` | URL pubblico del backend (informativo; i link iCal sono costruiti dal frontend con `VITE_API_URL`) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NOME` | Utente ADMIN creato al primo avvio |

### Frontend (Netlify)

| Variabile | Descrizione |
|---|---|
| `VITE_API_URL` | URL pubblico del backend Railway (senza slash finale) |

Vedi `backend/.env.example` e `frontend/.env.example`.

## Sviluppo locale (opzionale)

```bash
cd backend && npm install && npm run build && npm run lint
cd frontend && npm install && npm run build && npm run lint
```

## Convenzioni

- Commit in formato Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`)
- Orari salvati in UTC, visualizzati in `Europe/Rome`; le serate possono attraversare la mezzanotte
- Il tipo di artista (`DJ` | `BAND`) è sempre un dato, mai una logica hardcoded
