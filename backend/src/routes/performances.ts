import { Router } from 'express';
import { ArtistType, PerformanceStatus, type Prisma } from '@prisma/client';
import { z } from 'zod';
import { assertNoConflicts, isActiveStatus } from '../lib/conflicts.js';
import { badRequest, forbidden, notFound, param, parseBody, parseQuery } from '../lib/http.js';
import { prisma } from '../lib/prisma.js';
import { MAX_DURATION_MS, zInstant } from '../lib/time.js';
import { currentUser, requireAuth, requireRole } from '../middleware/auth.js';

export const performancesRouter = Router();

export const performanceInclude = {
  artist: { select: { id: true, nomeArte: true, tipo: true, genereMusicale: true } },
  venue: { select: { id: true, nome: true, indirizzo: true } },
  event: { select: { id: true, titolo: true, stato: true, inizio: true, fine: true, data: true, venueId: true } },
} satisfies Prisma.PerformanceInclude;

export const compensoSchema = z
  .union([z.number(), z.string().trim().regex(/^\d+([.,]\d{1,2})?$/, 'Compenso non valido')])
  .transform((v) => (typeof v === 'number' ? v.toFixed(2) : v.replace(',', '.')))
  .nullish();

export const PerformanceSchema = z.object({
  eventId: z.string().min(1, 'Serata obbligatoria'),
  artistId: z.string().min(1, 'Artista obbligatorio'),
  inizio: zInstant,
  fine: zInstant,
  stato: z.enum(PerformanceStatus).optional(), // default CONFERMATO (schema Prisma)
  compenso: compensoSchema,
  note: z.string().trim().max(5000).nullish(),
});

const csv = <T extends z.ZodType<string, string>>(item: T) =>
  z
    .string()
    .transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean))
    .pipe(z.array(item))
    .optional();

const ListQuerySchema = z.object({
  from: zInstant.optional(),
  to: zInstant.optional(),
  eventId: z.string().optional(),
  artistId: csv(z.string()),
  venueId: csv(z.string()),
  stato: csv(z.enum(PerformanceStatus)),
  tipo: csv(z.enum(ArtistType)),
});

/**
 * Elenco slot per il calendario. Gli ARTIST vedono solo i propri slot, qualunque filtro passino.
 */
performancesRouter.get('/performances', requireAuth, async (req, res) => {
  const user = currentUser(req);
  const q = parseQuery(req, ListQuerySchema);

  let artistFilter: Prisma.StringFilter | undefined = q.artistId ? { in: q.artistId } : undefined;
  if (user.ruolo === 'ARTIST') {
    if (!user.artistId) throw forbidden('Il tuo utente non è collegato a nessun profilo artista');
    artistFilter = { equals: user.artistId };
  }

  const performances = await prisma.performance.findMany({
    where: {
      eventId: q.eventId,
      artistId: artistFilter,
      venueId: q.venueId ? { in: q.venueId } : undefined,
      stato: q.stato ? { in: q.stato } : undefined,
      artist: q.tipo ? { tipo: { in: q.tipo } } : undefined,
      fine: q.from ? { gt: q.from } : undefined,
      inizio: q.to ? { lt: q.to } : undefined,
    },
    include: performanceInclude,
    orderBy: { inizio: 'asc' },
  });
  res.json({ performances });
});

export type PerformanceInput = z.infer<typeof PerformanceSchema>;

/**
 * Controlli di coerenza con serata e artista + conflitti, dentro la transazione.
 * Restituisce il locale della serata, da salvare sullo slot.
 */
export async function validateSlot(tx: Prisma.TransactionClient, slot: PerformanceInput, id?: string): Promise<string> {
  if (slot.fine <= slot.inizio) throw badRequest("L'ora di fine deve essere successiva all'ora di inizio");
  if (slot.fine.getTime() - slot.inizio.getTime() > MAX_DURATION_MS) {
    throw badRequest('Uno slot non può durare più di 24 ore');
  }

  const [event, artist] = await Promise.all([
    tx.event.findUnique({ where: { id: slot.eventId }, include: { venue: true } }),
    tx.artist.findUnique({ where: { id: slot.artistId } }),
  ]);
  if (!event) throw badRequest('Serata inesistente');
  if (!artist) throw badRequest('Artista inesistente');

  if (slot.inizio < event.inizio || slot.fine > event.fine) {
    throw badRequest("Lo slot deve essere compreso nell'orario della serata");
  }

  if (isActiveStatus(slot.stato ?? 'CONFERMATO')) {
    if (!artist.attivo) throw badRequest(`${artist.nomeArte} è disattivato`);
    if (event.stato === 'ANNULLATO') throw badRequest('La serata è annullata');
    await assertNoConflicts(tx, { id, ...slot, venueId: event.venueId });
  }
  return event.venueId;
}

performancesRouter.post('/performances', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res) => {
  const data = parseBody(req, PerformanceSchema);
  const performance = await prisma.$transaction(async (tx) => {
    const venueId = await validateSlot(tx, data);
    return tx.performance.create({ data: { ...data, venueId }, include: performanceInclude });
  });
  res.status(201).json({ performance });
});

performancesRouter.patch('/performances/:id', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res) => {
  const patch = parseBody(req, PerformanceSchema.partial());
  const performance = await prisma.$transaction(async (tx) => {
    const existing = await tx.performance.findUnique({ where: { id: param(req, 'id') } });
    if (!existing) throw notFound('Slot non trovato');

    const merged: PerformanceInput = {
      eventId: patch.eventId ?? existing.eventId,
      artistId: patch.artistId ?? existing.artistId,
      inizio: patch.inizio ?? existing.inizio,
      fine: patch.fine ?? existing.fine,
      stato: patch.stato ?? existing.stato,
      compenso: patch.compenso === undefined ? existing.compenso?.toString() : patch.compenso,
      note: patch.note === undefined ? existing.note : patch.note,
    };
    const venueId = await validateSlot(tx, merged, existing.id);
    return tx.performance.update({
      where: { id: existing.id },
      data: { ...patch, venueId },
      include: performanceInclude,
    });
  });
  res.json({ performance });
});

performancesRouter.delete('/performances/:id', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res) => {
  await prisma.performance.delete({ where: { id: param(req, 'id') } });
  res.status(204).end();
});
