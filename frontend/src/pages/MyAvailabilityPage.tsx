import { useCallback, useMemo, useState } from 'react';
import type { EventInput, EventSourceFuncArg } from '@fullcalendar/core';
import { useAuth } from '../auth/AuthContext';
import { Modal } from '../components/Modal';
import { NightCalendar } from '../components/NightCalendar';
import { api, errorMessage } from '../lib/api';
import { performanceStatusColor } from '../lib/labels';
import { formatDateOnly } from '../lib/time';
import { useSlotsOnDate } from '../lib/useSlotsOnDate';
import { SlotsOnDateWarning } from '../components/SlotsOnDateWarning';
import type { Availability, Performance } from '../lib/types';

const AVAILABLE = '#16a34a';
const UNAVAILABLE = '#dc2626';

/**
 * Calendario personale dell'artista: le sue date + le disponibilità dichiarate.
 * Cliccando su un giorno può segnarsi non disponibile (o disponibile).
 */
export function AvailabilityCalendar() {
  const [editing, setEditing] = useState<{ date: string; current?: Availability } | null>(null);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [byDate, setByDate] = useState<Record<string, Availability>>({});

  const loadEvents = useCallback(
    async (info: EventSourceFuncArg): Promise<EventInput[]> => {
      try {
        const from = info.startStr.slice(0, 10);
        const to = info.endStr.slice(0, 10);
        const [av, perf] = await Promise.all([
          api.get<{ availabilities: Availability[] }>('/me/availability', { from, to }),
          api.get<{ performances: Performance[] }>('/performances', { from: info.startStr, to: info.endStr }),
        ]);
        setError(null);
        setByDate(Object.fromEntries(av.availabilities.map((a) => [a.data.slice(0, 10), a])));
        return [
          ...av.availabilities.map((a) => ({
            id: `av-${a.id}`,
            start: a.data.slice(0, 10),
            allDay: true,
            display: 'background',
            backgroundColor: a.disponibile ? AVAILABLE : UNAVAILABLE,
            title: a.disponibile ? 'Disponibile' : 'Non disponibile',
          })),
          ...perf.performances
            .filter((p) => p.stato === 'CONFERMATO')
            .map((p) => ({
              id: p.id,
              title: p.venue.nome,
              start: p.inizio,
              end: p.fine,
              backgroundColor: performanceStatusColor[p.stato].bg,
              borderColor: performanceStatusColor[p.stato].bg,
              textColor: performanceStatusColor[p.stato].fg,
            })),
        ];
      } catch (err) {
        setError(errorMessage(err));
        return [];
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );
  const eventSources = useMemo(() => [{ events: loadEvents }], [loadEvents]);

  return (
    <>
      <p className="muted">
        Tocca un giorno per segnare un'indisponibilità (o confermare che sei disponibile). Lo staff la vede quando
        ti assegna una data.
      </p>
      <div className="legend">
        <span>
          <i style={{ background: AVAILABLE }} /> Disponibile
        </span>
        <span>
          <i style={{ background: UNAVAILABLE }} /> Non disponibile
        </span>
        <span>
          <i style={{ background: performanceStatusColor.CONFERMATO.bg }} /> In programma
        </span>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="card calendar-card">
        <NightCalendar
          eventSources={eventSources}
          headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
          initialView="dayGridMonth"
          dateClick={(info) => {
            const date = info.dateStr.slice(0, 10);
            setEditing({ date, current: byDate[date] });
          }}
        />
      </div>

      {editing && (
        <AvailabilityModal
          date={editing.date}
          current={editing.current}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setVersion((v) => v + 1);
          }}
        />
      )}
    </>
  );
}

export function MyAvailabilityPage() {
  const { user } = useAuth();
  return (
    <div className="page">
      <h1>La mia disponibilità</h1>
      {user?.artistId ? (
        <AvailabilityCalendar />
      ) : (
        <div className="alert alert-error">Il tuo utente non è collegato a un profilo artista. Contatta lo staff.</div>
      )}
    </div>
  );
}

function AvailabilityModal({
  date,
  current,
  onClose,
  onSaved,
}: {
  date: string;
  current?: Availability;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [note, setNote] = useState(current?.note ?? '');
  const existingSlots = useSlotsOnDate(date);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const save = (disponibile: boolean) =>
    run(() => api.put('/me/availability', { data: date, disponibile, note: note.trim() || null }));

  return (
    <Modal title={formatDateOnly(date)} onClose={onClose}>
      <div className="form">
        {current && (
          <div className={`alert ${current.disponibile ? 'alert-ok' : 'alert-error'}`}>
            Attualmente: {current.disponibile ? 'disponibile' : 'non disponibile'}
          </div>
        )}
        <label>
          Nota (facoltativa)
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="es. fuori città, impegno personale…" />
        </label>
        <SlotsOnDateWarning slots={existingSlots} audience="artist" />
        {error && <div className="alert alert-error">{error}</div>}
        <div className="form-actions">
          {current && (
            <button
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => run(() => api.delete(`/me/availability/${date}`))}
            >
              Rimuovi indicazione
            </button>
          )}
          <button className="btn btn-ghost" disabled={busy} onClick={() => save(true)}>
            Sono disponibile
          </button>
          <button className="btn btn-danger" disabled={busy} onClick={() => save(false)}>
            Segna non disponibile
          </button>
        </div>
      </div>
    </Modal>
  );
}
