import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, TrendingUp, BarChart, ArrowRight, Sparkles } from 'lucide-react';
import { Poll } from '../types';
import { pollService } from '../services/pollService';
import { PollCard } from '../components/PollCard';
import { PollListCard } from '../components/PollListCard';

const TRENDING_COUNT = 3;
const NEW_COUNT = 6;

export const HomePage: React.FC = () => {
  const [trending, setTrending] = useState<Poll[]>([]);
  const [fresh, setFresh] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // Two small, bounded queries instead of downloading every poll
    Promise.all([
      pollService.listPolls({ sort: 'popular', pageSize: TRENDING_COUNT }),
      pollService.listPolls({ sort: 'newest', pageSize: NEW_COUNT + TRENDING_COUNT }),
    ])
      .then(([top, newest]) => {
        if (cancelled) return;
        const topIds = new Set(top.polls.map(p => p.id));
        setTrending(top.polls);
        setFresh(newest.polls.filter(p => !topIds.has(p.id)).slice(0, NEW_COUNT));
      })
      .catch(error => console.error('Error fetching polls:', error))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-12">
      {/* Minimal Hero Section */}
      <section className="relative overflow-hidden rounded-3xl glass-panel p-8 sm:p-12 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-8">
        <div className="max-w-xl z-10">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 dark:text-white mb-6 leading-tight tracking-tight">
            Ask <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-500 to-black dark:from-gray-400 dark:to-white">
              The Internet
            </span>
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
            Drop a question, watch the internet respond in real-time.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link to="/create" className="glass-button px-8 py-3 rounded-xl font-bold flex items-center justify-center">
              <PlusCircle className="mr-2" size={20} />
              Create Poll
            </Link>
            <Link to="/explore" className="px-8 py-3 rounded-xl font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all border border-transparent hover:border-gray-200 dark:hover:border-gray-700">
              Explore Feeds
            </Link>
          </div>
        </div>

        {/* Abstract Hero Graphic */}
        <div className="relative w-64 h-64 flex-shrink-0 hidden sm:flex items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-tr from-gray-200 to-gray-400 dark:from-gray-800 dark:to-gray-600 rounded-full opacity-20 blur-3xl animate-pulse"></div>
          <BarChart size={120} className="text-gray-900 dark:text-white opacity-80" strokeWidth={1} />
        </div>
      </section>

      {/* Trending: a few interactive cards you can vote on right here */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
            <TrendingUp className="mr-2" size={24} />
            Trending Now
          </h2>
          <Link to="/explore?tab=popular" className="text-sm font-bold text-gray-700 dark:text-gray-200 hover:underline flex items-center">
            See all <ArrowRight size={14} className="ml-1" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            Array.from({ length: TRENDING_COUNT }, (_, i) => (
              <div key={i} className="glass-panel rounded-2xl h-72 animate-pulse" aria-hidden="true" />
            ))
          ) : trending.length > 0 ? (
            trending.map(poll => <PollCard key={poll.id} poll={poll} compact />)
          ) : (
            <div className="col-span-full py-12 text-center glass-panel rounded-xl text-gray-500 space-y-3">
              <p>No open polls right now. Start the conversation!</p>
              <Link to="/explore?tab=ended" className="text-sm font-bold text-gray-900 dark:text-white underline">
                Browse ended polls
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* New polls: lightweight summaries */}
      {fresh.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
              <Sparkles className="mr-2" size={22} />
              New Polls
            </h2>
            <Link to="/explore" className="text-sm font-bold text-gray-700 dark:text-gray-200 hover:underline flex items-center">
              Explore all <ArrowRight size={14} className="ml-1" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {fresh.map(poll => <PollListCard key={poll.id} poll={poll} />)}
          </div>
        </section>
      )}
    </div>
  );
};
