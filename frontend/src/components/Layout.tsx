import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { roleLabel } from '../lib/labels';
import type { Role } from '../lib/types';

interface NavItem {
  to: string;
  label: string;
  roles: Role[];
}

const NAV: NavItem[] = [
  { to: '/calendario', label: 'Calendario', roles: ['ADMIN', 'STAFF'] },
  { to: '/serate', label: 'Serate', roles: ['ADMIN', 'STAFF'] },
  { to: '/artisti', label: 'Artisti', roles: ['ADMIN', 'STAFF'] },
  { to: '/locali', label: 'Locali', roles: ['ADMIN', 'STAFF'] },
  { to: '/disponibilita', label: 'Disponibilità', roles: ['ADMIN', 'STAFF'] },
  { to: '/utenti', label: 'Utenti', roles: ['ADMIN'] },
  { to: '/le-mie-date', label: 'Le mie date', roles: ['ARTIST'] },
  { to: '/la-mia-disponibilita', label: 'La mia disponibilità', roles: ['ARTIST'] },
];

export function Layout() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  if (!user) return null;

  const items = NAV.filter((n) => n.roles.includes(user.ruolo));

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand" aria-label="Vai al calendario" onClick={() => setMenuOpen(false)}>
          <img src="/favicon.svg" alt="" width={28} height={28} />
          <span>Bagalendario</span>
        </Link>
        <button
          className="menu-toggle"
          aria-expanded={menuOpen}
          aria-label="Apri menu"
          onClick={() => setMenuOpen((o) => !o)}
        >
          ☰
        </button>
        <nav className={`mainnav ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen(false)}>
          {items.map((n) => (
            <NavLink key={n.to} to={n.to}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="userbox">
          <NavLink to="/profilo" className="username" title={user.email}>
            {user.nome}
            <small>{user.artist ? user.artist.nomeArte : roleLabel[user.ruolo]}</small>
          </NavLink>
          <button className="btn btn-ghost" onClick={logout}>
            Esci
          </button>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
