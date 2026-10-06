import { DateTime } from 'luxon';
import { api } from './api';
import { TIMEZONE } from './time';
import type { Performance } from './types';
import { useAsync } from './useAsync';

/**
 * Slot attivi (confermati) degli artisti indicati nelle serate di una data (yyyy-MM-dd).
 * Per un utente ARTIST il backend restituisce solo i suoi slot, quindi `artistIds` può essere omesso.
 */
export function useSlotsOnDate(date: string | null, artistIds?: string[]): Performance[] {
  const ids = artistIds ?? [];
  const skip = !date || (artistIds !== undefined && ids.length === 0);
  const { data } = useAsync(() => {
    if (skip) return Promise.resolve([] as Performance[]);
    // Le serate della data possono iniziare quel giorno e finire il successivo: margine di un giorno per lato.
    const day = DateTime.fromISO(date!, { zone: TIMEZONE });
    return api
      .get<{ performances: Performance[] }>('/performances', {
        from: day.minus({ days: 1 }).toISO()!,
        to: day.plus({ days: 2 }).toISO()!,
        artistId: artistIds ? ids : undefined,
        stato: ['CONFERMATO'],
      })
      .then((r) => r.performances.filter((p) => p.event.data.slice(0, 10) === date));
  }, `${date}|${ids.join(',')}`);
  return skip ? [] : (data ?? []);
}
