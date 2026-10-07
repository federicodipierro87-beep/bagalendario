import { useCallback, useMemo, useState } from 'react';
import type { EventInput, EventSourceFuncArg } from '@fullcalendar/core';
import { useAuth } from '../auth/AuthContext';
import { IcalLink } from '../components/IcalLink';
import { NightCalendar } from '../components/NightCalendar';
import { PerformanceStatusBadge } from '../components/StatusBadge';
import { api, errorMessage } from '../lib/api';
import { performanceStatusColor } from '../lib/labels';
import { formatDateOnly, formatRange } from '../lib/time';
import type { Artist, Performance } from '../lib/types';
import { useAsync } from '../lib/useAsync';

type Tab = 'prossime' | 'calendario' | 'passate';

export function MyDatesPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('prossime');

  // Tutti gli slot dell'artista: il backend filtra automaticamente per l'utente ARTIST.
  const { data, error } = useAsync(() =>
    api
      .get<{ performances: Performance[] }>('/performances')
      .then((r) => ({ performances: r.performances, loadedAt: Date.now() })),
  );

  const groups = useMemo(() => {
    const now = data?.loadedAt ?? 0;
    const isPast = (p: Performance) => new Date(p.fine).getTime() < now;
    const all = data?.performances ?? [];
    const future = all.filter((p) => !isPast(p));
    return {
      prossime: future.filter((p) => p.stato === 'CONFERMATO'),
      passate: all.filter(isPast).reverse(),
    };
  }, [data]);

  if (!user?.artistId) {
    return (
      <div className="page narrow">
        <h1>Le mie date</h1>
        <div className="alert alert-error">Il tuo utente non è collegato a un profilo artista. Contatta lo staff.</div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Le mie date</h1>
      <div className="segmented">
        <button className={tab === 'prossime' ? 'active' : ''} onClick={() => setTab('prossime')}>
          Prossime
        </button>
        <button className={tab === 'calendario' ? 'active' : ''} onClick={() => setTab('calendario')}>
          Calendario
        </button>
        <button className={tab === 'passate' ? 'active' : ''} onClick={() => setTab('passate')}>
          Passate
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {!data && !error && <div className="muted">Caricamento…</div>}

      {data && tab === 'calendario' && (
        <>
          <MyCalendar />
          <MyIcalCard />
        </>
      )}

      {data && tab !== 'calendario' && (
        <SlotList
          slots={groups[tab]}
          emptyText={tab === 'prossime' ? 'Nessuna data in programma.' : 'Nessuna data passata.'}
        />
      )}
    </div>
  );
}

function SlotList({ slots, emptyText }: { slots: Performance[]; emptyText: string }) {
  if (slots.length === 0) return <div className="card empty">{emptyText}</div>;
  return (
    <ul className="card list slot-list">
      {slots.map((p) => (
        <li key={p.id}>
          <div className="grow">
            <strong>{[p.venue.nome, p.event.titolo].filter(Boolean).join(' · ')}</strong>
            <div className="muted">
              {formatDateOnly(p.event.data)} · {formatRange(p.inizio, p.fine)}
            </div>
            {p.compenso && (
              <div className="small">Compenso: € {Number(p.compenso).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
            )}
            {p.note && <div className="small muted pre">{p.note}</div>}
          </div>
          <PerformanceStatusBadge stato={p.stato} />
        </li>
      ))}
    </ul>
  );
}

/** Calendario personale dell'artista con le sue date confermate. */
function MyCalendar() {
  const [error, setError] = useState<string | null>(null);
  const loadEvents = useCallback(async (info: EventSourceFuncArg): Promise<EventInput[]> => {
    try {
      const r = await api.get<{ performances: Performance[] }>('/performances', { from: info.startStr, to: info.endStr });
      setError(null);
      return r.performances
        .filter((p) => p.stato === 'CONFERMATO')
        .map((p) => ({
          id: p.id,
          title: p.venue.nome,
          start: p.inizio,
          end: p.fine,
          backgroundColor: performanceStatusColor[p.stato].bg,
          borderColor: performanceStatusColor[p.stato].bg,
          textColor: performanceStatusColor[p.stato].fg,
        }));
    } catch (err) {
      setError(errorMessage(err));
      return [];
    }
  }, []);
  const eventSources = useMemo(() => [{ events: loadEvents }], [loadEvents]);

  return (
    <>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="card calendar-card">
        <NightCalendar
          eventSources={eventSources}
          headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
          initialView="dayGridMonth"
        />
      </div>
    </>
  );
}

function MyIcalCard() {
  const { data, error } = useAsync(() => api.get<{ artist: Artist }>('/me/artist').then((r) => r.artist));
  return (
    <section className="card">
      <h2>Sincronizza con il tuo calendario</h2>
      <p className="muted">Aggiungi le tue date a Google Calendar, Apple Calendar o Outlook: si aggiornano da sole.</p>
      {error && <div className="alert alert-error">{error}</div>}
      {data && <IcalLink token={data.icalToken} regeneratePath="/me/ical-token" />}
    </section>
  );
}
