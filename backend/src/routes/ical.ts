import { Router } from 'express';
import ical, { ICalCalendarMethod, ICalEventStatus } from 'ical-generator';
import type { PerformanceStatus } from '@prisma/client';
import { DateTime } from 'luxon';
import { rateLimit } from 'express-rate-limit';
import { TIMEZONE } from '../config.js';
import { notFound, param } from '../lib/http.js';
import { prisma } from '../lib/prisma.js';

/**
 * Feed iCal pubblico per artista, protetto dal token segreto nell'URL.
 * Da aggiungere a Google Calendar / Apple Calendar come calendario in abbonamento.
 * Orari in UTC (standard iCal): i client li mostrano nel fuso locale dell'utente.
 */
export const icalRouter = Router();

const icalLimiter = rateLimit({ windowMs: 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false });

const statusMap: Record<PerformanceStatus, ICalEventStatus> = {
  CONFERMATO: ICalEventStatus.CONFIRMED,
  RIFIUTATO: ICalEventStatus.CANCELLED,
  ANNULLATO: ICalEventStatus.CANCELLED,
};

const statusLabel: Record<PerformanceStatus, string> = {
  CONFERMATO: 'Confermato',
  RIFIUTATO: 'Rifiutato',
  ANNULLATO: 'Annullato',
};

icalRouter.get('/ical/:file', icalLimiter, async (req, res) => {
  const token = param(req, 'file').replace(/\.ics$/i, '');
  const artist = await prisma.artist.findUnique({ where: { icalToken: token } });
  if (!artist) throw notFound('Calendario non trovato');

  // Ultimi 3 mesi + tutto il futuro. Gli slot rifiutati non vengono pubblicati;
  // quelli annullati sì (come CANCELLED), così spariscono dai calendari già sincronizzati.
  const since = DateTime.now().minus({ months: 3 }).toJSDate();
  const performances = await prisma.performance.findMany({
    where: { artistId: artist.id, fine: { gte: since }, stato: { not: 'RIFIUTATO' } },
    include: { event: true, venue: true },
    orderBy: { inizio: 'asc' },
  });

  const calendar = ical({
    name: `Bagalendario — ${artist.nomeArte}`,
    description: `Date di ${artist.nomeArte}`,
    prodId: { company: 'Bagalendario', product: 'calendario', language: 'IT' },
    method: ICalCalendarMethod.PUBLISH,
    ttl: 60 * 60,
  });

  for (const p of performances) {
    const orario = `${DateTime.fromJSDate(p.inizio, { zone: TIMEZONE }).toFormat('HH:mm')}–${DateTime.fromJSDate(p.fine, { zone: TIMEZONE }).toFormat('HH:mm')}`;
    calendar.createEvent({
      id: `performance-${p.id}@bagalendario`,
      start: p.inizio,
      end: p.fine,
      stamp: p.updatedAt,
      lastModified: p.updatedAt,
      summary: `${p.venue.nome}${p.event.titolo ? ` · ${p.event.titolo}` : ''}`,
      description: [
        p.event.titolo ? `Serata: ${p.event.titolo}` : null,
        `Locale: ${p.venue.nome}`,
        `Orario: ${orario} (Europe/Rome)`,
        `Stato: ${statusLabel[p.stato]}`,
        p.note ? `Note: ${p.note}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
      location: [p.venue.nome, p.venue.indirizzo].filter(Boolean).join(', '),
      status: p.event.stato === 'ANNULLATO' ? ICalEventStatus.CANCELLED : statusMap[p.stato],
    });
  }

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `inline; filename="bagalendario-${artist.id}.ics"`);
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.send(calendar.toString());
});
