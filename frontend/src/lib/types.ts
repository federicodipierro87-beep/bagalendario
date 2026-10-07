// Tipi condivisi con le risposte dell'API backend.

export type Role = 'ADMIN' | 'STAFF' | 'ARTIST';
export type ArtistType = 'DJ' | 'BAND';
export type EventStatus = 'BOZZA' | 'PUBBLICATO' | 'ANNULLATO';
export type PerformanceStatus = 'CONFERMATO' | 'RIFIUTATO' | 'ANNULLATO';
export type AppointmentType = 'MATRIMONIO' | 'PERSONALE' | 'MEDICO';

export interface ArtistSummary {
  id: string;
  nomeArte: string;
  tipo: ArtistType;
}

export interface User {
  id: string;
  email: string;
  nome: string;
  ruolo: Role;
  artistId: string | null;
  artist: ArtistSummary | null;
}

export interface BandProfile {
  id: string;
  numeroMembri: number | null;
  backline: string | null;
  technicalRider: unknown;
}

export interface Artist extends ArtistSummary {
  email: string | null;
  telefono: string | null;
  genereMusicale: string | null;
  note: string | null;
  attivo: boolean;
  icalToken: string;
  createdAt: string;
  bandProfile: BandProfile | null;
  user: { id: string; email: string; nome: string } | null;
}

export interface Venue {
  id: string;
  nome: string;
  indirizzo: string | null;
  attivo: boolean;
  _count?: { events: number };
}

export type VenueSummary = Pick<Venue, 'id' | 'nome' | 'indirizzo'>;

export interface EventItem {
  id: string;
  titolo: string | null;
  data: string;
  inizio: string;
  fine: string;
  stato: EventStatus;
  note: string | null;
  venueId: string;
  venue?: VenueSummary;
  _count?: { performances: number };
  performances?: Performance[];
}

export interface Performance {
  id: string;
  eventId: string;
  artistId: string;
  venueId: string;
  inizio: string;
  fine: string;
  stato: PerformanceStatus;
  compenso: string | null;
  note: string | null;
  artist: ArtistSummary & { genereMusicale: string | null };
  venue: VenueSummary;
  event: Pick<EventItem, 'id' | 'titolo' | 'stato' | 'inizio' | 'fine' | 'data' | 'venueId'>;
}

/** Appuntamento diverso da una serata. I campi non pertinenti al tipo sono null. */
export interface Appointment {
  id: string;
  tipo: AppointmentType;
  titolo: string;
  inizio: string;
  /** Per gli appuntamenti di tutto il giorno: mezzanotte del giorno dopo l'ultimo giorno. */
  fine: string;
  tuttoIlGiorno: boolean;
  luogo: string | null;
  medico: string | null;
  contatto: string | null;
  compenso: string | null;
  note: string | null;
}
