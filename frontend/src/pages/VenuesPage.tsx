import { useState, type FormEvent } from 'react';
import { Modal } from '../components/Modal';
import { api, errorMessage } from '../lib/api';
import type { Venue } from '../lib/types';
import { useAsync } from '../lib/useAsync';

export function VenuesPage() {
  const { data, error, loading, reload } = useAsync(() =>
    api.get<{ venues: Venue[] }>('/venues').then((r) => r.venues),
  );
  const [modal, setModal] = useState<{ venue?: Venue } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>) {
    setActionError(null);
    try {
      await action();
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  return (
    <div className="page narrow">
      <div className="page-header">
        <h1>Locali</h1>
        <button className="btn btn-primary" onClick={() => setModal({})}>
          + Nuovo locale
        </button>
      </div>
      <p className="muted">I locali in cui si svolgono le serate: li scegli quando registri una data.</p>

      {(error || actionError) && <div className="alert alert-error">{error ?? actionError}</div>}
      {loading && !data && <div className="muted">Caricamento…</div>}

      {data && data.length === 0 && (
        <div className="card empty">Nessun locale. Aggiungine uno per poter registrare le serate.</div>
      )}
      {data && data.length > 0 && (
        <ul className="card list">
          {data.map((v) => (
            <li key={v.id} className={v.attivo ? '' : 'inactive'}>
              <div className="grow">
                <strong>{v.nome}</strong> {!v.attivo && <span className="badge">disattivato</span>}
                <div className="muted small">
                  {v.indirizzo ?? 'Nessun indirizzo'} · {v._count?.events ?? 0} serate
                </div>
              </div>
              <div className="row-actions">
                <button className="btn btn-ghost" onClick={() => setModal({ venue: v })}>
                  Modifica
                </button>
                <button className="btn btn-ghost" onClick={() => run(() => api.patch(`/venues/${v.id}`, { attivo: !v.attivo }))}>
                  {v.attivo ? 'Disattiva' : 'Riattiva'}
                </button>
                <button
                  className="btn btn-danger-ghost"
                  onClick={() => confirm(`Eliminare il locale "${v.nome}"?`) && run(() => api.delete(`/venues/${v.id}`))}
                >
                  Elimina
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modal && (
        <Modal title={modal.venue ? `Modifica ${modal.venue.nome}` : 'Nuovo locale'} onClose={() => setModal(null)}>
          <VenueForm
            venue={modal.venue}
            onCancel={() => setModal(null)}
            onSaved={() => {
              setModal(null);
              reload();
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function VenueForm({ venue, onSaved, onCancel }: { venue?: Venue; onSaved: () => void; onCancel: () => void }) {
  const [nome, setNome] = useState(venue?.nome ?? '');
  const [indirizzo, setIndirizzo] = useState(venue?.indirizzo ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = { nome, indirizzo: indirizzo || null };
      if (venue) await api.patch(`/venues/${venue.id}`, body);
      else await api.post('/venues', body);
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
        Nome del locale
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="es. Club Centrale" required />
      </label>
      <label>
        Indirizzo (facoltativo)
        <input value={indirizzo} onChange={(e) => setIndirizzo(e.target.value)} placeholder="es. Via Roma 1, Milano" />
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
