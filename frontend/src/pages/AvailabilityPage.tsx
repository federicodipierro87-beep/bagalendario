import { useMemo, useState } from 'react';
import { DateTime } from 'luxon';
import { api } from '../lib/api';
import { ARTIST_TYPES, artistTypeLabel } from '../lib/labels';
import { TIMEZONE } from '../lib/time';
import type { Artist, ArtistType, Availability } from '../lib/types';
import { useAsync } from '../lib/useAsync';

/** Vista staff: matrice artisti × giorni del mese con le disponibilità dichiarate. */
export function AvailabilityPage() {
  const [month, setMonth] = useState(() => DateTime.now().setZone(TIMEZONE).startOf('month'));
  const [tipo, setTipo] = useState<ArtistType | ''>('');
  const [soloConDati, setSoloConDati] = useState(false);

  const from = month.toFormat('yyyy-MM-dd');
  const to = month.endOf('month').toFormat('yyyy-MM-dd');

  const { data, error } = useAsync(
    () =>
      Promise.all([
        api.get<{ artists: Artist[] }>('/artists', { attivo: 'true', tipo: tipo || undefined }),
        api.get<{ availabilities: Availability[] }>('/availability', { from, to, tipo: tipo || undefined }),
      ]).then(([a, av]) => ({ artists: a.artists, availabilities: av.availabilities })),
    `${from}|${tipo}`,
  );

  const days = useMemo(
    () => Array.from({ length: month.daysInMonth ?? 30 }, (_, i) => month.plus({ days: i })),
    [month],
  );

  const map = useMemo(() => {
    const m = new Map<string, Availability>();
    for (const a of data?.availabilities ?? []) m.set(`${a.artistId}|${a.data.slice(0, 10)}`, a);
    return m;
  }, [data]);

  const artists = (data?.artists ?? []).filter(
    (a) => !soloConDati || data?.availabilities.some((av) => av.artistId === a.id),
  );

  return (
    <div className="page">
      <h1>Disponibilità artisti</h1>
      <div className="toolbar">
        <div className="segmented">
          <button onClick={() => setMonth((m) => m.minus({ months: 1 }))} aria-label="Mese precedente">
            ‹
          </button>
          <button className="active month-label">{month.setLocale('it').toFormat('LLLL yyyy')}</button>
          <button onClick={() => setMonth((m) => m.plus({ months: 1 }))} aria-label="Mese successivo">
            ›
          </button>
        </div>
        <select className="auto" value={tipo} onChange={(e) => setTipo(e.target.value as ArtistType | '')}>
          <option value="">Tutti i tipi</option>
          {ARTIST_TYPES.map((t) => (
            <option key={t} value={t}>
              {artistTypeLabel[t]}
            </option>
          ))}
        </select>
        <label className="checkbox">
          <input type="checkbox" checked={soloConDati} onChange={(e) => setSoloConDati(e.target.checked)} />
          Solo artisti con indicazioni
        </label>
      </div>
      <div className="legend">
        <span>
          <i style={{ background: '#16a34a' }} /> Disponibile
        </span>
        <span>
          <i style={{ background: '#dc2626' }} /> Non disponibile
        </span>
        <span>
          <i style={{ background: 'var(--surface-2)' }} /> Nessuna indicazione
        </span>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {data && artists.length === 0 && <div className="card empty">Nessun artista da mostrare.</div>}
      {data && artists.length > 0 && (
        <div className="card table-wrap">
          <table className="table availability-grid">
            <thead>
              <tr>
                <th className="sticky-col">Artista</th>
                {days.map((d) => (
                  <th key={d.day} className={d.weekday >= 5 ? 'weekend' : ''}>
                    <div>{d.setLocale('it').toFormat('ccccc')}</div>
                    <div>{d.day}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {artists.map((a) => (
                <tr key={a.id}>
                  <td className="sticky-col nowrap">
                    {a.nomeArte} <span className="badge">{artistTypeLabel[a.tipo]}</span>
                  </td>
                  {days.map((d) => {
                    const av = map.get(`${a.id}|${d.toFormat('yyyy-MM-dd')}`);
                    return (
                      <td
                        key={d.day}
                        className={`av-cell ${av ? (av.disponibile ? 'yes' : 'no') : ''}`}
                        title={av ? `${av.disponibile ? 'Disponibile' : 'Non disponibile'}${av.note ? ` — ${av.note}` : ''}` : ''}
                      >
                        {av ? (av.disponibile ? '✓' : '✕') : ''}
                        {av?.note ? '*' : ''}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
