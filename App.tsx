import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { CreatePollPage } from './pages/CreatePollPage';
import { ExplorePage } from './pages/ExplorePage';
import { PollDetailsPage } from './pages/PollDetailsPage';

function App() {
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/create" element={<CreatePollPage />} />
          <Route path="/poll/:id" element={<PollDetailsPage />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}

export default App;