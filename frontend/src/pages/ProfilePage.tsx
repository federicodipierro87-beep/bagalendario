import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api, errorMessage } from '../lib/api';
import { artistTypeLabel, roleLabel } from '../lib/labels';

export function ProfilePage() {
  const { user } = useAuth();
  const [passwordAttuale, setPasswordAttuale] = useState('');
  const [nuovaPassword, setNuovaPassword] = useState('');
  const [conferma, setConferma] = useState('');
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (nuovaPassword !== conferma) {
      setMessage({ type: 'error', text: 'Le due password non coincidono' });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await api.post('/auth/change-password', { passwordAttuale, nuovaPassword });
      setMessage({ type: 'ok', text: 'Password aggiornata' });
      setPasswordAttuale('');
      setNuovaPassword('');
      setConferma('');
    } catch (err) {
      setMessage({ type: 'error', text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page narrow">
      <h1>Profilo</h1>
      <section className="card">
        <dl className="details">
          <dt>Nome</dt>
          <dd>{user.nome}</dd>
          <dt>Email</dt>
          <dd>{user.email}</dd>
          <dt>Ruolo</dt>
          <dd>{roleLabel[user.ruolo]}</dd>
          {user.artist && (
            <>
              <dt>Profilo artista</dt>
              <dd>
                {user.artist.nomeArte} ({artistTypeLabel[user.artist.tipo]})
              </dd>
            </>
          )}
        </dl>
      </section>

      <section className="card">
        <h2>Cambia password</h2>
        <form className="form" onSubmit={onSubmit}>
          <label>
            Password attuale
            <input
              type="password"
              autoComplete="current-password"
              value={passwordAttuale}
              onChange={(e) => setPasswordAttuale(e.target.value)}
              required
            />
          </label>
          <label>
            Nuova password (min. 8 caratteri)
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={nuovaPassword}
              onChange={(e) => setNuovaPassword(e.target.value)}
              required
            />
          </label>
          <label>
            Conferma nuova password
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={conferma}
              onChange={(e) => setConferma(e.target.value)}
              required
            />
          </label>
          {message && <div className={`alert ${message.type === 'ok' ? 'alert-ok' : 'alert-error'}`}>{message.text}</div>}
          <button className="btn btn-primary" disabled={busy}>
            Aggiorna password
          </button>
        </form>
      </section>
    </div>
  );
}
