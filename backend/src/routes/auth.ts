import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { hashPassword, normalizeEmail, signToken, verifyPassword } from '../lib/auth.js';
import { badRequest, parseBody, unauthorized } from '../lib/http.js';
import { prisma } from '../lib/prisma.js';
import { currentUser, requireAuth } from '../middleware/auth.js';

export const authRouter = Router();

export const publicUserSelect = {
  id: true,
  email: true,
  nome: true,
  ruolo: true,
  artistId: true,
  artist: { select: { id: true, nomeArte: true, tipo: true } },
} as const;

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Troppi tentativi di accesso, riprova tra qualche minuto' },
});

const LoginSchema = z.object({
  email: z.string().trim().email('Email non valida'),
  password: z.string().min(1, 'Password obbligatoria'),
});

authRouter.post('/auth/login', loginLimiter, async (req, res) => {
  const { email, password } = parseBody(req, LoginSchema);

  const user = await prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw unauthorized('Email o password non corretti');
  }

  const token = signToken({ sub: user.id, ruolo: user.ruolo });
  const publicUser = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: publicUserSelect,
  });
  res.json({ token, user: publicUser });
});

authRouter.get('/auth/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: currentUser(req).id },
    select: publicUserSelect,
  });
  res.json({ user });
});

const ChangePasswordSchema = z.object({
  passwordAttuale: z.string().min(1, 'Password attuale obbligatoria'),
  nuovaPassword: z.string().min(8, 'La nuova password deve avere almeno 8 caratteri'),
});

authRouter.post('/auth/change-password', requireAuth, async (req, res) => {
  const { passwordAttuale, nuovaPassword } = parseBody(req, ChangePasswordSchema);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: currentUser(req).id } });

  if (!(await verifyPassword(passwordAttuale, user.passwordHash))) {
    throw badRequest('La password attuale non è corretta');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(nuovaPassword) },
  });
  res.status(204).end();
});
