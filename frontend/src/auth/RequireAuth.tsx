import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import type { Role } from '../lib/types';
import { useAuth } from './AuthContext';

/** Protegge una route: richiede login e, se indicati, uno dei ruoli. */
export function RequireAuth({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="page-loading">Caricamento…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.ruolo)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
