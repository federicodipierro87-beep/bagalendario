import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { ArtistType, Prisma } from '@prisma/client';
import { z } from 'zod';
import { badRequest, conflict, notFound, parseBody, parseQuery } from '../lib/http.js';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const artistsRouter = Router();
artistsRouter.use('/artists', requireAuth, requireRole('ADMIN', 'STAFF'));

const optionalText = z
  .string()
  .trim()
  .max(2000)
  .nullish()
  .transform((v) => (v === '' ? null : v));

const BandProfileSchema = z.object({
  numeroMembri: z.number().int().min(1).max(100).nullish(),
  backline: optionalText,
  technicalRider: z.json().nullish(),
});

const ArtistCreateSchema = z.object({
  nomeArte: z.string().trim().min(1, 'Nome d’arte obbligatorio').max(200),
  tipo: z.enum(ArtistType),
  email: z.string().trim().email('Email non valida').nullish().or(z.literal('').transform(() => null)),
  telefono: optionalText,
  genereMusicale: optionalText,
  note: optionalText,
  attivo: z.boolean().optional(), // default true (schema Prisma)
  bandProfile: BandProfileSchema.nullish(),
});

const ArtistUpdateSchema = ArtistCreateSchema.partial().extend({
  attivo: z.boolean().optional(),
});

const ListQuerySchema = z.object({
  tipo: z.enum(ArtistType).optional(),
  attivo: z.enum(['true', 'false']).optional(),
  q: z.string().trim().optional(),
});

const artistInclude = {
  bandProfile: true,
  user: { select: { id: true, email: true, nome: true } },
} satisfies Prisma.ArtistInclude;

/** Converte il JSON del technical rider nel tipo accettato da Prisma (null → DbNull). */
function toBandProfileData(bp: z.infer<typeof BandProfileSchema>) {
  return {
    numeroMembri: bp.numeroMembri ?? null,
    backline: bp.backline ?? null,
    technicalRider:
      bp.technicalRider === null || bp.technicalRider === undefined
        ? Prisma.DbNull
        : (bp.technicalRider as Prisma.InputJsonValue),
  };
}

artistsRouter.get('/artists', async (req, res) => {
  const { tipo, attivo, q } = parseQuery(req, ListQuerySchema);
  const artists = await prisma.artist.findMany({
    where: {
      tipo,
      attivo: attivo === undefined ? undefined : attivo === 'true',
      nomeArte: q ? { contains: q, mode: 'insensitive' } : undefined,
    },
    include: artistInclude,
    orderBy: { nomeArte: 'asc' },
  });
  res.json({ artists });
});

artistsRouter.get('/artists/:id', async (req, res) => {
  const artist = await prisma.artist.findUnique({ where: { id: req.params.id }, include: artistInclude });
  if (!artist) throw notFound('Artista non trovato');
  res.json({ artist });
});

artistsRouter.post('/artists', async (req, res) => {
  const { bandProfile, ...data } = parseBody(req, ArtistCreateSchema);
  if (bandProfile && data.tipo !== 'BAND') {
    throw badRequest('Il profilo band è disponibile solo per artisti di tipo BAND');
  }
  const artist = await prisma.artist.create({
    data: {
      ...data,
      bandProfile: bandProfile ? { create: toBandProfileData(bandProfile) } : undefined,
    },
    include: artistInclude,
  });
  res.status(201).json({ artist });
});

artistsRouter.patch('/artists/:id', async (req, res) => {
  const { bandProfile, ...data } = parseBody(req, ArtistUpdateSchema);
  const existing = await prisma.artist.findUnique({ where: { id: req.params.id } });
  if (!existing) throw notFound('Artista non trovato');

  const tipo = data.tipo ?? existing.tipo;
  if (bandProfile && tipo !== 'BAND') {
    throw badRequest('Il profilo band è disponibile solo per artisti di tipo BAND');
  }

  const artist = await prisma.artist.update({
    where: { id: existing.id },
    data: {
      ...data,
      bandProfile:
        bandProfile === null
          ? { delete: true }
          : bandProfile
            ? {
                upsert: {
                  create: toBandProfileData(bandProfile),
                  update: toBandProfileData(bandProfile),
                },
              }
            : undefined,
    },
    include: artistInclude,
  });
  res.json({ artist });
});

artistsRouter.delete('/artists/:id', async (req, res) => {
  const count = await prisma.performance.count({ where: { artistId: req.params.id } });
  if (count > 0) {
    throw conflict(
      `Impossibile eliminare: l'artista ha ${count} slot in calendario. Disattivalo invece di eliminarlo.`,
    );
  }
  await prisma.artist.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

/** Rigenera il token del feed iCal: il vecchio link smette di funzionare. */
artistsRouter.post('/artists/:id/ical-token', async (req, res) => {
  const artist = await prisma.artist.update({
    where: { id: req.params.id },
    data: { icalToken: randomBytes(24).toString('base64url') },
    select: { id: true, icalToken: true },
  });
  res.json({ artist });
});
