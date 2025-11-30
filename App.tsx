import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { CreatePollPage } from './pages/CreatePollPage';
import { ExplorePage } from './pages/ExplorePage';
import { PollDetailsPage } from './pages/PollDetailsPage';
import { AdminPage } from './pages/AdminPage';

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
            <Route path="/admin" element={<AdminPage />} />
          </Routes>
        </Layout>
      </Router>
    </AuthProvider>
  );
}

export default App;