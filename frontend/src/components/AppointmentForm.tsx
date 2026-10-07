import { useState, type FormEvent } from 'react';
import { DateTime } from 'luxon';
import { api, errorMessage } from '../lib/api';
import { formatRange, isoToRomeParts, romeToIso, TIMEZONE, todayRome } from '../lib/time';
import type { Appointment, AppointmentType } from '../lib/types';

/** Campi mostrati per ogni tipo di appuntamento. */
interface TypeConfig {
  titolo: string;
  titoloPlaceholder: string;
  luogo: string;
  luogoPlaceholder: string;
  medico?: boolean;
  contatto?: boolean;
  compenso?: boolean;
  /** Può essere di tutto il giorno (anche su più giorni). */
  tuttoIlGiorno?: boolean;
  orario: [string, string];
}

const CONFIG: Record<AppointmentType, TypeConfig> = {
  MATRIMONIO: {
    titolo: 'Sposi',
    titoloPlaceholder: 'es. Marco e Giulia',
    luogo: 'Location',
    luogoPlaceholder: 'es. Villa Rossi, Bergamo',
    contatto: true,
    compenso: true,
    orario: ['18:00', '02:00'],
  },
  PERSONALE: {
    titolo: 'Cosa',
    titoloPlaceholder: 'es. Cena con amici, palestra, ferie…',
    luogo: 'Luogo',
    luogoPlaceholder: 'facoltativo',
    tuttoIlGiorno: true,
    orario: ['10:00', '11:00'],
  },
  MEDICO: {
    titolo: 'Tipo di visita',
    titoloPlaceholder: 'es. Visita dermatologica, analisi del sangue…',
    luogo: 'Struttura / indirizzo',
    luogoPlaceholder: 'es. Ospedale, studio medico…',
    medico: true,
    orario: ['09:00', '10:00'],
  },
};

interface Props {
  tipo: AppointmentType;
  appointment?: Appointment;
  defaultDate?: string;
  onSaved: () => void;
  onCancel: () => void;
}

/** "yyyy-MM-dd" del giorno prima (la fine di un appuntamento di tutto il giorno è esclusiva). */
const dayBefore = (iso: string) => DateTime.fromISO(iso, { zone: TIMEZONE }).minus({ days: 1 }).toFormat('yyyy-MM-dd');
/** Mezzanotte (Europe/Rome) alla fine del giorno indicato. */
const endOfDayIso = (date: string) =>
  DateTime.fromISO(date, { zone: TIMEZONE }).plus({ days: 1 }).toISO({ suppressMilliseconds: true })!;

/**
 * Form di un appuntamento (matrimonio, impegno personale o medico): i campi dipendono dal tipo.
 * Come per le serate, se l'ora di fine non è successiva a quella di inizio la fine cade il giorno dopo.
 */
