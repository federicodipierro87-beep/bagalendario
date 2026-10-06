// Etichette e colori per i valori enumerati. Nessuna logica specifica per DJ o BAND:
// il tipo di artista è sempre un dato da mostrare o filtrare.
import type { ArtistType, EventStatus, PerformanceStatus, Role } from './types';

export const ARTIST_TYPES: ArtistType[] = ['DJ', 'BAND'];
export const artistTypeLabel: Record<ArtistType, string> = { DJ: 'DJ', BAND: 'Band' };

export const ROLES: Role[] = ['ADMIN', 'STAFF', 'ARTIST'];
export const roleLabel: Record<Role, string> = { ADMIN: 'Amministratore', STAFF: 'Staff', ARTIST: 'Artista' };

// Pubblicata è la scelta predefinita e compare per prima.
export const EVENT_STATUSES: EventStatus[] = ['PUBBLICATO', 'BOZZA', 'ANNULLATO'];
export const eventStatusLabel: Record<EventStatus, string> = {
  BOZZA: 'Bozza',
  PUBBLICATO: 'Pubblicata',
  ANNULLATO: 'Annullata',
};

export const PERFORMANCE_STATUSES: PerformanceStatus[] = ['CONFERMATO', 'RIFIUTATO', 'ANNULLATO'];
export const performanceStatusLabel: Record<PerformanceStatus, string> = {
  CONFERMATO: 'Confermato',
  RIFIUTATO: 'Rifiutato',
  ANNULLATO: 'Annullato',
};

/** Colori per stato dello slot (sfondo, testo), usati in calendario e badge. */
export const performanceStatusColor: Record<PerformanceStatus, { bg: string; fg: string }> = {
  CONFERMATO: { bg: '#16a34a', fg: '#ffffff' },
  RIFIUTATO: { bg: '#dc2626', fg: '#ffffff' },
  ANNULLATO: { bg: '#6b7280', fg: '#ffffff' },
};

/** Colori per stato della serata: nel calendario colorano anche gli slot attivi della serata. */
export const eventStatusColor: Record<EventStatus, { bg: string; fg: string }> = {
  BOZZA: { bg: '#f59e0b', fg: '#1f1300' },
  PUBBLICATO: { bg: '#16a34a', fg: '#ffffff' },
  ANNULLATO: { bg: '#6b7280', fg: '#ffffff' },
};

/**
 * Nome con cui mostrare una serata: il titolo se presente, altrimenti i DJ in line-up,
 * altrimenti il locale.
 */
export function eventName(ev: {
  titolo: string | null;
  venue?: { nome: string } | null;
  performances?: { artist: { nomeArte: string } }[];
}): string {
  if (ev.titolo) return ev.titolo;
  const djs = [...new Set((ev.performances ?? []).map((p) => p.artist.nomeArte))];
  if (djs.length) return djs.join(' + ');
  return ev.venue?.nome ?? 'Serata';
}
