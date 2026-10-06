import { api } from '../lib/api';
import { artistTypeLabel } from '../lib/labels';
import { splitLineup, type LineupValue } from '../lib/lineup';
import { formatRange } from '../lib/time';
import type { Artist } from '../lib/types';
import { useAsync } from '../lib/useAsync';
import { useUnavailableOn } from '../lib/useUnavailable';

interface Props {
  value: LineupValue;
  onChange: (value: LineupValue) => void;
  inizio: string | null;
  fine: string | null;
  /** Data della serata (yyyy-MM-dd): i DJ non disponibili non sono selezionabili. */
  date: string | null;
}

/** Selezione degli artisti registrati (attivi) da inserire nella serata, con anteprima degli slot. */
export function LineupPicker({ value, onChange, inizio, fine, date }: Props) {
  const unavailable = useUnavailableOn(date);
  const { data, error } = useAsync(() =>
    api.get<{ artists: Artist[] }>('/artists', { attivo: 'true' }).then((r) => ({ artists: r.artists })),
  );

  const byId = new Map((data?.artists ?? []).map((a) => [a.id, a]));
  const available = (data?.artists ?? []).filter((a) => !value.artistIds.includes(a.id));
  const preview = splitLineup(value, inizio, fine);

  const add = (id: string) => id && onChange({ ...value, artistIds: [...value.artistIds, id] });
  const remove = (id: string) => onChange({ ...value, artistIds: value.artistIds.filter((x) => x !== id) });
  const move = (index: number, delta: number) => {
    const ids = [...value.artistIds];
    const [item] = ids.splice(index, 1);
    ids.splice(index + delta, 0, item);
    onChange({ ...value, artistIds: ids });
  };

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!data) return <div className="muted small">Caricamento DJ…</div>;

  return (
    <div className="lineup">
      <label>
        DJ della serata
        <select value="" onChange={(e) => add(e.target.value)} disabled={available.length === 0}>
          <option value="">
            {data.artists.length === 0
              ? 'Nessun DJ registrato: aggiungili dalla pagina Artisti'
              : available.length === 0
                ? 'Tutti i DJ sono già selezionati'
                : '+ Aggiungi un DJ…'}
          </option>
          {available.map((a) => (
            <option key={a.id} value={a.id} disabled={unavailable.has(a.id)}>
              {a.nomeArte}
              {a.tipo !== 'DJ' ? ` (${artistTypeLabel[a.tipo]})` : ''}
              {unavailable.has(a.id)
                ? ` — non disponibile${unavailable.get(a.id) ? ` (${unavailable.get(a.id)})` : ''}`
                : a.genereMusicale
                  ? ` — ${a.genereMusicale}`
                  : ''}
            </option>
          ))}
        </select>
      </label>

      {value.artistIds.length > 0 && (
        <>
          <ul className="lineup-list">
            {value.artistIds.map((id, i) => {
              const slot = preview[i];
              return (
                <li key={id}>
                  <span className="lineup-time">{slot ? formatRange(slot.inizio, slot.fine) : '—'}</span>
                  <span className="grow">
                    {byId.get(id)?.nomeArte ?? '…'}
                    {unavailable.has(id) && <span className="badge badge-danger">non disponibile</span>}
                  </span>
                  <button type="button" className="btn btn-ghost btn-icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Sposta su">
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon"
                    onClick={() => move(i, 1)}
                    disabled={i === value.artistIds.length - 1}
                    aria-label="Sposta giù"
                  >
                    ↓
                  </button>
                  <button type="button" className="btn btn-danger-ghost btn-icon" onClick={() => remove(id)} aria-label="Rimuovi">
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="muted small">
            La serata viene divisa in parti uguali tra i DJ, nell'ordine indicato. Gli slot sono subito confermati;
            puoi rifinire gli orari dal dettaglio della serata.
          </div>
        </>
      )}
    </div>
  );
}
