import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BarChart2, Clock, CheckCircle2, ArrowRight, RotateCcw } from 'lucide-react';
import { Poll } from '../types';
import { pollService } from '../services/pollService';
import { supabase } from '../services/supabase';

interface PollCardProps {
  poll: Poll;
  compact?: boolean;
  onVote?: () => void;
}

export const PollCard: React.FC<PollCardProps> = ({ poll, compact = false, onVote }) => {
  const [votedOptionId, setVotedOptionId] = useState<string | null>(pollService.hasVoted(poll.id));
  const [isVoting, setIsVoting] = useState(false);
  const [showResults, setShowResults] = useState(!!votedOptionId);
  const [revoteTimeLeft, setRevoteTimeLeft] = useState(0);
  // Preserve original option order to prevent UI swapping
  const [originalOptionOrder, setOriginalOptionOrder] = useState<string[]>(
    poll.options.map(opt => opt.id)
  );

  // Local state for optimistic updates
  const [localOptions, setLocalOptions] = useState(poll.options);
  const [localTotalVotes, setLocalTotalVotes] = useState(poll.totalVotes);

  const timeLeft = new Date(poll.endsAt).getTime() - Date.now();
  const isExpired = timeLeft <= 0;
  const canRevote = pollService.canRevote(poll.id);

  // Sync local state with props when they change
  useEffect(() => {
    setLocalOptions(poll.options);
    setLocalTotalVotes(poll.totalVotes);
  }, [poll]);

  // Preserve original option order when poll is first loaded or when poll ID changes
  useEffect(() => {
    if (poll.options && poll.options.length > 0) {
      setOriginalOptionOrder(poll.options.map(opt => opt.id));
    }
  }, [poll.id]); // Reset order when poll ID changes

  // Fetch user's vote from server on mount
  useEffect(() => {
    const fetchUserVote = async () => {
      try {
        const vote = await pollService.getUserVote(poll.id);
        if (vote) {
          setVotedOptionId(vote);
          setShowResults(true);
        }
      } catch (error) {
        console.error('Error fetching user vote:', error);
      }
    };

    fetchUserVote();
  }, [poll.id]);

  // Realtime subscription for vote updates
  useEffect(() => {
    const channel = supabase
      .channel(`poll-${poll.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'options',
          filter: `poll_id=eq.${poll.id}`
        },
        (payload) => {
          console.log('Realtime update received:', payload);
          const newOption = payload.new as any;

          setLocalOptions(prev => {
            const newOptions = prev.map(opt =>
              opt.id === newOption.id ? { ...opt, votes: newOption.vote_count } : opt
            );

            // Calculate new total from the updated options list
            const newTotal = newOptions.reduce((acc, curr) => acc + curr.votes, 0);
            setLocalTotalVotes(newTotal);

            return newOptions;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [poll.id]);

  // Update revote timer every second
  useEffect(() => {
    if (votedOptionId) {
      const updateTimer = () => {
        const timeRemaining = pollService.getTimeUntilRevoteExpires(poll.id);
        setRevoteTimeLeft(timeRemaining);
      };

      updateTimer();
      const interval = setInterval(updateTimer, 1000);

      return () => clearInterval(interval);
    }
  }, [poll.id, votedOptionId]);

  // Sort options to maintain original order
  const sortedOptions = React.useMemo(() => {
    if (originalOptionOrder.length === 0) return localOptions;

    // Create a map for quick lookup
    const optionMap = new Map(localOptions.map(opt => [opt.id, opt]));

    // Return options in the original order, with updated vote counts
    return originalOptionOrder
      .map(id => optionMap.get(id))
      .filter((opt): opt is typeof localOptions[0] => opt !== undefined)
      .concat(
        // Add any new options that weren't in the original order (shouldn't happen, but safety)
        localOptions.filter(opt => !originalOptionOrder.includes(opt.id))
      );
  }, [localOptions, originalOptionOrder]);

  const daysLeft = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
  const hoursLeft = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  const handleVote = async (optionId: string) => {
    // Allow voting if: not voted yet, or can revote (within 1 minute)
    if (isExpired) return;

    // If already voted and can't revote, don't allow
    if (votedOptionId && !canRevote) return;

    setIsVoting(true);

    console.log('Voting started:', { pollId: poll.id, optionId, isRevote: !!votedOptionId });

    // Optimistic Update
    const isRevote = !!votedOptionId;
    const previousOptionId = votedOptionId;

    setLocalOptions(prev => prev.map(opt => {
      if (opt.id === optionId) {
        return { ...opt, votes: opt.votes + 1 };
      }
      if (isRevote && opt.id === previousOptionId) {
        return { ...opt, votes: Math.max(0, opt.votes - 1) };
      }
      return opt;
    }));

    if (!isRevote) {
      setLocalTotalVotes(prev => prev + 1);
    }

    setVotedOptionId(optionId);
    setShowResults(true);

    try {
      await pollService.vote(poll.id, optionId);
      console.log('Vote successful!');

      // Trigger parent refresh if callback provided
      if (onVote) {
        console.log('Calling onVote callback to refresh poll data');
        await onVote();
      }
    } catch (error) {
      console.error('Vote failed:', error);
      alert('Failed to vote: ' + (error as Error).message);

      // Rollback optimistic update on error
      // (Simplified rollback: just re-sync with props or fetch fresh data)
      if (onVote) onVote();
    } finally {
      setIsVoting(false);
    }
  };


  const totalVotes = localTotalVotes;
  const maxVotes = Math.max(...sortedOptions.map(o => o.votes), 0);

  const getPercentage = (votes: number) => {
    if (totalVotes === 0) return 0;
    return Math.round((votes / totalVotes) * 100);
  };

  const timeString = isExpired
    ? 'Closed'
    : `${daysLeft}d ${hoursLeft}h left`;

  return (
    <div className={`glass-panel rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-lg flex flex-col ${compact ? 'h-full' : ''}`}>
      <div className="p-6 flex-grow">

        {/* Header Metadata */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-black text-white dark:bg-white dark:text-black uppercase tracking-wider">
              {poll.category}
            </span>
            <span className="text-xs text-gray-500 font-medium flex items-center">
              <Clock size={12} className="mr-1" />
              {timeString}
            </span>
          </div>
          {isExpired && (
            <span className="text-xs font-bold text-gray-500 border border-gray-300 dark:border-gray-700 px-2 py-0.5 rounded">
              ENDED
            </span>
          )}
        </div>

        {/* Question */}
        <Link to={`/poll/${poll.id}`} className="group block mb-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white leading-tight group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors">
            {poll.question}
          </h3>
        </Link>

        {/* Revote Timer Banner */}
        {votedOptionId && canRevote && revoteTimeLeft > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <RotateCcw size={16} className="text-blue-600 dark:text-blue-400" />
              <span className="text-blue-700 dark:text-blue-300 font-medium">
                You can change your vote for {revoteTimeLeft}s
              </span>
            </div>
          </div>
        )}

        {/* Interaction Area */}
        <div className="space-y-3">
          {showResults ? (
            <div className="space-y-4 animate-fade-in">
              {sortedOptions.map((option) => {
                const pct = getPercentage(option.votes);
                const isWinner = option.votes === maxVotes && totalVotes > 0;
                const isVoted = votedOptionId === option.id;
                const isClickable = canRevote && !isExpired;

                return (
                  <div
                    key={option.id}
                    className={`relative group ${isClickable ? 'cursor-pointer' : ''}`}
                    onClick={isClickable && !isVoting ? () => handleVote(option.id) : undefined}
                  >
                    <div className="flex justify-between text-sm mb-1">
                      <span className={`font-medium ${isWinner ? 'text-black dark:text-white' : 'text-gray-600 dark:text-gray-400'} flex items-center`}>
                        {option.text}
                        {isVoted && <CheckCircle2 size={14} className="ml-1.5 text-gray-900 dark:text-gray-100" />}
                        {isClickable && !isVoted && (
                          <span className="ml-2 text-xs text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            Click to change
                          </span>
                        )}
                      </span>
                      <span className="font-bold text-gray-900 dark:text-white">{pct}%</span>
                    </div>
                    <div className="h-2.5 w-full bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ease-out ${isWinner
                          ? 'bg-black dark:bg-white'
                          : 'bg-gray-400 dark:bg-gray-600'
                          }`}
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                    {isClickable && (
                      <div className="absolute inset-0 rounded-lg border-2 border-blue-400 dark:border-blue-500 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2.5">
              {sortedOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleVote(option.id)}
                  disabled={isVoting || isExpired}
                  className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-black dark:hover:border-white hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200 group relative overflow-hidden"
                >
                  <span className="relative z-10 font-medium text-gray-700 dark:text-gray-200 group-hover:text-black dark:group-hover:text-white">
                    {option.text}
                  </span>
                  {/* Subtle hover fill effect */}
                  <div className="absolute inset-0 bg-gray-100 dark:bg-gray-700 opacity-0 group-hover:opacity-50 transition-opacity" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30 flex justify-between items-center">
        <div className="text-sm text-gray-500 font-medium">
          {totalVotes.toLocaleString()} votes
        </div>
        {!showResults && !isExpired && (
          <button
            onClick={() => setShowResults(true)}
            className="text-xs font-bold text-gray-900 dark:text-white hover:underline flex items-center"
          >
            View Results <ArrowRight size={12} className="ml-1" />
          </button>
        )}
        {showResults && (
          <div className="flex items-center gap-3">
            {votedOptionId && !canRevote && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Vote locked
              </span>
            )}
            <div className="flex items-center text-xs text-gray-400">
              <BarChart2 size={12} className="mr-1" /> Live
            </div>
          </div>
        )}
      </div>
    </div>
  );
};