export function AppointmentForm({ tipo, appointment, defaultDate, onSaved, onCancel }: Props) {
  const cfg = CONFIG[tipo];
  const start = appointment ? isoToRomeParts(appointment.inizio) : null;
  const end = appointment ? isoToRomeParts(appointment.fine) : null;

  const [titolo, setTitolo] = useState(appointment?.titolo ?? '');
  const [tuttoIlGiorno, setTuttoIlGiorno] = useState(appointment?.tuttoIlGiorno ?? false);
  const [data, setData] = useState(start?.date ?? defaultDate ?? todayRome());
  const [dataFine, setDataFine] = useState(
    appointment?.tuttoIlGiorno ? dayBefore(appointment.fine) : (start?.date ?? defaultDate ?? todayRome()),
  );
  const [oraInizio, setOraInizio] = useState(appointment && !appointment.tuttoIlGiorno ? start!.time : cfg.orario[0]);
  const [oraFine, setOraFine] = useState(appointment && !appointment.tuttoIlGiorno ? end!.time : cfg.orario[1]);
  const [luogo, setLuogo] = useState(appointment?.luogo ?? '');
  const [medico, setMedico] = useState(appointment?.medico ?? '');
  const [contatto, setContatto] = useState(appointment?.contatto ?? '');
  const [compenso, setCompenso] = useState(appointment?.compenso ?? '');
  const [note, setNote] = useState(appointment?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const allDay = !!cfg.tuttoIlGiorno && tuttoIlGiorno;
  // Tutto il giorno: da mezzanotte del primo giorno a mezzanotte del giorno dopo l'ultimo.
  const lastDay = dataFine && dataFine >= data ? dataFine : data;
  const inizio = data ? (allDay ? romeToIso(data, '00:00') : oraInizio ? romeToIso(data, oraInizio) : null) : null;
  const fine = inizio ? (allDay ? endOfDayIso(lastDay) : oraFine ? romeToIso(data, oraFine, inizio) : null) : null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!inizio || !fine) return;
    setBusy(true);
    setError(null);
    try {
      const body = {
        tipo,
        titolo,
        inizio,
        fine,
        tuttoIlGiorno: allDay,
        luogo: luogo || null,
        medico: cfg.medico ? medico || null : null,
        contatto: cfg.contatto ? contatto || null : null,
        compenso: cfg.compenso && compenso !== '' ? compenso : null,
        note: note || null,
      };
      if (appointment) await api.put(`/appointments/${appointment.id}`, body);
      else await api.post('/appointments', body);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!appointment || !confirm(`Eliminare «${appointment.titolo}»?`)) return;
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/appointments/${appointment.id}`);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      <label>
        {cfg.titolo}
        <input
          value={titolo}
          onChange={(e) => setTitolo(e.target.value)}
          placeholder={cfg.titoloPlaceholder}
          maxLength={200}
          required
          autoFocus={!appointment}
        />
      </label>
      {cfg.medico && (
        <label>
          Medico / specialista
          <input value={medico} onChange={(e) => setMedico(e.target.value)} placeholder="facoltativo" maxLength={200} />
        </label>
      )}
      {cfg.tuttoIlGiorno && (
        <label className="checkbox">
          <input type="checkbox" checked={tuttoIlGiorno} onChange={(e) => setTuttoIlGiorno(e.target.checked)} />
          Tutto il giorno
        </label>
      )}
      {allDay ? (
        <div className="form-row-2">
          <label>
            Dal
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
          </label>
          <label>
            Al
            <input type="date" value={lastDay} min={data} onChange={(e) => setDataFine(e.target.value)} required />
          </label>
        </div>
      ) : (
        <>
          <label>
            Data
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
          </label>
          <div className="form-row-2">
            <label>
              Inizio
              <input type="time" value={oraInizio} onChange={(e) => setOraInizio(e.target.value)} required />
            </label>
            <label>
              Fine
              <input type="time" value={oraFine} onChange={(e) => setOraFine(e.target.value)} required />
            </label>
          </div>
          {inizio && fine && <div className="hint">Orario: {formatRange(inizio, fine)}</div>}
        </>
      )}
      <label>
        {cfg.luogo}
        <input value={luogo} onChange={(e) => setLuogo(e.target.value)} placeholder={cfg.luogoPlaceholder} maxLength={300} />
      </label>
      {(cfg.contatto || cfg.compenso) && (
        <div className="form-row-2">
          {cfg.contatto && (
            <label>
              Referente / telefono
              <input value={contatto} onChange={(e) => setContatto(e.target.value)} placeholder="facoltativo" maxLength={200} />
            </label>
          )}
          {cfg.compenso && (
            <label>
              Compenso (€)
              <input inputMode="decimal" value={compenso} onChange={(e) => setCompenso(e.target.value)} placeholder="facoltativo" />
            </label>
          )}
        </div>
      )}
      <label>
        Note
        <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="form-actions">
        {appointment && (
          <button type="button" className="btn btn-danger-ghost" onClick={onDelete} disabled={busy}>
            Elimina
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Annulla
        </button>
        <button className="btn btn-primary" disabled={busy}>
          {appointment ? 'Salva' : 'Crea'}
        </button>
      </div>
    </form>
  );
}
