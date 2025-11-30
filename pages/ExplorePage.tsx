import React, { useEffect, useState } from 'react';
import { Search, Filter } from 'lucide-react';
import { Poll } from '../types';
import { pollService } from '../services/pollService';
import { PollCard } from '../components/PollCard';

export const ExplorePage: React.FC = () => {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [filteredPolls, setFilteredPolls] = useState<Poll[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const allPolls = await pollService.getPolls();
        setPolls(allPolls);
      } catch (error) {
        console.error('Error fetching polls:', error);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    let result = polls;

    if (searchTerm) {
      result = result.filter(p => p.question.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    if (categoryFilter !== 'All') {
      result = result.filter(p => p.category === categoryFilter);
    }

    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    setFilteredPolls(result);
  }, [polls, searchTerm, categoryFilter]);

  const categories = ['All', 'General', 'Tech', 'Sports', 'Entertainment', 'Politics'];

  return (
    <div className="space-y-8">
      <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Explore Polls</h1>
          <p className="text-gray-500 mt-1">Discover what the world is thinking.</p>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-black dark:group-focus-within:text-white transition-colors" size={18} />
            <input
              type="text"
              placeholder="Search polls..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2.5 w-full sm:w-64 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-black focus:ring-1 focus:ring-black dark:focus:ring-white outline-none transition-all"
            />
          </div>

          <div className="relative group">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-black dark:group-focus-within:text-white transition-colors" size={18} />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="pl-10 pr-8 py-2.5 w-full sm:w-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-black focus:ring-1 focus:ring-black dark:focus:ring-white outline-none appearance-none cursor-pointer"
            >
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPolls.map(poll => (
          <PollCard key={poll.id} poll={poll} compact />
        ))}
        {filteredPolls.length === 0 && (
          <div className="col-span-full text-center py-20 text-gray-500 bg-white/50 dark:bg-black/20 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
            No polls found matching your criteria.
          </div>
        )}
      </div>
    </div>
  );
};