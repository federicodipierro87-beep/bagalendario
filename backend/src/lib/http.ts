import type { Request } from 'express';
import { z } from 'zod';

/** Errore applicativo con status HTTP e messaggio (in italiano) destinato al client. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, details?: unknown) => new HttpError(400, message, details);
export const unauthorized = (message = 'Autenticazione richiesta') => new HttpError(401, message);
export const forbidden = (message = 'Operazione non consentita') => new HttpError(403, message);
export const notFound = (message = 'Risorsa non trovata') => new HttpError(404, message);
export const conflict = (message: string, details?: unknown) => new HttpError(409, message, details);

/** Valida `req.body` con uno schema zod; in caso di errore lancia un 400 con i dettagli. */
export function parseBody<S extends z.ZodType>(req: Request, schema: S): z.output<S> {
  return parseWith(schema, req.body ?? {}, 'Dati non validi');
}

/** Valida `req.query` con uno schema zod. */
export function parseQuery<S extends z.ZodType>(req: Request, schema: S): z.output<S> {
  return parseWith(schema, req.query, 'Parametri non validi');
}

function parseWith<S extends z.ZodType>(schema: S, data: unknown, message: string): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw badRequest(
      message,
      result.error.issues.map((i) => ({ campo: i.path.join('.'), messaggio: i.message })),
    );
  }
  return result.data;
}

/** Legge un parametro di percorso come stringa (Express 5 lo tipizza come string | string[]). */
export function param(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== 'string' || value === '') throw badRequest(`Parametro "${name}" mancante`);
  return value;
}
