import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Modal } from '../components/Modal';
import { api, errorMessage } from '../lib/api';
import { artistTypeLabel, ROLES, roleLabel } from '../lib/labels';
import type { Artist, Role, User } from '../lib/types';
import { useAsync } from '../lib/useAsync';

export function UsersPage() {
  const { user: me } = useAuth();
  const { data, error, reload } = useAsync(() =>
    Promise.all([api.get<{ users: User[] }>('/users'), api.get<{ artists: Artist[] }>('/artists')]).then(
      ([u, a]) => ({ users: u.users, artists: a.artists }),
    ),
  );
  const [modal, setModal] = useState<{ user?: User } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function remove(u: User) {
    if (!confirm(`Eliminare l'utente ${u.email}?`)) return;
    setActionError(null);
    try {
      await api.delete(`/users/${u.id}`);
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Utenti</h1>
        <button className="btn btn-primary" onClick={() => setModal({})}>
          + Nuovo utente
        </button>
      </div>
      <p className="muted">
        Gli utenti con ruolo Artista vanno collegati al proprio profilo artista: vedranno solo le proprie date.
      </p>
      {(error || actionError) && <div className="alert alert-error">{error ?? actionError}</div>}
      {data && (
        <div className="card table-wrap">
          <table className="table table-stack">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Ruolo</th>
                <th>Artista collegato</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.id}>
                  <td className="stack-title"><strong>{u.nome}</strong></td>
                  <td data-label="Email" className="break">{u.email}</td>
                  <td data-label="Ruolo">{roleLabel[u.ruolo]}</td>
                  <td data-label="Artista">{u.artist ? `${u.artist.nomeArte} (${artistTypeLabel[u.artist.tipo]})` : '—'}</td>
                  <td className="nowrap actions">
                    <button className="btn btn-ghost" onClick={() => setModal({ user: u })}>
                      Modifica
                    </button>
                    {u.id !== me?.id && (
                      <button className="btn btn-danger-ghost" onClick={() => remove(u)}>
                        Elimina
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && data && (
        <Modal title={modal.user ? `Modifica ${modal.user.nome}` : 'Nuovo utente'} onClose={() => setModal(null)}>
          <UserForm
            user={modal.user}
            artists={data.artists}
            usedArtistIds={data.users.filter((u) => u.id !== modal.user?.id && u.artistId).map((u) => u.artistId!)}
            onCancel={() => setModal(null)}
            onSaved={() => {
              setModal(null);
              reload();
            }}
          />
        </Modal>
      )}
    </div>
  );
}

interface UserFormProps {
  user?: User;
  artists: Artist[];
  usedArtistIds: string[];
  onSaved: () => void;
  onCancel: () => void;
}

function UserForm({ user, artists, usedArtistIds, onSaved, onCancel }: UserFormProps) {
  const [nome, setNome] = useState(user?.nome ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [ruolo, setRuolo] = useState<Role>(user?.ruolo ?? 'ARTIST');
  const [artistId, setArtistId] = useState(user?.artistId ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const available = artists.filter((a) => !usedArtistIds.includes(a.id));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = {
        nome,
        email,
        ruolo,
        artistId: artistId || null,
        ...(password ? { password } : {}),
      };
      if (user) await api.patch(`/users/${user.id}`, body);
      else await api.post('/users', body);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      <div className="form-row">
        <label>
          Nome
          <input value={nome} onChange={(e) => setNome(e.target.value)} required />
        </label>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
      </div>
      <div className="form-row">
        <label>
          Ruolo
          <select value={ruolo} onChange={(e) => setRuolo(e.target.value as Role)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {roleLabel[r]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Profilo artista
          <select value={artistId} onChange={(e) => setArtistId(e.target.value)} required={ruolo === 'ARTIST'}>
            <option value="">— Nessuno —</option>
            {available.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nomeArte} ({artistTypeLabel[a.tipo]})
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        {user ? 'Nuova password (lascia vuoto per non cambiarla)' : 'Password iniziale (min. 8 caratteri)'}
        <input
          type="text"
          autoComplete="new-password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required={!user}
        />
      </label>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Annulla
        </button>
        <button className="btn btn-primary" disabled={busy}>
          Salva
        </button>
      </div>
    </form>
  );
}
