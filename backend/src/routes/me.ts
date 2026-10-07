import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { forbidden } from '../lib/http.js';
import { prisma } from '../lib/prisma.js';
import { currentUser, requireAuth } from '../middleware/auth.js';
import type { Request } from 'express';

/** Endpoint dell'area artista: agiscono sempre sul profilo artista dell'utente autenticato. */
export const meRouter = Router();
meRouter.use('/me', requireAuth);

function myArtistId(req: Request): string {
  const user = currentUser(req);
  if (!user.artistId) throw forbidden('Il tuo utente non è collegato a nessun profilo artista');
  return user.artistId;
}

meRouter.get('/me/artist', async (req, res) => {
  const artist = await prisma.artist.findUniqueOrThrow({
    where: { id: myArtistId(req) },
    include: { bandProfile: true },
  });
  res.json({ artist });
});

/** L'artista rigenera il proprio link iCal (il precedente smette di funzionare). */
meRouter.post('/me/ical-token', async (req, res) => {
  const artist = await prisma.artist.update({
    where: { id: myArtistId(req) },
    data: { icalToken: randomBytes(24).toString('base64url') },
    select: { id: true, icalToken: true },
  });
  res.json({ artist });
});
