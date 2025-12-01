import { supabase } from './supabase';
import { Poll, CreatePollData, PollOption } from '../types';

export const pollService = {
  async getPolls(): Promise<Poll[]> {
    const { data: polls, error } = await supabase
      .from('polls_with_creator')
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
      createdBy: poll.creator_email || poll.creator_id
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

  async getUserVote(pollId: string): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      // If logged in, check the database
      const { data, error } = await supabase
        .from('votes')
        .select('option_id')
        .eq('poll_id', pollId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching user vote:', error);
      }

      if (data) return data.option_id;
    }

    // Fallback to local storage
    const votes = JSON.parse(localStorage.getItem('pollstream_votes') || '{}');
    return votes[pollId]?.optionId || null;
  },

  async vote(pollId: string, optionId: string): Promise<void> {
    console.log('pollService.vote called:', { pollId, optionId });

    // Check if user has voted before (prioritize DB check)
    const previousVote = await this.getUserVote(pollId);
    const canRevote = this.canRevote(pollId); // Note: canRevote still relies on local timestamp for now

    if (previousVote && !canRevote) {
      // If the user voted for the SAME option, we can just return (idempotent)
      if (previousVote === optionId) return;

      throw new Error('You have already voted on this poll. Revoting is only allowed within 15 seconds.');
    }

    // If revoting to the same option, just update the timestamp
    if (previousVote && previousVote === optionId && canRevote) {
      this.updateLocalVoteTimestamp(pollId, optionId);
      console.log('Vote timestamp updated (same option)');
      return;
    }

    // If revoting to a different option
    if (previousVote && previousVote !== optionId) {
      // Call RPC to handle revote
      console.log('Calling revote RPC:', { pollId, previousVote, optionId });
      const { data, error } = await supabase.rpc('revote', {
        p_poll_id: pollId,
        p_old_option_id: previousVote,
        p_new_option_id: optionId
      });

      if (error) {
        console.error('Revote RPC error:', error);
        if (error.message?.includes('Could not find the function')) {
          throw new Error('Revote function not found. Please run fix_vote_logic.sql in Supabase.');
        }
        throw error;
      }
      console.log('Revote RPC successful');
    } else {
      // First time voting
      const { data: { user } } = await supabase.auth.getUser();

      // If logged in, include user_id in the RPC call or insert directly
      // Ideally record_vote should handle user_id, but let's check if it does.
      // The current record_vote doesn't take user_id. We should probably update it or just insert directly.
      // For now, let's use direct insert if logged in to ensure user_id is captured

      if (user) {
        const { error } = await supabase
          .from('votes')
          .insert({
            poll_id: pollId,
            option_id: optionId,
            user_id: user.id
          });

        if (error) {
          // Check for unique constraint violation (code 23505)
          if (error.code === '23505') {
            // This means they actually HAVE voted, but maybe local storage was cleared.
            // We should try to revote instead, or tell them they voted.
            // For simplicity, let's throw a clear error or try to recover.
            throw new Error('You have already voted on this poll.');
          }
          throw error;
        }
      } else {
        // Anonymous vote via RPC
        const { error: voteError } = await supabase
          .rpc('record_vote', {
            p_poll_id: pollId,
            p_option_id: optionId
          });

        if (voteError) throw voteError;
      }
    }

    // Save vote locally with timestamp
    this.updateLocalVoteTimestamp(pollId, optionId);
    console.log('Vote saved locally with timestamp');
  },

  updateLocalVoteTimestamp(pollId: string, optionId: string) {
    const votes = JSON.parse(localStorage.getItem('pollstream_votes') || '{}');
    votes[pollId] = {
      optionId: optionId,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('pollstream_votes', JSON.stringify(votes));
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
    const oneMinute = 15 * 1000; // 15 seconds in milliseconds

    return (now - voteTime) < oneMinute;
  },

  getTimeUntilRevoteExpires(pollId: string): number {
    const votes = JSON.parse(localStorage.getItem('pollstream_votes') || '{}');
    const voteData = votes[pollId];

    if (!voteData || !voteData.timestamp) return 0;

    const voteTime = new Date(voteData.timestamp).getTime();
    const now = Date.now();
    const oneMinute = 15 * 1000;
    const timeLeft = oneMinute - (now - voteTime);

    return Math.max(0, Math.ceil(timeLeft / 1000)); // Return seconds remaining
  },

  async deletePoll(pollId: string): Promise<void> {
    const { error, count } = await supabase
      .from('polls')
      .delete({ count: 'exact' })
      .eq('id', pollId);

    if (error) throw error;

    // If no rows were deleted, it likely means RLS blocked it or poll doesn't exist
    if (count === 0) {
      throw new Error('Poll could not be deleted. This is likely due to missing permissions (RLS policies). Please run the admin_setup.sql script in Supabase.');
    }
  }
};