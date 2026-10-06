import { useState } from 'react';
import { api, apiBaseUrl, errorMessage } from '../lib/api';

interface Props {
  token: string;
  /** Endpoint POST che rigenera il token (restituisce { artist: { icalToken } }). */
  regeneratePath: string;
  onRegenerated?: (token: string) => void;
}

/** Link al feed iCal con copia, apertura in app calendario e rigenerazione del token. */
export function IcalLink({ token: initialToken, regeneratePath, onRegenerated }: Props) {
  const [token, setToken] = useState(initialToken);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const httpsUrl = `${apiBaseUrl}/ical/${token}.ics`;
  const webcalUrl = httpsUrl.replace(/^https?:/, 'webcal:');
  const googleUrl = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(httpsUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Copia non riuscita: seleziona il link e copialo manualmente');
    }
  }

  async function regenerate() {
    if (!confirm('Il link attuale smetterà di funzionare e andrà aggiunto di nuovo nei calendari. Continuare?')) return;
    setError(null);
    try {
      const r = await api.post<{ artist: { icalToken: string } }>(regeneratePath);
      setToken(r.artist.icalToken);
      onRegenerated?.(r.artist.icalToken);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="ical">
      <div className="inline-form">
        <input readOnly value={httpsUrl} onFocus={(e) => e.target.select()} aria-label="Link calendario iCal" />
        <button type="button" className="btn btn-ghost" onClick={copy}>
          {copied ? 'Copiato ✓' : 'Copia'}
        </button>
      </div>
      <div className="ical-actions">
        <a className="btn btn-ghost" href={webcalUrl}>
          Apri in Apple Calendar / Outlook
        </a>
        <a className="btn btn-ghost" href={googleUrl} target="_blank" rel="noreferrer">
          Aggiungi a Google Calendar
        </a>
        <button type="button" className="btn btn-danger-ghost" onClick={regenerate}>
          Rigenera link
        </button>
      </div>
      <p className="muted small">
        Il link è personale: chi lo possiede può vedere le date. Google Calendar aggiorna i calendari in abbonamento
        ogni alcune ore.
      </p>
      {error && <div className="alert alert-error">{error}</div>}
    </div>
  );
}
