import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { config } from './config.js';
import { HttpError } from './lib/http.js';
import { artistsRouter } from './routes/artists.js';
import { authRouter } from './routes/auth.js';
import { availabilityRouter } from './routes/availability.js';
import { eventsRouter } from './routes/events.js';
import { healthRouter } from './routes/health.js';
import { icalRouter } from './routes/ical.js';
import { meRouter } from './routes/me.js';
import { performancesRouter } from './routes/performances.js';
import { usersRouter } from './routes/users.js';
import { venuesRouter } from './routes/venues.js';

/** Violazione degli exclusion constraint di non sovrapposizione (SQLSTATE 23P01). */
function isOverlapViolation(err: unknown): boolean {
  const message = err instanceof Error ? err.message : '';
  return message.includes('23P01') || message.includes('_no_sovrapposizioni');
}

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(
    cors({
      origin: config.corsOrigins,
      credentials: false,
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  app.use(healthRouter);
  app.use(icalRouter);
  app.use(authRouter);
  app.use(usersRouter);
  app.use(artistsRouter);
  app.use(venuesRouter);
  app.use(eventsRouter);
  app.use(performancesRouter);
  app.use(availabilityRouter);
  app.use(meRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Risorsa non trovata' });
  });

  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message, details: err.details });
      return;
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2025') {
        res.status(404).json({ error: 'Risorsa non trovata' });
        return;
      }
      if (err.code === 'P2002') {
        res.status(409).json({ error: 'Esiste già un elemento con questi dati', details: err.meta });
        return;
      }
      if (err.code === 'P2003') {
        res.status(409).json({ error: 'Operazione impossibile: elemento collegato ad altri dati' });
        return;
      }
    }
    if (isOverlapViolation(err)) {
      res.status(409).json({ error: "Conflitto: l'artista ha già uno slot in questo orario" });
      return;
    }
    if (err instanceof SyntaxError && 'body' in err) {
      res.status(400).json({ error: 'JSON non valido' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Errore interno del server' });
  };
  app.use(errorHandler);

  return app;
}
