import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import type { EventInput, EventSourceFuncArg } from '@fullcalendar/core';
import { EventForm } from '../components/EventForm';
import { Modal } from '../components/Modal';
import { NightCalendar } from '../components/NightCalendar';
import { SlotForm } from '../components/SlotForm';
import { api, errorMessage } from '../lib/api';
import {
  ARTIST_TYPES,
  artistTypeLabel,
  eventName,
  eventStatusColor,
  PERFORMANCE_STATUSES,
  performanceStatusColor,
  performanceStatusLabel,
} from '../lib/labels';
import type { Artist, ArtistType, EventItem, Performance, PerformanceStatus, Venue } from '../lib/types';
import { useAsync } from '../lib/useAsync';

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function CalendarPage() {
  const navigate = useNavigate();
  const lists = useAsync(() =>
    Promise.all([api.get<{ venues: Venue[] }>('/venues'), api.get<{ artists: Artist[] }>('/artists')]).then(
      ([v, a]) => ({ venues: v.venues, artists: a.artists }),
    ),
  );

  const [venueIds, setVenueIds] = useState<string[]>([]);
  const [artistId, setArtistId] = useState('');
  const [stati, setStati] = useState<PerformanceStatus[]>(['CONFERMATO']);
  const [tipi, setTipi] = useState<ArtistType[]>([]);
  const [showEvents, setShowEvents] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilters = venueIds.length + tipi.length + (artistId ? 1 : 0);
  const [error, setError] = useState<string | null>(null);

  const [slotModal, setSlotModal] = useState<Performance | null>(null);
  const [newEventDate, setNewEventDate] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  // Il nome del locale serve nel titolo solo se ce n'è più di uno.
  const multiVenue = (lists.data?.venues.length ?? 0) > 1;

  const loadEvents = useCallback(
    async (info: EventSourceFuncArg): Promise<EventInput[]> => {
      try {
        const [perf, evs] = await Promise.all([
          api.get<{ performances: Performance[] }>('/performances', {
            from: info.startStr,
            to: info.endStr,
            venueId: venueIds,
            artistId: artistId || undefined,
            stato: stati,
            tipo: tipi,
          }),
          showEvents && !artistId
            ? api
                .get<{ events: EventItem[] }>('/events', { from: info.startStr, to: info.endStr })
                .then((r) => ({ events: venueIds.length ? r.events.filter((e) => venueIds.includes(e.venueId)) : r.events }))
            : Promise.resolve({ events: [] as EventItem[] }),
        ]);
        setError(null);
        // Le serate con DJ sono già rappresentate dai loro slot: mostriamo a parte solo quelle ancora senza DJ.
        const serate: EventInput[] = evs.events.filter((ev) => (ev.performances ?? []).length === 0).map((ev) => ({
          id: `event-${ev.id}`,
          title: `★ ${eventName(ev)} — nessun DJ`,
          start: ev.inizio,
          end: ev.fine,
          backgroundColor: 'transparent',
          borderColor: eventStatusColor[ev.stato].bg,
          textColor: 'var(--text)',
          classNames: ['fc-serata', `fc-serata-${ev.stato.toLowerCase()}`],
          extendedProps: { kind: 'event', eventId: ev.id },
        }));
        // Gli slot confermati prendono il colore della serata (bozza/pubblicata);
        // quelli rifiutati o annullati mantengono il colore del proprio stato.
        const slots: EventInput[] = perf.performances.map((p) => {
          const color = p.stato === 'CONFERMATO' ? eventStatusColor[p.event.stato] : performanceStatusColor[p.stato];
          return {
            id: p.id,
            title: multiVenue ? `${p.artist.nomeArte} · ${p.venue.nome}` : p.artist.nomeArte,
            start: p.inizio,
            end: p.fine,
            backgroundColor: color.bg,
            borderColor: color.bg,
            textColor: color.fg,
            extendedProps: { kind: 'slot', performance: p },
          };
        });
        return [...serate, ...slots];
      } catch (err) {
        setError(errorMessage(err));
        return [];
      }
    },
    // version forza il ricaricamento dopo un salvataggio
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [venueIds, artistId, stati, tipi, showEvents, multiVenue, version],
  );

  const eventSources = useMemo(() => [{ events: loadEvents }], [loadEvents]);
  const refresh = () => setVersion((v) => v + 1);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Calendario</h1>
        <button
          className="btn btn-primary"
          onClick={() => setNewEventDate('')}
        >
          + Nuova serata
        </button>
      </div>

      <button className="btn btn-ghost filters-toggle" onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen}>
        {filtersOpen ? 'Nascondi filtri' : `Filtri${activeFilters ? ` (${activeFilters})` : ''}`}
      </button>
      <div className={`card filters ${filtersOpen ? 'open' : ''}`}>
        <div className="filter-group">
          <span className="filter-label">Stato slot</span>
          {PERFORMANCE_STATUSES.map((s) => (
            <button
              key={s}
              className={`chip ${stati.includes(s) ? 'on' : ''}`}
              style={stati.includes(s) ? { background: performanceStatusColor[s].bg, color: performanceStatusColor[s].fg } : undefined}
              onClick={() => setStati(toggle(stati, s))}
            >
              {performanceStatusLabel[s]}
            </button>
          ))}
        </div>
        <div className="filter-group">
          <span className="filter-label">Tipo</span>
          {ARTIST_TYPES.map((t) => (
            <button key={t} className={`chip ${tipi.includes(t) ? 'on' : ''}`} onClick={() => setTipi(toggle(tipi, t))}>
              {artistTypeLabel[t]}
            </button>
          ))}
        </div>
        {lists.data && lists.data.venues.length > 1 && (
          <div className="filter-group">
            <span className="filter-label">Locale</span>
            {lists.data.venues.map((r) => (
              <button
                key={r.id}
                className={`chip ${venueIds.includes(r.id) ? 'on' : ''}`}
                onClick={() => setVenueIds(toggle(venueIds, r.id))}
              >
                {r.nome}
              </button>
            ))}
          </div>
        )}
        <div className="filter-group">
          <span className="filter-label">Artista</span>
          <select className="auto" value={artistId} onChange={(e) => setArtistId(e.target.value)}>
            <option value="">Tutti</option>
            {lists.data?.artists.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nomeArte} ({artistTypeLabel[a.tipo]})
              </option>
            ))}
          </select>
          <label className="checkbox">
            <input type="checkbox" checked={showEvents} onChange={(e) => setShowEvents(e.target.checked)} />
            Mostra serate senza DJ
          </label>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card calendar-card">
        <NightCalendar
          eventSources={eventSources}
          dateClick={(info) => setNewEventDate(info.dateStr.slice(0, 10))}
          eventClick={(info) => {
            const props = info.event.extendedProps as {
              kind: string;
              eventId?: string;
              performance?: Performance;
            };
            if (props.kind === 'event' && props.eventId) navigate(`/serate/${props.eventId}`);
            if (props.kind === 'slot' && props.performance) setSlotModal(props.performance);
          }}
        />
      </div>

      {slotModal && (
        <Modal title="Modifica slot" onClose={() => setSlotModal(null)} wide>
          <SlotForm
            event={slotModal.event}
            slot={slotModal}
            onCancel={() => setSlotModal(null)}
            onSaved={() => {
              setSlotModal(null);
              refresh();
            }}
          />
          <div className="modal-footer-link">
            <button className="btn btn-ghost" onClick={() => navigate(`/serate/${slotModal.eventId}`)}>
              Apri la serata →
            </button>
          </div>
        </Modal>
      )}
      {newEventDate !== null && (
        <Modal title="Nuova serata" onClose={() => setNewEventDate(null)}>
          <EventForm
            defaultDate={newEventDate || undefined}
            onCancel={() => setNewEventDate(null)}
            onSaved={(ev) => navigate(`/serate/${ev.id}`)}
          />
        </Modal>
      )}
    </div>
  );
}
