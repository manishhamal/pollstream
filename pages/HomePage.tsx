import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, TrendingUp, BarChart } from 'lucide-react';
import { Poll } from '../types';
import { pollService } from '../services/pollService';
import { PollCard } from '../components/PollCard';

export const HomePage: React.FC = () => {
  const [polls, setPolls] = useState<Poll[]>([]);

  useEffect(() => {
    const fetchData = () => {
      const allPolls = pollService.getPolls();
      setPolls(allPolls);
    };

    fetchData();
    const unsubscribe = pollService.subscribe(fetchData);
    return () => unsubscribe();
  }, []);

  // Simple stats
  const totalVotes = polls.reduce((acc, curr) => acc + curr.totalVotes, 0);

  return (
    <div className="space-y-12">
      {/* Minimal Hero Section */}
      <section className="relative overflow-hidden rounded-3xl glass-panel p-8 sm:p-12 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-8">
        <div className="max-w-xl z-10">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 dark:text-white mb-6 leading-tight tracking-tight">
            Polling, <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-500 to-black dark:from-gray-400 dark:to-white">
              Simplified.
            </span>
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
            Create polls in seconds. Visualize answers in real-time. No clutter, just data.
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

      {/* Featured Section */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
            <TrendingUp className="mr-2" size={24} />
            Trending Now
          </h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {polls.length > 0 ? (
            polls.slice(0, 3).map(poll => (
              <PollCard key={poll.id} poll={poll} compact />
            ))
          ) : (
            <div className="col-span-full py-12 text-center glass-panel rounded-xl text-gray-500">
              No polls yet. Start the conversation!
            </div>
          )}
        </div>
      </section>

       {/* All Polls Section */}
       <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Recent Activity</h2>
          <span className="text-sm font-medium bg-gray-200 dark:bg-gray-800 px-3 py-1 rounded-full text-gray-700 dark:text-gray-300">
             {totalVotes} Votes Cast
          </span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {polls.slice(3).map(poll => (
            <PollCard key={poll.id} poll={poll} compact />
          ))}
        </div>
      </section>
    </div>
  );
};