import { supabase } from './supabase';
import { Poll, CreatePollData, PollOption } from '../types';

export const pollService = {
  async getPolls(): Promise<Poll[]> {
    const { data: polls, error } = await supabase
      .from('polls')
      .select(`
        *,
        options (
          id,
          text,
          vote_count
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return polls.map((poll: any) => ({
      id: poll.id,
      question: poll.question,
      options: poll.options.map((opt: any) => ({
        id: opt.id,
        text: opt.text,
        votes: opt.vote_count,
        color: '#3B82F6' // Default color, can be enhanced later
      })),
      createdAt: poll.created_at,
      endsAt: new Date(new Date(poll.created_at).getTime() + 24 * 60 * 60 * 1000).toISOString(), // Default 24h duration for now
      category: 'General', // Default category
      totalVotes: poll.options.reduce((acc: number, curr: any) => acc + curr.vote_count, 0),
      createdBy: poll.creator_id
    }));
  },

  async getPollById(id: string): Promise<Poll | null> {
    const { data: poll, error } = await supabase
      .from('polls_with_creator')
      .select(`
        *,
        options (
          id,
          text,
          vote_count
        )
      `)
      .eq('id', id)
      .single();

    if (error) return null;

    return {
      id: poll.id,
      question: poll.question,
      options: poll.options.map((opt: any) => ({
        id: opt.id,
        text: opt.text,
        votes: opt.vote_count,
        color: '#3B82F6'
      })),
      createdAt: poll.created_at,
      endsAt: new Date(new Date(poll.created_at).getTime() + 24 * 60 * 60 * 1000).toISOString(),
      category: 'General',
      totalVotes: poll.options.reduce((acc: number, curr: any) => acc + curr.vote_count, 0),
      createdBy: poll.creator_email || poll.creator_id
    };
  },

  async createPoll(pollData: CreatePollData): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User must be logged in to create a poll');

    // 1. Create Poll
    const { data: poll, error: pollError } = await supabase
      .from('polls')
      .insert({
        question: pollData.question,
        creator_id: user.id,
        is_public: true
      })
      .select()
      .single();

    if (pollError) throw pollError;

    // 2. Create Options
    const optionsToInsert = pollData.options.map(optText => ({
      poll_id: poll.id,
      text: optText,
      vote_count: 0
    }));

    const { error: optionsError } = await supabase
      .from('options')
      .insert(optionsToInsert);

    if (optionsError) throw optionsError;

    return poll.id;
  },

  async vote(pollId: string, optionId: string): Promise<void> {
    console.log('pollService.vote called:', { pollId, optionId });

    // Check if user has voted before
    const previousVote = this.hasVoted(pollId);
    const canRevote = this.canRevote(pollId);

    if (previousVote && !canRevote) {
      throw new Error('You have already voted on this poll. Revoting is only allowed within 1 minute.');
    }

    // If revoting to the same option, just update the timestamp (no database call needed)
    if (previousVote && previousVote === optionId && canRevote) {
      // Just update the timestamp in localStorage to reset the 1-minute timer
      const votes = JSON.parse(localStorage.getItem('pollstream_votes') || '{}');
      votes[pollId] = {
        optionId: optionId,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem('pollstream_votes', JSON.stringify(votes));
      console.log('Vote timestamp updated (same option)');
      return;
    }

    // If revoting to a different option, we need to decrement the old option and increment the new one
    if (previousVote && previousVote !== optionId && canRevote) {
      // Call RPC to handle revote (decrement old, increment new)
      console.log('Calling revote RPC:', { pollId, previousVote, optionId });
      const { data, error } = await supabase.rpc('revote', {
        p_poll_id: pollId,
        p_old_option_id: previousVote,
        p_new_option_id: optionId
      });

      if (error) {
        console.error('Revote RPC error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        // Provide more helpful error message
        if (error.message?.includes('Could not find the function')) {
          throw new Error('Revote function not found in database. Please run revote_function.sql in your Supabase SQL editor.');
        }
        throw error;
      }
      console.log('Revote RPC successful:', data);
    } else {
      // First time voting - use normal record_vote
      const { error: voteError } = await supabase
        .rpc('record_vote', {
          p_poll_id: pollId,
          p_option_id: optionId
        });

      console.log('RPC record_vote result:', { error: voteError });

      if (voteError) {
        console.error('Vote RPC error:', voteError);
        throw voteError;
      }
    }

    // Save vote locally with timestamp
    const votes = JSON.parse(localStorage.getItem('pollstream_votes') || '{}');
    votes[pollId] = {
      optionId: optionId,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('pollstream_votes', JSON.stringify(votes));
    console.log('Vote saved locally with timestamp');
  },

  hasVoted(pollId: string): string | null {
    const votes = JSON.parse(localStorage.getItem('pollstream_votes') || '{}');
    return votes[pollId]?.optionId || null;
  },

  canRevote(pollId: string): boolean {
    const votes = JSON.parse(localStorage.getItem('pollstream_votes') || '{}');
    const voteData = votes[pollId];

    if (!voteData || !voteData.timestamp) return false;

    const voteTime = new Date(voteData.timestamp).getTime();
    const now = Date.now();
    const oneMinute = 60 * 1000; // 60 seconds in milliseconds

    return (now - voteTime) < oneMinute;
  },

  getTimeUntilRevoteExpires(pollId: string): number {
    const votes = JSON.parse(localStorage.getItem('pollstream_votes') || '{}');
    const voteData = votes[pollId];

    if (!voteData || !voteData.timestamp) return 0;

    const voteTime = new Date(voteData.timestamp).getTime();
    const now = Date.now();
    const oneMinute = 60 * 1000;
    const timeLeft = oneMinute - (now - voteTime);

    return Math.max(0, Math.ceil(timeLeft / 1000)); // Return seconds remaining
  },

  async deletePoll(pollId: string): Promise<void> {
    const { error } = await supabase
      .from('polls')
      .delete()
      .eq('id', pollId);

    if (error) throw error;
  }
};