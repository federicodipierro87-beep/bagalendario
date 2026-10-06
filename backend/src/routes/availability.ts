import { Router } from 'express';
import { ArtistType } from '@prisma/client';
import { z } from 'zod';
import { badRequest, param, parseBody, parseQuery } from '../lib/http.js';
import { prisma } from '../lib/prisma.js';
import { dateOnlyToDate, zDateOnly } from '../lib/time.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

/** Disponibilità di tutti gli artisti: consultazione e gestione da parte dello staff (ADMIN/STAFF). */
export const availabilityRouter = Router();
availabilityRouter.use('/availability', requireAuth, requireRole('ADMIN', 'STAFF'));

const QuerySchema = z.object({
  from: zDateOnly.optional(),
  to: zDateOnly.optional(),
  artistId: z.string().optional(),
  tipo: z.enum(ArtistType).optional(),
});

availabilityRouter.get('/availability', async (req, res) => {
  const { from, to, artistId, tipo } = parseQuery(req, QuerySchema);
  const availabilities = await prisma.availability.findMany({
    where: {
      artistId,
      artist: tipo ? { tipo } : undefined,
      data: { gte: from ? dateOnlyToDate(from) : undefined, lte: to ? dateOnlyToDate(to) : undefined },
    },
    include: { artist: { select: { id: true, nomeArte: true, tipo: true } } },
    orderBy: [{ data: 'asc' }, { artist: { nomeArte: 'asc' } }],
  });
  res.json({ availabilities });
});

const SetSchema = z.object({
  artistIds: z.array(z.string().min(1)).min(1, 'Seleziona almeno un artista').max(50),
  data: zDateOnly,
  disponibile: z.boolean(),
  note: z
    .string()
    .trim()
    .max(2000)
    .nullish()
    .transform((v) => (v === '' ? null : v)),
});

/** Lo staff imposta la (in)disponibilità di uno o più artisti per un giorno. */
availabilityRouter.put('/availability', async (req, res) => {
  const { artistIds, data, disponibile, note } = parseBody(req, SetSchema);
  const day = dateOnlyToDate(data);

  const found = await prisma.artist.count({ where: { id: { in: artistIds } } });
  if (found !== new Set(artistIds).size) throw badRequest('Artista inesistente');

  const availabilities = await prisma.$transaction(
    artistIds.map((artistId) =>
      prisma.availability.upsert({
        where: { artistId_data: { artistId, data: day } },
        create: { artistId, data: day, disponibile, note },
        update: { disponibile, note },
        include: { artist: { select: { id: true, nomeArte: true, tipo: true } } },
      }),
    ),
  );
  res.json({ availabilities });
});

/** Rimuove l'indicazione di (in)disponibilità di un artista per un giorno. */
availabilityRouter.delete('/availability/:artistId/:data', async (req, res) => {
  const parsed = zDateOnly.safeParse(param(req, 'data'));
  if (!parsed.success) throw badRequest('Data non valida (formato AAAA-MM-GG)');
  await prisma.availability.deleteMany({
    where: { artistId: param(req, 'artistId'), data: dateOnlyToDate(parsed.data) },
  });
  res.status(204).end();
});
