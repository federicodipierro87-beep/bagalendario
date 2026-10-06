import type { Role } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  nome: string;
  ruolo: Role;
  artistId: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
