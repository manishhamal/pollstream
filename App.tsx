import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { CreatePollPage } from './pages/CreatePollPage';
import { ExplorePage } from './pages/ExplorePage';
import { PollDetailsPage } from './pages/PollDetailsPage';

// Admin code is split into its own chunk and only downloaded by admins
const AdminPage = lazy(() => import('./pages/AdminPage').then(m => ({ default: m.AdminPage })));

/**
 * UI guard only: non-admins are sent home without confirming the page exists.
 * Real enforcement is in the database (RLS + public.is_admin()).
 */
const RequireAdmin: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAdmin } = useAuth();
  return isAdmin ? children : <Navigate to="/" replace />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/create" element={<CreatePollPage />} />
            <Route path="/poll/:id" element={<PollDetailsPage />} />
            <Route
              path="/admin"
              element={
                <RequireAdmin>
                  <Suspense fallback={<div className="text-center py-20 animate-pulse text-gray-500">Loading…</div>}>
                    <AdminPage />
                  </Suspense>
                </RequireAdmin>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </Router>
    </AuthProvider>
  );
}

export default App;
