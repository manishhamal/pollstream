import { supabase } from './supabase';
import { Poll, CreatePollData } from '../types';

const POLL_SELECT = `
  id, question, category, created_at, ends_at, creator_id,
  creator:profiles!polls_creator_profile_fk ( display_name ),
  options ( id, text, vote_count )
`;

export type PollSort = 'newest' | 'popular' | 'ending' | 'ended';

export interface ListPollsParams {
  sort: PollSort;
  category?: string;   // 'All' or undefined = no filter
  search?: string;
  page?: number;       // 0-based
  pageSize?: number;
}

export interface PollPage {
  polls: Poll[];
  hasMore: boolean;
}

const MAX_SEARCH_LENGTH = 100;

/** Escape LIKE wildcards so user input is matched literally */
const escapeLike = (s: string) => s.replace(/[\\%_]/g, m => `\\${m}`);

const LOCAL_VOTES_KEY = 'pollstream_votes';
const REVOTE_WINDOW_MS = 15 * 1000; // UI hint only; the server (cast_vote) enforces it

export interface VoteTally {
  optionId: string;
  votes: number;
}

const mapPoll = (poll: any): Poll => {
  const options = [...(poll.options ?? [])];
  return {
    id: poll.id,
    question: poll.question,
    options: options.map((opt: any) => ({
      id: opt.id,
      text: opt.text,
      votes: Number(opt.vote_count ?? 0),
      color: '#3B82F6'
    })),
    createdAt: poll.created_at,
    endsAt: poll.ends_at,
    category: poll.category,
    totalVotes: options.reduce((acc: number, o: any) => acc + Number(o.vote_count ?? 0), 0),
    createdBy: poll.creator?.display_name ?? 'Unknown'
  };
};

const readLocalVotes = (): Record<string, { optionId: string; timestamp: string }> => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_VOTES_KEY) || '{}');
  } catch {
    return {};
  }
};

const writeLocalVote = (pollId: string, optionId: string, votedAt: string) => {
  try {
    const votes = readLocalVotes();
    votes[pollId] = { optionId, timestamp: votedAt };
    localStorage.setItem(LOCAL_VOTES_KEY, JSON.stringify(votes));
  } catch {
    /* storage unavailable: the server is the source of truth anyway */
  }
};

/** Voting needs an auth.uid(). Visitors who aren't signed in get an anonymous session on first vote. */
const ensureSession = async (): Promise<string> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) return session.user.id;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) {
    throw new Error('Could not start a voting session. Please try again.');
  }
  return data.user.id;
};

const currentUserId = async (): Promise<string | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
};

export const pollService = {
  /**
   * One page of polls for Explore / Home. Filtering, search, sorting and paging
   * all happen in the database, so the cost per request stays flat as polls grow.
   */
  async listPolls({ sort, category, search, page = 0, pageSize = 12 }: ListPollsParams): Promise<PollPage> {
    const nowIso = new Date().toISOString();
    let query = supabase.from('polls').select(POLL_SELECT);

    if (sort === 'ended') {
      query = query.lte('ends_at', nowIso).order('ends_at', { ascending: false });
    } else {
      query = query.gt('ends_at', nowIso);
      if (sort === 'popular') {
        query = query.order('total_votes', { ascending: false }).order('created_at', { ascending: false });
      } else if (sort === 'ending') {
        query = query.order('ends_at', { ascending: true });
      } else {
        query = query.order('created_at', { ascending: false });
      }
    }
    query = query.order('id', { ascending: true }); // stable tie-breaker for paging

    if (category && category !== 'All') query = query.eq('category', category);

    const term = search?.trim().slice(0, MAX_SEARCH_LENGTH);
    if (term) query = query.ilike('question', `%${escapeLike(term)}%`);

    // Fetch one extra row to know whether another page exists
    const from = page * pageSize;
    const { data, error } = await query.range(from, from + pageSize);
    if (error) throw error;

    const rows = data ?? [];
    return {
      polls: rows.slice(0, pageSize).map(mapPoll),
      hasMore: rows.length > pageSize
    };
  },

  /** Every poll. Only for the admin table; public pages use listPolls(). */
  async getPolls(): Promise<Poll[]> {
    const { data, error } = await supabase
      .from('polls')
      .select(POLL_SELECT)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []).map(mapPoll);
  },

  async getPollById(id: string): Promise<Poll | null> {
    const { data, error } = await supabase
      .from('polls')
      .select(POLL_SELECT)
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return mapPoll(data);
  },

  async createPoll(pollData: CreatePollData): Promise<string> {
    const { data, error } = await supabase.rpc('create_poll', {
      p_question: pollData.question,
      p_options: pollData.options,
      p_category: pollData.category,
      p_duration_hours: pollData.durationHours
    });

    if (error) throw new Error(error.message);
    return data as string;
  },

  /** The current user's vote, from the server (RLS: users can only read their own votes). */
  async getUserVote(pollId: string): Promise<string | null> {
    const userId = await currentUserId();
    if (!userId) return null;

    const { data, error } = await supabase
      .from('votes')
      .select('option_id, created_at')
      .eq('poll_id', pollId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching user vote:', error);
      return null;
    }
    if (!data) return null;

    writeLocalVote(pollId, data.option_id, data.created_at);
    return data.option_id;
  },

  /**
   * Cast or change a vote. All rules (one vote per user, poll open,
   * option belongs to poll, 15s revote window) are enforced by cast_vote().
   * Returns the poll's authoritative tallies.
   */
  async vote(pollId: string, optionId: string): Promise<VoteTally[]> {
    await ensureSession();

    const { data, error } = await supabase.rpc('cast_vote', {
      p_poll_id: pollId,
      p_option_id: optionId
    });

    if (error) throw new Error(error.message);

    const rows = (data ?? []) as Array<{
      option_id: string;
      vote_count: number;
      voted_option_id: string;
      voted_at: string;
    }>;

    if (rows[0]) writeLocalVote(pollId, rows[0].voted_option_id, rows[0].voted_at);

    return rows.map(r => ({ optionId: r.option_id, votes: Number(r.vote_count) }));
  },

  /** Synchronous cache of the last known vote, for the first render only. */
  hasVoted(pollId: string): string | null {
    return readLocalVotes()[pollId]?.optionId || null;
  },

  /** UI hint for the revote countdown. The server makes the final decision. */
  canRevote(pollId: string): boolean {
    return this.getTimeUntilRevoteExpires(pollId) > 0;
  },

  getTimeUntilRevoteExpires(pollId: string): number {
    const voteData = readLocalVotes()[pollId];
    if (!voteData?.timestamp) return 0;

    const timeLeft = REVOTE_WINDOW_MS - (Date.now() - new Date(voteData.timestamp).getTime());
    return Math.max(0, Math.ceil(timeLeft / 1000));
  },

  async deletePoll(pollId: string): Promise<void> {
    const { error, count } = await supabase
      .from('polls')
      .delete({ count: 'exact' })
      .eq('id', pollId);

    if (error) throw error;

    if (count === 0) {
      throw new Error('Poll could not be deleted. You may not have admin rights, or your session needs a refresh (sign out and back in).');
    }
  }
};
