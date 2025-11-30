export interface PollOption {
  id: string;
  text: string;
  votes: number;
  color: string;
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  createdAt: string; // ISO string
  endsAt: string; // ISO string
  category: 'General' | 'Tech' | 'Sports' | 'Entertainment' | 'Politics';
  totalVotes: number;
  createdBy: string;
}

export interface UserVote {
  pollId: string;
  optionId: string;
  timestamp: string;
}

export interface CreatePollData {
  question: string;
  options: string[];
  category: string;
  durationHours: number;
}