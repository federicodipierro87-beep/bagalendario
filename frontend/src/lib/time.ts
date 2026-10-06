// Tutte le date sono mostrate e inserite in Europe/Rome, indipendentemente dal fuso del browser.
import { DateTime } from 'luxon';

export const TIMEZONE = 'Europe/Rome';
const LOCALE = 'it-IT';

const rome = (iso: string) => DateTime.fromISO(iso, { zone: TIMEZONE }).setLocale(LOCALE);

/** "sab 3 ott 2026" */
export const formatDate = (iso: string) => rome(iso).toFormat('ccc d LLL yyyy');
/** "23:00" */
export const formatTime = (iso: string) => rome(iso).toFormat('HH:mm');
/** "sab 3 ott 2026, 23:00" */
export const formatDateTime = (iso: string) => rome(iso).toFormat('ccc d LLL yyyy, HH:mm');

/** Intervallo leggibile; se la fine è il giorno dopo lo indica ("23:00 → 05:00 (+1)"). */
export function formatRange(inizio: string, fine: string): string {
  const a = rome(inizio);
  const b = rome(fine);
  const days = b.startOf('day').diff(a.startOf('day'), 'days').days;
  return `${a.toFormat('HH:mm')} → ${b.toFormat('HH:mm')}${days > 0 ? ` (+${days})` : ''}`;
}

/** Data di una colonna @db.Date ("2026-10-03T00:00:00.000Z") → "sab 3 ott 2026". */
export const formatDateOnly = (iso: string) =>
  DateTime.fromISO(iso.slice(0, 10), { zone: TIMEZONE }).setLocale(LOCALE).toFormat('ccc d LLL yyyy');

/**
 * Combina una data (yyyy-MM-dd) e un'ora (HH:mm) in Europe/Rome in un ISO con offset.
 * Se `afterIso` è indicato e l'orario risultante non è successivo, passa al giorno dopo
 * (gestione delle serate che attraversano la mezzanotte).
 */
export function romeToIso(date: string, time: string, afterIso?: string): string {
  let dt = DateTime.fromISO(`${date}T${time}`, { zone: TIMEZONE });
  if (afterIso) {
    const after = DateTime.fromISO(afterIso, { zone: TIMEZONE });
    while (dt <= after) dt = dt.plus({ days: 1 });
  }
  return dt.toISO({ suppressMilliseconds: true })!;
}

/** ISO → { date: yyyy-MM-dd, time: HH:mm } in Europe/Rome, per popolare i form. */
export function isoToRomeParts(iso: string): { date: string; time: string } {
  const dt = rome(iso);
  return { date: dt.toFormat('yyyy-MM-dd'), time: dt.toFormat('HH:mm') };
}

export const todayRome = () => DateTime.now().setZone(TIMEZONE).toFormat('yyyy-MM-dd');
