import { DateTime } from 'luxon';
import { z } from 'zod';
import { TIMEZONE } from '../config.js';

/**
 * Data "di calendario" in Europe/Rome dell'istante indicato, rappresentata come
 * mezzanotte UTC (formato usato dalle colonne `@db.Date`).
 * Esempio: 2026-10-03T21:00:00Z (23:00 a Roma) → 2026-10-03.
 */
export function romeDateOf(instant: Date): Date {
  const isoDate = DateTime.fromJSDate(instant, { zone: TIMEZONE }).toISODate();
  return dateOnlyToDate(isoDate!);
}

/** "YYYY-MM-DD" → Date a mezzanotte UTC (per le colonne `@db.Date`). */
export function dateOnlyToDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

/** Date di una colonna `@db.Date` → "YYYY-MM-DD". */
export function dateToDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Istante ISO 8601 con fuso (es. "2026-10-03T23:00:00+02:00" o "...Z") → Date. */
export const zInstant = z.iso
  .datetime({ offset: true, error: 'Data/ora non valida (formato ISO 8601 con fuso orario)' })
  .transform((s) => new Date(s));

/** Data "YYYY-MM-DD". */
export const zDateOnly = z.iso.date({ error: 'Data non valida (formato AAAA-MM-GG)' });

/** Durata massima di una serata o di uno slot. */
export const MAX_DURATION_MS = 24 * 60 * 60 * 1000;
