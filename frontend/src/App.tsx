import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { RequireAuth } from './auth/RequireAuth';
import { Layout } from './components/Layout';
import { ArtistsPage } from './pages/ArtistsPage';
import { AvailabilityPage } from './pages/AvailabilityPage';
import { CalendarPage } from './pages/CalendarPage';
import { EventDetailPage } from './pages/EventDetailPage';
import { EventsPage } from './pages/EventsPage';
import { LoginPage } from './pages/LoginPage';
import { MyAvailabilityPage } from './pages/MyAvailabilityPage';
import { MyDatesPage } from './pages/MyDatesPage';
import { ProfilePage } from './pages/ProfilePage';
import { UsersPage } from './pages/UsersPage';
import { VenuesPage } from './pages/VenuesPage';

/** Pagina iniziale in base al ruolo. */
function Home() {
  const { user } = useAuth();
  return <Navigate to={user?.ruolo === 'ARTIST' ? '/le-mie-date' : '/calendario'} replace />;
}

const staff = ['ADMIN', 'STAFF'] as const;

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route index element={<Home />} />
            <Route path="profilo" element={<ProfilePage />} />
            <Route path="calendario" element={<RequireAuth roles={[...staff]}><CalendarPage /></RequireAuth>} />
            <Route path="serate" element={<RequireAuth roles={[...staff]}><EventsPage /></RequireAuth>} />
            <Route path="serate/:id" element={<RequireAuth roles={[...staff]}><EventDetailPage /></RequireAuth>} />
            <Route path="artisti" element={<RequireAuth roles={[...staff]}><ArtistsPage /></RequireAuth>} />
            <Route path="locali" element={<RequireAuth roles={[...staff]}><VenuesPage /></RequireAuth>} />
            <Route path="disponibilita" element={<RequireAuth roles={[...staff]}><AvailabilityPage /></RequireAuth>} />
            <Route path="utenti" element={<RequireAuth roles={['ADMIN']}><UsersPage /></RequireAuth>} />
            <Route path="le-mie-date" element={<RequireAuth roles={['ARTIST']}><MyDatesPage /></RequireAuth>} />
            <Route path="la-mia-disponibilita" element={<RequireAuth roles={['ARTIST']}><MyAvailabilityPage /></RequireAuth>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
