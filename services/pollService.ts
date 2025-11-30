import { Poll, CreatePollData, UserVote, PollOption } from '../types';

const STORAGE_KEY_POLLS = 'pollstream_polls';
const STORAGE_KEY_VOTES = 'pollstream_user_votes';
const CHANNEL_NAME = 'pollstream_realtime';

// Monochrome colors for options (Dark Gray / Black)
const DEFAULT_COLOR = '#1f2937'; 

class PollService {
  private channel: BroadcastChannel | null = null;
  private listeners: (() => void)[] = [];

  constructor() {
    try {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.channel.onmessage = () => {
        this.notifyListeners();
      };
    } catch (e) {
      console.warn('BroadcastChannel not supported', e);
    }
    this.initializeData();
  }

  private initializeData() {
    try {
      const existing = localStorage.getItem(STORAGE_KEY_POLLS);
      if (!existing) {
        // Seed data
        const seedPolls: Poll[] = [
          {
            id: 'seed-1',
            question: 'Preferred Design Style?',
            category: 'Tech',
            createdAt: new Date().toISOString(),
            endsAt: new Date(Date.now() + 86400000 * 2).toISOString(),
            totalVotes: 142,
            createdBy: 'DesignerOne',
            options: [
              { id: 'opt-1', text: 'Minimalist', votes: 65, color: '#111827' },
              { id: 'opt-2', text: 'Brutalist', votes: 30, color: '#374151' },
              { id: 'opt-3', text: 'Skeuomorphic', votes: 15, color: '#6b7280' },
              { id: 'opt-4', text: 'Glassmorphism', votes: 32, color: '#9ca3af' },
            ]
          },
          {
            id: 'seed-2',
            question: 'Coffee or Tea?',
            category: 'General',
            createdAt: new Date(Date.now() - 100000).toISOString(),
            endsAt: new Date(Date.now() + 86400000).toISOString(),
            totalVotes: 89,
            createdBy: 'MorningPerson',
            options: [
              { id: 'opt-5', text: 'Black Coffee', votes: 45, color: '#000000' },
              { id: 'opt-6', text: 'Green Tea', votes: 30, color: '#4b5563' },
              { id: 'opt-7', text: 'Espresso', votes: 14, color: '#1f2937' },
            ]
          }
        ];
        localStorage.setItem(STORAGE_KEY_POLLS, JSON.stringify(seedPolls));
      }
    } catch (e) {
      console.error('Failed to initialize poll data', e);
    }
  }

  public subscribe(callback: () => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(cb => cb());
  }

  private broadcastUpdate() {
    if (this.channel) {
      this.channel.postMessage({ type: 'UPDATE' });
    }
    this.notifyListeners();
  }

  public getPolls(): Poll[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY_POLLS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error fetching polls', e);
      return [];
    }
  }

  public getPoll(id: string): Poll | undefined {
    return this.getPolls().find(p => p.id === id);
  }

  public createPoll(data: CreatePollData): string {
    const polls = this.getPolls();
    const newPoll: Poll = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      question: data.question,
      category: data.category as any,
      createdAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + data.durationHours * 3600000).toISOString(),
      totalVotes: 0,
      createdBy: 'You',
      options: data.options.map((text, index) => ({
        id: `opt-${Date.now()}-${index}`,
        text,
        votes: 0,
        color: DEFAULT_COLOR
      }))
    };

    polls.unshift(newPoll);
    try {
      localStorage.setItem(STORAGE_KEY_POLLS, JSON.stringify(polls));
      this.broadcastUpdate();
    } catch (e) {
      console.error('Error creating poll', e);
    }
    return newPoll.id;
  }

  public vote(pollId: string, optionId: string): boolean {
    try {
      // Check if already voted
      const votesStr = localStorage.getItem(STORAGE_KEY_VOTES);
      const votes: UserVote[] = votesStr ? JSON.parse(votesStr) : [];
      
      if (votes.some(v => v.pollId === pollId)) {
        return false; // Already voted
      }

      // Update poll data
      const polls = this.getPolls();
      const pollIndex = polls.findIndex(p => p.id === pollId);
      if (pollIndex === -1) return false;

      const poll = polls[pollIndex];
      const optionIndex = poll.options.findIndex(o => o.id === optionId);
      if (optionIndex === -1) return false;

      poll.options[optionIndex].votes += 1;
      poll.totalVotes += 1;

      // Save vote record
      const newVote: UserVote = {
        pollId,
        optionId,
        timestamp: new Date().toISOString()
      };
      votes.push(newVote);

      localStorage.setItem(STORAGE_KEY_POLLS, JSON.stringify(polls));
      localStorage.setItem(STORAGE_KEY_VOTES, JSON.stringify(votes));
      
      this.broadcastUpdate();
      return true;
    } catch (e) {
      console.error('Error voting', e);
      return false;
    }
  }

  public hasVoted(pollId: string): string | null {
    try {
      const votesStr = localStorage.getItem(STORAGE_KEY_VOTES);
      const votes: UserVote[] = votesStr ? JSON.parse(votesStr) : [];
      const vote = votes.find(v => v.pollId === pollId);
      return vote ? vote.optionId : null;
    } catch (e) {
      return null;
    }
  }
}

export const pollService = new PollService();