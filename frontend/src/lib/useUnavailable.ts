import { api } from './api';
import type { Availability } from './types';
import { useAsync } from './useAsync';

/**
 * Artisti non disponibili in una data (yyyy-MM-dd): mappa artistId → motivo (o null).
 * Il backend rifiuta comunque gli slot per questi artisti; qui serve a disabilitarli nei form.
 */
export function useUnavailableOn(date: string | null): Map<string, string | null> {
  const { data } = useAsync(
    () =>
      date
        ? api
            .get<{ availabilities: Availability[] }>('/availability', { from: date, to: date })
            .then((r) => r.availabilities.filter((a) => !a.disponibile))
        : Promise.resolve([] as Availability[]),
    date ?? '',
  );
  return new Map((data ?? []).map((a) => [a.artistId, a.note]));
}
