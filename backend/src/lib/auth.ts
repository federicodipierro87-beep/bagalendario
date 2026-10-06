import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { config } from '../config.js';

const TOKEN_TTL = '7d';
const BCRYPT_ROUNDS = 12;

export interface TokenPayload {
  sub: string;
  ruolo: Role;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.JWT_SECRET, { expiresIn: TOKEN_TTL });
}

export function verifyToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, config.JWT_SECRET);
  if (typeof decoded === 'string' || typeof decoded.sub !== 'string') {
    throw new Error('Token non valido');
  }
  return { sub: decoded.sub, ruolo: decoded.ruolo as Role };
}

export const hashPassword = (password: string) => bcrypt.hash(password, BCRYPT_ROUNDS);
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
