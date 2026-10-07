import type { PerformanceStatus, Prisma } from '@prisma/client';
import { conflict } from './http.js';

/** Stati che "occupano" artista e locale: solo questi generano conflitti. */
export const ACTIVE_PERFORMANCE_STATUSES: PerformanceStatus[] = ['CONFERMATO'];

export const isActiveStatus = (stato: PerformanceStatus) => ACTIVE_PERFORMANCE_STATUSES.includes(stato);

interface SlotCandidate {
  id?: string;
  artistId: string;
  venueId: string;
  inizio: Date;
  fine: Date;
}

/**
 * Verifica che lo slot non si sovrapponga ad altri slot attivi dello stesso artista
 * o nello stesso locale. Intervalli semiaperti [inizio, fine): uno slot che finisce alle 02:00
 * non va in conflitto con uno che inizia alle 02:00.
 * Per l'artista il database ha anche un exclusion constraint equivalente come ultima difesa.
 */
export async function assertNoConflicts(tx: Prisma.TransactionClient, slot: SlotCandidate) {
  const overlapping = await tx.performance.findMany({
    where: {
      id: slot.id ? { not: slot.id } : undefined,
      stato: { in: ACTIVE_PERFORMANCE_STATUSES },
      inizio: { lt: slot.fine },
      fine: { gt: slot.inizio },
      OR: [{ artistId: slot.artistId }, { venueId: slot.venueId }],
    },
    include: {
      artist: { select: { nomeArte: true } },
      venue: { select: { nome: true } },
      event: { select: { titolo: true } },
    },
    orderBy: { inizio: 'asc' },
  });

  if (overlapping.length === 0) return;

  const conflitti = overlapping.map((p) => ({
    performanceId: p.id,
    motivo: p.artistId === slot.artistId ? 'ARTISTA' : 'LOCALE',
    artista: p.artist.nomeArte,
    locale: p.venue.nome,
    serata: p.event.titolo ?? p.venue.nome,
    inizio: p.inizio,
    fine: p.fine,
    stato: p.stato,
  }));

  const artistClash = conflitti.some((c) => c.motivo === 'ARTISTA');
  const venueClash = conflitti.some((c) => c.motivo === 'LOCALE');
  const message =
    artistClash && venueClash
      ? "L'artista e il locale sono già occupati in questo orario"
      : artistClash
        ? "L'artista ha già uno slot sovrapposto in questo orario"
        : 'Il locale ha già uno slot sovrapposto in questo orario';

  throw conflict(message, { conflitti });
}
