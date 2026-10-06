import { Router } from 'express';
import { z } from 'zod';
import { conflict, param, parseBody } from '../lib/http.js';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

/** Locali in cui si svolgono le serate. */
export const venuesRouter = Router();

const VenueSchema = z.object({
  nome: z.string().trim().min(1, 'Nome del locale obbligatorio').max(150),
  indirizzo: z
    .string()
    .trim()
    .max(300)
    .nullish()
    .transform((v) => (v === '' ? null : v)),
  attivo: z.boolean().optional(),
});

// I locali servono anche agli artisti per leggere il calendario.
venuesRouter.get('/venues', requireAuth, async (_req, res) => {
  const venues = await prisma.venue.findMany({
    include: { _count: { select: { events: true } } },
    orderBy: { nome: 'asc' },
  });
  res.json({ venues });
});

venuesRouter.post('/venues', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res) => {
  const venue = await prisma.venue.create({ data: parseBody(req, VenueSchema) });
  res.status(201).json({ venue });
});

venuesRouter.patch('/venues/:id', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res) => {
  const venue = await prisma.venue.update({
    where: { id: param(req, 'id') },
    data: parseBody(req, VenueSchema.partial()),
  });
  res.json({ venue });
});

venuesRouter.delete('/venues/:id', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res) => {
  const count = await prisma.event.count({ where: { venueId: param(req, 'id') } });
  if (count > 0) {
    throw conflict(`Impossibile eliminare: il locale ha ${count} serate in calendario. Disattivalo invece.`);
  }
  await prisma.venue.delete({ where: { id: param(req, 'id') } });
  res.status(204).end();
});
