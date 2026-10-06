import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { badRequest, forbidden, parseBody, parseQuery } from '../lib/http.js';
import { prisma } from '../lib/prisma.js';
import { dateOnlyToDate, zDateOnly } from '../lib/time.js';
import { currentUser, requireAuth } from '../middleware/auth.js';
import type { Request } from 'express';

/** Endpoint dell'area artista: agiscono sempre sul profilo artista dell'utente autenticato. */
export const meRouter = Router();
meRouter.use('/me', requireAuth);

function myArtistId(req: Request): string {
  const user = currentUser(req);
  if (!user.artistId) throw forbidden('Il tuo utente non è collegato a nessun profilo artista');
  return user.artistId;
}

meRouter.get('/me/artist', async (req, res) => {
  const artist = await prisma.artist.findUniqueOrThrow({
    where: { id: myArtistId(req) },
    include: { bandProfile: true },
  });
  res.json({ artist });
});

/** L'artista rigenera il proprio link iCal (il precedente smette di funzionare). */
meRouter.post('/me/ical-token', async (req, res) => {
  const artist = await prisma.artist.update({
    where: { id: myArtistId(req) },
    data: { icalToken: randomBytes(24).toString('base64url') },
    select: { id: true, icalToken: true },
  });
  res.json({ artist });
});

const RangeQuerySchema = z.object({
  from: zDateOnly.optional(),
  to: zDateOnly.optional(),
});

meRouter.get('/me/availability', async (req, res) => {
  const { from, to } = parseQuery(req, RangeQuerySchema);
  const availabilities = await prisma.availability.findMany({
    where: {
      artistId: myArtistId(req),
      data: { gte: from ? dateOnlyToDate(from) : undefined, lte: to ? dateOnlyToDate(to) : undefined },
    },
    orderBy: { data: 'asc' },
  });
  res.json({ availabilities });
});

const AvailabilitySchema = z.object({
  data: zDateOnly,
  disponibile: z.boolean(),
  note: z.string().trim().max(2000).nullish(),
});

/** Imposta (crea o aggiorna) la disponibilità per un giorno. */
meRouter.put('/me/availability', async (req, res) => {
  const artistId = myArtistId(req);
  const { data, disponibile, note } = parseBody(req, AvailabilitySchema);
  const day = dateOnlyToDate(data);
  const availability = await prisma.availability.upsert({
    where: { artistId_data: { artistId, data: day } },
    create: { artistId, data: day, disponibile, note },
    update: { disponibile, note },
  });
  res.json({ availability });
});

meRouter.delete('/me/availability/:data', async (req, res) => {
  const parsed = zDateOnly.safeParse(req.params.data);
  if (!parsed.success) throw badRequest('Data non valida (formato AAAA-MM-GG)');
  await prisma.availability.deleteMany({
    where: { artistId: myArtistId(req), data: dateOnlyToDate(parsed.data) },
  });
  res.status(204).end();
});
