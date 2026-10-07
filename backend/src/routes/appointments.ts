import { Router } from 'express';
import { AppointmentType } from '@prisma/client';
import { DateTime } from 'luxon';
import { z } from 'zod';
import { TIMEZONE } from '../config.js';
import { badRequest, param, parseBody, parseQuery } from '../lib/http.js';
import { prisma } from '../lib/prisma.js';
import { MAX_DURATION_MS, zInstant } from '../lib/time.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { compensoSchema } from './performances.js';

/** Appuntamenti diversi dalle serate: matrimoni, impegni personali e medici (ADMIN/STAFF). */
export const appointmentsRouter = Router();
appointmentsRouter.use('/appointments', requireAuth, requireRole('ADMIN', 'STAFF'));

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

const AppointmentSchema = z.object({
  tipo: z.enum(AppointmentType),
  titolo: z.string().trim().min(1, 'Descrizione obbligatoria').max(200),
  inizio: zInstant,
  fine: zInstant,
  tuttoIlGiorno: z.boolean().default(false),
  luogo: optionalText(300),
  medico: optionalText(200),
  contatto: optionalText(200),
  compenso: compensoSchema,
  note: optionalText(5000),
});

type AppointmentInput = z.infer<typeof AppointmentSchema>;

/** Un appuntamento di tutto il giorno può coprire più giorni (es. ferie), fino a un anno. */
const MAX_ALL_DAY_MS = 366 * 24 * 60 * 60 * 1000;

/**
 * Normalizza l'appuntamento: gli appuntamenti di tutto il giorno vanno da mezzanotte a mezzanotte
 * (Europe/Rome) e i campi che non appartengono al tipo vengono azzerati.
 */
function normalize(input: AppointmentInput) {
  let { inizio, fine } = input;
  if (input.tuttoIlGiorno) {
    const start = DateTime.fromJSDate(inizio, { zone: TIMEZONE }).startOf('day');
    const endInstant = DateTime.fromJSDate(fine, { zone: TIMEZONE });
    let end = endInstant.startOf('day');
    if (end < endInstant) end = end.plus({ days: 1 });
    if (end <= start) end = start.plus({ days: 1 });
    inizio = start.toJSDate();
    fine = end.toJSDate();
  }
  if (fine <= inizio) throw badRequest("L'ora di fine deve essere successiva all'ora di inizio");
  const max = input.tuttoIlGiorno ? MAX_ALL_DAY_MS : MAX_DURATION_MS;
  if (fine.getTime() - inizio.getTime() > max) {
    throw badRequest(
      input.tuttoIlGiorno
        ? 'Un appuntamento non può durare più di un anno'
        : 'Un appuntamento con orario non può durare più di 24 ore',
    );
  }
  return {
    ...input,
    inizio,
    fine,
    medico: input.tipo === 'MEDICO' ? input.medico : null,
    contatto: input.tipo === 'MATRIMONIO' ? input.contatto : null,
    compenso: input.tipo === 'MATRIMONIO' ? input.compenso : null,
  };
}

const csv = <T extends z.ZodType<string, string>>(item: T) =>
  z
    .string()
    .transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean))
    .pipe(z.array(item))
    .optional();

const ListQuerySchema = z.object({
  from: zInstant.optional(),
  to: zInstant.optional(),
  tipo: csv(z.enum(AppointmentType)),
});

appointmentsRouter.get('/appointments', async (req, res) => {
  const { from, to, tipo } = parseQuery(req, ListQuerySchema);
  const appointments = await prisma.appointment.findMany({
    where: {
      tipo: tipo ? { in: tipo } : undefined,
      // Appuntamenti che intersecano l'intervallo richiesto.
      fine: from ? { gt: from } : undefined,
      inizio: to ? { lt: to } : undefined,
    },
    orderBy: { inizio: 'asc' },
  });
  res.json({ appointments });
});

appointmentsRouter.post('/appointments', async (req, res) => {
  const data = normalize(parseBody(req, AppointmentSchema));
  const appointment = await prisma.appointment.create({ data });
  res.status(201).json({ appointment });
});

// Il form invia sempre l'appuntamento completo (anche il tipo può cambiare).
appointmentsRouter.put('/appointments/:id', async (req, res) => {
  const data = normalize(parseBody(req, AppointmentSchema));
  const appointment = await prisma.appointment.update({ where: { id: param(req, 'id') }, data });
  res.json({ appointment });
});

appointmentsRouter.delete('/appointments/:id', async (req, res) => {
  await prisma.appointment.delete({ where: { id: param(req, 'id') } });
  res.status(204).end();
});
