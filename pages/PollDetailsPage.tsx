import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Share2, AlertCircle } from 'lucide-react';
import { Poll } from '../types';
import { pollService } from '../services/pollService';
import { PollCard } from '../components/PollCard';
import { PollChart } from '../components/PollChart';

export const PollDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [poll, setPoll] = useState<Poll | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (id) {
        try {
          const data = await pollService.getPollById(id);
          setPoll(data || undefined);
        } catch (error) {
          console.error('Error fetching poll:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchData();
  }, [id]);

  if (loading) return <div className="text-center py-20 animate-pulse text-gray-500">Loading poll data...</div>;

  if (!poll) {
    return (
      <div className="text-center py-20">
        <div className="inline-block p-4 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
          <AlertCircle size={48} className="text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Poll not found</h2>
        <Link to="/" className="text-gray-600 dark:text-gray-400 underline hover:text-black dark:hover:text-white">Return Home</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <Link to="/explore" className="inline-flex items-center text-gray-500 hover:text-black dark:hover:text-white transition-colors">
        <ArrowLeft size={20} className="mr-2" /> Back to Explore
      </Link>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Main Poll Card */}
        <div className="md:col-span-2 animate-slide-up">
          <PollCard poll={poll} />
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          {/* Stats Panel */}
          <div className="glass-panel p-6 rounded-2xl">
            <h3 className="font-bold text-gray-900 dark:text-white mb-6 text-sm uppercase tracking-wider">Analytics</h3>

            <div className="h-48 mb-4">
              <PollChart options={poll.options} totalVotes={poll.totalVotes} type="pie" />
            </div>

            <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Total Votes</span>
                <span className="font-mono font-bold text-gray-900 dark:text-white">{poll.totalVotes}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Leading</span>
                <span className="font-medium text-gray-900 dark:text-white truncate max-w-[120px]">
                  {poll.options.reduce((a, b) => a.votes > b.votes ? a : b).votes > 0
                    ? poll.options.reduce((a, b) => a.votes > b.votes ? a : b).text
                    : '-'}
                </span>
              </div>
            </div>
          </div>

          {/* Metadata Panel */}
          <div className="glass-panel p-6 rounded-2xl">
            <h3 className="font-bold text-gray-900 dark:text-white mb-4 text-sm uppercase tracking-wider">Details</h3>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-gray-400 block text-xs">Category</span>
                <span className="font-medium text-gray-900 dark:text-white">{poll.category}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-xs">Created</span>
                <span className="font-medium text-gray-900 dark:text-white">{new Date(poll.createdAt).toDateString()}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-xs">Creator</span>
                <span className="font-medium text-gray-900 dark:text-white">{poll.createdBy}</span>
              </div>
              <button className="w-full mt-4 flex items-center justify-center gap-2 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300">
                <Share2 size={16} /> Share Poll
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};