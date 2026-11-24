import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, Filter, X, Loader2 } from 'lucide-react';
import { Poll } from '../types';
import { pollService, PollSort } from '../services/pollService';
import { PollListCard } from '../components/PollListCard';

const PAGE_SIZE = 12;
const SEARCH_DEBOUNCE_MS = 300;
const REFRESH_AFTER_MS = 60_000;

const TABS: { id: PollSort; label: string }[] = [
  { id: 'newest', label: 'Newest' },
  { id: 'popular', label: 'Popular' },
  { id: 'ending', label: 'Ending soon' },
  { id: 'ended', label: 'Ended' },
];
const CATEGORIES = ['All', 'General', 'Tech', 'Sports', 'Entertainment', 'Politics'];

const isSort = (v: string | null): v is PollSort => TABS.some(t => t.id === v);

const SkeletonCard: React.FC = () => (
  <div className="glass-panel rounded-2xl p-5 h-52 animate-pulse flex flex-col gap-3" aria-hidden="true">
    <div className="flex justify-between">
      <div className="h-5 w-20 rounded-full bg-gray-200 dark:bg-gray-800" />
      <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-800" />
    </div>
    <div className="h-5 w-4/5 rounded bg-gray-200 dark:bg-gray-800" />
    <div className="h-5 w-3/5 rounded bg-gray-200 dark:bg-gray-800" />
    <div className="mt-auto h-1.5 w-full rounded bg-gray-200 dark:bg-gray-800" />
    <div className="h-4 w-1/3 rounded bg-gray-200 dark:bg-gray-800" />
  </div>
);

export const ExplorePage: React.FC = () => {
  // Tab, category and search live in the URL so views are shareable and survive back/forward
  const [params, setParams] = useSearchParams();
  const sort: PollSort = isSort(params.get('tab')) ? (params.get('tab') as PollSort) : 'newest';
  const category = CATEGORIES.includes(params.get('category') ?? '') ? params.get('category')! : 'All';
  const search = params.get('q') ?? '';

  const [searchInput, setSearchInput] = useState(search);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState<'loading' | 'loadingMore' | 'idle' | 'error'>('loading');
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);

  const requestId = useRef(0);
  const lastLoadedAt = useRef(0);

  const updateParam = useCallback((key: string, value: string, defaultValue: string) => {
    setParams(prev => {
      const next = new URLSearchParams(prev);
      if (!value || value === defaultValue) next.delete(key); else next.set(key, value);
      return next;
    }, { replace: key === 'q' }); // don't create a history entry per keystroke
  }, [setParams]);

  // Debounce the search box into the URL
  useEffect(() => {
    if (searchInput === search) return;
    const t = setTimeout(() => updateParam('q', searchInput.trim(), ''), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput, search, updateParam]);

  // Keep the input in sync when the URL changes from elsewhere (back/forward)
  useEffect(() => { setSearchInput(search); }, [search]);

  const load = useCallback(async (targetPage: number, { silent = false } = {}) => {
    const id = ++requestId.current;
    if (!silent) setStatus(targetPage === 0 ? 'loading' : 'loadingMore');
    setLoadMoreFailed(false);
    try {
      const result = await pollService.listPolls({ sort, category, search, page: targetPage, pageSize: PAGE_SIZE });
      if (id !== requestId.current) return; // a newer request superseded this one
      setPolls(prev => {
        if (targetPage === 0) return result.polls;
        const seen = new Set(prev.map(p => p.id)); // ordering can shift between pages (e.g. Popular)
        return [...prev, ...result.polls.filter(p => !seen.has(p.id))];
      });
      setPage(targetPage);
      setHasMore(result.hasMore);
      setStatus('idle');
      if (targetPage === 0) lastLoadedAt.current = Date.now();
    } catch (error) {
      if (id !== requestId.current) return;
      console.error('Error loading polls:', error);
      if (silent) return;
      if (targetPage === 0) {
        setStatus('error');
      } else {
        setStatus('idle');       // keep what's already shown
        setLoadMoreFailed(true);
      }
    }
  }, [sort, category, search]);

  // Reload from page 0 whenever the view changes
  useEffect(() => { load(0); }, [load]);

  // Refresh the first page when the user comes back to the tab after a while
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && page === 0 && Date.now() - lastLoadedAt.current > REFRESH_AFTER_MS) {
        load(0, { silent: true });
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load, page]);

  const isFiltered = !!search || category !== 'All';
  const activeTab = TABS.find(t => t.id === sort)!;

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6 rounded-2xl space-y-5">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Explore Polls</h1>
            <p className="text-gray-500 mt-1">Discover what the world is thinking.</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-black dark:group-focus-within:text-white transition-colors" size={18} />
              <input
                type="search"
                placeholder="Search polls..."
                aria-label="Search polls"
                maxLength={100}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-10 pr-9 py-2.5 w-full sm:w-64 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-black focus:ring-1 focus:ring-black dark:focus:ring-white outline-none transition-all [&::-webkit-search-cancel-button]:hidden"
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput('')}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="relative group">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-black dark:group-focus-within:text-white transition-colors" size={18} />
              <select
                value={category}
                aria-label="Category"
                onChange={(e) => updateParam('category', e.target.value, 'All')}
                className="pl-10 pr-8 py-2.5 w-full sm:w-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-black focus:ring-1 focus:ring-black dark:focus:ring-white outline-none appearance-none cursor-pointer"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c === 'All' ? 'All categories' : c}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div role="tablist" aria-label="Sort polls" className="flex gap-1 overflow-x-auto -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map(tab => {
            const selected = tab.id === sort;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={selected}
                onClick={() => updateParam('tab', tab.id, 'newest')}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${selected
                  ? 'bg-black text-white dark:bg-white dark:text-black'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {status === 'loading' ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : status === 'error' ? (
        <div className="text-center py-16 glass-panel rounded-2xl">
          <p className="text-gray-700 dark:text-gray-200 font-medium mb-4">Couldn't load polls.</p>
          <button onClick={() => load(0)} className="glass-button px-6 py-2.5 rounded-xl font-bold">Try again</button>
        </div>
      ) : polls.length === 0 ? (
        <div className="text-center py-16 text-gray-500 bg-white/50 dark:bg-black/20 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 space-y-4">
          <p>
            {isFiltered
              ? 'No polls match your search.'
              : sort === 'ended' ? 'No polls have ended yet.' : 'No open polls right now.'}
          </p>
          {isFiltered ? (
            <button
              onClick={() => { setSearchInput(''); setParams(sort === 'newest' ? {} : { tab: sort }); }}
              className="text-sm font-bold text-gray-900 dark:text-white underline"
            >
              Clear filters
            </button>
          ) : sort !== 'ended' && (
            <Link to="/create" className="inline-block glass-button px-6 py-2.5 rounded-xl font-bold">Create a poll</Link>
          )}
        </div>
      ) : (
        <>
          <div role="tabpanel" aria-label={activeTab.label} className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {polls.map(poll => <PollListCard key={poll.id} poll={poll} />)}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                onClick={() => load(page + 1)}
                disabled={status === 'loadingMore'}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-gray-200 dark:border-gray-700 font-bold text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60"
              >
                {status === 'loadingMore' && <Loader2 size={16} className="animate-spin" />}
                {status === 'loadingMore' ? 'Loading…' : loadMoreFailed ? 'Couldn’t load — try again' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
