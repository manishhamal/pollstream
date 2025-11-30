import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart2, Clock, CheckCircle2, ArrowRight } from 'lucide-react';
import { Poll } from '../types';
import { pollService } from '../services/pollService';

interface PollCardProps {
  poll: Poll;
  compact?: boolean;
}

export const PollCard: React.FC<PollCardProps> = ({ poll, compact = false }) => {
  const [votedOptionId, setVotedOptionId] = useState<string | null>(pollService.hasVoted(poll.id));
  const [isVoting, setIsVoting] = useState(false);
  const [showResults, setShowResults] = useState(!!votedOptionId);

  const timeLeft = new Date(poll.endsAt).getTime() - Date.now();
  const isExpired = timeLeft <= 0;
  
  const daysLeft = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
  const hoursLeft = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  const handleVote = async (optionId: string) => {
    if (votedOptionId || isExpired) return;
    setIsVoting(true);
    
    // Simulate network delay for "real feel"
    await new Promise(resolve => setTimeout(resolve, 600));
    
    const success = pollService.vote(poll.id, optionId);
    if (success) {
      setVotedOptionId(optionId);
      setShowResults(true);
    }
    setIsVoting(false);
  };

  const totalVotes = poll.totalVotes;
  const maxVotes = Math.max(...poll.options.map(o => o.votes));

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

        {/* Interaction Area */}
        <div className="space-y-3">
          {showResults ? (
            <div className="space-y-4 animate-fade-in">
              {poll.options.map((option) => {
                const pct = getPercentage(option.votes);
                const isWinner = option.votes === maxVotes && totalVotes > 0;
                const isVoted = votedOptionId === option.id;
                
                return (
                  <div key={option.id} className="relative group">
                    <div className="flex justify-between text-sm mb-1">
                      <span className={`font-medium ${isWinner ? 'text-black dark:text-white' : 'text-gray-600 dark:text-gray-400'} flex items-center`}>
                        {option.text}
                        {isVoted && <CheckCircle2 size={14} className="ml-1.5 text-gray-900 dark:text-gray-100" />}
                      </span>
                      <span className="font-bold text-gray-900 dark:text-white">{pct}%</span>
                    </div>
                    <div className="h-2.5 w-full bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ease-out ${
                          isWinner 
                            ? 'bg-black dark:bg-white' 
                            : 'bg-gray-400 dark:bg-gray-600'
                        }`}
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2.5">
              {poll.options.map((option) => (
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
           <div className="flex items-center text-xs text-gray-400">
              <BarChart2 size={12} className="mr-1" /> Live
           </div>
        )}
      </div>
    </div>
  );
};