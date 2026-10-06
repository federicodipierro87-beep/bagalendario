import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { DateTime } from 'luxon';
import { EventForm } from '../components/EventForm';
import { Modal } from '../components/Modal';
import { EventStatusBadge } from '../components/StatusBadge';
import { api } from '../lib/api';
import { EVENT_STATUSES, eventName, eventStatusLabel } from '../lib/labels';
import { formatDateOnly, formatRange, TIMEZONE } from '../lib/time';
import type { EventItem, EventStatus } from '../lib/types';
import { useAsync } from '../lib/useAsync';

type Period = 'future' | 'past';

export function EventsPage() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>('future');
  const [stato, setStato] = useState<EventStatus | ''>('');
  const [creating, setCreating] = useState(false);

  const { data, error, loading } = useAsync(() => {
    const startOfToday = DateTime.now().setZone(TIMEZONE).startOf('day').toISO()!;
    return api
      .get<{ events: EventItem[] }>('/events', {
        from: period === 'future' ? startOfToday : undefined,
        to: period === 'past' ? startOfToday : undefined,
        stato: stato || undefined,
      })
      .then((r) => (period === 'past' ? r.events.reverse() : r.events));
  }, `${period}|${stato}`);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Serate</h1>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          + Nuova serata
        </button>
      </div>

      <div className="toolbar">
        <div className="segmented">
          <button className={period === 'future' ? 'active' : ''} onClick={() => setPeriod('future')}>
            Prossime
          </button>
          <button className={period === 'past' ? 'active' : ''} onClick={() => setPeriod('past')}>
            Passate
          </button>
        </div>
        <select value={stato} onChange={(e) => setStato(e.target.value as EventStatus | '')} className="auto">
          <option value="">Tutti gli stati</option>
          {EVENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {eventStatusLabel[s]}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {loading && !data && <div className="muted">Caricamento…</div>}
      {data && data.length === 0 && <div className="card empty">Nessuna serata in questo periodo.</div>}
      {data && data.length > 0 && (
        <ul className="card list">
          {data.map((ev) => (
            <li key={ev.id}>
              <Link to={`/serate/${ev.id}`} className="grow row-link">
                <strong>{eventName(ev)}</strong>
                <span className="muted">
                  {formatDateOnly(ev.data)} · {formatRange(ev.inizio, ev.fine)}
                  {ev.venue && ` · ${ev.venue.nome}`}
                </span>
              </Link>
              <span className="badge">{ev._count?.performances ?? 0} slot</span>
              <EventStatusBadge stato={ev.stato} />
            </li>
          ))}
        </ul>
      )}

      {creating && (
        <Modal title="Nuova serata" onClose={() => setCreating(false)}>
          <EventForm onCancel={() => setCreating(false)} onSaved={(ev) => navigate(`/serate/${ev.id}`)} />
        </Modal>
      )}
    </div>
  );
}
