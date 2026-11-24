const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export interface TimeStatus {
  isClosed: boolean;
  /** e.g. "Ends in 5h", "Ends in 3d", "Ended 2d ago" */
  label: string;
}

const span = (ms: number): string => {
  if (ms < HOUR) return `${Math.max(1, Math.round(ms / MINUTE))}m`;
  if (ms < DAY) return `${Math.round(ms / HOUR)}h`;
  return `${Math.round(ms / DAY)}d`;
};

export const getTimeStatus = (endsAt: string, now: number = Date.now()): TimeStatus => {
  const diff = new Date(endsAt).getTime() - now;
  if (diff > 0) return { isClosed: false, label: `Ends in ${span(diff)}` };

  const ago = -diff;
  if (ago < MINUTE) return { isClosed: true, label: 'Ended just now' };
  if (ago > 30 * DAY) {
    return {
      isClosed: true,
      label: `Ended ${new Date(endsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
    };
  }
  return { isClosed: true, label: `Ended ${span(ago)} ago` };
};

export const formatVotes = (n: number): string => `${n.toLocaleString()} vote${n === 1 ? '' : 's'}`;
