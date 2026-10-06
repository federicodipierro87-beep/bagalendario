import { performanceStatusLabel } from '../lib/labels';
import { formatRange } from '../lib/time';
import type { Performance } from '../lib/types';

/** Avviso: segnando l'indisponibilità, questi slot già esistenti restano da gestire a mano. */
export function SlotsOnDateWarning({ slots, audience }: { slots: Performance[]; audience: 'staff' | 'artist' }) {
  if (slots.length === 0) return null;
  return (
    <div className="alert alert-warning">
      <strong>Attenzione:</strong> {slots.length === 1 ? 'c\'è già uno slot' : `ci sono già ${slots.length} slot`} in
      questa data.
      <ul className="conflicts">
        {slots.map((p) => (
          <li key={p.id}>
            {audience === 'staff' && `${p.artist.nomeArte} · `}
            {p.venue.nome} · {formatRange(p.inizio, p.fine)} ({performanceStatusLabel[p.stato].toLowerCase()})
          </li>
        ))}
      </ul>
      {audience === 'staff'
        ? 'Puoi salvare comunque l\x27indisponibilità: lo slot non viene modificato, ricordati di annullarlo o riassegnarlo.'
        : 'Puoi salvare comunque l\x27indisponibilità: la data resta in programma, avvisa lo staff.'}
    </div>
  );
}
