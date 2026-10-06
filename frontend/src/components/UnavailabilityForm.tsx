import { useState, type FormEvent } from 'react';
import { api, errorMessage } from '../lib/api';
import { artistTypeLabel } from '../lib/labels';
import { formatDateOnly, todayRome } from '../lib/time';
import type { Artist } from '../lib/types';
import { useAsync } from '../lib/useAsync';
import { useSlotsOnDate } from '../lib/useSlotsOnDate';
import { SlotsOnDateWarning } from './SlotsOnDateWarning';

interface Props {
  defaultDate?: string;
  onSaved: () => void;
  onCancel: () => void;
}

/** Lo staff segna uno o più DJ come non disponibili in una data (compaiono in rosso nel calendario). */
export function UnavailabilityForm({ defaultDate, onSaved, onCancel }: Props) {
  const { data: artists, error: loadError } = useAsync(() =>
    api.get<{ artists: Artist[] }>('/artists', { attivo: 'true' }).then((r) => r.artists),
  );
  const [data, setData] = useState(defaultDate ?? todayRome());
  const [artistIds, setArtistIds] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const existingSlots = useSlotsOnDate(data || null, artistIds);
  const byId = new Map((artists ?? []).map((a) => [a.id, a]));
  const available = (artists ?? []).filter((a) => !artistIds.includes(a.id));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (artistIds.length === 0) {
      setError('Seleziona almeno un DJ');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.put('/availability', { artistIds, data, disponibile: false, note: note.trim() || null });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      <label>
        Data
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
      </label>
      <label>
        DJ non disponibili
        <select value="" onChange={(e) => e.target.value && setArtistIds([...artistIds, e.target.value])}>
          <option value="">{available.length ? '+ Aggiungi un DJ…' : 'Nessun altro DJ da aggiungere'}</option>
          {available.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nomeArte}
              {a.tipo !== 'DJ' ? ` (${artistTypeLabel[a.tipo]})` : ''}
            </option>
          ))}
        </select>
      </label>
      {loadError && <div className="alert alert-error">{loadError}</div>}
      {artistIds.length > 0 && (
        <div className="chips-list">
          {artistIds.map((id) => (
            <span key={id} className="chip chip-unavailable">
              {byId.get(id)?.nomeArte ?? '…'}
              <button type="button" aria-label="Rimuovi" onClick={() => setArtistIds(artistIds.filter((x) => x !== id))}>
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      <label>
        Motivo (facoltativo)
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="es. altra data, ferie…" />
      </label>
      {data && artistIds.length > 0 && (
        <div className="hint">
          {artistIds.length === 1 ? 'Il DJ comparirà' : 'I DJ compariranno'} in rosso nel calendario il{' '}
          {formatDateOnly(data)}.
        </div>
      )}
      <SlotsOnDateWarning slots={existingSlots} audience="staff" />
      {error && <div className="alert alert-error">{error}</div>}
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Annulla
        </button>
        <button className="btn btn-danger" disabled={busy}>
          Segna non disponibile
        </button>
      </div>
    </form>
  );
}
