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
      .from('polls')
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
      createdBy: poll.creator_id
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
    // 1. Record the vote
    const { error: voteError } = await supabase
      .from('votes')
      .insert({
        poll_id: pollId,
        option_id: optionId
      });

    if (voteError) throw voteError;

    // 2. Increment the counter (using RPC or simple update if concurrency isn't huge issue yet)
    // For now, we'll just fetch current count and update (not atomic, but simple for MVP)
    // Better approach: Create a Postgres function `increment_vote`

    // Using a simpler approach: RPC call if we had one, or just update.
    // Let's try to update directly.
    const { data: option } = await supabase
      .from('options')
      .select('vote_count')
      .eq('id', optionId)
      .single();

    if (option) {
      await supabase
        .from('options')
        .update({ vote_count: option.vote_count + 1 })
        .eq('id', optionId);
    }

    // Save vote locally
    const votes = JSON.parse(localStorage.getItem('pollstream_votes') || '{}');
    votes[pollId] = optionId;
    localStorage.setItem('pollstream_votes', JSON.stringify(votes));
  },

  hasVoted(pollId: string): string | null {
    const votes = JSON.parse(localStorage.getItem('pollstream_votes') || '{}');
    return votes[pollId] || null;
  }
};