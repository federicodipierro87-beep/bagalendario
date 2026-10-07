import { forwardRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import type { CalendarOptions } from '@fullcalendar/core';
import itLocale from '@fullcalendar/core/locales/it';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import luxonPlugin from '@fullcalendar/luxon3';
import timeGridPlugin from '@fullcalendar/timegrid';
import { TIMEZONE } from '../lib/time';

/** Su schermi stretti nella vista mese si mostra solo il nome (senza orario) per dargli spazio. */
const isNarrow = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 700px)').matches;

/**
 * FullCalendar per serate e impegni quotidiani:
 * - fuso Europe/Rome indipendente dal browser (plugin luxon);
 * - vista settimana dalle 06:00 alle 06:00 del giorno dopo, così una serata 23:00–05:00
 *   resta in un'unica colonna e gli impegni di giorno restano visibili;
 * - riga "tutto il giorno" per gli appuntamenti senza orario;
 * - nella vista mese gli eventi che finiscono prima delle 09:00 non "sconfinano" nel giorno dopo;
 * - si apre sempre in vista mese; su mobile gli eventi mostrano solo il nome del DJ.
 */
export const NightCalendar = forwardRef<FullCalendar, CalendarOptions>(function NightCalendar(props, ref) {
  return (
    <FullCalendar
      ref={ref}
      plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin, luxonPlugin]}
      timeZone={TIMEZONE}
      locale={itLocale}
      initialView="dayGridMonth"
      displayEventTime={!isNarrow()}
      eventDisplay="block"
      headerToolbar={{
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,listMonth',
      }}
      views={{
        listMonth: { buttonText: 'lista' },
      }}
      slotMinTime="06:00:00"
      slotMaxTime="30:00:00"
      scrollTime="08:00:00"
      nextDayThreshold="09:00:00"
      allDaySlot
      nowIndicator
      height="auto"
      eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
      slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
      dayMaxEvents={4}
      noEventsText="Nessun evento in questo periodo"
      {...props}
    />
  );
});
