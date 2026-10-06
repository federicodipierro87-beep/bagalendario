import { useState, type FormEvent } from 'react';
import { IcalLink } from '../components/IcalLink';
import { Modal } from '../components/Modal';
import { api, errorMessage } from '../lib/api';
import { ARTIST_TYPES, artistTypeLabel } from '../lib/labels';
import type { Artist, ArtistType } from '../lib/types';
import { useAsync } from '../lib/useAsync';

export function ArtistsPage() {
  const [tipo, setTipo] = useState<ArtistType | ''>('');
  const [soloAttivi, setSoloAttivi] = useState(true);
  const [q, setQ] = useState('');
  const [modal, setModal] = useState<{ artist?: Artist } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, error, loading, reload } = useAsync(
    () =>
      api
        .get<{ artists: Artist[] }>('/artists', {
          tipo: tipo || undefined,
          attivo: soloAttivi ? 'true' : undefined,
          q: q.trim() || undefined,
        })
        .then((r) => r.artists),
    `${tipo}|${soloAttivi}|${q}`,
  );

  async function remove(a: Artist) {
    if (!confirm(`Eliminare ${a.nomeArte}?`)) return;
    setActionError(null);
    try {
      await api.delete(`/artists/${a.id}`);
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Artisti</h1>
        <button className="btn btn-primary" onClick={() => setModal({})}>
          + Nuovo artista
        </button>
      </div>

      <div className="toolbar">
        <input className="auto" placeholder="Cerca per nome…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="auto" value={tipo} onChange={(e) => setTipo(e.target.value as ArtistType | '')}>
          <option value="">Tutti i tipi</option>
          {ARTIST_TYPES.map((t) => (
            <option key={t} value={t}>
              {artistTypeLabel[t]}
            </option>
          ))}
        </select>
        <label className="checkbox">
          <input type="checkbox" checked={soloAttivi} onChange={(e) => setSoloAttivi(e.target.checked)} />
          Solo attivi
        </label>
      </div>

      {(error || actionError) && <div className="alert alert-error">{error ?? actionError}</div>}
      {loading && !data && <div className="muted">Caricamento…</div>}
      {data && data.length === 0 && <div className="card empty">Nessun artista trovato.</div>}
      {data && data.length > 0 && (
        <div className="card table-wrap">
          <table className="table table-stack">
            <thead>
              <tr>
                <th>Nome d'arte</th>
                <th>Tipo</th>
                <th>Genere</th>
                <th>Contatti</th>
                <th>Account</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map((a) => (
                <tr key={a.id} className={a.attivo ? '' : 'inactive'}>
                  <td className="stack-title">
                    <strong>{a.nomeArte}</strong> {!a.attivo && <span className="badge">disattivato</span>}
                  </td>
                  <td data-label="Tipo">{artistTypeLabel[a.tipo]}</td>
                  <td data-label="Genere">{a.genereMusicale ?? '—'}</td>
                  <td className="small" data-label="Contatti">
                    {a.email && <div>{a.email}</div>}
                    {a.telefono && <div>{a.telefono}</div>}
                    {!a.email && !a.telefono && '—'}
                  </td>
                  <td className="small" data-label="Account">{a.user ? a.user.email : <span className="muted">nessuno</span>}</td>
                  <td className="nowrap actions">
                    <button className="btn btn-ghost" onClick={() => setModal({ artist: a })}>
                      Modifica
                    </button>
                    <button className="btn btn-danger-ghost" onClick={() => remove(a)}>
                      Elimina
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal title={modal.artist ? `Modifica ${modal.artist.nomeArte}` : 'Nuovo artista'} onClose={() => setModal(null)}>
          <ArtistForm
            artist={modal.artist}
            onCancel={() => setModal(null)}
            onSaved={() => {
              setModal(null);
              reload();
            }}
          />
          {modal.artist && (
            <div className="modal-section">
              <h3>Feed calendario (iCal)</h3>
              <IcalLink
                token={modal.artist.icalToken}
                regeneratePath={`/artists/${modal.artist.id}/ical-token`}
                onRegenerated={reload}
              />
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function ArtistForm({ artist, onSaved, onCancel }: { artist?: Artist; onSaved: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    nomeArte: artist?.nomeArte ?? '',
    tipo: artist?.tipo ?? ('DJ' as ArtistType),
    genereMusicale: artist?.genereMusicale ?? '',
    email: artist?.email ?? '',
    telefono: artist?.telefono ?? '',
    note: artist?.note ?? '',
    attivo: artist?.attivo ?? true,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (artist) await api.patch(`/artists/${artist.id}`, form);
      else await api.post('/artists', form);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      <div className="form-row">
        <label>
          Nome d'arte
          <input value={form.nomeArte} onChange={(e) => set('nomeArte', e.target.value)} required />
        </label>
        <label>
          Tipo
          <select value={form.tipo} onChange={(e) => set('tipo', e.target.value as ArtistType)}>
            {ARTIST_TYPES.map((t) => (
              <option key={t} value={t}>
                {artistTypeLabel[t]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Genere musicale
        <input value={form.genereMusicale} onChange={(e) => set('genereMusicale', e.target.value)} />
      </label>
      <div className="form-row">
        <label>
          Email
          <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </label>
        <label>
          Telefono
          <input type="tel" value={form.telefono} onChange={(e) => set('telefono', e.target.value)} />
        </label>
      </div>
      <label>
        Note
        <textarea rows={3} value={form.note} onChange={(e) => set('note', e.target.value)} />
      </label>
      <label className="checkbox">
        <input type="checkbox" checked={form.attivo} onChange={(e) => set('attivo', e.target.checked)} />
        Attivo (può ricevere nuovi slot)
      </label>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Annulla
        </button>
        <button className="btn btn-primary" disabled={busy}>
          Salva
        </button>
      </div>
    </form>
  );
}
