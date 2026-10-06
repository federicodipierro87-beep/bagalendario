import { useMemo, useState, type FormEvent } from 'react';
import { DateTime } from 'luxon';
import { api, ApiError, errorMessage } from '../lib/api';
import { artistTypeLabel, PERFORMANCE_STATUSES, performanceStatusLabel } from '../lib/labels';
import { formatDateOnly, formatRange, isoToRomeParts, TIMEZONE } from '../lib/time';
import type { Artist, Availability, EventItem, Performance, PerformanceStatus, VenueSummary } from '../lib/types';
import { useAsync } from '../lib/useAsync';
import { useUnavailableOn } from '../lib/useUnavailable';

interface Props {
  event: Pick<EventItem, 'id' | 'titolo' | 'inizio' | 'fine' | 'data'>;
  venue?: VenueSummary;
  slot?: Performance;
  onSaved: () => void;
  onCancel: () => void;
}

interface Conflict {
  motivo: 'ARTISTA' | 'LOCALE';
  artista: string;
  locale: string;
  serata: string;
  inizio: string;
  fine: string;
}

/**
 * Primo istante con l'orario indicato (Europe/Rome) a partire da `fromIso`.
 * Permette di inserire gli slot con i soli orari: "02:00" in una serata 23:00–05:00 cade il giorno dopo.
 */
function nextOccurrence(fromIso: string, time: string, strictlyAfter = false): string {
  const from = DateTime.fromISO(fromIso, { zone: TIMEZONE });
  const [h, m] = time.split(':').map(Number);
  let dt = from.set({ hour: h, minute: m, second: 0, millisecond: 0 });
  while (strictlyAfter ? dt <= from : dt < from) dt = dt.plus({ days: 1 });
  return dt.toISO({ suppressMilliseconds: true })!;
}

export function SlotForm({ event, venue, slot, onSaved, onCancel }: Props) {
  const lists = useAsync(() =>
    api.get<{ artists: Artist[] }>('/artists', { attivo: 'true' }).then((r) => ({ artists: r.artists })),
  );

  const [artistId, setArtistId] = useState(slot?.artistId ?? '');
  const [oraInizio, setOraInizio] = useState(isoToRomeParts(slot?.inizio ?? event.inizio).time);
  const [oraFine, setOraFine] = useState(isoToRomeParts(slot?.fine ?? event.fine).time);
  const [stato, setStato] = useState<PerformanceStatus>(slot?.stato ?? 'CONFERMATO');
  const [compenso, setCompenso] = useState(slot?.compenso ?? '');
  const [note, setNote] = useState(slot?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [busy, setBusy] = useState(false);

  const inizio = oraInizio ? nextOccurrence(event.inizio, oraInizio) : null;
  const fine = inizio && oraFine ? nextOccurrence(inizio, oraFine, true) : null;

  // Disponibilità dichiarata dall'artista per la data della serata.
  const eventDay = event.data.slice(0, 10);
  const unavailable = useUnavailableOn(eventDay);
  const availability = useAsync(
    () =>
      artistId
        ? api
            .get<{ availabilities: Availability[] }>('/availability', { artistId, from: eventDay, to: eventDay })
            .then((r) => r.availabilities[0] ?? null)
        : Promise.resolve(null),
    `${artistId}|${eventDay}`,
  );

  const artists = useMemo(() => {
    const list = lists.data?.artists ?? [];
    // Mantiene nella lista l'artista dello slot anche se nel frattempo è stato disattivato.
    if (slot && !list.some((a) => a.id === slot.artistId)) {
      return [...list, { ...slot.artist, attivo: false } as Artist];
    }
    return list;
  }, [lists.data, slot]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!inizio || !fine) return;
    setBusy(true);
    setError(null);
    setConflicts([]);
    try {
      const body = {
        eventId: event.id,
        artistId,
        inizio,
        fine,
        stato,
        compenso: compenso === '' ? null : compenso,
        note: note || null,
      };
      if (slot) await api.patch(`/performances/${slot.id}`, body);
      else await api.post('/performances', body);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      if (err instanceof ApiError && err.status === 409) {
        const details = err.details as { conflitti?: Conflict[] } | undefined;
        setConflicts(details?.conflitti ?? []);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      <div className="hint">
        {[event.titolo, (venue ?? slot?.venue)?.nome].filter(Boolean).join(' · ')} · {formatDateOnly(event.data)} ·{' '}
        {formatRange(event.inizio, event.fine)}
      </div>
      {lists.error && <div className="alert alert-error">{lists.error}</div>}
      <div className="form-row">
        <label>
          Artista
          <select value={artistId} onChange={(e) => setArtistId(e.target.value)} required>
            <option value="">— Seleziona —</option>
            {artists.map((a) => (
              <option key={a.id} value={a.id} disabled={unavailable.has(a.id) && a.id !== slot?.artistId}>
                {a.nomeArte} ({artistTypeLabel[a.tipo]})
                {unavailable.has(a.id) ? ' — non disponibile' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>
      {availability.data && (
        <div className={`alert ${availability.data.disponibile ? 'alert-ok' : 'alert-error'}`}>
          {availability.data.disponibile ? 'Disponibile' : 'Non disponibile'} in questa data secondo l'artista
          {availability.data.note ? ` — ${availability.data.note}` : ''}
        </div>
      )}
      <div className="form-row-2">
        <label>
          Inizio
          <input type="time" value={oraInizio} onChange={(e) => setOraInizio(e.target.value)} required />
        </label>
        <label>
          Fine
          <input type="time" value={oraFine} onChange={(e) => setOraFine(e.target.value)} required />
        </label>
      </div>
      <div className="form-row-2">
        <label>
          Stato
          <select value={stato} onChange={(e) => setStato(e.target.value as PerformanceStatus)}>
            {PERFORMANCE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {performanceStatusLabel[s]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Compenso (€)
          <input inputMode="decimal" value={compenso} onChange={(e) => setCompenso(e.target.value)} placeholder="facoltativo" />
        </label>
      </div>
      {inizio && fine && <div className="hint">Slot: {formatRange(inizio, fine)}</div>}
      <label>
        Note
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {error && (
        <div className="alert alert-error">
          {error}
          {conflicts.length > 0 && (
            <ul className="conflicts">
              {conflicts.map((c, i) => (
                <li key={i}>
                  {c.motivo === 'ARTISTA' ? 'Artista' : 'Locale'} occupato: {c.artista} a {c.locale} — {c.serata},{' '}
                  {formatRange(c.inizio, c.fine)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Annulla
        </button>
        <button className="btn btn-primary" disabled={busy || lists.loading}>
          {slot ? 'Salva slot' : 'Aggiungi slot'}
        </button>
      </div>
    </form>
  );
}
