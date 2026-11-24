import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Share2, AlertCircle, Check } from 'lucide-react';
import { Poll } from '../types';
import { pollService } from '../services/pollService';
import { PollCard } from '../components/PollCard';

export const PollDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [poll, setPoll] = useState<Poll | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  // Live vote counts are handled inside PollCard (realtime + server tallies after voting)
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    pollService
      .getPollById(id)
      .then(data => { if (!cancelled) setPoll(data ?? undefined); })
      .catch(error => console.error('Error fetching poll:', error))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  const handleShare = async () => {
    if (!poll) return;
    const url = `${window.location.origin}/poll/${poll.id}`;

    // Native share sheet on phones; copy-link everywhere else
    if (navigator.share) {
      try {
        await navigator.share({ title: poll.question, text: `Vote on: ${poll.question}`, url });
        return;
      } catch (e) {
        if ((e as DOMException)?.name === 'AbortError') return; // user closed the share sheet
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareStatus('copied');
    } catch {
      setShareStatus('failed');
    }
    setTimeout(() => setShareStatus('idle'), 2500);
  };

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

  const isClosed = new Date(poll.endsAt).getTime() <= Date.now();
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

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
          <div className="glass-panel p-6 rounded-2xl">
            <h3 className="font-bold text-gray-900 dark:text-white mb-4 text-sm uppercase tracking-wider">Details</h3>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-gray-400 block text-xs">Category</span>
                <span className="font-medium text-gray-900 dark:text-white">{poll.category}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-xs">Created</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatDate(poll.createdAt)}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-xs">{isClosed ? 'Closed' : 'Closes'}</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatDate(poll.endsAt)}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-xs">Creator</span>
                <span className="font-medium text-gray-900 dark:text-white">{poll.createdBy}</span>
              </div>
              <button
                onClick={handleShare}
                className="w-full mt-4 flex items-center justify-center gap-2 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300"
              >
                {shareStatus === 'copied' ? (
                  <><Check size={16} /> Link copied</>
                ) : (
                  <><Share2 size={16} /> Share Poll</>
                )}
              </button>
              {shareStatus === 'failed' && (
                <p className="text-xs text-gray-500 break-all" role="status">
                  Copy this link: {window.location.origin}/poll/{poll.id}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
