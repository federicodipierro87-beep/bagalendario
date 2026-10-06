import { Router } from 'express';
import { EventStatus, type Prisma } from '@prisma/client';
import { z } from 'zod';
import { ACTIVE_PERFORMANCE_STATUSES, assertNoConflicts } from '../lib/conflicts.js';
import { badRequest, notFound, param, parseBody, parseQuery } from '../lib/http.js';
import { prisma } from '../lib/prisma.js';
import { MAX_DURATION_MS, romeDateOf, zInstant } from '../lib/time.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { performanceInclude, PerformanceSchema, validateSlot } from './performances.js';

export const eventsRouter = Router();
eventsRouter.use('/events', requireAuth, requireRole('ADMIN', 'STAFF'));

const EventBaseSchema = z.object({
  // Facoltativo: nel calendario la serata è identificata dai DJ e dal locale.
  titolo: z
    .string()
    .trim()
    .max(200)
    .nullish()
    .transform((v) => (v === '' ? null : v)),
  inizio: zInstant,
  fine: zInstant,
  stato: z.enum(EventStatus).optional(), // default PUBBLICATO (schema Prisma)
  note: z.string().trim().max(5000).nullish(),
  venueId: z.string().min(1, 'Locale obbligatorio'),
});

const ListQuerySchema = z.object({
  from: zInstant.optional(),
  to: zInstant.optional(),
  stato: z.enum(EventStatus).optional(),
  venueId: z.string().optional(),
});

const venueSelect = { select: { id: true, nome: true, indirizzo: true } } as const;

/** Il locale deve esistere ed essere attivo (salvo che sia già quello della serata). */
async function assertVenueUsable(tx: Prisma.TransactionClient, venueId: string, currentVenueId?: string) {
  const venue = await tx.venue.findUnique({ where: { id: venueId } });
  if (!venue) throw badRequest('Locale inesistente');
  if (!venue.attivo && venue.id !== currentVenueId) throw badRequest(`Il locale ${venue.nome} è disattivato`);
}

function assertValidRange(inizio: Date, fine: Date) {
  if (fine <= inizio) throw badRequest("L'ora di fine deve essere successiva all'ora di inizio");
  if (fine.getTime() - inizio.getTime() > MAX_DURATION_MS) {
    throw badRequest('Una serata non può durare più di 24 ore');
  }
}

eventsRouter.get('/events', async (req, res) => {
  const { from, to, stato, venueId } = parseQuery(req, ListQuerySchema);
  const events = await prisma.event.findMany({
    where: {
      stato,
      venueId,
      // Serate che intersecano l'intervallo richiesto.
      fine: from ? { gt: from } : undefined,
      inizio: to ? { lt: to } : undefined,
    },
    include: {
      venue: venueSelect,
      _count: { select: { performances: true } },
      // Line-up (slot attivi) per identificare la serata con i nomi dei DJ.
      performances: {
        where: { stato: { in: ACTIVE_PERFORMANCE_STATUSES } },
        select: { artist: { select: { nomeArte: true } } },
        orderBy: { inizio: 'asc' },
      },
    },
    orderBy: { inizio: 'asc' },
  });
  res.json({ events });
});

eventsRouter.get('/events/:id', async (req, res) => {
  const event = await prisma.event.findUnique({
    where: { id: param(req, 'id') },
    include: {
      venue: venueSelect,
      performances: { include: performanceInclude, orderBy: { inizio: 'asc' } },
    },
  });
  if (!event) throw notFound('Serata non trovata');
  res.json({ event });
});

// In creazione si possono indicare gli slot iniziali (es. i DJ della serata): serata e slot
// vengono creati in un'unica transazione, con gli stessi controlli di coerenza e conflitto.
const EventCreateSchema = EventBaseSchema.extend({
  slots: z.array(PerformanceSchema.omit({ eventId: true })).max(50).optional(),
});

eventsRouter.post('/events', async (req, res) => {
  const { slots = [], ...data } = parseBody(req, EventCreateSchema);
  assertValidRange(data.inizio, data.fine);
  const event = await prisma.$transaction(async (tx) => {
    await assertVenueUsable(tx, data.venueId);
    const created = await tx.event.create({ data: { ...data, data: romeDateOf(data.inizio) } });
    for (const slot of slots) {
      const input = { ...slot, eventId: created.id };
      const venueId = await validateSlot(tx, input);
      await tx.performance.create({ data: { ...input, venueId } });
    }
    return created;
  });
  res.status(201).json({ event });
});

eventsRouter.patch('/events/:id', async (req, res) => {
  const patch = parseBody(req, EventBaseSchema.partial());
  const existing = await prisma.event.findUnique({ where: { id: param(req, 'id') } });
  if (!existing) throw notFound('Serata non trovata');

  const inizio = patch.inizio ?? existing.inizio;
  const fine = patch.fine ?? existing.fine;
  assertValidRange(inizio, fine);

  const event = await prisma.$transaction(async (tx) => {
    if (patch.venueId) await assertVenueUsable(tx, patch.venueId, existing.venueId);
    const updated = await tx.event.update({
      where: { id: existing.id },
      data: { ...patch, data: romeDateOf(inizio) },
    });
    // Cambio locale: gli slot seguono la serata (con controllo sovrapposizioni nel nuovo locale).
    if (patch.venueId && patch.venueId !== existing.venueId) {
      const slots = await tx.performance.findMany({ where: { eventId: existing.id } });
      for (const s of slots) {
        if (ACTIVE_PERFORMANCE_STATUSES.includes(s.stato)) {
          await assertNoConflicts(tx, { ...s, venueId: patch.venueId });
        }
      }
      await tx.performance.updateMany({ where: { eventId: existing.id }, data: { venueId: patch.venueId } });
    }
    // Annullare una serata annulla anche i suoi slot ancora attivi.
    if (patch.stato === 'ANNULLATO' && existing.stato !== 'ANNULLATO') {
      await tx.performance.updateMany({
        where: { eventId: existing.id, stato: { in: ACTIVE_PERFORMANCE_STATUSES } },
        data: { stato: 'ANNULLATO' },
      });
    }
    return updated;
  });
  res.json({ event });
});

eventsRouter.delete('/events/:id', async (req, res) => {
  await prisma.event.delete({ where: { id: param(req, 'id') } });
  res.status(204).end();
});
