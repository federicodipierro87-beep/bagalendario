import { DateTime } from 'luxon';
import { TIMEZONE } from './time';

export interface LineupSlot {
  artistId: string;
  inizio: string;
  fine: string;
}

export interface LineupValue {
  artistIds: string[];
}

const STEP_MINUTES = 15;

/**
 * Divide la serata in slot consecutivi di pari durata (arrotondati a 15 minuti),
 * uno per artista nell'ordine scelto. Gli orari si possono poi rifinire dal dettaglio serata.
 */
export function splitLineup(value: LineupValue, inizio: string | null, fine: string | null): LineupSlot[] {
  if (!inizio || !fine || value.artistIds.length === 0) return [];
  const start = DateTime.fromISO(inizio, { zone: TIMEZONE });
  const totalMinutes = DateTime.fromISO(fine, { zone: TIMEZONE }).diff(start, 'minutes').minutes;
  const n = value.artistIds.length;
  const boundary = (i: number) => {
    if (i === n) return fine;
    const minutes = Math.round((totalMinutes * i) / n / STEP_MINUTES) * STEP_MINUTES;
    return start.plus({ minutes }).toISO({ suppressMilliseconds: true })!;
  };
  return value.artistIds.map((artistId, i) => ({
    artistId,
    inizio: boundary(i),
    fine: boundary(i + 1),
  }));
}
