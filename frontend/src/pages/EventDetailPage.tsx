import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { EventForm } from '../components/EventForm';
import { Modal } from '../components/Modal';
import { SlotForm } from '../components/SlotForm';
import { EventStatusBadge, PerformanceStatusBadge } from '../components/StatusBadge';
import { api, errorMessage } from '../lib/api';
import { artistTypeLabel, eventName } from '../lib/labels';
import { formatDateOnly, formatRange } from '../lib/time';
import type { EventItem, Performance } from '../lib/types';
import { useAsync } from '../lib/useAsync';

export function EventDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data: event, error, reload } = useAsync(
    () => api.get<{ event: EventItem }>(`/events/${id}`).then((r) => r.event),
    id,
  );
  const [editing, setEditing] = useState(false);
  const [slotModal, setSlotModal] = useState<{ slot?: Performance } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (error && !event) return <div className="page"><div className="alert alert-error">{error}</div></div>;
  if (!event) return <div className="page-loading">Caricamento…</div>;

  async function deleteEvent() {
    if (!event || !confirm(`Eliminare la serata "${eventName(event)}" e tutti i suoi slot?`)) return;
    try {
      await api.delete(`/events/${event.id}`);
      navigate('/serate');
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  async function deleteSlot(p: Performance) {
    if (!confirm(`Eliminare lo slot di ${p.artist.nomeArte}?`)) return;
    try {
      await api.delete(`/performances/${p.id}`);
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  const slots = event.performances ?? [];
  const activeSlots = slots.filter((p) => p.stato === 'CONFERMATO');

  return (
    <div className="page">
      <Link to="/serate" className="back-link">
        ← Serate
      </Link>
      <div className="page-header">
        <div>
          <h1>
            {eventName({ ...event, performances: activeSlots })} <EventStatusBadge stato={event.stato} />
          </h1>
          <div className="muted">
            {formatDateOnly(event.data)} · {formatRange(event.inizio, event.fine)}
            {event.venue && ` · ${event.venue.nome}`}
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={() => setEditing(true)}>
            Modifica
          </button>
          <button className="btn btn-danger-ghost" onClick={deleteEvent}>
            Elimina
          </button>
        </div>
      </div>
      {event.note && <div className="card note">{event.note}</div>}
      {actionError && <div className="alert alert-error">{actionError}</div>}

      <div className="page-header">
        <h2>Slot</h2>
        {event.stato !== 'ANNULLATO' && (
          <button className="btn btn-primary" onClick={() => setSlotModal({})}>
            + Aggiungi slot
          </button>
        )}
      </div>

      {slots.length === 0 ? (
        <div className="card empty">Nessuno slot. Aggiungi gli artisti della serata.</div>
      ) : (
        <div className="card table-wrap">
          <table className="table table-stack">
            <thead>
              <tr>
                <th>Orario</th>
                <th>Artista</th>
                <th>Stato</th>
                <th>Compenso</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {slots.map((p) => (
                <tr key={p.id}>
                  <td className="nowrap" data-label="Orario">{formatRange(p.inizio, p.fine)}</td>
                  <td data-label="Artista">
                    {p.artist.nomeArte} <span className="badge">{artistTypeLabel[p.artist.tipo]}</span>
                    {p.note && <div className="muted small pre">{p.note}</div>}
                  </td>
                  <td data-label="Stato">
                    <PerformanceStatusBadge stato={p.stato} />
                  </td>
                  <td className="nowrap" data-label="Compenso">{p.compenso ? `€ ${Number(p.compenso).toLocaleString('it-IT', { minimumFractionDigits: 2 })}` : '—'}</td>
                  <td className="nowrap actions">
                    <button className="btn btn-ghost" onClick={() => setSlotModal({ slot: p })}>
                      Modifica
                    </button>
                    <button className="btn btn-danger-ghost" onClick={() => deleteSlot(p)}>
                      Elimina
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <Modal title="Modifica serata" onClose={() => setEditing(false)}>
          <EventForm
            event={event}
            onCancel={() => setEditing(false)}
            onSaved={() => {
              setEditing(false);
              reload();
            }}
          />
        </Modal>
      )}
      {slotModal && (
        <Modal title={slotModal.slot ? 'Modifica slot' : 'Nuovo slot'} onClose={() => setSlotModal(null)} wide>
          <SlotForm
            event={event}
            venue={event.venue}
            slot={slotModal.slot}
            onCancel={() => setSlotModal(null)}
            onSaved={() => {
              setSlotModal(null);
              reload();
            }}
          />
        </Modal>
      )}
    </div>
  );
}
