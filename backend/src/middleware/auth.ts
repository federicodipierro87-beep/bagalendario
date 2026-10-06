import type { Request, RequestHandler } from 'express';
import type { Role } from '@prisma/client';
import { verifyToken } from '../lib/auth.js';
import { forbidden, unauthorized } from '../lib/http.js';
import { prisma } from '../lib/prisma.js';
import type { AuthUser } from '../types/express.js';

/**
 * Verifica il JWT (header `Authorization: Bearer ...`) e carica l'utente dal database,
 * così ruolo e collegamento all'artista sono sempre aggiornati.
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw unauthorized();

  let userId: string;
  try {
    userId = verifyToken(header.slice('Bearer '.length)).sub;
  } catch {
    throw unauthorized("Sessione scaduta o non valida, effettua di nuovo l'accesso");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, nome: true, ruolo: true, artistId: true },
  });
  if (!user) throw unauthorized('Utente non più esistente');

  req.user = user;
  next();
};

/** Consente l'accesso solo ai ruoli indicati. Da usare dopo `requireAuth`. */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.ruolo)) throw forbidden();
    next();
  };
}

/** Restituisce l'utente autenticato (lancia 401 se assente). */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}
