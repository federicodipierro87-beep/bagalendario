import { Router } from 'express';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { hashPassword, normalizeEmail } from '../lib/auth.js';
import { badRequest, notFound, parseBody } from '../lib/http.js';
import { prisma } from '../lib/prisma.js';
import { currentUser, requireAuth, requireRole } from '../middleware/auth.js';
import { publicUserSelect } from './auth.js';

/** Gestione utenti: solo ADMIN. */
export const usersRouter = Router();
usersRouter.use('/users', requireAuth, requireRole('ADMIN'));

const UserCreateSchema = z.object({
  email: z.string().trim().email('Email non valida'),
  nome: z.string().trim().min(1, 'Nome obbligatorio').max(200),
  ruolo: z.enum(Role),
  password: z.string().min(8, 'La password deve avere almeno 8 caratteri'),
  artistId: z.string().nullish(),
});

const UserUpdateSchema = UserCreateSchema.partial();

/** Un utente ARTIST deve essere collegato a un artista; gli altri ruoli possono non esserlo. */
async function checkArtistLink(ruolo: Role, artistId: string | null | undefined) {
  if (ruolo === 'ARTIST' && !artistId) {
    throw badRequest('Un utente ARTIST deve essere collegato a un profilo artista');
  }
  if (artistId && !(await prisma.artist.findUnique({ where: { id: artistId } }))) {
    throw badRequest('Artista inesistente');
  }
}

usersRouter.get('/users', async (_req, res) => {
  const users = await prisma.user.findMany({ select: publicUserSelect, orderBy: { nome: 'asc' } });
  res.json({ users });
});

usersRouter.post('/users', async (req, res) => {
  const { password, email, artistId, ...data } = parseBody(req, UserCreateSchema);
  await checkArtistLink(data.ruolo, artistId);
  const user = await prisma.user.create({
    data: {
      ...data,
      email: normalizeEmail(email),
      artistId: artistId ?? null,
      passwordHash: await hashPassword(password),
    },
    select: publicUserSelect,
  });
  res.status(201).json({ user });
});

usersRouter.patch('/users/:id', async (req, res) => {
  const { password, email, ...data } = parseBody(req, UserUpdateSchema);
  const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!existing) throw notFound('Utente non trovato');

  const ruolo = data.ruolo ?? existing.ruolo;
  const artistId = data.artistId === undefined ? existing.artistId : data.artistId;
  await checkArtistLink(ruolo, artistId);

  if (existing.id === currentUser(req).id && ruolo !== 'ADMIN') {
    throw badRequest('Non puoi rimuovere il ruolo ADMIN al tuo stesso utente');
  }

  const user = await prisma.user.update({
    where: { id: existing.id },
    data: {
      ...data,
      email: email ? normalizeEmail(email) : undefined,
      passwordHash: password ? await hashPassword(password) : undefined,
    },
    select: publicUserSelect,
  });
  res.json({ user });
});

usersRouter.delete('/users/:id', async (req, res) => {
  if (req.params.id === currentUser(req).id) throw badRequest('Non puoi eliminare il tuo stesso utente');
  await prisma.user.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
