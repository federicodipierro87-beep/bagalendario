import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import type { EventInput, EventSourceFuncArg } from '@fullcalendar/core';
import { AppointmentForm } from '../components/AppointmentForm';
import { EventForm } from '../components/EventForm';
import { Modal } from '../components/Modal';
import { NightCalendar } from '../components/NightCalendar';
import { SlotForm } from '../components/SlotForm';
import { api, errorMessage } from '../lib/api';
import {
  APPOINTMENT_TYPES,
  ARTIST_TYPES,
  artistTypeLabel,
  CALENDAR_CATEGORIES,
  categoryColor,
  categoryLabel,
  categoryPluralLabel,
  eventName,
  eventStatusColor,
  PERFORMANCE_STATUSES,
  performanceStatusColor,
  performanceStatusLabel,
  type CalendarCategory,
} from '../lib/labels';
import { isoToRomeParts } from '../lib/time';
import type { Appointment, Artist, ArtistType, EventItem, Performance, PerformanceStatus, Venue } from '../lib/types';
import { useAsync } from '../lib/useAsync';

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

const newTitle: Record<CalendarCategory, string> = {
  SERATA: 'Nuova serata',
  MATRIMONIO: 'Nuovo matrimonio',
  PERSONALE: 'Nuovo impegno personale',
  MEDICO: 'Nuovo impegno medico',
};

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
  // Categorie visibili (serate e tipi di appuntamento): i chip fanno anche da legenda dei colori.
  const [categorie, setCategorie] = useState<CalendarCategory[]>(CALENDAR_CATEGORIES);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilters = venueIds.length + tipi.length + (artistId ? 1 : 0);
  const [error, setError] = useState<string | null>(null);

  const [slotModal, setSlotModal] = useState<Performance | null>(null);
  const [appointmentModal, setAppointmentModal] = useState<Appointment | null>(null);
  // Nuovo appuntamento: prima si sceglie il tipo, poi compaiono i campi di quel tipo.
  const [creating, setCreating] = useState<{ date: string; tipo: CalendarCategory | null } | null>(null);
  const [version, setVersion] = useState(0);
  // Il nome del locale serve nel titolo solo se ce n'è più di uno.
  const multiVenue = (lists.data?.venues.length ?? 0) > 1;

  const loadEvents = useCallback(
    async (info: EventSourceFuncArg): Promise<EventInput[]> => {
      try {
        const showSerate = categorie.includes('SERATA');
        const tipiAppuntamento = APPOINTMENT_TYPES.filter((t) => categorie.includes(t));
        const [perf, evs, apps] = await Promise.all([
          showSerate
            ? api.get<{ performances: Performance[] }>('/performances', {
                from: info.startStr,
                to: info.endStr,
                venueId: venueIds,
                artistId: artistId || undefined,
                stato: stati,
                tipo: tipi,
              })
            : Promise.resolve({ performances: [] as Performance[] }),
          showSerate && showEvents && !artistId
            ? api
                .get<{ events: EventItem[] }>('/events', { from: info.startStr, to: info.endStr })
                .then((r) => ({ events: venueIds.length ? r.events.filter((e) => venueIds.includes(e.venueId)) : r.events }))
            : Promise.resolve({ events: [] as EventItem[] }),
          tipiAppuntamento.length
            ? api.get<{ appointments: Appointment[] }>('/appointments', {
                from: info.startStr,
                to: info.endStr,
                tipo: tipiAppuntamento,
              })
            : Promise.resolve({ appointments: [] as Appointment[] }),
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
        // Gli slot confermati prendono il colore della serata (blu, azzurro se bozza);
        // quelli rifiutati o annullati restano blu ma sbiaditi e barrati.
        const slots: EventInput[] = perf.performances.map((p) => {
          const active = p.stato === 'CONFERMATO';
          const color = active ? eventStatusColor[p.event.stato] : categoryColor.SERATA;
          return {
            id: p.id,
            title: multiVenue ? `${p.artist.nomeArte} · ${p.venue.nome}` : p.artist.nomeArte,
            start: p.inizio,
            end: p.fine,
            backgroundColor: color.bg,
            borderColor: color.bg,
            textColor: color.fg,
            classNames: active ? [] : ['fc-slot-inattivo'],
            extendedProps: { kind: 'slot', performance: p },
          };
        });
        // Appuntamenti: colore del tipo; quelli di tutto il giorno vanno nella riga in alto.
        const appuntamenti: EventInput[] = apps.appointments.map((a) => ({
          id: `appointment-${a.id}`,
          title: a.titolo,
          start: a.tuttoIlGiorno ? isoToRomeParts(a.inizio).date : a.inizio,
          end: a.tuttoIlGiorno ? isoToRomeParts(a.fine).date : a.fine,
          allDay: a.tuttoIlGiorno,
          backgroundColor: categoryColor[a.tipo].bg,
          borderColor: categoryColor[a.tipo].bg,
          textColor: categoryColor[a.tipo].fg,
          extendedProps: { kind: 'appointment', appointment: a },
        }));
        return [...appuntamenti, ...serate, ...slots];
      } catch (err) {
        setError(errorMessage(err));
        return [];
      }
    },
    // version forza il ricaricamento dopo un salvataggio
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [venueIds, artistId, stati, tipi, showEvents, categorie, multiVenue, version],
  );

  const eventSources = useMemo(() => [{ events: loadEvents }], [loadEvents]);
  const refresh = () => setVersion((v) => v + 1);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Calendario</h1>
        <button
          className="btn btn-primary"
          onClick={() => setCreating({ date: '', tipo: null })}
        >
          + Nuovo appuntamento
        </button>
      </div>

      <div className="category-bar" role="group" aria-label="Categorie visibili">
        {CALENDAR_CATEGORIES.map((c) => {
          const on = categorie.includes(c);
          return (
            <button
              key={c}
              className={`chip category-chip ${on ? 'on' : ''}`}
              style={on ? { background: categoryColor[c].bg, color: categoryColor[c].fg } : undefined}
              aria-pressed={on}
              onClick={() => setCategorie(toggle(categorie, c))}
            >
              <i style={{ background: categoryColor[c].bg }} />
              {categoryPluralLabel[c]}
            </button>
          );
        })}
      </div>

      <button className="btn btn-ghost filters-toggle" onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen}>
        {filtersOpen ? 'Nascondi filtri' : `Filtri${activeFilters ? ` (${activeFilters})` : ''}`}
      </button>
      <div className={`card filters ${filtersOpen ? 'open' : ''}`}>
        <div className="filter-group">
          <span className="filter-label">Serate · stato slot</span>
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
          <span className="filter-label">Tipo artista</span>
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
          dateClick={(info) => setCreating({ date: info.dateStr.slice(0, 10), tipo: null })}
          eventClick={(info) => {
            const props = info.event.extendedProps as {
              kind: string;
              eventId?: string;
              performance?: Performance;
              appointment?: Appointment;
            };
            if (props.kind === 'event' && props.eventId) navigate(`/serate/${props.eventId}`);
            if (props.kind === 'slot' && props.performance) setSlotModal(props.performance);
            if (props.kind === 'appointment' && props.appointment) setAppointmentModal(props.appointment);
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
      {appointmentModal && (
        <Modal title={categoryLabel[appointmentModal.tipo]} onClose={() => setAppointmentModal(null)}>
          <AppointmentForm
            tipo={appointmentModal.tipo}
            appointment={appointmentModal}
            onCancel={() => setAppointmentModal(null)}
            onSaved={() => {
              setAppointmentModal(null);
              refresh();
            }}
          />
        </Modal>
      )}
      {creating && (
        <Modal title={creating.tipo ? newTitle[creating.tipo] : 'Nuovo appuntamento'} onClose={() => setCreating(null)}>
          {!creating.tipo ? (
            <div className="type-picker">
              <p className="muted">Che tipo di appuntamento vuoi aggiungere?</p>
              {CALENDAR_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="type-option"
                  style={{ borderLeftColor: categoryColor[c].bg }}
                  onClick={() => setCreating({ ...creating, tipo: c })}
                >
                  {categoryLabel[c]}
                </button>
              ))}
            </div>
          ) : (
            <>
              <button type="button" className="btn btn-ghost change-type" onClick={() => setCreating({ ...creating, tipo: null })}>
                ← Cambia tipo
              </button>
              {creating.tipo === 'SERATA' ? (
                <EventForm
                  defaultDate={creating.date || undefined}
                  onCancel={() => setCreating(null)}
                  onSaved={(ev) => navigate(`/serate/${ev.id}`)}
                />
              ) : (
                <AppointmentForm
                  key={creating.tipo}
                  tipo={creating.tipo}
                  defaultDate={creating.date || undefined}
                  onCancel={() => setCreating(null)}
                  onSaved={() => {
                    setCreating(null);
                    refresh();
                  }}
                />
              )}
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
