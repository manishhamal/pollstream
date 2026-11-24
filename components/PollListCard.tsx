import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock } from 'lucide-react';
import { Poll } from '../types';
import { formatVotes, getTimeStatus } from '../utils/format';

/**
 * Lightweight poll summary for lists (Explore, Home).
 * No realtime subscription, no per-card queries: voting and live results
 * happen on the poll page.
 */
export const PollListCard: React.FC<{ poll: Poll }> = ({ poll }) => {
  const { isClosed, label } = getTimeStatus(poll.endsAt);
  const total = poll.totalVotes;
  const leader = total > 0
    ? poll.options.reduce((best, o) => (o.votes > best.votes ? o : best), poll.options[0])
    : undefined;
  const leaderPct = leader ? Math.round((leader.votes / total) * 100) : 0;

  return (
    <Link
      to={`/poll/${poll.id}`}
      className="glass-panel rounded-2xl p-5 flex flex-col h-full transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white group"
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-black text-white dark:bg-white dark:text-black uppercase tracking-wider">
          {poll.category}
        </span>
        <span className={`text-xs font-medium flex items-center gap-1.5 ${isClosed ? 'text-gray-400' : 'text-gray-600 dark:text-gray-300'}`}>
          {isClosed ? (
            <Clock size={12} />
          ) : (
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          )}
          {label}
        </span>
      </div>

      <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-snug line-clamp-2 mb-4 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors">
        {poll.question}
      </h3>

      <div className="mt-auto">
        {leader ? (
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1.5 gap-3">
              <span className="text-gray-600 dark:text-gray-300 truncate">
                <span className="text-gray-400">{isClosed ? 'Winner' : 'Leading'}:</span>{' '}
                <span className="font-medium text-gray-900 dark:text-white">{leader.text}</span>
              </span>
              <span className="font-bold text-gray-900 dark:text-white">{leaderPct}%</span>
            </div>
            <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-black dark:bg-white" style={{ width: `${leaderPct}%` }} />
            </div>
          </div>
        ) : (
          <p className="mb-4 text-sm text-gray-400">
            {isClosed ? 'No votes were cast' : 'No votes yet — be the first'}
          </p>
        )}

        <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-100 dark:border-gray-800">
          <span>
            {formatVotes(total)} · {poll.options.length} options
          </span>
          <span className="font-bold text-gray-900 dark:text-white flex items-center">
            {isClosed ? 'See results' : 'Vote'} <ArrowRight size={12} className="ml-1 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
};
